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
  console.log(`[ACTION] Decoded Event - Method: ${method}, Path: ${path}, User: ${authUserId}`);
  console.log(`[TRACE] Query Params: ${JSON.stringify(queryParams)}`);

  try {
    // ── Audit Log ──
    if (path.match(/\/api\/v1\/export\/audit$/) && method === 'GET') {
      console.log(`[ACTION] Routing to handleAuditList for user ${authUserId}`);
      return await handleAuditList(authUserId, queryParams);
    }

    // ── Export User Data ──
    const exportMatch = path.match(/\/api\/v1\/export\/([a-f0-9-]+)$/);
    if (exportMatch && method === 'GET') {
      const targetUserId = exportMatch[1];
      console.log(`[ACTION] Routing to handleExport for targetUserId ${targetUserId}`);
      return await handleExport(targetUserId, authUserId, queryParams, event.headers);
    }

    console.log(`[ACTION] Route not found for ${method} ${path}`);
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
  console.log(`[ACTION] Running handleExport. targetUserId=${targetUserId}, format=${queryParams.format}`);
  // ── Authorization: users can only export their own data ──
  if (authUserId && authUserId !== targetUserId) {
    console.log(`[ACTION] Export rejected: authUserId (${authUserId}) does not match targetUserId (${targetUserId})`);
    return forbidden('You can only export your own data');
  }
  console.log(`[TRACE] Authorization check passed for user ${authUserId}`);

  // ── Validate format ──
  const format = (queryParams.format || 'json').toLowerCase();
  if (!EXPORT_FORMATS.includes(format)) {
    console.log(`[ACTION] Export rejected: Invalid format requested: ${format}`);
    return badRequest(`Invalid format. Supported: ${EXPORT_FORMATS.join(', ')}`);
  }

  // ── Parse service filter ──
  let serviceKeys = VALID_SERVICES;
  if (queryParams.services) {
    serviceKeys = queryParams.services.split(',').map(s => s.trim());
    const invalid = serviceKeys.filter(s => !VALID_SERVICES.includes(s));
    if (invalid.length > 0) {
      console.log(`[ACTION] Export rejected: Invalid services requested: ${invalid.join(', ')}`);
      return badRequest(`Invalid services: ${invalid.join(', ')}. Valid: ${VALID_SERVICES.join(', ')}`);
    }
  }
  console.log(`[ACTION] Validated service filters: ${JSON.stringify(serviceKeys)}`);

  // ── Rate limiting ──
  const rateLimitResult = await checkRateLimit(targetUserId);
  if (!rateLimitResult.allowed) {
    console.log(`[ACTION] Export rejected: Rate limit exceeded for user ${targetUserId}`);
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
    console.log(`[ACTION] Formatting export payload as CSV`);
    return csvResponse(toCSV(exportData));
  }

  console.log(`[ACTION] Formatting export payload as JSON`);
  return success(exportData);
}

/**
 * Check rate limit — max N exports per hour.
 */
async function checkRateLimit(userId) {
  console.log(`[ACTION] Checking rate limit for user ${userId}`);
  const windowStart = new Date(Date.now() - RATE_LIMIT.windowHours * 60 * 60 * 1000).toISOString();

  try {
    const result = await dynamoDB.send(new QueryCommand({
      TableName: TABLE_NAMES.EXPORT_AUDIT,
      KeyConditionExpression: 'userId = :uid AND exportedAt > :since',
      ExpressionAttributeValues: { ':uid': userId, ':since': windowStart },
      Select: 'COUNT',
    }));

    const count = result.Count || 0;
    console.log(`[ACTION] Found ${count} past exports in window. Max allowed is ${RATE_LIMIT.maxExports}`);
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
    console.log(`[ACTION] Successfully logged export to Audit DB`);
  } catch (err) {
    console.error('[Audit] Failed to log export:', err.message);
    // Don't fail the export if audit logging fails
  }
}

/**
 * Handle audit log listing (admin).
 */
async function handleAuditList(userId, queryParams) {
  console.log(`[ACTION] Processing handleAuditList for user ${userId}`);
  if (!userId) {
    console.log(`[ACTION] Audit list rejected: No user ID`);
    return forbidden('Authentication required');
  }

  const limit = parseInt(queryParams.limit || '20', 10);

  try {
    const result = await dynamoDB.send(new QueryCommand({
      TableName: TABLE_NAMES.EXPORT_AUDIT,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false,
      Limit: limit,
    }));

    console.log(`[ACTION] Successfully retrieved ${result.Count} audit records for user ${userId}`);
    return success({
      audits: result.Items || [],
      count: result.Count || 0,
    });
  } catch (err) {
    console.error('[Audit] List failed:', err.message);
    return error('Failed to retrieve audit logs', 500);
  }
}
