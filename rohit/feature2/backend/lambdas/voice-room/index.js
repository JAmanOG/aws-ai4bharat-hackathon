/**
 * Voice Room Lambda – Main handler.
 * Routes API Gateway events to appropriate handler functions.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const rooms = require('./rooms');
const moderation = require('./moderation');
const chat = require('./chat');

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath;
  const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-user';
  console.log(`[API:EVENT] Voice Room Lambda invoked. Method: ${method}, Path: ${path}, UserID: ${userId}`);

  const userName = event.requestContext?.authorizer?.claims?.name || event.headers?.['x-user-name'] || 'Demo User';
  const queryParams = event.queryStringParameters || {};
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { return badRequest('Invalid JSON body'); }

  try {
    // ── Create Room ──
    if (path.match(/\/voice-rooms$/) && method === 'POST') {
      if (!body.title || body.title.length < 2) return badRequest('Title is required (min 2 chars)');
      const result = await rooms.createRoom(body, userId, userName);
      return success(result, 201);
    }

    // ── List Rooms ──
    if (path.match(/\/voice-rooms$/) && method === 'GET') {
      const result = await rooms.listRooms({
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
        status: queryParams.status || 'active',
        topic: queryParams.topic,
        search: queryParams.search,
      });
      return success(result);
    }

    // ── Get Room By ID ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)$/) && method === 'GET') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)$/)[1];
      const result = await rooms.getRoomById(roomId);
      if (!result) return notFound('Voice room not found');
      return success(result);
    }

    // ── End Room ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/end$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/end$/)[1];
      try {
        const result = await rooms.endRoom(roomId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') return notFound('Voice room not found');
        if (err.message === 'ROOM_ALREADY_ENDED') return badRequest('Room already ended');
        if (err.message === 'NOT_MODERATOR') return error('Only the room creator can end the room', 403);
        throw err;
      }
    }

    // ── Mute User ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/mute\/([a-f0-9-]+)$/) && method === 'POST') {
      const [, roomId, targetUserId] = path.match(/\/voice-rooms\/([a-f0-9-]+)\/mute\/([a-f0-9-]+)$/);
      try {
        const result = await moderation.muteUser(roomId, targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can mute users', 403);
        if (err.message === 'CANNOT_SELF_ACTION') return badRequest('Cannot mute yourself');
        if (err.message === 'USER_NOT_IN_ROOM') return notFound('User not in room');
        throw err;
      }
    }

    // ── Unmute User ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/unmute\/([a-f0-9-]+)$/) && method === 'POST') {
      const [, roomId, targetUserId] = path.match(/\/voice-rooms\/([a-f0-9-]+)\/unmute\/([a-f0-9-]+)$/);
      try {
        const result = await moderation.unmuteUser(roomId, targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can unmute users', 403);
        throw err;
      }
    }

    // ── Kick User ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/kick\/([a-f0-9-]+)$/) && method === 'POST') {
      const [, roomId, targetUserId] = path.match(/\/voice-rooms\/([a-f0-9-]+)\/kick\/([a-f0-9-]+)$/);
      try {
        const result = await moderation.kickUser(roomId, targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can kick users', 403);
        if (err.message === 'CANNOT_SELF_ACTION') return badRequest('Cannot kick yourself');
        throw err;
      }
    }

    // ── Ban User ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/ban\/([a-f0-9-]+)$/) && method === 'POST') {
      const [, roomId, targetUserId] = path.match(/\/voice-rooms\/([a-f0-9-]+)\/ban\/([a-f0-9-]+)$/);
      try {
        const result = await moderation.banUser(roomId, targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can ban users', 403);
        if (err.message === 'CANNOT_SELF_ACTION') return badRequest('Cannot ban yourself');
        throw err;
      }
    }

    // ── Transfer Moderator ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/transfer-moderator$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/transfer-moderator$/)[1];
      if (!body.targetUserId) return badRequest('targetUserId is required');
      try {
        const result = await moderation.transferModerator(roomId, body.targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can transfer', 403);
        if (err.message === 'USER_NOT_IN_ROOM') return notFound('Target user not in room');
        throw err;
      }
    }

    // ── Toggle Recording ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/toggle-recording$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/toggle-recording$/)[1];
      try {
        const result = await moderation.toggleRecording(roomId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can toggle recording', 403);
        throw err;
      }
    }

    // ── Toggle Privacy ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/toggle-privacy$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/toggle-privacy$/)[1];
      try {
        const result = await moderation.togglePrivacy(roomId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can toggle privacy', 403);
        throw err;
      }
    }

    // ── Request Speak ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/request-speak$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/request-speak$/)[1];
      try {
        const result = await moderation.requestToSpeak(roomId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'USER_NOT_IN_ROOM') return notFound('User not in room');
        throw err;
      }
    }

    // ── Approve Speaker ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/approve-speaker\/([a-f0-9-]+)$/) && method === 'POST') {
      const [, roomId, targetUserId] = path.match(/\/voice-rooms\/([a-f0-9-]+)\/approve-speaker\/([a-f0-9-]+)$/);
      try {
        const result = await moderation.approveSpeaker(roomId, targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can approve speakers', 403);
        throw err;
      }
    }

    // ── Revoke Speaker ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/revoke-speaker\/([a-f0-9-]+)$/) && method === 'POST') {
      const [, roomId, targetUserId] = path.match(/\/voice-rooms\/([a-f0-9-]+)\/revoke-speaker\/([a-f0-9-]+)$/);
      try {
        const result = await moderation.revokeSpeaker(roomId, targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'NOT_MODERATOR') return error('Only moderators can revoke speakers', 403);
        throw err;
      }
    }

    // ── Get Chat Messages ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/chat$/) && method === 'GET') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/chat$/)[1];
      const result = await chat.getChatMessages(roomId, {
        limit: parseInt(queryParams.limit || '50', 10),
        lastKey: queryParams.cursor,
      });
      return success(result);
    }

    // ── Send Chat Message ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/chat$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/chat$/)[1];
      if (!body.message) return badRequest('Message content is required');
      const result = await chat.sendMessage(roomId, userId, userName, body.message);
      return success(result, 201);
    }

    // ── Get Agora Token ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/token$/) && method === 'GET') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/token$/)[1];
      try {
        const result = await rooms.getRoomToken(roomId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') return notFound('Voice room not found');
        return error('Failed to generate token', 500, err.message);
      }
    }

    // ── Join Room ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/join$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/join$/)[1];
      try {
        const result = await rooms.joinRoom(roomId, userId, userName);
        return success(result);
      } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') return notFound('Voice room not found');
        if (err.message === 'ROOM_ENDED') return badRequest('Room has ended');
        if (err.message === 'USER_BLOCKED') return error('You are blocked from this room', 403);
        if (err.message === 'ROOM_FULL') return badRequest('Room is at maximum capacity');
        throw err;
      }
    }

    // ── Leave Room ──
    if (path.match(/\/voice-rooms\/([a-f0-9-]+)\/leave$/) && method === 'POST') {
      const roomId = path.match(/\/voice-rooms\/([a-f0-9-]+)\/leave$/)[1];
      const result = await rooms.leaveRoom(roomId, userId);
      return success(result);
    }

    return notFound(`Route not found: ${method} ${path}`);

  } catch (err) {
    console.error('Voice Room API error:', err);
    return error('Internal server error', 500, err.message);
  }
};
