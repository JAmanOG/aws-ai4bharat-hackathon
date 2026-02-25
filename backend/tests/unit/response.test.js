/**
 * Unit tests for response utilities
 */

const { success, error, badRequest, notFound, unauthorized } = require('../../utils/response');

describe('Response Utilities', () => {
    test('success should return 200 with JSON body', () => {
        const result = success({ message: 'ok' });

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ message: 'ok' });
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    test('success should accept custom status code', () => {
        const result = success({ id: '123' }, 201);
        expect(result.statusCode).toBe(201);
    });

    test('error should return 500 by default', () => {
        const result = error('Something went wrong');

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toBe('Something went wrong');
    });

    test('error should include details when provided', () => {
        const result = error('Fail', 500, 'Detailed reason');

        expect(JSON.parse(result.body).details).toBe('Detailed reason');
    });

    test('badRequest should return 400', () => {
        const result = badRequest('Invalid input');

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe('Invalid input');
    });

    test('notFound should return 404', () => {
        const result = notFound('Course not found');

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).error).toBe('Course not found');
    });

    test('notFound should use default message', () => {
        const result = notFound();

        expect(JSON.parse(result.body).error).toBe('Resource not found');
    });

    test('unauthorized should return 401', () => {
        const result = unauthorized();

        expect(result.statusCode).toBe(401);
        expect(JSON.parse(result.body).error).toBe('Unauthorized');
    });
});
