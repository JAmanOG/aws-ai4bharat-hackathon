/**
 * Standardized API response helpers used across all Lambda functions.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

function success(body, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
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

function badRequest(message, details = null) {
  return error(message, 400, details);
}

function notFound(message = 'Resource not found') {
  return error(message, 404);
}

function unauthorized(message = 'Unauthorized') {
  return error(message, 401);
}

module.exports = { success, error, badRequest, notFound, unauthorized, CORS_HEADERS };
