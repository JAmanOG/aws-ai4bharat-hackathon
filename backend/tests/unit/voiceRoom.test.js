/**
 * Unit tests for Voice Room Lambda.
 */

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockSend })) },
  PutCommand: jest.fn((p) => ({ _type: 'Put', ...p })),
  GetCommand: jest.fn((p) => ({ _type: 'Get', ...p })),
  UpdateCommand: jest.fn((p) => ({ _type: 'Update', ...p })),
  QueryCommand: jest.fn((p) => ({ _type: 'Query', ...p })),
  ScanCommand: jest.fn((p) => ({ _type: 'Scan', ...p })),
  DeleteCommand: jest.fn((p) => ({ _type: 'Delete', ...p })),
}));

jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn() })) }));

const { handler } = require('../../lambdas/voice-room/index');

// Valid UUID for route matching
const ROOM_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('Voice Room Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create a voice room', async () => {
    mockSend
      .mockResolvedValueOnce({}) // PutCommand room
      .mockResolvedValueOnce({}); // PutCommand participant

    const result = await handler({
      httpMethod: 'POST',
      path: '/community/voice-rooms',
      headers: { 'x-user-id': 'user-1', 'x-user-name': 'TestUser' },
      body: JSON.stringify({ title: 'Farming Tips', topics: ['agriculture'] }),
    });

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.title).toBe('Farming Tips');
    expect(body.status).toBe('active');
    expect(body.participants).toHaveLength(1);
    expect(body.participants[0].role).toBe('moderator');
  });

  test('should reject room without title', async () => {
    const result = await handler({
      httpMethod: 'POST',
      path: '/community/voice-rooms',
      headers: { 'x-user-id': 'user-1' },
      body: JSON.stringify({}),
    });
    expect(result.statusCode).toBe(400);
  });

  test('should list active rooms', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { roomId: 'r1', title: 'Room 1', status: 'active', topics: ['agriculture'], participantCount: 3, createdAt: '2024-01-01' },
        { roomId: 'r2', title: 'Room 2', status: 'active', topics: ['business'], participantCount: 5, createdAt: '2024-01-02' },
      ],
    });

    const result = await handler({
      httpMethod: 'GET',
      path: '/community/voice-rooms',
      queryStringParameters: { status: 'active' },
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.rooms).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  test('should filter rooms by topic', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { roomId: 'r1', title: 'Room 1', topics: ['agriculture'], createdAt: '2024-01-01' },
        { roomId: 'r2', title: 'Room 2', topics: ['business'], createdAt: '2024-01-02' },
      ],
    });

    const result = await handler({
      httpMethod: 'GET',
      path: '/community/voice-rooms',
      queryStringParameters: { topic: 'agriculture' },
    });

    const body = JSON.parse(result.body);
    expect(body.rooms).toHaveLength(1);
    expect(body.rooms[0].topics).toContain('agriculture');
  });

  test('should get room by ID with participants', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { roomId: ROOM_ID, title: 'Test Room', status: 'active' } })
      .mockResolvedValueOnce({ Items: [{ userId: 'u1', role: 'moderator', isBlocked: false }] });

    const result = await handler({
      httpMethod: 'GET',
      path: `/community/voice-rooms/${ROOM_ID}`,
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.roomId).toBe(ROOM_ID);
    expect(body.participants).toHaveLength(1);
  });

  test('should return 404 for non-existent room', async () => {
    mockSend.mockResolvedValueOnce({ Item: null });

    const result = await handler({
      httpMethod: 'GET',
      path: `/community/voice-rooms/${ROOM_ID}`,
    });
    expect(result.statusCode).toBe(404);
  });

  test('should get chat messages', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { roomId: ROOM_ID, messageId: '2024-01-01#m1', content: 'Hello' },
        { roomId: ROOM_ID, messageId: '2024-01-01#m2', content: 'World' },
      ],
      LastEvaluatedKey: null,
    });

    const result = await handler({
      httpMethod: 'GET',
      path: `/community/voice-rooms/${ROOM_ID}/chat`,
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.messages).toHaveLength(2);
  });

  test('should return 404 for unknown route', async () => {
    const result = await handler({
      httpMethod: 'GET',
      path: '/unknown-route',
    });
    expect(result.statusCode).toBe(404);
  });
});
