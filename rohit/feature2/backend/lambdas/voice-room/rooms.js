/**
 * Voice Room CRUD – DynamoDB operations.
 */

const { v4: uuidv4 } = require('uuid');
const { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { VOICE_ROOM_STATUS, VOICE_ROOM_ROLES, MAX_ROOM_PARTICIPANTS } = require('../../utils/constants');
const { generateRtcToken } = require('../../utils/agora');

async function createRoom({ title, description, topics, isPrivate, maxParticipants }, userId, userName) {
  console.log(`[ACTION] User ${userId} (${userName}) creating Voice Room. Params: title="${title}", private=${!!isPrivate}, maxPart=${maxParticipants || 'default'}`);
  const roomId = uuidv4();
  const now = new Date().toISOString();

  const room = {
    roomId,
    title,
    description: description || null,
    topics: topics || [],
    status: VOICE_ROOM_STATUS.ACTIVE,
    isPrivate: isPrivate || false,
    isRecording: false,
    maxParticipants: maxParticipants || MAX_ROOM_PARTICIPANTS,
    creatorId: userId,
    creatorName: userName || 'Unknown',
    participantCount: 1,
    createdAt: now,
    updatedAt: now,
    endedAt: null,
  };

  console.log(`[TRACE] Prepared VoiceRoom object: ${JSON.stringify(room)}`);

  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Item: room,
  }));

  // Add creator as moderator
  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Item: {
      roomId,
      userId,
      userName: userName || 'Unknown',
      role: VOICE_ROOM_ROLES.MODERATOR,
      isMuted: false,
      isBlocked: false,
      joinedAt: now,
      leftAt: null,
    },
  }));

  console.log(`[ACTION] Voice Room ${roomId} created successfully with creator as moderator.`);
  return { ...room, participants: [{ userId, userName: userName || 'Unknown', role: VOICE_ROOM_ROLES.MODERATOR }] };
}

async function listRooms({ page = 1, limit = 10, status = 'active', topic, search }) {
  console.log(`[ACTION] Listing Voice Rooms. Page: ${page}, Status: ${status}, Topic: ${topic}, Search: ${search}`);
  let items = [];
  let lastKey = undefined;

  try {
    // Use Scan instead of Query GSI to debug
    const params = {
      TableName: TABLE_NAMES.VOICE_ROOMS,
    };

    console.log('📤 Attempting DynamoDB Scan with params:', JSON.stringify(params));
    const result = await dynamoDB.send(new ScanCommand(params));
    items = result.Items || [];
    console.log('✅ Scan successful! Got', items.length, 'items');
  } catch (err) {
    console.error('❌ Scan error:', err.message, err.code);
    throw err;
  }

  // Client-side filtering for topic and search (DynamoDB limitations)
  if (topic) {
    items = items.filter(r => r.topics && r.topics.includes(topic));
  }
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(r => r.title.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s));
  }

  console.log(`[TRACE] Filtering complete. Found ${items.length} rooms matching criteria.`);

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return {
    rooms: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getRoomById(roomId) {
  console.log(`[ACTION] Fetching details for Voice Room ID: ${roomId}`);
  const result = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
  }));

  if (!result.Item) return null;

  // Get participants
  const participants = await dynamoDB.send(new QueryCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    KeyConditionExpression: 'roomId = :roomId',
    ExpressionAttributeValues: { ':roomId': roomId },
  }));

  const activeParticipants = (participants.Items || []).filter(p => !p.leftAt && !p.isBlocked);

  return {
    ...result.Item,
    participants: activeParticipants,
  };
}

async function endRoom(roomId, userId) {
  console.log(`[ACTION] User ${userId} attempting to end Voice Room ID: ${roomId}`);
  const room = await getRoomById(roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.status === VOICE_ROOM_STATUS.ENDED) throw new Error('ROOM_ALREADY_ENDED');
  if (room.creatorId !== userId) {
    console.log(`[ACTION] End Room rejected: User ${userId} is not the moderator`);
    throw new Error('NOT_MODERATOR');
  }

  const now = new Date().toISOString();

  // Calculate metrics
  const createdAt = new Date(room.createdAt);
  const endedAt = new Date(now);
  const durationMinutes = Math.floor((endedAt - createdAt) / 60000);

  const metrics = {
    duration: durationMinutes,
    peakParticipants: room.participantCount, // Simplified
    endedAt: now
  };

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET #status = :ended, endedAt = :now, updatedAt = :now, #metrics = :metrics',
    ExpressionAttributeNames: { '#status': 'status', '#metrics': 'metrics' },
    ExpressionAttributeValues: { ':ended': VOICE_ROOM_STATUS.ENDED, ':now': now, ':metrics': metrics },
  }));

  return { roomId, status: VOICE_ROOM_STATUS.ENDED, endedAt: now, metrics };
}

async function getRoomToken(roomId, userId) {
  console.log(`[ACTION] Generating Agora token for room ${roomId}, user ${userId}`);
  const room = await getRoomById(roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  // Find users role
  const participant = room.participants.find(p => p.userId === userId);
  const role = participant ? participant.role : VOICE_ROOM_ROLES.LISTENER;

  const token = generateRtcToken(roomId, userId, role);
  return { roomId, token, role };
}

async function joinRoom(roomId, userId, userName) {
  console.log(`[ACTION] User ${userId} (${userName}) attempting to join Voice Room ID: ${roomId}`);
  const room = await getRoomById(roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.status === VOICE_ROOM_STATUS.ENDED) throw new Error('ROOM_ENDED');

  // Check if blocked
  const existing = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId },
  }));

  if (existing.Item && existing.Item.isBlocked) throw new Error('USER_BLOCKED');

  // Check capacity
  if (room.participantCount >= room.maxParticipants) throw new Error('ROOM_FULL');

  const now = new Date().toISOString();
  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Item: {
      roomId,
      userId,
      userName: userName || 'Unknown',
      role: VOICE_ROOM_ROLES.LISTENER,
      isMuted: true,
      isBlocked: false,
      joinedAt: now,
    },
  }));

  // Increment participant count
  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET participantCount = participantCount + :one, updatedAt = :now',
    ExpressionAttributeValues: { ':one': 1, ':now': now },
  }));

  return { roomId, userId, role: VOICE_ROOM_ROLES.LISTENER };
}

async function leaveRoom(roomId, userId) {
  console.log(`[ACTION] User ${userId} leaving Voice Room ID: ${roomId}`);
  const now = new Date().toISOString();

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId },
    UpdateExpression: 'SET leftAt = :now',
    ExpressionAttributeValues: { ':now': now },
  }));

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET participantCount = participantCount - :one, updatedAt = :now',
    ExpressionAttributeValues: { ':one': 1, ':now': now },
  }));

  // Check if room is empty — auto-end
  const room = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
  }));

  if (room.Item && room.Item.participantCount <= 0) {
    await dynamoDB.send(new UpdateCommand({
      TableName: TABLE_NAMES.VOICE_ROOMS,
      Key: { roomId },
      UpdateExpression: 'SET #status = :ended, endedAt = :now, updatedAt = :now, participantCount = :zero',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':ended': VOICE_ROOM_STATUS.ENDED, ':now': now, ':zero': 0 },
    }));
  }

  return { roomId, userId, leftAt: now };
}

module.exports = { createRoom, listRooms, getRoomById, endRoom, joinRoom, leaveRoom, getRoomToken };
