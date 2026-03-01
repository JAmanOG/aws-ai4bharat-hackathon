/**
 * Voice Room Chat – DynamoDB operations.
 */

const { v4: uuidv4 } = require('uuid');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');

async function sendMessage(roomId, userId, userName, content) {
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

  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAMES.CHAT_MESSAGES,
    Item: message,
  }));

  return message;
}

async function getChatMessages(roomId, { limit = 50, lastKey } = {}) {
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
