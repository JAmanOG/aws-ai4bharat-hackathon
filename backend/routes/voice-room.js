/**
 * Voice Room routes – Rooms, Chat, Moderation (Twitter Spaces-like)
 */

const rooms = require('../lambdas/voice-room/rooms');
const chat = require('../lambdas/voice-room/chat');
const moderation = require('../lambdas/voice-room/moderation');

function mapError(err) {
  const map = {
    ROOM_NOT_FOUND: { statusCode: 404, message: 'Voice room not found' },
    ROOM_ENDED: { statusCode: 400, message: 'This room has already ended' },
    ROOM_ALREADY_ENDED: { statusCode: 400, message: 'This room has already ended' },
    NOT_MODERATOR: { statusCode: 403, message: 'Only the room moderator can perform this action' },
    USER_BLOCKED: { statusCode: 403, message: 'You have been banned from this room' },
    ROOM_FULL: { statusCode: 400, message: 'Room is at capacity' },
    CANNOT_SELF_ACTION: { statusCode: 400, message: 'Cannot perform this action on yourself' },
    USER_NOT_IN_ROOM: { statusCode: 404, message: 'Target user is not in this room' },
  };
  return map[err.message] || null;
}

function handleError(err) {
  const mapped = mapError(err);
  if (mapped) throw mapped;
  throw err;
}

async function voiceRoomRoutes(fastify) {

  // ═══════════════════════════════════════
  //  Rooms CRUD
  // ═══════════════════════════════════════

  fastify.post('/voice-rooms', {
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 500 },
          topics: { type: 'array', items: { type: 'string' } },
          isPrivate: { type: 'boolean' },
          maxParticipants: { type: 'integer', minimum: 2, maximum: 100 },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userName = req.headers['x-user-name'] || 'User';
      const result = await rooms.createRoom(req.body, req.userId, userName);
      return reply.status(201).send(result);
    } catch (err) { handleError(err); }
  });

  fastify.get('/voice-rooms', async (req) => {
    const { page = 1, limit = 10, status, topic, search } = req.query;
    return rooms.listRooms({ page: +page, limit: +limit, status, topic, search });
  });

  fastify.get('/voice-rooms/:roomId', async (req) => {
    try {
      const result = await rooms.getRoomById(req.params.roomId);
      if (!result) throw new Error('ROOM_NOT_FOUND');
      return result;
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/end', async (req) => {
    try {
      return await rooms.endRoom(req.params.roomId, req.userId);
    } catch (err) { handleError(err); }
  });

  // ═══════════════════════════════════════
  //  Join / Leave / Token
  // ═══════════════════════════════════════

  fastify.post('/voice-rooms/:roomId/join', async (req) => {
    try {
      const userName = req.headers['x-user-name'] || 'User';
      return await rooms.joinRoom(req.params.roomId, req.userId, userName);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/leave', async (req) => {
    try {
      return await rooms.leaveRoom(req.params.roomId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.get('/voice-rooms/:roomId/token', async (req) => {
    try {
      return await rooms.getRoomToken(req.params.roomId, req.userId);
    } catch (err) { handleError(err); }
  });

  // ═══════════════════════════════════════
  //  Chat
  // ═══════════════════════════════════════

  fastify.get('/voice-rooms/:roomId/chat', async (req) => {
    const { limit = 50, lastKey } = req.query;
    return chat.getChatMessages(req.params.roomId, { limit: +limit, lastKey });
  });

  fastify.post('/voice-rooms/:roomId/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 1000 },
        },
      },
    },
  }, async (req, reply) => {
    const userName = req.headers['x-user-name'] || 'User';
    const result = await chat.sendMessage(req.params.roomId, req.userId, userName, req.body.content);
    return reply.status(201).send(result);
  });

  // ═══════════════════════════════════════
  //  Moderation
  // ═══════════════════════════════════════

  fastify.post('/voice-rooms/:roomId/mute/:targetUserId', async (req) => {
    try {
      return await moderation.muteUser(req.params.roomId, req.params.targetUserId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/unmute/:targetUserId', async (req) => {
    try {
      return await moderation.unmuteUser(req.params.roomId, req.params.targetUserId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/kick/:targetUserId', async (req) => {
    try {
      return await moderation.kickUser(req.params.roomId, req.params.targetUserId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/ban/:targetUserId', async (req) => {
    try {
      return await moderation.banUser(req.params.roomId, req.params.targetUserId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/transfer-moderator', {
    schema: {
      body: {
        type: 'object',
        required: ['targetUserId'],
        properties: {
          targetUserId: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    try {
      return await moderation.transferModerator(req.params.roomId, req.body.targetUserId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/toggle-recording', async (req) => {
    try {
      return await moderation.toggleRecording(req.params.roomId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/toggle-privacy', async (req) => {
    try {
      return await moderation.togglePrivacy(req.params.roomId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/request-speak', async (req) => {
    try {
      return await moderation.requestToSpeak(req.params.roomId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/approve-speaker/:targetUserId', async (req) => {
    try {
      return await moderation.approveSpeaker(req.params.roomId, req.params.targetUserId, req.userId);
    } catch (err) { handleError(err); }
  });

  fastify.post('/voice-rooms/:roomId/revoke-speaker/:targetUserId', async (req) => {
    try {
      return await moderation.revokeSpeaker(req.params.roomId, req.params.targetUserId, req.userId);
    } catch (err) { handleError(err); }
  });
}

module.exports = voiceRoomRoutes;
