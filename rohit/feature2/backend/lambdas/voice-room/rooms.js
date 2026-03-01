/**
 * Voice Room CRUD – DynamoDB operations.
 */

const { v4: uuidv4 } = require('uuid');
const { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { VOICE_ROOM_STATUS, VOICE_ROOM_ROLES, MAX_ROOM_PARTICIPANTS } = require('../../utils/constants');

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

  return { ...room, participants: [{ userId, userName: userName || 'Unknown', role: VOICE_ROOM_ROLES.MODERATOR }] };
}

async function listRooms({ page = 1, limit = 10, status = 'active', topic, search }) {
  let items = [];
  let lastKey = undefined;

  // Use GSI ByStatus for active/ended filtering
  const params = {
    TableName: TABLE_NAMES.VOICE_ROOMS,
    IndexName: 'ByStatus',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status },
    ScanIndexForward: false,
  };

  const result = await dynamoDB.send(new QueryCommand(params));
  items = result.Items || [];

  // Client-side filtering for topic and search (DynamoDB limitations)
  if (topic) {
    items = items.filter(r => r.topics && r.topics.includes(topic));
  }
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(r => r.title.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s));
  }

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return {
    rooms: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

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
    FilterExpression: 'attribute_not_exists(leftAt) OR leftAt = :null',
    ExpressionAttributeValues: { ':roomId': roomId, ':null': null },
  }));

  return {
    ...result.Item,
    participants: (participants.Items || []).filter(p => !p.isBlocked),
  };
}

async function endRoom(roomId, userId) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.status === VOICE_ROOM_STATUS.ENDED) throw new Error('ROOM_ALREADY_ENDED');
  if (room.creatorId !== userId) throw new Error('NOT_MODERATOR');

  const now = new Date().toISOString();
  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET #status = :ended, endedAt = :now, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':ended': VOICE_ROOM_STATUS.ENDED, ':now': now },
  }));

  return { roomId, status: VOICE_ROOM_STATUS.ENDED, endedAt: now };
}

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
      leftAt: null,
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

module.exports = { createRoom, listRooms, getRoomById, endRoom, joinRoom, leaveRoom };
