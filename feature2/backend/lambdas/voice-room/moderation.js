/**
 * Voice Room Moderation – DynamoDB operations.
 */

const { GetCommand, UpdateCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { VOICE_ROOM_ROLES, VOICE_ROOM_STATUS } = require('../../utils/constants');

async function getParticipant(roomId, userId) {
  const result = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId },
  }));
  return result.Item || null;
}

async function assertModerator(roomId, userId) {
  const p = await getParticipant(roomId, userId);
  if (!p || p.role !== VOICE_ROOM_ROLES.MODERATOR) {
    throw new Error('NOT_MODERATOR');
  }
  return p;
}

async function assertRoomActive(roomId) {
  const { GetCommand: Get } = require('@aws-sdk/lib-dynamodb');
  const result = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
  }));
  if (!result.Item) throw new Error('ROOM_NOT_FOUND');
  if (result.Item.status === VOICE_ROOM_STATUS.ENDED) throw new Error('ROOM_ENDED');
  return result.Item;
}

async function muteUser(roomId, targetUserId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} muting user ${targetUserId} in Voice Room ${roomId}`);
  await assertRoomActive(roomId);
  await assertModerator(roomId, moderatorId);
  if (moderatorId === targetUserId) throw new Error('CANNOT_SELF_ACTION');

  const target = await getParticipant(roomId, targetUserId);
  console.log(`[TRACE] Muting target user ${targetUserId}. Moderator: ${moderatorId}. Current participant status: ${target ? 'Found' : 'Not Found'}`);
  if (!target) throw new Error('USER_NOT_IN_ROOM');

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: targetUserId },
    UpdateExpression: 'SET isMuted = :muted',
    ExpressionAttributeValues: { ':muted': true },
  }));

  return { roomId, userId: targetUserId, isMuted: true };
}

async function unmuteUser(roomId, targetUserId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} unmuting user ${targetUserId} in Voice Room ${roomId}`);
  await assertRoomActive(roomId);
  await assertModerator(roomId, moderatorId);

  const target = await getParticipant(roomId, targetUserId);
  console.log(`[TRACE] Unmuting target user ${targetUserId}. Moderator: ${moderatorId}. Current participant status: ${target ? 'Found' : 'Not Found'}`);
  if (!target) throw new Error('USER_NOT_IN_ROOM');

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: targetUserId },
    UpdateExpression: 'SET isMuted = :muted',
    ExpressionAttributeValues: { ':muted': false },
  }));

  return { roomId, userId: targetUserId, isMuted: false };
}

async function kickUser(roomId, targetUserId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} kicking user ${targetUserId} from Voice Room ${roomId}`);
  await assertRoomActive(roomId);
  await assertModerator(roomId, moderatorId);
  if (moderatorId === targetUserId) throw new Error('CANNOT_SELF_ACTION');

  const target = await getParticipant(roomId, targetUserId);
  if (!target) throw new Error('USER_NOT_IN_ROOM');

  const now = new Date().toISOString();
  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: targetUserId },
    UpdateExpression: 'SET leftAt = :now',
    ExpressionAttributeValues: { ':now': now },
  }));

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET participantCount = participantCount - :one, updatedAt = :now',
    ExpressionAttributeValues: { ':one': 1, ':now': now },
  }));

  return { roomId, userId: targetUserId, action: 'kicked' };
}

async function banUser(roomId, targetUserId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} banning user ${targetUserId} in Voice Room ${roomId}`);
  await assertRoomActive(roomId);
  await assertModerator(roomId, moderatorId);
  if (moderatorId === targetUserId) throw new Error('CANNOT_SELF_ACTION');

  const now = new Date().toISOString();
  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: targetUserId },
    UpdateExpression: 'SET isBlocked = :blocked, blockedBy = :mod, leftAt = :now',
    ExpressionAttributeValues: { ':blocked': true, ':mod': moderatorId, ':now': now },
  }));

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET participantCount = participantCount - :one, updatedAt = :now',
    ExpressionAttributeValues: { ':one': 1, ':now': now },
  }));

  return { roomId, userId: targetUserId, action: 'banned' };
}

async function transferModerator(roomId, targetUserId, currentModeratorId) {
  console.log(`[ACTION] Moderator ${currentModeratorId} transferring moderation to ${targetUserId} in Voice Room ${roomId}`);
  await assertRoomActive(roomId);
  await assertModerator(roomId, currentModeratorId);
  if (currentModeratorId === targetUserId) throw new Error('CANNOT_SELF_ACTION');

  const target = await getParticipant(roomId, targetUserId);
  console.log(`[TRACE] Transferring moderation to ${targetUserId}. Current target status: ${target ? 'Found' : 'Not Found'}`);
  if (!target || target.leftAt) throw new Error('USER_NOT_IN_ROOM');

  // Demote current moderator
  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: currentModeratorId },
    UpdateExpression: 'SET #role = :speaker',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':speaker': VOICE_ROOM_ROLES.SPEAKER },
  }));

  // Promote target
  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: targetUserId },
    UpdateExpression: 'SET #role = :mod',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':mod': VOICE_ROOM_ROLES.MODERATOR },
  }));

  return { roomId, newModerator: targetUserId, previousModerator: currentModeratorId };
}

async function toggleRecording(roomId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} toggling recording state in Voice Room ${roomId}`);
  await assertModerator(roomId, moderatorId);

  const room = await assertRoomActive(roomId);
  const newState = !room.isRecording;

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET isRecording = :rec, updatedAt = :now',
    ExpressionAttributeValues: { ':rec': newState, ':now': new Date().toISOString() },
  }));

  return { roomId, isRecording: newState };
}

async function togglePrivacy(roomId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} toggling privacy state in Voice Room ${roomId}`);
  await assertModerator(roomId, moderatorId);

  const room = await assertRoomActive(roomId);
  const newState = !room.isPrivate;

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOMS,
    Key: { roomId },
    UpdateExpression: 'SET isPrivate = :priv, updatedAt = :now',
    ExpressionAttributeValues: { ':priv': newState, ':now': new Date().toISOString() },
  }));

  return { roomId, isPrivate: newState };
}

async function requestToSpeak(roomId, userId) {
  console.log(`[ACTION] User ${userId} requesting to speak in Voice Room ${roomId}`);
  await assertRoomActive(roomId);

  const target = await getParticipant(roomId, userId);
  if (!target) throw new Error('USER_NOT_IN_ROOM');

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId },
    UpdateExpression: 'SET requestedSpeak = :req',
    ExpressionAttributeValues: { ':req': true },
  }));

  return { roomId, userId, requestedSpeak: true };
}

async function approveSpeaker(roomId, targetUserId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} approving user ${targetUserId} as Speaker in Voice Room ${roomId}`);
  await assertRoomActive(roomId);
  await assertModerator(roomId, moderatorId);

  const target = await getParticipant(roomId, targetUserId);
  if (!target) throw new Error('USER_NOT_IN_ROOM');

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: targetUserId },
    UpdateExpression: 'SET #role = :speaker, requestedSpeak = :false, isMuted = :false',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':speaker': VOICE_ROOM_ROLES.SPEAKER, ':false': false },
  }));

  return { roomId, userId: targetUserId, role: VOICE_ROOM_ROLES.SPEAKER };
}

async function revokeSpeaker(roomId, targetUserId, moderatorId) {
  console.log(`[ACTION] Moderator ${moderatorId} revoking speaking rights from ${targetUserId} in Voice Room ${roomId}`);
  await assertRoomActive(roomId);
  await assertModerator(roomId, moderatorId);

  const target = await getParticipant(roomId, targetUserId);
  if (!target) throw new Error('USER_NOT_IN_ROOM');

  await dynamoDB.send(new UpdateCommand({
    TableName: TABLE_NAMES.VOICE_ROOM_PARTICIPANTS,
    Key: { roomId, userId: targetUserId },
    UpdateExpression: 'SET #role = :listener, isMuted = :true',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':listener': VOICE_ROOM_ROLES.LISTENER, ':true': true },
  }));

  return { roomId, userId: targetUserId, role: VOICE_ROOM_ROLES.LISTENER };
}

module.exports = {
  muteUser, unmuteUser, kickUser, banUser, transferModerator, toggleRecording, togglePrivacy,
  requestToSpeak, approveSpeaker, revokeSpeaker
};
