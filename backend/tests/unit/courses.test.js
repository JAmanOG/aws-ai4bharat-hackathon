/**
 * Unit tests for Knowledge API – courses.js
 */

// Mock pg module
jest.mock('pg', () => {
    const mockQuery = jest.fn();
    return {
        Pool: jest.fn(() => ({
            query: mockQuery,
        })),
        __mockQuery: mockQuery,
    };
});

jest.mock('../../utils/db', () => ({
    query: jest.fn(),
    dynamoDB: { send: jest.fn() },
    TABLE_NAMES: {
        USER_LEARNING_PROFILE: 'UserLearningProfile',
        PEER_GROUPS: 'PeerGroups',
        LEARNING_RECOMMENDATIONS: 'LearningRecommendations',
        CONTENT_INTERACTIONS: 'ContentInteractions',
    },
}));

const { query } = require('../../utils/db');
const { listCourses, getCourseById, createCourse } = require('../../lambdas/knowledge-api/courses');

describe('Courses Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listCourses', () => {
        test('should return paginated courses with no filters', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // count query
                .mockResolvedValueOnce({
                    rows: [
                        { id: 'c1', title: 'Organic Farming', category: 'agriculture', language: 'hi' },
                        { id: 'c2', title: 'Digital Literacy', category: 'digital-literacy', language: 'hi' },
                    ],
                });

            const result = await listCourses({ page: 1, limit: 20 });

            expect(result.courses).toHaveLength(2);
            expect(result.pagination.total).toBe(5);
            expect(result.pagination.page).toBe(1);
        });

        test('should filter by language', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '2' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'c1', language: 'hi' }] });

            const result = await listCourses({ language: 'hi', page: 1, limit: 10 });

            expect(result.courses).toHaveLength(1);
            expect(query).toHaveBeenCalledTimes(2);
            // Verify language filter is in the SQL
            const countCall = query.mock.calls[0];
            expect(countCall[1]).toContain('hi');
        });

        test('should filter by category', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'c1', category: 'agriculture' }] });

            const result = await listCourses({ category: 'agriculture', page: 1, limit: 10 });

            expect(result.courses).toHaveLength(1);
        });

        test('should handle search query', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Organic Farming' }] });

            const result = await listCourses({ search: 'organic', page: 1, limit: 10 });

            expect(result.courses).toHaveLength(1);
        });
    });

    describe('getCourseById', () => {
        test('should return course with modules', async () => {
            query
                .mockResolvedValueOnce({
                    rows: [{ id: 'c1', title: 'Organic Farming', category: 'agriculture' }],
                })
                .mockResolvedValueOnce({
                    rows: [
                        { id: 'm1', course_id: 'c1', module_number: 1, title: 'Introduction' },
                        { id: 'm2', course_id: 'c1', module_number: 2, title: 'Soil Prep' },
                    ],
                });

            const result = await getCourseById('c1');

            expect(result).toBeTruthy();
            expect(result.modules).toHaveLength(2);
            expect(result.totalModules).toBe(2);
        });

        test('should return null for non-existent course', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await getCourseById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createCourse', () => {
        test('should create a course with defaults', async () => {
            const newCourse = {
                title: 'Test Course',
                description: 'Test description',
                category: 'agriculture',
            };

            query.mockResolvedValueOnce({
                rows: [{ id: 'new-id', ...newCourse, language: 'hi', difficulty: 'beginner' }],
            });

            const result = await createCourse(newCourse);

            expect(result.id).toBe('new-id');
            expect(result.language).toBe('hi');
            expect(result.difficulty).toBe('beginner');
        });
    });
});
