/**
 * Unit tests for Community Lambda.
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
const { handler } = require('../../lambdas/community/index');

// Valid UUIDs for route matching
const POST_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const DEMO_USER = 'demo-user'; // default userId from handler

describe('Community Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Post', () => {
    test('should create a knowledge post', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: POST_ID, title: 'Organic Farming', content: 'Guide...', topic: 'agriculture' }],
      });

      const result = await handler({
        httpMethod: 'POST',
        path: '/community/posts',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ title: 'Organic Farming', content: 'Guide...', topic: 'agriculture' }),
      });

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.title).toBe('Organic Farming');
      expect(body.topic).toBe('agriculture');
    });

    test('should reject post without title', async () => {
      const result = await handler({
        httpMethod: 'POST',
        path: '/community/posts',
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ content: 'no title' }),
      });
      expect(result.statusCode).toBe(400);
    });
  });

  describe('List Posts', () => {
    test('should return paginated posts', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '15' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'p1', title: 'Post A', author_name: 'User 1', bookmark_count: '3' },
            { id: 'p2', title: 'Post B', author_name: 'User 2', bookmark_count: '1' },
          ],
        });

      const result = await handler({
        httpMethod: 'GET',
        path: '/community/posts',
        queryStringParameters: { page: '1', limit: '10' },
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.posts).toHaveLength(2);
      expect(body.pagination.total).toBe(15);
    });
  });

  describe('Get Post', () => {
    test('should return a post by ID', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: POST_ID, title: 'Post A', author_name: 'User 1', bookmark_count: '5' }],
      });

      const result = await handler({
        httpMethod: 'GET',
        path: `/community/posts/${POST_ID}`,
        queryStringParameters: {},
      });

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).title).toBe('Post A');
    });

    test('should return 404 for non-existent post', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await handler({
        httpMethod: 'GET',
        path: `/community/posts/${POST_ID}`,
        queryStringParameters: {},
      });
      expect(result.statusCode).toBe(404);
    });
  });

  describe('Bookmark Toggle', () => {
    test('should toggle bookmark ON', async () => {
      query
        .mockResolvedValueOnce({ rows: [] }) // not bookmarked
        .mockResolvedValueOnce({}); // insert

      const result = await handler({
        httpMethod: 'POST',
        path: `/community/posts/${POST_ID}/bookmark`,
        headers: { 'x-user-id': 'user-1' },
        body: null,
      });

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).bookmarked).toBe(true);
    });

    test('should toggle bookmark OFF', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 'b1' }] }) // already bookmarked
        .mockResolvedValueOnce({}); // delete

      const result = await handler({
        httpMethod: 'POST',
        path: `/community/posts/${POST_ID}/bookmark`,
        headers: { 'x-user-id': 'user-1' },
        body: null,
      });

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).bookmarked).toBe(false);
    });
  });

  describe('Follow Toggle', () => {
    test('should prevent self-follow', async () => {
      // default userId is 'demo-user', so follow path must also be 'demo-user'
      // but the regex requires [a-f0-9-]+, so we need to set header to a UUID
      const result = await handler({
        httpMethod: 'POST',
        path: `/community/follow/${USER_ID}`,
        headers: { 'x-user-id': USER_ID }, // same user = self-follow
        body: null,
      });
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('yourself');
    });
  });

  describe('Report Post', () => {
    test('should reject report without reason', async () => {
      const result = await handler({
        httpMethod: 'POST',
        path: `/community/posts/${POST_ID}/report`,
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({}),
      });
      expect(result.statusCode).toBe(400);
    });

    test('should prevent duplicate report', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // already reported

      const result = await handler({
        httpMethod: 'POST',
        path: `/community/posts/${POST_ID}/report`,
        headers: { 'x-user-id': 'user-1' },
        body: JSON.stringify({ reason: 'Spam' }),
      });
      expect(result.statusCode).toBe(409);
    });
  });
});
