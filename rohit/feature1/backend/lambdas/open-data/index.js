/**
 * Open Data Lambda — Main handler.
 *
 * Routes:
 *   GET /api/v1/export/{userId}              → export user data (JSON or CSV)
 *   GET /api/v1/export/{userId}?format=csv   → export as CSV
 *   GET /api/v1/export/{userId}?services=... → export selected services
 *   GET /api/v1/export/audit                 → list export audit logs
 */

const { v4: uuidv4 } = require('uuid');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { success, csvResponse, error, badRequest, forbidden, tooManyRequests, notFound } = require('../../utils/response');
const { VALID_SERVICES, EXPORT_FORMATS, RATE_LIMIT } = require('../../utils/constants');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { aggregateUserData } = require('./aggregator');
const { toCSV } = require('./csv-formatter');

exports.handler = async (event) => {
  console.log('Open Data API event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath;
  const authUserId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || null;
  const queryParams = event.queryStringParameters || {};

  try {
    // ── Audit Log ──
    if (path.match(/\/api\/v1\/export\/audit$/) && method === 'GET') {
      return await handleAuditList(authUserId, queryParams);
    }

    // ── Export User Data ──
    const exportMatch = path.match(/\/api\/v1\/export\/([a-f0-9-]+)$/);
    if (exportMatch && method === 'GET') {
      const targetUserId = exportMatch[1];
      return await handleExport(targetUserId, authUserId, queryParams, event.headers);
    }

    return notFound(`Route not found: ${method} ${path}`);

  } catch (err) {
    console.error('Open Data API error:', err);
    return error('Internal server error', 500, err.message);
  }
};

/**
 * Handle data export request.
 */
async function handleExport(targetUserId, authUserId, queryParams, headers) {
  // ── Authorization: users can only export their own data ──
  if (authUserId && authUserId !== targetUserId) {
    return forbidden('You can only export your own data');
  }

  // ── Validate format ──
  const format = (queryParams.format || 'json').toLowerCase();
  if (!EXPORT_FORMATS.includes(format)) {
    return badRequest(`Invalid format. Supported: ${EXPORT_FORMATS.join(', ')}`);
  }

  // ── Parse service filter ──
  let serviceKeys = VALID_SERVICES;
  if (queryParams.services) {
    serviceKeys = queryParams.services.split(',').map(s => s.trim());
    const invalid = serviceKeys.filter(s => !VALID_SERVICES.includes(s));
    if (invalid.length > 0) {
      return badRequest(`Invalid services: ${invalid.join(', ')}. Valid: ${VALID_SERVICES.join(', ')}`);
    }
  }

  // ── Rate limiting ──
  const rateLimitResult = await checkRateLimit(targetUserId);
  if (!rateLimitResult.allowed) {
    return tooManyRequests(`Rate limit exceeded. Max ${RATE_LIMIT.maxExports} exports per ${RATE_LIMIT.windowHours} hour(s). Try again after ${rateLimitResult.retryAfter}.`);
  }

  // ── Aggregate data ──
  const authToken = headers?.['authorization'] || headers?.['Authorization'] || null;
  const exportData = await aggregateUserData(targetUserId, serviceKeys, authToken);
  exportData.export_metadata.format = format;

  // ── Audit log ──
  await logExport(targetUserId, serviceKeys, format);

  // ── Return in requested format ──
  if (format === 'csv') {
    return csvResponse(toCSV(exportData));
  }

  return success(exportData);
}

/**
 * Check rate limit — max N exports per hour.
 */
async function checkRateLimit(userId) {
  const windowStart = new Date(Date.now() - RATE_LIMIT.windowHours * 60 * 60 * 1000).toISOString();

  try {
    const result = await dynamoDB.send(new QueryCommand({
      TableName: TABLE_NAMES.EXPORT_AUDIT,
      KeyConditionExpression: 'userId = :uid AND exportedAt > :since',
      ExpressionAttributeValues: { ':uid': userId, ':since': windowStart },
      Select: 'COUNT',
    }));

    const count = result.Count || 0;
    if (count >= RATE_LIMIT.maxExports) {
      return { allowed: false, retryAfter: `${RATE_LIMIT.windowHours}h` };
    }
    return { allowed: true, remaining: RATE_LIMIT.maxExports - count };
  } catch (err) {
    console.warn('[RateLimit] Check failed, allowing request:', err.message);
    return { allowed: true, remaining: RATE_LIMIT.maxExports };
  }
}

/**
 * Log an export event to DynamoDB for auditing.
 */
async function logExport(userId, services, format) {
  try {
    const now = new Date();
    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAMES.EXPORT_AUDIT,
      Item: {
        userId,
        exportedAt: now.toISOString(),
        exportId: uuidv4(),
        servicesRequested: services,
        format,
        ttl: Math.floor(now.getTime() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
      },
    }));
  } catch (err) {
    console.error('[Audit] Failed to log export:', err.message);
    // Don't fail the export if audit logging fails
  }
}

/**
 * Handle audit log listing (admin).
 */
async function handleAuditList(userId, queryParams) {
  if (!userId) { return forbidden('Authentication required'); }

  const limit = parseInt(queryParams.limit || '20', 10);

  try {
    const result = await dynamoDB.send(new QueryCommand({
      TableName: TABLE_NAMES.EXPORT_AUDIT,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false,
      Limit: limit,
    }));

    return success({
      audits: result.Items || [],
      count: result.Count || 0,
    });
  } catch (err) {
    console.error('[Audit] List failed:', err.message);
    return error('Failed to retrieve audit logs', 500);
  }
}
