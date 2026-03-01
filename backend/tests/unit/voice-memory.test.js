/**
 * Unit tests for Voice – memory.js
 * Tests DynamoDB conversation memory with mocked AWS SDK.
 */

/* ---------- Mock DynamoDB ---------- */
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend })),
  },
  PutCommand: jest.fn(function (params) { this.input = params; }),
  QueryCommand: jest.fn(function (params) { this.input = params; }),
  DeleteCommand: jest.fn(function (params) { this.input = params; }),
  UpdateCommand: jest.fn(function (params) { this.input = params; }),
}));

/* Mock LLM for extractFacts — generateResponse returns {content, provider, usage} */
jest.mock('../../services/llm', () => ({
  generateResponse: jest.fn(async () => ({
    content: '{"user_name": "Ramesh", "location_state": "Maharashtra"}',
    provider: 'sarvam-m',
    usage: {},
  })),
}));

const memory = require('../../services/memory');

describe('Voice Memory Service', () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.STAGE = 'dev';
  });

  describe('storeTurn', () => {
    test('stores a conversation turn with TTL', async () => {
      mockSend.mockResolvedValueOnce({});

      await memory.storeTurn('user-123', 'session-abc', 'user', 'What is wheat price?', {
        language: 'hi-IN',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const putArgs = mockSend.mock.calls[0][0];
      expect(putArgs.input.Item.userId).toBe('user-123');
      expect(putArgs.input.Item.sessionId).toBe('session-abc');
      expect(putArgs.input.Item.role).toBe('user');
      expect(putArgs.input.Item.text).toBe('What is wheat price?');
      expect(putArgs.input.Item.ttl).toBeDefined(); // 30-day TTL
    });
  });

  describe('getSessionHistory', () => {
    test('queries session turns sorted by turnId', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { turnId: 'session-abc#001', role: 'user', text: 'hello' },
          { turnId: 'session-abc#002', role: 'assistant', text: 'hi' },
        ],
      });

      const result = await memory.getSessionHistory('user-123', 'session-abc');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    test('returns empty array on no items', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const result = await memory.getSessionHistory('user-123', 'session-xyz');
      expect(result).toEqual([]);
    });
  });

  describe('upsertFact', () => {
    test('writes a user fact with 1-year TTL', async () => {
      mockSend.mockResolvedValueOnce({});

      await memory.upsertFact('user-123', 'user_name', 'Ramesh Kumar', 'chat');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const args = mockSend.mock.calls[0][0];
      expect(args.input.Item.userId).toBe('user-123');
      expect(args.input.Item.factKey).toBe('user_name');
      expect(args.input.Item.factValue).toBe('Ramesh Kumar');
      expect(args.input.Item.ttl).toBeDefined();
    });
  });

  describe('getUserFacts', () => {
    test('retrieves all facts for a user', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { factKey: 'user_name', factValue: 'Ramesh' },
          { factKey: 'location_state', factValue: 'Maharashtra' },
        ],
      });

      const result = await memory.getUserFacts('user-123');

      expect(Object.keys(result)).toHaveLength(2);
      expect(result.user_name).toBe('Ramesh');
      expect(result.location_state).toBe('Maharashtra');
    });
  });

  describe('deleteFact', () => {
    test('deletes a specific user fact', async () => {
      mockSend.mockResolvedValueOnce({});

      await memory.deleteFact('user-123', 'user_name');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const args = mockSend.mock.calls[0][0];
      expect(args.input.Key.userId).toBe('user-123');
      expect(args.input.Key.factKey).toBe('user_name');
    });
  });

  describe('extractFacts', () => {
    test('parses LLM response into fact key-value pairs', async () => {
      const facts = await memory.extractFacts('My name is Ramesh and I farm in Maharashtra');

      expect(facts).toBeDefined();
      expect(facts.user_name).toBe('Ramesh');
      expect(facts.location_state).toBe('Maharashtra');
    });
  });

  describe('buildContextMessages', () => {
    test('constructs system prompt with user facts and history', async () => {
      // Mock getUserFacts
      mockSend
        .mockResolvedValueOnce({
          Items: [
            { factKey: 'user_name', factValue: 'Ramesh' },
            { factKey: 'crops', factValue: 'wheat, rice' },
          ],
        })
        // Mock getSessionHistory
        .mockResolvedValueOnce({
          Items: [
            { turnId: 's1#001', role: 'user', text: 'namaste' },
            { turnId: 's1#002', role: 'assistant', text: 'namaste! kaise hain?' },
          ],
        });

      const messages = await memory.buildContextMessages('user-123', 'session-1', 'What is wheat price?');

      expect(messages.length).toBeGreaterThanOrEqual(2); // system + user at minimum
      const systemMsg = messages.find((m) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg.content).toContain('Ramesh');
    });
  });
});
