/**
 * Unit tests for Adapter Layer.
 */

const {
  adaptProfile,
  adaptCommunityPosts,
  adaptBusinesses,
  adaptComplaints,
  adaptCourses,
  adaptLearningProfile,
} = require('../../lambdas/open-data/adapters');

describe('Adapters', () => {
  describe('adaptProfile', () => {
    test('should normalize profile with fullName/mobile', () => {
      const result = adaptProfile({ fullName: 'Ramesh', mobile: '9876543210', email: 'r@test.com' });
      expect(result.name).toBe('Ramesh');
      expect(result.phone).toBe('9876543210');
      expect(result.email).toBe('r@test.com');
    });

    test('should normalize profile with name/phone', () => {
      const result = adaptProfile({ name: 'Sita', phone: '9876543211' });
      expect(result.name).toBe('Sita');
      expect(result.phone).toBe('9876543211');
    });

    test('should return null for null input', () => {
      expect(adaptProfile(null)).toBeNull();
    });

    test('should set defaults for missing fields', () => {
      const result = adaptProfile({});
      expect(result.name).toBeNull();
      expect(result.language).toBe('en');
      expect(result.verified).toBe(false);
    });
  });

  describe('adaptCommunityPosts', () => {
    test('should normalize posts array', () => {
      const raw = [
        { id: 'p1', title: 'Farming', content: 'Guide', topic: 'agriculture', created_at: '2024-01-01' },
        { id: 'p2', title: 'Market', content: 'Tips', createdAt: '2024-01-02' },
      ];
      const result = adaptCommunityPosts(raw);
      expect(result).toHaveLength(2);
      expect(result[0].topic).toBe('agriculture');
      expect(result[1].topic).toBe('general');
      expect(result[1].created_at).toBe('2024-01-02');
    });

    test('should return empty array for non-array', () => {
      expect(adaptCommunityPosts(null)).toEqual([]);
      expect(adaptCommunityPosts('string')).toEqual([]);
    });
  });

  describe('adaptBusinesses', () => {
    test('should normalize businesses', () => {
      const raw = [
        { id: 'b1', name: 'Farm A', category_name: 'Dairy', phone: '123', address: 'Village', is_active: true },
        { id: 'b2', name: 'Shop B', category: 'Retail' },
      ];
      const result = adaptBusinesses(raw);
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('Dairy');
      expect(result[1].category).toBe('Retail');
      expect(result[1].active).toBe(true); // default
    });

    test('should return empty for null', () => {
      expect(adaptBusinesses(null)).toEqual([]);
    });
  });

  describe('adaptComplaints', () => {
    test('should normalize complaints with varied field names', () => {
      const raw = [
        { id: 'c1', portal_name: 'CPGRAMS', reference_no: 'REF1', status: 'filed', filed_at: '2024-01-01' },
        { id: 'c2', portalName: 'PMGSY', referenceNo: 'REF2', status: 'resolved' },
      ];
      const result = adaptComplaints(raw);
      expect(result).toHaveLength(2);
      expect(result[0].portal).toBe('CPGRAMS');
      expect(result[1].portal).toBe('PMGSY');
      expect(result[1].reference_no).toBe('REF2');
    });
  });

  describe('adaptCourses', () => {
    test('should normalize courses', () => {
      const raw = [
        { id: 'c1', title: 'Basics', category: 'Agriculture', status: 'enrolled', completionPct: 50 },
        { courseId: 'c2', course: { title: 'Advanced' }, progress: 80 },
      ];
      const result = adaptCourses(raw);
      expect(result).toHaveLength(2);
      expect(result[0].progress_pct).toBe(50);
      expect(result[1].id).toBe('c2');
      expect(result[1].title).toBe('Advanced');
      expect(result[1].progress_pct).toBe(80);
    });
  });

  describe('adaptLearningProfile', () => {
    test('should normalize learning profile with camelCase', () => {
      const result = adaptLearningProfile({
        preferredLanguage: 'hi',
        interests: ['farming', 'dairy'],
        completedCourses: 5,
        skillLevel: 'intermediate',
      });
      expect(result.preferred_language).toBe('hi');
      expect(result.interests).toEqual(['farming', 'dairy']);
      expect(result.completed_courses).toBe(5);
    });

    test('should normalize with snake_case', () => {
      const result = adaptLearningProfile({
        preferred_language: 'bn',
        topics: ['business'],
        completed_courses: 3,
      });
      expect(result.preferred_language).toBe('bn');
      expect(result.interests).toEqual(['business']);
    });

    test('should return null for null input', () => {
      expect(adaptLearningProfile(null)).toBeNull();
    });
  });
});
