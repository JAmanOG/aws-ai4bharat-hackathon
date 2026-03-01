/**
 * Unit tests for response.js utilities.
 */

const { success, error, badRequest, notFound, unauthorized, forbidden, conflict, CORS_HEADERS } = require('../../utils/response');

describe('Response Utilities', () => {
  test('success returns 200 with JSON body', () => {
    const result = success({ data: 'test' });
    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual(CORS_HEADERS);
    expect(JSON.parse(result.body)).toEqual({ data: 'test' });
  });

  test('success with custom status code', () => {
    const result = success({ created: true }, 201);
    expect(result.statusCode).toBe(201);
  });

  test('error returns 500 by default', () => {
    const result = error('Something broke');
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Something broke' });
  });

  test('error includes details when provided', () => {
    const result = error('Fail', 400, 'Details here');
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Fail');
    expect(body.details).toBe('Details here');
  });

  test('badRequest returns 400', () => {
    const result = badRequest('Missing field');
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Missing field');
  });

  test('notFound returns 404 with default message', () => {
    const result = notFound();
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Resource not found');
  });

  test('notFound returns 404 with custom message', () => {
    const result = notFound('Room not found');
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Room not found');
  });

  test('unauthorized returns 401', () => {
    const result = unauthorized();
    expect(result.statusCode).toBe(401);
  });

  test('forbidden returns 403', () => {
    const result = forbidden('Access denied');
    expect(result.statusCode).toBe(403);
  });

  test('conflict returns 409', () => {
    const result = conflict('Duplicate entry');
    expect(result.statusCode).toBe(409);
  });

  test('all responses include CORS headers', () => {
    [success({}), error('e'), badRequest('b'), notFound(), unauthorized(), forbidden(), conflict()].forEach(r => {
      expect(r.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(r.headers['Content-Type']).toBe('application/json');
    });
  });
});
