/**
 * Tests for Private Provider Directory (Module 4).
 */

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn(() => ({})) }));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
}));

jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn() })) }));

jest.mock('../../utils/db', () => ({
  query: jest.fn(),
  dynamoDB: { send: jest.fn() },
  TABLE_NAMES: {},
}));

const { query } = require('../../utils/db');
const { listProviders, getProvider } = require('../../lambdas/health-directory/providers');

describe('Provider Directory', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listProviders', () => {
    test('should list providers with pagination', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '12' }] })  // count
        .mockResolvedValueOnce({
          rows: [
            { id: 'p1', name: 'Apollo', type: 'hospital', city: 'Mumbai', rating: 4.3 },
            { id: 'p2', name: 'Practo', type: 'telemedicine', city: 'Pan-India', rating: 4.1 },
          ],
        });

      const result = await listProviders({ page: '1', limit: '10' });
      expect(result.providers).toHaveLength(2);
      expect(result.pagination.total).toBe(12);
    });

    test('should filter by city (includes Pan-India)', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'Apollo', city: 'Mumbai' }] });

      await listProviders({ city: 'Mumbai' });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('Pan-India'),
        expect.arrayContaining(['%Mumbai%'])
      );
    });

    test('should filter by type', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: [] });

      await listProviders({ type: 'pharmacy' });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.arrayContaining(['pharmacy'])
      );
    });

    test('should handle empty results', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await listProviders({ city: 'Nonexistent' });
      expect(result.providers).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getProvider', () => {
    test('should return provider by ID', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 'p1', name: 'Apollo Hospitals', type: 'hospital',
          city: 'Mumbai', phone: '022-33505000', rating: 4.3,
        }],
      });

      const provider = await getProvider('p1');
      expect(provider.name).toBe('Apollo Hospitals');
      expect(provider.rating).toBe(4.3);
    });

    test('should return null for missing provider', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const provider = await getProvider('nonexistent');
      expect(provider).toBeNull();
    });
  });
});
