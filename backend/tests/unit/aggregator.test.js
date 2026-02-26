/**
 * Unit tests for Aggregator.
 */

jest.mock('axios');
const axios = require('axios');

// Mock db and constants to avoid real DynamoDB
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
}));

const { aggregateUserData, fetchService } = require('../../lambdas/open-data/aggregator');

describe('Aggregator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchService', () => {
    test('should fetch and return data on success', async () => {
      axios.get.mockResolvedValueOnce({
        data: { name: 'Ramesh', phone: '9876543210' },
      });

      const result = await fetchService('profile', 'user-123', 'Bearer token');
      expect(result.key).toBe('profile');
      expect(result.data).toEqual({ name: 'Ramesh', phone: '9876543210' });
    });

    test('should return null data on HTTP error', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network Error'));

      const result = await fetchService('profile', 'user-123');
      expect(result.key).toBe('profile');
      expect(result.data).toBeNull();
      expect(result.error).toBe('Network Error');
    });

    test('should return error for unknown service', async () => {
      const result = await fetchService('nonexistent', 'user-123');
      expect(result.data).toBeNull();
      expect(result.error).toBe('Unknown service');
    });

    test('should extract nested data for community_posts', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          posts: [{ id: 'p1', title: 'Post 1' }],
          pagination: { total: 1 },
        },
      });

      const result = await fetchService('community_posts', 'user-123');
      expect(result.data).toEqual([{ id: 'p1', title: 'Post 1' }]);
    });

    test('should forward auth token in headers', async () => {
      axios.get.mockResolvedValueOnce({ data: {} });

      await fetchService('profile', 'user-123', 'Bearer my-token');

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
            'X-User-Id': 'user-123',
          }),
        })
      );
    });
  });

  describe('aggregateUserData', () => {
    test('should aggregate all services in parallel', async () => {
      // Mock all 6 service calls
      axios.get
        .mockResolvedValueOnce({ data: { fullName: 'Ramesh', mobile: '9876543210' } })
        .mockResolvedValueOnce({ data: { posts: [{ id: 'p1', title: 'Post' }] } })
        .mockResolvedValueOnce({ data: { businesses: [{ id: 'b1', name: 'Farm' }] } })
        .mockResolvedValueOnce({ data: { complaints: [] } })
        .mockResolvedValueOnce({ data: { courses: [{ id: 'c1', title: 'Course' }] } })
        .mockResolvedValueOnce({ data: { preferredLanguage: 'hi', interests: ['farming'] } });

      const result = await aggregateUserData('user-123');

      expect(result.export_metadata.user_id).toBe('user-123');
      expect(result.export_metadata.services_included).not.toHaveLength(0);
      expect(result.profile.name).toBe('Ramesh');
      expect(result.community_posts).toHaveLength(1);
      expect(result.businesses).toHaveLength(1);
      expect(result.courses).toHaveLength(1);
      expect(result.learning_profile.preferred_language).toBe('hi');
    });

    test('should handle partial failures gracefully', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { name: 'Sita' } }) // profile OK
        .mockRejectedValueOnce(new Error('Service down'))   // posts FAIL
        .mockResolvedValueOnce({ data: { businesses: [] } }) // businesses OK
        .mockRejectedValueOnce(new Error('Timeout'))         // complaints FAIL
        .mockResolvedValueOnce({ data: { courses: [] } })    // courses OK
        .mockRejectedValueOnce(new Error('Auth fail'));       // learning_profile FAIL

      const result = await aggregateUserData('user-123');

      expect(result.profile.name).toBe('Sita');
      expect(result.community_posts).toEqual([]);
      expect(result.complaints).toEqual([]);
      expect(result.learning_profile).toBeNull();
      expect(result.export_metadata.services_failed.length).toBeGreaterThan(0);
    });

    test('should filter to selected services only', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { name: 'Ram' } })
        .mockResolvedValueOnce({ data: { businesses: [{ id: 'b1' }] } });

      const result = await aggregateUserData('user-123', ['profile', 'businesses']);

      expect(result.profile).toBeDefined();
      expect(result.businesses).toBeDefined();
      expect(result.community_posts).toBeUndefined();
      expect(result.courses).toBeUndefined();
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    test('should throw on invalid service keys', async () => {
      await expect(aggregateUserData('user-123', ['nonexistent']))
        .rejects.toThrow('INVALID_SERVICES');
    });
  });
});
