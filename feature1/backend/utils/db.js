/**
 * Database client — DynamoDB only (no direct Aurora access in this service).
 * Audit logs stored in DynamoDB.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
  forcePathStyle: true,
});

const dynamoDB = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// Proxy DynamoDB send method for logging
const originalSend = dynamoDB.send.bind(dynamoDB);
dynamoDB.send = async (command, ...args) => {
  const start = Date.now();
  const cmdName = command.constructor.name;
  let actionStr = '[CRUD:READ]';
  if (cmdName === 'PutCommand') actionStr = '[CRUD:CREATE]';
  if (cmdName === 'UpdateCommand') actionStr = '[CRUD:UPDATE]';
  if (cmdName === 'DeleteCommand') actionStr = '[CRUD:DELETE]';

  const payloadStr = JSON.stringify(command.input?.Item || command.input?.ExpressionAttributeValues || command.input?.Key || {});
  console.log(`${actionStr} DynamoDB ${cmdName} on table: ${command.input?.TableName || 'Unknown'} | Payload: ${payloadStr.substring(0, 300)}${payloadStr.length > 300 ? '...' : ''}`);

  try {
    const res = await originalSend(command, ...args);
    const duration = Date.now() - start;
    console.log(`[API:SUCCESS] DynamoDB ${cmdName} completed in ${duration}ms`);
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`[API:ERROR] DynamoDB ${cmdName} failed after ${duration}ms: ${err.message}`);
    throw err;
  }
};

const TABLE_NAMES = {
  EXPORT_AUDIT: process.env.EXPORT_AUDIT_TABLE || 'ExportAudit',
};

module.exports = { dynamoDB, TABLE_NAMES };
