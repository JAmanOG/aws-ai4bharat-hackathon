/**
 * Database client — DynamoDB only (no direct Aurora access in this service).
 * Audit logs stored in DynamoDB.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION_CUSTOM || process.env.AWS_REGION || 'ap-south-1',
});

const dynamoDB = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAMES = {
  EXPORT_AUDIT: process.env.EXPORT_AUDIT_TABLE || 'ExportAudit',
};

module.exports = { dynamoDB, TABLE_NAMES };
