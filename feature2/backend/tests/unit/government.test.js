/**
 * Unit tests for Government Lambda.
 */

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({ query: jest.fn() })),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
}));

jest.mock('../../utils/db', () => ({
  query: jest.fn(),
  dynamoDB: { send: jest.fn() },
  TABLE_NAMES: {},
}));

const { query } = require('../../utils/db');

describe('Government Lambda', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = require('../../lambdas/government/index').handler;
  });

  describe('List Portals', () => {
    test('should return paginated portals', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'p1', name: 'CPGRAMS', category: 'general' },
            { id: 'p2', name: 'PMGSY', category: 'roads' },
          ],
        });

      const event = {
        httpMethod: 'GET',
        path: '/community/government/portals',
        queryStringParameters: {},
      };

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.portals).toHaveLength(2);
      expect(body.pagination.total).toBe(10);
    });

    test('should filter portals by category', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'PMGSY', category: 'roads' }] });

      const event = {
        httpMethod: 'GET',
        path: '/community/government/portals',
        queryStringParameters: { category: 'roads' },
      };

      const result = await handler(event);
      const body = JSON.parse(result.body);
      expect(body.portals).toHaveLength(1);
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[0][1]).toContain('roads');
    });
  });

  describe('List Schemes', () => {
    test('should return schemes with category info', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '6' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 's1', name: 'PMAY', category_name: 'Housing', category_icon: '🏠' },
            { id: 's2', name: 'PM-KISAN', category_name: 'Agriculture', category_icon: '🌱' },
          ],
        });

      const event = {
        httpMethod: 'GET',
        path: '/community/government/schemes',
        queryStringParameters: {},
      };

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.schemes).toHaveLength(2);
    });
  });

  describe('Save Complaint', () => {
    test('should save a complaint reference', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'c1', portal_name: 'CPGRAMS', reference_no: 'REF123', status: 'filed' }],
      });

      const event = {
        httpMethod: 'POST',
        path: '/community/government/complaints',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ portalName: 'CPGRAMS', referenceNo: 'REF123' }),
      };

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.portal_name).toBe('CPGRAMS');
    });

    test('should reject complaint without required fields', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/community/government/complaints',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({}),
      };

      const result = await handler(event);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('Scheme Categories', () => {
    test('should list scheme categories with counts', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: 'sc1', name: 'Housing', scheme_count: '2' },
          { id: 'sc2', name: 'Water', scheme_count: '1' },
        ],
      });

      const event = {
        httpMethod: 'GET',
        path: '/community/government/schemes/categories',
        queryStringParameters: {},
      };

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toHaveLength(2);
    });
  });
});
