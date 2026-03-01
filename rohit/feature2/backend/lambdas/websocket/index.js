/**
 * WebSocket Lambda – Handles $connect, $disconnect, $default for voice signaling + chat.
 */

const { PutCommand, DeleteCommand, GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const rooms = require('../voice-room/rooms');
const chat = require('../voice-room/chat');

function getApiClient(event) {
  const endpoint = process.env.WEBSOCKET_API_ENDPOINT ||
    `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  return new ApiGatewayManagementApiClient({ endpoint });
}

async function broadcastToRoom(event, roomId, message, excludeConnectionId = null) {
  const apiClient = getApiClient(event);

  // Get all connections for this room
  const result = await dynamoDB.send(new ScanCommand({
    TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
    FilterExpression: 'roomId = :roomId',
    ExpressionAttributeValues: { ':roomId': roomId },
  }));

  const connections = (result.Items || []).filter(c => c.connectionId !== excludeConnectionId);
  const payload = JSON.stringify(message);

  const promises = connections.map(async (conn) => {
    try {
      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: payload,
      }));
    } catch (err) {
      if (err.statusCode === 410) {
        // Stale connection — clean up
        await dynamoDB.send(new DeleteCommand({
          TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
          Key: { connectionId: conn.connectionId },
        }));
      }
    }
  });

  await Promise.all(promises);
}

exports.handler = async (event) => {
  console.log('WebSocket event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;
  const userId = event.queryStringParameters?.userId || event.headers?.['x-user-id'] || 'anonymous';

  try {
    // ── $connect ──
    if (routeKey === '$connect') {
      const ttl = Math.floor(Date.now() / 1000) + 7200; // 2 hours
      await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
        Item: {
          connectionId,
          userId,
          roomId: null,
          connectedAt: new Date().toISOString(),
          ttl,
        },
      }));
      return { statusCode: 200, body: 'Connected' };
    }

    // ── $disconnect ──
    if (routeKey === '$disconnect') {
      // Get connection info
      const conn = await dynamoDB.send(new GetCommand({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
        Key: { connectionId },
      }));

      if (conn.Item && conn.Item.roomId) {
        // Leave room
        await rooms.leaveRoom(conn.Item.roomId, conn.Item.userId);

        // Notify others
        await broadcastToRoom(event, conn.Item.roomId, {
          action: 'user-left',
          userId: conn.Item.userId,
          timestamp: new Date().toISOString(),
        }, connectionId);
      }

      await dynamoDB.send(new DeleteCommand({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
        Key: { connectionId },
      }));

      return { statusCode: 200, body: 'Disconnected' };
    }

    // ── $default (all other messages) ──
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { action } = body;

    switch (action) {
      case 'join-room': {
        const { roomId, userName } = body;
        await rooms.joinRoom(roomId, userId, userName);

        // Update connection with roomId
        await dynamoDB.send(new PutCommand({
          TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
          Item: {
            connectionId,
            userId,
            roomId,
            connectedAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + 7200,
          },
        }));

        await broadcastToRoom(event, roomId, {
          action: 'user-joined',
          userId,
          userName,
          timestamp: new Date().toISOString(),
        }, connectionId);

        return { statusCode: 200, body: JSON.stringify({ action: 'joined', roomId }) };
      }

      case 'leave-room': {
        const { roomId } = body;
        await rooms.leaveRoom(roomId, userId);

        await dynamoDB.send(new PutCommand({
          TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
          Item: { connectionId, userId, roomId: null, connectedAt: new Date().toISOString(), ttl: Math.floor(Date.now() / 1000) + 7200 },
        }));

        await broadcastToRoom(event, roomId, {
          action: 'user-left',
          userId,
          timestamp: new Date().toISOString(),
        }, connectionId);

        return { statusCode: 200, body: JSON.stringify({ action: 'left', roomId }) };
      }

      case 'chat-message': {
        const { roomId, content } = body;
        const message = await chat.sendMessage(roomId, userId, body.userName, content);

        await broadcastToRoom(event, roomId, {
          action: 'chat-message',
          message,
        });

        return { statusCode: 200, body: JSON.stringify({ action: 'message-sent', message }) };
      }

      // ── WebRTC signaling ──
      case 'webrtc-offer':
      case 'webrtc-answer':
      case 'webrtc-ice-candidate': {
        const { roomId, targetUserId, data } = body;

        // Find target user's connection
        const conns = await dynamoDB.send(new ScanCommand({
          TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS,
          FilterExpression: 'userId = :userId AND roomId = :roomId',
          ExpressionAttributeValues: { ':userId': targetUserId, ':roomId': roomId },
        }));

        if (conns.Items && conns.Items.length > 0) {
          const apiClient = getApiClient(event);
          await apiClient.send(new PostToConnectionCommand({
            ConnectionId: conns.Items[0].connectionId,
            Data: JSON.stringify({ action, fromUserId: userId, data }),
          }));
        }

        return { statusCode: 200, body: JSON.stringify({ action: 'signal-sent' }) };
      }

      default:
        return { statusCode: 400, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
    }

  } catch (err) {
    console.error('WebSocket handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
