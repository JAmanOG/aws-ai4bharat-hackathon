/**
 * Standardized API Gateway response helpers.
 * Same pattern as feature1/feature2 modules.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-User-Id',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json',
};

const CSV_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'text/csv',
  'Content-Disposition': 'attachment; filename="export.csv"',
};

function success(body, statusCode = 200, headers = CORS_HEADERS) {
  return {
    statusCode,
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function csvResponse(csvString) {
  return {
    statusCode: 200,
    headers: CSV_HEADERS,
    body: csvString,
  };
}

function error(message, statusCode = 500, details = null) {
  const body = { error: message };
  if (details) body.details = details;
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function badRequest(message, details = null) { return error(message, 400, details); }
function notFound(message = 'Resource not found') { return error(message, 404); }
function unauthorized(message = 'Unauthorized') { return error(message, 401); }
function forbidden(message = 'Forbidden') { return error(message, 403); }
function tooManyRequests(message = 'Rate limit exceeded') { return error(message, 429); }

module.exports = { success, csvResponse, error, badRequest, notFound, unauthorized, forbidden, tooManyRequests, CORS_HEADERS, CSV_HEADERS };
