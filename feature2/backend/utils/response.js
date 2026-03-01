/**
 * Standardized API Gateway response helpers.
 * Same pattern as knowledge_sharing_and_learning module.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-User-Id',
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

function forbidden(message = 'Forbidden') {
  return error(message, 403);
}

function conflict(message = 'Conflict') {
  return error(message, 409);
}

module.exports = { success, error, badRequest, notFound, unauthorized, forbidden, conflict, CORS_HEADERS };
