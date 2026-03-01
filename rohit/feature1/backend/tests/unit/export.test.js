/**
 * Unit tests for Export Lambda handler (index.js).
 */

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockSend })) },
  PutCommand: jest.fn((p) => ({ _type: 'Put', ...p })),
  QueryCommand: jest.fn((p) => ({ _type: 'Query', ...p })),
}));

jest.mock('axios');
const axios = require('axios');

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('Export Lambda', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = require('../../lambdas/open-data/index').handler;
  });

  function mockRateLimitOk() {
    mockSend.mockResolvedValueOnce({ Count: 0 }); // rate limit check
  }

  function mockAuditLog() {
    mockSend.mockResolvedValueOnce({}); // audit log write
  }

  function mockAllServicesOk() {
    axios.get
      .mockResolvedValueOnce({ data: { name: 'Ramesh', phone: '9876543210' } })
      .mockResolvedValueOnce({ data: { posts: [{ id: 'p1', title: 'Post' }] } })
      .mockResolvedValueOnce({ data: { businesses: [] } })
      .mockResolvedValueOnce({ data: { complaints: [] } })
      .mockResolvedValueOnce({ data: { courses: [] } })
      .mockResolvedValueOnce({ data: { preferredLanguage: 'hi' } });
  }

  describe('Export endpoint', () => {
    test('should export user data as JSON', async () => {
      mockRateLimitOk();
      mockAllServicesOk();
      mockAuditLog();

      const result = await handler({
        httpMethod: 'GET',
        path: `/api/v1/export/${USER_ID}`,
        headers: { 'x-user-id': USER_ID },
        queryStringParameters: {},
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.export_metadata.user_id).toBe(USER_ID);
      expect(body.profile.name).toBe('Ramesh');
      expect(body.community_posts).toHaveLength(1);
    });

    test('should export as CSV when format=csv', async () => {
      mockRateLimitOk();
      mockAllServicesOk();
      mockAuditLog();

      const result = await handler({
        httpMethod: 'GET',
        path: `/api/v1/export/${USER_ID}`,
        headers: { 'x-user-id': USER_ID },
        queryStringParameters: { format: 'csv' },
      });

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/csv');
      expect(result.body).toContain('--- Export Metadata ---');
      expect(result.body).toContain('--- Profile ---');
    });

    test('should filter services when services= param given', async () => {
      mockRateLimitOk();
      // Only 2 services requested, so only 2 API calls
      axios.get
        .mockResolvedValueOnce({ data: { name: 'Ramesh' } })
        .mockResolvedValueOnce({ data: { businesses: [{ id: 'b1' }] } });
      mockAuditLog();

      const result = await handler({
        httpMethod: 'GET',
        path: `/api/v1/export/${USER_ID}`,
        headers: { 'x-user-id': USER_ID },
        queryStringParameters: { services: 'profile,businesses' },
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile).toBeDefined();
      expect(body.businesses).toBeDefined();
      expect(body.community_posts).toBeUndefined();
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    test('should reject invalid format', async () => {
      const result = await handler({
        httpMethod: 'GET',
        path: `/api/v1/export/${USER_ID}`,
        headers: { 'x-user-id': USER_ID },
        queryStringParameters: { format: 'xml' },
      });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Invalid format');
    });

    test('should reject invalid service names', async () => {
      const result = await handler({
        httpMethod: 'GET',
        path: `/api/v1/export/${USER_ID}`,
        headers: { 'x-user-id': USER_ID },
        queryStringParameters: { services: 'invalid_service' },
      });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Invalid services');
    });

    test('should block export of other users data', async () => {
      const result = await handler({
        httpMethod: 'GET',
        path: `/api/v1/export/${USER_ID}`,
        headers: { 'x-user-id': 'different-user' },
        queryStringParameters: {},
      });

      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body).error).toContain('own data');
    });

    test('should return 429 when rate limited', async () => {
      mockSend.mockResolvedValueOnce({ Count: 10 }); // over limit

      const result = await handler({
        httpMethod: 'GET',
        path: `/api/v1/export/${USER_ID}`,
        headers: { 'x-user-id': USER_ID },
        queryStringParameters: {},
      });

      expect(result.statusCode).toBe(429);
      expect(JSON.parse(result.body).error).toContain('Rate limit');
    });
  });

  describe('Audit endpoint', () => {
    test('should list audit logs for authenticated user', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { userId: USER_ID, exportedAt: '2024-01-01', servicesRequested: ['profile'], format: 'json' },
        ],
        Count: 1,
      });

      const result = await handler({
        httpMethod: 'GET',
        path: '/api/v1/export/audit',
        headers: { 'x-user-id': USER_ID },
        queryStringParameters: {},
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.audits).toHaveLength(1);
      expect(body.count).toBe(1);
    });

    test('should reject unauthenticated audit requests', async () => {
      const result = await handler({
        httpMethod: 'GET',
        path: '/api/v1/export/audit',
        headers: {},
        queryStringParameters: {},
      });

      expect(result.statusCode).toBe(403);
    });
  });

  describe('Unknown routes', () => {
    test('should return 404 for unknown route', async () => {
      const result = await handler({
        httpMethod: 'GET',
        path: '/unknown',
        headers: {},
        queryStringParameters: {},
      });

      expect(result.statusCode).toBe(404);
    });
  });
});
