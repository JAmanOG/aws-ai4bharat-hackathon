/**
 * Unit tests for Business Lambda.
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
const { handler } = require('../../lambdas/business/index');

describe('Business Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('List Categories', () => {
    test('should return all categories with subcategories', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: 'c1', name: 'Dairy', icon: '🥛', subcategories: [{ id: 's1', name: 'Milk' }] },
          { id: 'c2', name: 'Poultry', icon: '🐔', subcategories: null },
        ],
      });

      const result = await handler({
        httpMethod: 'GET',
        path: '/community/businesses/categories',
      });

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toHaveLength(2);
    });
  });

  describe('Create Business', () => {
    test('should create a business with valid data', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] }) // category check
        .mockResolvedValueOnce({ rows: [] }) // duplicate check
        .mockResolvedValueOnce({ rows: [{ id: 'biz-1', name: 'Ram Dairy', phone: '9876543210' }] }); // insert

      const result = await handler({
        httpMethod: 'POST',
        path: '/community/businesses',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ name: 'Ram Dairy', phone: '9876543210', address: 'Village Road', categoryId: 'cat-1' }),
      });

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body).name).toBe('Ram Dairy');
    });

    test('should reject invalid phone number', async () => {
      // Phone validation happens before any query calls, so no mock needed
      const result = await handler({
        httpMethod: 'POST',
        path: '/community/businesses',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ name: 'Bad Phone', phone: '12345', address: 'Village', categoryId: 'cat-1' }),
      });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('phone');
    });

    test('should reject missing required fields', async () => {
      const result = await handler({
        httpMethod: 'POST',
        path: '/community/businesses',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ name: 'No Phone' }),
      });
      expect(result.statusCode).toBe(400);
    });

    test('should reject duplicate business name', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] }) // category exists
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // duplicate found

      const result = await handler({
        httpMethod: 'POST',
        path: '/community/businesses',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ name: 'Existing', phone: '9876543210', address: 'Village', categoryId: 'cat-1' }),
      });

      expect(result.statusCode).toBe(409);
    });
  });

  describe('List Businesses', () => {
    test('should return paginated businesses', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '25' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'b1', name: 'Farm A', category_name: 'Dairy' },
            { id: 'b2', name: 'Farm B', category_name: 'Poultry' },
          ],
        });

      const result = await handler({
        httpMethod: 'GET',
        path: '/community/businesses',
        queryStringParameters: { page: '1', limit: '10' },
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.businesses).toHaveLength(2);
      expect(body.pagination.total).toBe(25);
      expect(body.pagination.totalPages).toBe(3);
    });
  });

  describe('Get Business', () => {
    test('should return 404 for non-existent business', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await handler({
        httpMethod: 'GET',
        path: '/community/businesses/nonexistent',
      });
      expect(result.statusCode).toBe(404);
    });
  });
});
