/**
 * Unit tests for CSV Formatter.
 */

const { toCSV, escapeCSV, arrayToCSV, objectToCSV } = require('../../lambdas/open-data/csv-formatter');

describe('CSV Formatter', () => {
  describe('escapeCSV', () => {
    test('should return empty string for null', () => {
      expect(escapeCSV(null)).toBe('');
      expect(escapeCSV(undefined)).toBe('');
    });

    test('should return plain string as-is', () => {
      expect(escapeCSV('hello')).toBe('hello');
    });

    test('should quote strings with commas', () => {
      expect(escapeCSV('hello, world')).toBe('"hello, world"');
    });

    test('should escape double quotes', () => {
      expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
    });

    test('should quote strings with newlines', () => {
      expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
    });

    test('should convert numbers to strings', () => {
      expect(escapeCSV(42)).toBe('42');
    });
  });

  describe('arrayToCSV', () => {
    test('should create section with header and rows', () => {
      const items = [
        { id: '1', name: 'Farm A', active: true },
        { id: '2', name: 'Shop B', active: false },
      ];
      const result = arrayToCSV('Businesses', items, ['id', 'name', 'active']);
      const lines = result.split('\n');
      expect(lines[0]).toBe('--- Businesses ---');
      expect(lines[1]).toBe('id,name,active');
      expect(lines[2]).toBe('1,Farm A,true');
      expect(lines[3]).toBe('2,Shop B,false');
    });

    test('should return empty string for empty array', () => {
      expect(arrayToCSV('Empty', [], ['id'])).toBe('');
    });

    test('should return empty string for null', () => {
      expect(arrayToCSV('Null', null, ['id'])).toBe('');
    });
  });

  describe('objectToCSV', () => {
    test('should create key-value rows', () => {
      const obj = { name: 'Ramesh', phone: '9876543210' };
      const result = objectToCSV('Profile', obj);
      const lines = result.split('\n');
      expect(lines[0]).toBe('--- Profile ---');
      expect(lines[1]).toBe('Field,Value');
      expect(lines[2]).toBe('name,Ramesh');
      expect(lines[3]).toBe('phone,9876543210');
    });

    test('should join arrays with semicolons', () => {
      const obj = { interests: ['farming', 'dairy'] };
      const result = objectToCSV('Data', obj);
      expect(result).toContain('farming; dairy');
    });

    test('should return empty string for null', () => {
      expect(objectToCSV('Null', null)).toBe('');
    });
  });

  describe('toCSV', () => {
    test('should produce full CSV with all sections', () => {
      const exportData = {
        export_metadata: { user_id: 'u1', exported_at: '2024-01-01', format: 'csv' },
        profile: { name: 'Ramesh', phone: '9876543210' },
        community_posts: [{ id: 'p1', title: 'Post', content: 'Body', topic: 'general', created_at: '2024-01-01' }],
        businesses: [{ id: 'b1', name: 'Farm', category: 'Dairy', phone: '123', address: 'Village', active: true }],
        complaints: [],
        courses: [{ id: 'c1', title: 'Course', category: 'Agri', status: 'enrolled', progress_pct: 50 }],
        learning_profile: { preferred_language: 'hi', interests: ['farming'], completed_courses: 3, skill_level: 'beginner' },
      };

      const csv = toCSV(exportData);
      expect(csv).toContain('--- Export Metadata ---');
      expect(csv).toContain('--- Profile ---');
      expect(csv).toContain('--- Community Posts ---');
      expect(csv).toContain('--- Business Listings ---');
      expect(csv).toContain('--- Courses ---');
      expect(csv).toContain('--- Learning Profile ---');
      expect(csv).not.toContain('--- Complaints ---'); // empty array = omitted
    });

    test('should handle export with no data', () => {
      const exportData = {
        export_metadata: { user_id: 'u1', exported_at: '2024-01-01', format: 'csv' },
        profile: null,
        community_posts: [],
        businesses: [],
        complaints: [],
        courses: [],
        learning_profile: null,
      };

      const csv = toCSV(exportData);
      expect(csv).toContain('--- Export Metadata ---');
      expect(csv).not.toContain('--- Profile ---');
      expect(csv).not.toContain('--- Community Posts ---');
    });
  });
});
