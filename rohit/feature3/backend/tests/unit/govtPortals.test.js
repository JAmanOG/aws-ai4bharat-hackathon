/**
 * Tests for Government Health Portals (Module 3).
 */

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: jest.fn().mockRejectedValue(new Error('No Bedrock')) })),
  InvokeModelCommand: jest.fn((p) => p),
}));

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
const { listPortals, getPortal, checkEligibility } = require('../../lambdas/health-directory/govt-portals');

describe('Government Health Portals', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listPortals', () => {
    test('should list all portals', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: 'p1', name: 'eSanjeevani', category: 'telemedicine' },
          { id: 'p2', name: 'Ayushman Bharat', category: 'insurance' },
        ],
      });

      const portals = await listPortals();
      expect(portals).toHaveLength(2);
    });

    test('should filter by category', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'p1', name: 'eSanjeevani', category: 'telemedicine' }],
      });

      const portals = await listPortals('telemedicine');
      expect(portals).toHaveLength(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('category'),
        expect.arrayContaining(['telemedicine'])
      );
    });

    test('should search by name', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await listPortals(null, 'ayushman');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%ayushman%'])
      );
    });
  });

  describe('getPortal', () => {
    test('should return portal by ID', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'p1', name: 'eSanjeevani', url: 'https://esanjeevani.in' }],
      });

      const portal = await getPortal('p1');
      expect(portal.name).toBe('eSanjeevani');
    });

    test('should return null for missing portal', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const portal = await getPortal('nonexistent');
      expect(portal).toBeNull();
    });
  });

  describe('checkEligibility', () => {
    test('should reject without age and location', async () => {
      await expect(checkEligibility({ income: 10000 }))
        .rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
    });

    test('should return rule-based eligibility (Bedrock fallback)', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { name: 'eSanjeevani', category: 'telemedicine', eligibility_criteria: {}, services_offered: [] },
          { name: 'PM-JAY', category: 'insurance', eligibility_criteria: {}, services_offered: [] },
        ],
      });

      const result = await checkEligibility({ age: 35, location: 'Panvel', bplCard: true });
      expect(result.eligible_schemes.length).toBeGreaterThan(0);
      expect(result.documents_needed).toBeDefined();
      expect(result.disclaimer).toBeDefined();
    });

    test('should include PM-JAY for BPL families', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await checkEligibility({ age: 40, location: 'Mumbai', bplCard: true });
      const pmjay = result.eligible_schemes.find(s => s.name.includes('PM-JAY'));
      expect(pmjay).toBeDefined();
      expect(pmjay.likely_eligible).toBe(true);
    });
  });
});
