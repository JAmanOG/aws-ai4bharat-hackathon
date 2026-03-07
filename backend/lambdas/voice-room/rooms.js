/**
 * Voice Room CRUD – DynamoDB operations.
 */

const { v4: uuidv4 } = require('uuid');
const { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { VOICE_ROOM_STATUS, VOICE_ROOM_ROLES, MAX_ROOM_PARTICIPANTS } = require('../../utils/constants');
const { generateRtcToken } = require('../../utils/agora');

/**
 * Create a new voice room and add creator as moderator.
 */
async function createRoom({ title, description, topics, isPrivate, maxParticipants }, userId, userName) {
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

  return {
    ...room,
    participants: [{ userId, userName: userName || 'Unknown', role: VOICE_ROOM_ROLES.MODERATOR }],
  };
}

/**
 * List rooms with optional filtering and pagination.
 */
async function listRooms({ page = 1, limit = 10, status = 'active', topic, search } = {}) {
  const result = await dynamoDB.send(new ScanCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
  }));

  let items = result.Items || [];

  // Filter by status
  if (status) {
    items = items.filter(r => r.status === status);
  }

  // Filter by topic
  if (topic) {
    items = items.filter(r => r.topics && r.topics.includes(topic));
  }

  // Filter by search text
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(r =>
      r.title.toLowerCase().includes(s) ||
      (r.description || '').toLowerCase().includes(s),
    );
  }

  // Sort newest first
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return {
    rooms: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get a single room by ID, including active participants.
 */
async function getRoomById(roomId) {
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

  return { ...result.Item, participants: activeParticipants };
}

/**
 * End a room (moderator only).
 */
async function endRoom(roomId, userId) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.status === VOICE_ROOM_STATUS.ENDED) throw new Error('ROOM_ALREADY_ENDED');
  if (room.creatorId !== userId) throw new Error('NOT_MODERATOR');

  const now = new Date().toISOString();
  const durationMinutes = Math.floor((new Date(now) - new Date(room.createdAt)) / 60000);

  const metrics = { duration: durationMinutes, peakParticipants: room.participantCount, endedAt: now };

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET #status = :ended, endedAt = :now, updatedAt = :now, #metrics = :metrics',
    ExpressionAttributeNames: { '#status': 'status', '#metrics': 'metrics' },
    ExpressionAttributeValues: { ':ended': VOICE_ROOM_STATUS.ENDED, ':now': now, ':metrics': metrics },
  }));

  return { roomId, status: VOICE_ROOM_STATUS.ENDED, endedAt: now, metrics };
}

/**
 * Generate an Agora RTC token for a participant.
 */
async function getRoomToken(roomId, userId) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const participant = (room.participants || []).find(p => p.userId === userId);
  const role = participant ? participant.role : VOICE_ROOM_ROLES.LISTENER;

  const token = generateRtcToken(roomId, userId, role);
  return { roomId, token, role };
}

/**
 * Join an existing room as a listener.
 */
async function joinRoom(roomId, userId, userName) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.status === VOICE_ROOM_STATUS.ENDED) throw new Error('ROOM_ENDED');

  // Check if blocked
  const existing = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId },
  }));
  if (existing.Item && existing.Item.isBlocked) throw new Error('USER_BLOCKED');

  // Already active in the room: keep the existing role and don't double count.
  if (existing.Item && !existing.Item.leftAt) {
    return { roomId, userId, role: existing.Item.role };
  }

  // Check capacity
  if (room.participantCount >= room.maxParticipants) throw new Error('ROOM_FULL');

  const now = new Date().toISOString();
  if (existing.Item && existing.Item.leftAt) {
    await dynamoDB.send(new UpdateCommand({
      TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
      Key: { roomId, userId },
      UpdateExpression: 'SET userName = :userName, leftAt = :leftAt, joinedAt = :joinedAt, isBlocked = :isBlocked',
      ExpressionAttributeValues: {
        ':userName': userName || existing.Item.userName || 'Unknown',
        ':leftAt': null,
        ':joinedAt': now,
        ':isBlocked': false,
      },
    }));
  } else {
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
  }

  // Increment participant count
  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET participantCount = participantCount + :one, updatedAt = :now',
    ExpressionAttributeValues: { ':one': 1, ':now': now },
  }));

  return { roomId, userId, role: existing.Item?.role || VOICE_ROOM_ROLES.LISTENER };
}

/**
 * Leave a room. Auto-ends if room becomes empty.
 */
async function leaveRoom(roomId, userId) {
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

  // Auto-end if empty
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
