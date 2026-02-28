/**
 * Tests for Knowledge Base (Module 5).
 */

const mockDynamoSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: jest.fn().mockRejectedValue(new Error('No Bedrock')) })),
  InvokeModelCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn(() => ({})) }));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDynamoSend })) },
  PutCommand: jest.fn((p) => p),
  QueryCommand: jest.fn((p) => p),
  GetCommand: jest.fn((p) => p),
  ScanCommand: jest.fn((p) => p),
}));

jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn() })) }));

const { listArticles, getArticle, generateArticle, getFallbackArticle } = require('../../lambdas/health-ai/knowledge-base');

describe('Knowledge Base', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listArticles', () => {
    test('should query by topic using GSI', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [{ articleId: 'a1', topic: 'diabetes', title: 'Understanding Diabetes' }],
      });

      const articles = await listArticles('diabetes');
      expect(articles).toHaveLength(1);
      expect(articles[0].topic).toBe('diabetes');
    });

    test('should scan all when no topic', async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      const articles = await listArticles(null);
      expect(articles).toEqual([]);
    });
  });

  describe('getArticle', () => {
    test('should return article by ID', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: { articleId: 'a1', title: 'Test Article' },
      });

      const article = await getArticle('a1');
      expect(article.title).toBe('Test Article');
    });

    test('should return null for missing article', async () => {
      mockDynamoSend.mockResolvedValueOnce({ Item: undefined });
      const article = await getArticle('nonexistent');
      expect(article).toBeNull();
    });
  });

  describe('generateArticle', () => {
    test('should reject empty topic', async () => {
      await expect(generateArticle(null))
        .rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
    });

    test('should return cached article if exists', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [{ articleId: 'a1', topic: 'malaria', title: 'Existing' }],
      });

      const result = await generateArticle('malaria');
      expect(result.cached).toBe(true);
      expect(result.article.title).toBe('Existing');
    });

    test('should generate fallback article when Bedrock fails', async () => {
      mockDynamoSend
        .mockResolvedValueOnce({ Items: [] })  // no cache
        .mockResolvedValueOnce({});             // put article

      const result = await generateArticle('dengue');
      expect(result.cached).toBe(false);
      expect(result.article.topic).toBe('dengue');
      expect(result.article.sections.length).toBeGreaterThan(0);
    });
  });

  describe('getFallbackArticle', () => {
    test('should produce structured article', () => {
      const article = getFallbackArticle('tuberculosis');
      expect(article.title).toContain('Tuberculosis');
      expect(article.sections.length).toBeGreaterThan(0);
      expect(article.sections[0].heading).toBe('What is it?');
    });
  });
});
