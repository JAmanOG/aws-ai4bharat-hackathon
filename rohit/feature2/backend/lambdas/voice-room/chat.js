/**
 * Voice Room Chat – DynamoDB operations.
 */

const { v4: uuidv4 } = require('uuid');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');

async function sendMessage(roomId, userId, userName, content) {
  console.log(`[ACTION] Chat message sent by ${userId} (${userName}) in room ${roomId}`);
  console.log(`[TRACE] Message Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
  const now = new Date().toISOString();
  const messageId = `${now}#${uuidv4()}`; // Timestamp prefix for ordering

  const message = {
    roomId,
    messageId,
    userId,
    userName: userName || 'Unknown',
    content,
    createdAt: now,
  };

  console.log(`[TRACE] Prepared ChatMessage object: ${JSON.stringify(message)}`);

  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAMES.CHAT_MESSAGES,
    Item: message,
  }));

  return message;
}

async function getChatMessages(roomId, { limit = 50, lastKey } = {}) {
  console.log(`[ACTION] Fetching chat messages for Voice Room ID: ${roomId} (limit: ${limit})`);
  const params = {
    TableName: TABLE_NAMES.CHAT_MESSAGES,
    KeyConditionExpression: 'roomId = :roomId',
    ExpressionAttributeValues: { ':roomId': roomId },
    ScanIndexForward: false, // newest first
    Limit: limit,
  };

  if (lastKey) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
  }

  const result = await dynamoDB.send(new QueryCommand(params));

  return {
    messages: result.Items || [],
    nextKey: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null,
  };
}

module.exports = { sendMessage, getChatMessages };
