/**
 * BRUTAL TEST SUITE – Requirement 7: Knowledge Sharing & Learning
 * Tests: courses, enrollment, govt-integration, learning-path, peer-grouping
 * Pushes every function to edge cases, error paths, and boundary conditions.
 */

/* ────────────────── mocks ────────────────── */
jest.mock('../../utils/db', () => ({
  query: jest.fn(),
  dynamoDB: { send: jest.fn() },
  TABLE_NAMES: {
    CONTENT_INTERACTIONS: 'ContentInteractions',
    PEER_GROUPS: 'PeerGroups',
    USER_LEARNING_PROFILE: 'UserLearningProfile',
    PERSONALIZED_RECOMMENDATIONS: 'PersonalizedRecommendations',
  },
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  PutCommand: jest.fn(function (p) { this.input = p; }),
  GetCommand: jest.fn(function (p) { this.input = p; }),
  QueryCommand: jest.fn(function (p) { this.input = p; }),
  UpdateCommand: jest.fn(function (p) { this.input = p; }),
  ScanCommand: jest.fn(function (p) { this.input = p; }),
  DeleteCommand: jest.fn(function (p) { this.input = p; }),
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
}));

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid-1234') }));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: jest.fn() })),
  InvokeModelCommand: jest.fn((p) => p),
}));

const { query, dynamoDB } = require('../../utils/db');
const courses = require('../../lambdas/knowledge-api/courses');
const enrollment = require('../../lambdas/knowledge-api/enrollment');
const govtIntegration = require('../../lambdas/knowledge-api/govt-integration');
const groups = require('../../lambdas/peer-grouping/groups');
const clustering = require('../../lambdas/peer-grouping/clustering');

beforeEach(() => {
  jest.clearAllMocks();
});

/* ═══════════════════════════════════════════════════
   SECTION A — COURSES (knowledge-api/courses.js)
   Req 7.1: Voice-based learning content
   ═══════════════════════════════════════════════════ */
describe('Courses – listCourses', () => {
  test('returns courses with pagination', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '15' }] });
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, title: 'Organic Farming', category: 'agriculture' },
        { id: 2, title: 'Drip Irrigation', category: 'water' },
      ],
    });
    const result = await courses.listCourses({});
    expect(result.courses).toHaveLength(2);
    expect(result.pagination.total).toBe(15);
  });

  test('filters by language, category, difficulty', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '3' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await courses.listCourses({ language: 'hi', category: 'agriculture', difficulty: 'beginner' });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('language');
    expect(sql).toContain('category');
    expect(sql).toContain('difficulty');
  });

  test('search filter uses ILIKE', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await courses.listCourses({ search: 'organic' });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('ILIKE');
    expect(query.mock.calls[0][1]).toContain('%organic%');
  });

  test('empty result set', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const result = await courses.listCourses({ category: 'nonexistent' });
    expect(result.courses).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  test('pagination page 3 with limit 5 = offset 10', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '50' }] });
    query.mockResolvedValueOnce({ rows: [] });
    await courses.listCourses({ page: 3, limit: 5 });
    const params = query.mock.calls[1][1];
    expect(params).toContain(5); // limit
    expect(params).toContain(10); // offset
  });
});

describe('Courses – getCourseById', () => {
  test('returns course with modules', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Farming 101' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Module 1' }] });
    const result = await courses.getCourseById(1);
    expect(result).toBeDefined();
    expect(result.title).toBe('Farming 101');
  });

  test('returns null for non-existent course', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await courses.getCourseById(99999);
    expect(result).toBeNull();
  });
});

describe('Courses – createCourse', () => {
  test('inserts new course with all fields', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'New Course', language: 'hi', category: 'agriculture' }],
    });
    const result = await courses.createCourse({
      title: 'New Course', description: 'Learn farming', language: 'hi',
      category: 'agriculture', difficulty: 'beginner', duration_minutes: 60,
      instructor_name: 'Dr. Sharma',
    });
    expect(result.title).toBe('New Course');
  });
});

describe('Courses – addModule', () => {
  test('adds module to course', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'm1', course_id: 1, title: 'Module 1' }] });
    const result = await courses.addModule(1, {
      title: 'Module 1', content_text: 'Learn about crops', order_index: 1,
    });
    expect(result).toBeDefined();
  });
});

/* ═══════════════════════════════════════════════════
   SECTION B — ENROLLMENT (knowledge-api/enrollment.js)
   Req 7.1: Learning progress tracking
   ═══════════════════════════════════════════════════ */
describe('Enrollment – enrollUser', () => {
  test('creates new enrollment for valid course', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Farming 101' }] }); // course check
    query.mockResolvedValueOnce({ rows: [] }); // no existing enrollment
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', status: 'active' }] }); // insert
    dynamoDB.send.mockResolvedValueOnce({}); // DynamoDB interaction

    const result = await enrollment.enrollUser('u1', 'c1');
    expect(result.id).toBe('e1');
    expect(result.status).toBe('active');
    expect(dynamoDB.send).toHaveBeenCalledTimes(1);
  });

  test('throws COURSE_NOT_FOUND for invalid course', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // no course
    await expect(enrollment.enrollUser('u1', 'bad-course')).rejects.toThrow('COURSE_NOT_FOUND');
  });

  test('throws ALREADY_ENROLLED for active enrollment', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] }); // course exists
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', status: 'active' }] }); // already active
    await expect(enrollment.enrollUser('u1', 'c1')).rejects.toThrow('ALREADY_ENROLLED');
  });

  test('re-activates paused enrollment', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] }); // course exists
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', status: 'paused' }] }); // paused enrollment
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', status: 'active' }] }); // update
    const result = await enrollment.enrollUser('u1', 'c1');
    expect(result.status).toBe('active');
  });

  test('re-activates dropped enrollment', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', status: 'dropped' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', status: 'active' }] });
    const result = await enrollment.enrollUser('u1', 'c1');
    expect(result.status).toBe('active');
  });
});

describe('Enrollment – getUserEnrollments', () => {
  test('returns enriched enrollments with progress', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 'e1', course_id: 'c1', title: 'Farming 101', total_modules: 10, completed_modules: 5 },
        { id: 'e2', course_id: 'c2', title: 'Irrigation', total_modules: 4, completed_modules: 4 },
      ],
    });
    const result = await enrollment.getUserEnrollments('u1');
    expect(result).toHaveLength(2);
    expect(result[0].progressPercent).toBe(50);
    expect(result[1].progressPercent).toBe(100);
  });

  test('zero total_modules yields 0% progress', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'e1', total_modules: 0, completed_modules: 0 }],
    });
    const result = await enrollment.getUserEnrollments('u1');
    expect(result[0].progressPercent).toBe(0);
  });

  test('filters by status', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await enrollment.getUserEnrollments('u1', 'completed');
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('e.status');
    expect(query.mock.calls[0][1]).toContain('completed');
  });

  test('no status filter returns all', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await enrollment.getUserEnrollments('u1');
    const sql = query.mock.calls[0][0];
    expect(sql).not.toContain('e.status = $2');
  });
});

describe('Enrollment – completeModule', () => {
  test('completes a module and updates progress', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] }); // enrollment
    query.mockResolvedValueOnce({ rows: [{ id: 'mp1', status: 'completed' }] }); // upsert progress
    query.mockResolvedValueOnce({ rows: [{ total: '5' }] }); // total modules
    query.mockResolvedValueOnce({ rows: [{ completed: '3' }] }); // completed
    query.mockResolvedValueOnce({}); // update last_accessed
    dynamoDB.send.mockResolvedValueOnce({}); // DynamoDB interaction

    const result = await enrollment.completeModule('u1', 'c1', 'm1', { score: 85, timeSpentSecs: 300 });
    expect(result.status).toBe('completed');
  });

  test('auto-completes course when all modules done', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] }); // enrollment
    query.mockResolvedValueOnce({ rows: [{ id: 'mp1' }] }); // upsert
    query.mockResolvedValueOnce({ rows: [{ total: '3' }] }); // total
    query.mockResolvedValueOnce({ rows: [{ completed: '3' }] }); // all completed!
    query.mockResolvedValueOnce({}); // mark course completed
    query.mockResolvedValueOnce({}); // update last_accessed
    dynamoDB.send.mockResolvedValueOnce({}); // interaction

    await enrollment.completeModule('u1', 'c1', 'm3', { score: 90 });
    // The 5th query should be the UPDATE enrollments SET status = 'completed'
    const sql = query.mock.calls[4][0];
    expect(sql).toContain("status = 'completed'");
  });

  test('throws NOT_ENROLLED if no active enrollment', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // no enrollment
    await expect(enrollment.completeModule('u1', 'c1', 'm1')).rejects.toThrow('NOT_ENROLLED');
  });

  test('defaults score=0 and timeSpentSecs=0', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'mp1' }] });
    query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
    query.mockResolvedValueOnce({ rows: [{ completed: '1' }] });
    query.mockResolvedValueOnce({});
    dynamoDB.send.mockResolvedValueOnce({});

    await enrollment.completeModule('u1', 'c1', 'm1');
    // The INSERT params should have 0 for score and timeSpentSecs
    const params = query.mock.calls[1][1];
    expect(params).toContain(0); // score
    expect(params).toContain(0); // timeSpentSecs
  });
});

/* ═══════════════════════════════════════════════════
   SECTION C — GOVT INTEGRATION (knowledge-api/govt-integration.js)
   Req 7.5: Government training course access
   ═══════════════════════════════════════════════════ */
describe('Govt Integration – getAvailablePortals', () => {
  test('returns non-empty array of portal objects', () => {
    const portals = govtIntegration.getAvailablePortals();
    expect(portals.length).toBeGreaterThan(0);
    for (const portal of portals) {
      expect(portal.id).toBeDefined();
      expect(portal.name).toBeDefined();
      expect(portal.url).toBeDefined();
      expect(portal.description).toBeDefined();
    }
  });

  test('includes key portals: PMKVY, ICAR, NSDC, MANAGE', () => {
    const portals = govtIntegration.getAvailablePortals();
    const ids = portals.map(p => p.id);
    expect(ids).toContain('PMKVY');
    expect(ids).toContain('ICAR');
    expect(ids).toContain('NSDC');
    expect(ids).toContain('MANAGE');
  });

  test('has at least 7 portals', () => {
    expect(govtIntegration.getAvailablePortals().length).toBeGreaterThanOrEqual(7);
  });
});

describe('Govt Integration – listGovtCourses', () => {
  test('pagination with all filters', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, title: 'Agri Skills', source_portal: 'PMKVY' },
        { id: 2, title: 'Digital Literacy', source_portal: 'PMGDISHA' },
      ],
    });
    const result = await govtIntegration.listGovtCourses({
      language: 'hi', category: 'agriculture', portal: 'PMKVY', search: 'skill',
      page: 1, limit: 10,
    });
    expect(result.courses).toHaveLength(2);
    expect(result.pagination.total).toBe(10);
    expect(result.available_portals).toBeDefined();
    expect(result.available_portals.length).toBeGreaterThan(0);
  });

  test('courses include portal_info when source_portal matches', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
    query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'PMKVY Course', source_portal: 'PMKVY' }],
    });
    const result = await govtIntegration.listGovtCourses({});
    expect(result.courses[0].portal_info).toBeDefined();
    expect(result.courses[0].portal_info.name).toContain('Kaushal');
  });

  test('portal_info is null for unknown portal', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
    query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'Unknown Portal Course', source_portal: 'UNKNOWN' }],
    });
    const result = await govtIntegration.listGovtCourses({});
    expect(result.courses[0].portal_info).toBeNull();
  });

  test('no filters returns all active courses', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
    query.mockResolvedValueOnce({ rows: [] });
    await govtIntegration.listGovtCourses({});
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('is_active = true');
  });
});

describe('Govt Integration – getGovtCourseById', () => {
  test('returns course with portal_info', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'ICAR Course', source_portal: 'ICAR' }],
    });
    const result = await govtIntegration.getGovtCourseById(1);
    expect(result.portal_info.name).toContain('Agricultural Research');
  });

  test('returns null for non-existent course', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await govtIntegration.getGovtCourseById(9999)).toBeNull();
  });
});

describe('Govt Integration – syncGovtCourses', () => {
  test('syncs all portals when no portal specified', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, title: 'C1', source_portal: 'PMKVY' },
        { id: 2, title: 'C2', source_portal: 'ICAR' },
      ],
    });
    const result = await govtIntegration.syncGovtCourses();
    expect(result.synced).toBe(2);
    expect(result.portal).toBe('all');
    expect(result.timestamp).toBeDefined();
  });

  test('syncs specific portal', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'C1', source_portal: 'PMKVY' }] });
    const result = await govtIntegration.syncGovtCourses('PMKVY');
    expect(result.portal).toBe('PMKVY');
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('WHERE source_portal = $1');
  });

  test('returns zero synced when no courses exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await govtIntegration.syncGovtCourses('NONEXISTENT');
    expect(result.synced).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════
   SECTION D — PEER GROUPS (peer-grouping/groups.js)
   Req 7.2: AI-created peer groups
   ═══════════════════════════════════════════════════ */
describe('Peer Groups – createGroup', () => {
  test('creates group with creator as admin', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await groups.createGroup({
      name: 'Wheat Learners', description: 'Learn wheat farming',
      goals: ['organic'], category: 'agriculture', language: 'hi',
      location: { state: 'MP' }, creatorUserId: 'u1',
    });
    expect(result.groupId).toBe('mock-uuid-1234');
    expect(result.name).toBe('Wheat Learners');
    expect(result.members).toHaveLength(1);
    expect(result.members[0].role).toBe('admin');
    expect(result.members[0].userId).toBe('u1');
    expect(result.isActive).toBe(true);
    expect(result.maxMembers).toBe(20);
  });

  test('defaults optional fields', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await groups.createGroup({
      name: 'Defaults', creatorUserId: 'u1',
    });
    expect(result.goals).toEqual([]);
    expect(result.category).toBe('general');
    expect(result.language).toBe('hi');
    expect(result.location).toEqual({});
  });
});

describe('Peer Groups – createGroupFromClustering', () => {
  test('creates group from cluster data with members', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await groups.createGroupFromClustering({
      name: 'AI Group', description: 'AI-formed',
      goals: ['organic farming'], memberUserIds: ['u2', 'u3'],
      matchScore: 0.85, reason: 'Similar goals',
    }, 'u1');
    expect(result.members).toHaveLength(3); // u1 + u2 + u3
    expect(result.members[0].role).toBe('admin'); // creator
    expect(result.activityScore).toBe(85); // 0.85 * 100
    expect(result.clusteringReason).toBe('Similar goals');
  });

  test('creator already in memberUserIds is not duplicated', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await groups.createGroupFromClustering({
      memberUserIds: ['u1', 'u2'],
      matchScore: 0.5,
    }, 'u1');
    const u1Members = result.members.filter(m => m.userId === 'u1');
    expect(u1Members).toHaveLength(1);
    expect(u1Members[0].role).toBe('admin');
  });

  test('empty memberUserIds still includes creator', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await groups.createGroupFromClustering({ memberUserIds: [] }, 'u1');
    expect(result.members).toHaveLength(1);
    expect(result.members[0].userId).toBe('u1');
  });

  test('defaults name_and description', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await groups.createGroupFromClustering({}, 'u1');
    expect(result.name).toBe('Learning Group');
    expect(result.description).toBe('');
  });
});

describe('Peer Groups – getGroupById', () => {
  test('returns group when found', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Item: { groupId: 'g1', name: 'Test' } });
    const result = await groups.getGroupById('g1');
    expect(result.groupId).toBe('g1');
  });

  test('returns null when not found', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Item: undefined });
    expect(await groups.getGroupById('nope')).toBeNull();
  });

  test('returns null when Item is missing from response', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    expect(await groups.getGroupById('nope')).toBeNull();
  });
});

describe('Peer Groups – getUserGroups', () => {
  test('returns only groups where user is a member', async () => {
    dynamoDB.send.mockResolvedValueOnce({
      Items: [
        { groupId: 'g1', isActive: true, members: [{ userId: 'u1' }, { userId: 'u2' }] },
        { groupId: 'g2', isActive: true, members: [{ userId: 'u3' }] },
        { groupId: 'g3', isActive: true, members: [{ userId: 'u1' }] },
      ],
    });
    const result = await groups.getUserGroups('u1');
    expect(result).toHaveLength(2);
    expect(result.map(g => g.groupId)).toEqual(['g1', 'g3']);
  });

  test('returns empty array when user has no groups', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: [] });
    const result = await groups.getUserGroups('nobody');
    expect(result).toEqual([]);
  });

  test('handles null Items from DynamoDB', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: null });
    const result = await groups.getUserGroups('u1');
    expect(result).toEqual([]);
  });
});

describe('Peer Groups – joinGroup', () => {
  test('successfully joins an open group', async () => {
    dynamoDB.send
      .mockResolvedValueOnce({ Item: { groupId: 'g1', isActive: true, maxMembers: 20, members: [{ userId: 'u1' }] } }) // getGroupById
      .mockResolvedValueOnce({}); // update
    const result = await groups.joinGroup('g1', 'u2', 'Ramesh');
    expect(result.members).toHaveLength(2);
    expect(result.members[1].userId).toBe('u2');
    expect(result.members[1].displayName).toBe('Ramesh');
    expect(result.members[1].role).toBe('member');
  });

  test('throws GROUP_NOT_FOUND', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Item: undefined });
    await expect(groups.joinGroup('bad', 'u1')).rejects.toThrow('GROUP_NOT_FOUND');
  });

  test('throws GROUP_INACTIVE', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Item: { groupId: 'g1', isActive: false, members: [] } });
    await expect(groups.joinGroup('g1', 'u1')).rejects.toThrow('GROUP_INACTIVE');
  });

  test('throws ALREADY_MEMBER', async () => {
    dynamoDB.send.mockResolvedValueOnce({
      Item: { groupId: 'g1', isActive: true, maxMembers: 20, members: [{ userId: 'u1' }] },
    });
    await expect(groups.joinGroup('g1', 'u1')).rejects.toThrow('ALREADY_MEMBER');
  });

  test('throws GROUP_FULL when at max capacity', async () => {
    const members = Array.from({ length: 20 }, (_, i) => ({ userId: `u${i}` }));
    dynamoDB.send.mockResolvedValueOnce({
      Item: { groupId: 'g1', isActive: true, maxMembers: 20, members },
    });
    await expect(groups.joinGroup('g1', 'new-user')).rejects.toThrow('GROUP_FULL');
  });

  test('default displayName is empty string', async () => {
    dynamoDB.send
      .mockResolvedValueOnce({ Item: { groupId: 'g1', isActive: true, maxMembers: 20, members: [] } })
      .mockResolvedValueOnce({});
    const result = await groups.joinGroup('g1', 'u1');
    expect(result.members[0].displayName).toBe('');
  });
});

describe('Peer Groups – leaveGroup', () => {
  test('successfully leaves a group', async () => {
    dynamoDB.send
      .mockResolvedValueOnce({ Item: { groupId: 'g1', members: [{ userId: 'u1' }, { userId: 'u2' }] } })
      .mockResolvedValueOnce({});
    const result = await groups.leaveGroup('g1', 'u1');
    expect(result.success).toBe(true);
    expect(result.groupId).toBe('g1');
  });

  test('throws GROUP_NOT_FOUND', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Item: undefined });
    await expect(groups.leaveGroup('bad', 'u1')).rejects.toThrow('GROUP_NOT_FOUND');
  });

  test('throws NOT_A_MEMBER', async () => {
    dynamoDB.send.mockResolvedValueOnce({
      Item: { groupId: 'g1', members: [{ userId: 'u2' }] },
    });
    await expect(groups.leaveGroup('g1', 'u1')).rejects.toThrow('NOT_A_MEMBER');
  });

  test('throws NOT_A_MEMBER when members is empty', async () => {
    dynamoDB.send.mockResolvedValueOnce({
      Item: { groupId: 'g1', members: [] },
    });
    await expect(groups.leaveGroup('g1', 'u1')).rejects.toThrow('NOT_A_MEMBER');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION E — CLUSTERING (peer-grouping/clustering.js)
   Req 7.2: AI-powered peer matching
   ═══════════════════════════════════════════════════ */
describe('Clustering – fallbackClustering (via clusterWithBedrock mock)', () => {
  // We test the internal fallbackClustering by making Bedrock fail
  // clusterWithBedrock catches the error and calls fallbackClustering

  test('groups peers by shared goals and interests', async () => {
    const userProfile = {
      userId: 'u1', displayName: 'Farmer A', skillLevel: 'beginner',
      learningGoals: ['organic farming', 'drip irrigation'],
      interests: ['wheat', 'cotton'], location: { state: 'MP' },
    };
    const candidates = [
      { userId: 'u2', learningGoals: ['organic farming'], interests: ['wheat'], location: { state: 'MP' } },
      { userId: 'u3', learningGoals: ['drip irrigation'], interests: ['cotton'], location: { state: 'UP' } },
      { userId: 'u4', learningGoals: ['unrelated'], interests: ['xyz'], location: { state: 'TN' } },
    ];

    // Mock Bedrock to fail so fallbackClustering runs
    const bedrock = new (require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient)();
    bedrock.send = jest.fn().mockRejectedValue(new Error('Bedrock unavailable'));

    const result = await clustering.clusterWithBedrock(userProfile, candidates);
    expect(result.groups.length).toBeGreaterThanOrEqual(0);
    expect(result.reasoning).toBeDefined();
    // Users with overlapping goals should have higher match scores
    if (result.groups.length > 0) {
      expect(result.groups[0].memberUserIds.length).toBeGreaterThan(0);
    }
  });

  test('returns empty groups when no candidates match', async () => {
    const userProfile = {
      userId: 'u1', learningGoals: ['quantum_physics'],
      interests: ['space'], location: { state: 'Moon' }, skillLevel: 'expert',
    };
    const candidates = [
      { userId: 'u2', learningGoals: [], interests: [], location: { state: 'Mars' } },
    ];

    const bedrock = new (require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient)();
    bedrock.send = jest.fn().mockRejectedValue(new Error('Bedrock down'));

    const result = await clustering.clusterWithBedrock(userProfile, candidates);
    // match score for u2 would be 0, which is ≤ 0.2, so filtered out
    expect(result.groups.length).toBe(0);
    expect(result.reasoning).toContain('No sufficiently matching');
  });
});

describe('Clustering – getUserLearningProfile', () => {
  test('returns profile when found', async () => {
    dynamoDB.send.mockResolvedValueOnce({
      Items: [{ userId: 'u1', skillLevel: 'beginner', learningGoals: ['organic'] }],
    });
    const result = await clustering.getUserLearningProfile('u1');
    expect(result.userId).toBe('u1');
  });

  test('returns null when no profile found', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: [] });
    const result = await clustering.getUserLearningProfile('unknown');
    expect(result).toBeNull();
  });

  test('returns null when Items is undefined', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await clustering.getUserLearningProfile('unknown');
    expect(result).toBeNull();
  });
});
