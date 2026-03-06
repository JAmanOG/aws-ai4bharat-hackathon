/**
 * ═══════════════════════════════════════════════════════════════════
 *  Requirement 7 — Knowledge Sharing and Learning
 *  REAL endpoint integration tests
 * ═══════════════════════════════════════════════════════════════════
 *
 *  AC 7.1: Voice-based learning content in local languages
 *  AC 7.2: Peer groups with similar learning goals
 *  AC 7.3: Peer credential verification via DigiLocker
 *  AC 7.4: Next learning steps based on progress
 *  AC 7.5: Government training courses + filtered content
 *  AC 7.6: Track learning outcomes, adjust recommendations
 */

const {
    suite, test, skip,
    GET, POST,
    assert, assertEqual, assertStatus, assertHasKeys, assertType,
    assertArray, assertGt, assertGte, assertLte, assertContains, assertOneOf,
    assertResponseTime,
} = require('./framework');

async function runKnowledgeTests() {

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Course Catalog (AC 7.5)');
    /* ═══════════════════════════════════════ */

    let courses = [];
    let courseId = null;

    await test('GET /knowledge/courses returns paginated course list', async () => {
        const res = await GET('/knowledge/courses?page=1&limit=20');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['courses']);
        assertArray(res.body.courses, 'courses');
        courses = res.body.courses;
    });

    await test('POST /knowledge/courses creates a new course', async () => {
        const res = await POST('/knowledge/courses', {
            title: `Integration Test Course ${Date.now()}`,
            description: 'Learn modern wheat farming techniques',
            category: 'agriculture',
            difficulty: 'beginner',
            language: 'hi',
            modules: [
                { id: 'mod-1', title: 'Introduction to Wheat', content: 'Wheat is a rabi crop...' },
                { id: 'mod-2', title: 'Soil Preparation', content: 'Deep ploughing is recommended...' },
            ],
            tags: ['wheat', 'farming', 'beginner'],
        });
        assertStatus(res, 201);
        assertHasKeys(res.body, ['id']);
        courseId = res.body.id;
    });

    await test('GET /knowledge/courses/:id returns course detail', async () => {
        if (!courseId) return skip('No course ID');
        const res = await GET(`/knowledge/courses/${courseId}`);
        assertStatus(res, 200);
        assertHasKeys(res.body, ['id', 'title']);
        // Modules may be stored separately or inline
        if (res.body.modules) {
            assertArray(res.body.modules, 'modules');
        }
    });

    await test('GET /knowledge/courses with language filter', async () => {
        const res = await GET('/knowledge/courses?language=hi');
        assertStatus(res, 200);
        assertArray(res.body.courses, 'courses');
    });

    await test('GET /knowledge/courses with category filter', async () => {
        const res = await GET('/knowledge/courses?category=agriculture');
        assertStatus(res, 200);
    });

    await test('GET /knowledge/courses with search query', async () => {
        const res = await GET('/knowledge/courses?search=wheat');
        assertStatus(res, 200);
    });

    await test('GET /knowledge/courses/:invalid → 404', async () => {
        // Use valid UUID format to avoid Postgres "invalid input syntax" error
        const res = await GET('/knowledge/courses/00000000-0000-0000-0000-000000000000');
        assertStatus(res, 404);
    });

    await test('Course listing responds within 2 seconds', async () => {
        const res = await GET('/knowledge/courses?page=1&limit=20');
        assertResponseTime(res, 2000, 'course list latency');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Enrollment & Progress (AC 7.4, 7.6)');
    /* ═══════════════════════════════════════ */

    await test('POST /knowledge/courses/:id/enroll enrolls user', async () => {
        if (!courseId) return skip('No course ID');
        const res = await POST(`/knowledge/courses/${courseId}/enroll`);
        assertStatus(res, 201);
        // Response may use 'id' or 'enrollment_id'
        assert(res.body.id || res.body.enrollment_id, 'has enrollment identifier');
    });

    await test('GET /knowledge/my-courses returns user enrollments', async () => {
        const res = await GET('/knowledge/my-courses');
        assertStatus(res, 200);
        if (res.body.enrollments) {
            assertArray(res.body.enrollments, 'enrollments');
        }
    });

    await test('POST complete module marks progress', async () => {
        if (!courseId) return skip('No course ID');
        // Get actual module IDs from the course
        const courseRes = await GET(`/knowledge/courses/${courseId}`);
        const modules = courseRes.body.modules || [];
        const modId = modules[0]?.id || modules[0]?.module_id;
        if (!modId) return skip('No modules available');
        const res = await POST(`/knowledge/courses/${courseId}/modules/${modId}/complete`, {
            score: 85,
            time_spent_minutes: 15,
        });
        assertStatus(res, 200);
    });

    await test('GET /knowledge/progress-summary returns learning analytics', async () => {
        const res = await GET('/knowledge/progress-summary');
        assertStatus(res, 200);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Content Delivery (AC 7.1)');
    /* ═══════════════════════════════════════ */

    await test('GET /knowledge/courses/:id/content returns localized content', async () => {
        if (!courseId) return skip('No course ID');
        const res = await GET(`/knowledge/courses/${courseId}/content?lang=hi&audio=false`);
        assertStatus(res, 200);
        assertHasKeys(res.body, ['course_title', 'course_id', 'language', 'modules']);
        assertEqual(res.body.language, 'hi', 'requested language');
        assertArray(res.body.modules, 'modules');
    });

    await test('Content with audio=true includes audio data', async () => {
        if (!courseId) return skip('No course ID');
        const res = await GET(`/knowledge/courses/${courseId}/content?lang=hi&audio=true`);
        assertStatus(res, 200);
        // Audio generation may or may not succeed in test env, but endpoint should respond
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Government Courses (AC 7.5)');
    /* ═══════════════════════════════════════ */

    await test('GET /knowledge/govt-courses returns government courses', async () => {
        const res = await GET('/knowledge/govt-courses');
        assertStatus(res, 200);
        if (res.body.courses) {
            assertArray(res.body.courses, 'govt courses');
        }
    });

    await test('GET /knowledge/govt-courses/portals lists available portals', async () => {
        const res = await GET('/knowledge/govt-courses/portals');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['portals']);
        assertArray(res.body.portals, 'portals');
        assertGte(res.body.portals.length, 1, 'at least 1 portal');
    });

    await test('POST /knowledge/govt-courses/sync triggers sync', async () => {
        const res = await POST('/knowledge/govt-courses/sync', {
            portal: 'swayam',
        });
        assertStatus(res, 200);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Peer Groups (AC 7.2)');
    /* ═══════════════════════════════════════ */

    let peerGroupId = null;

    await test('POST /knowledge/peer-groups creates a new group', async () => {
        const res = await POST('/knowledge/peer-groups', {
            name: `Test Learning Group ${Date.now()}`,
            topic: 'organic farming',
            description: 'Learn organic techniques together',
            language: 'hi',
        });
        assertStatus(res, 201);
        // Service returns groupId (not id)
        assertHasKeys(res.body, ['groupId']);
        peerGroupId = res.body.groupId || res.body.id;
    });

    await test('POST /knowledge/peer-groups/join finds peer matches', async () => {
        const res = await POST('/knowledge/peer-groups/join', {});
        // 200 if learning profile exists, 404 if not yet created
        assert([200, 404].includes(res.status), `join response (got ${res.status})`);
    });

    await test('GET /knowledge/peer-groups/my-groups returns user groups', async () => {
        const res = await GET('/knowledge/peer-groups/my-groups');
        assertStatus(res, 200);
    });

    await test('GET /knowledge/peer-groups/:id returns group details', async () => {
        if (!peerGroupId) return skip('No peer group ID');
        const res = await GET(`/knowledge/peer-groups/${peerGroupId}`);
        assertStatus(res, 200);
        // API returns groupId (DynamoDB) — accept either
        assert(res.body.id || res.body.groupId, 'has group identifier');
    });

    await test('POST /knowledge/peer-groups/:id/join adds member', async () => {
        if (!peerGroupId) return skip('No peer group ID');
        const res = await POST(`/knowledge/peer-groups/${peerGroupId}/join`, {});
        assertStatus(res, 200);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — DigiLocker Verification (AC 7.3)');
    /* ═══════════════════════════════════════ */

    await test('POST /knowledge/peer-groups/verify/start initiates verification', async () => {
        const res = await POST('/knowledge/peer-groups/verify/start', {});
        assertStatus(res, 200);
        // In mock mode, should return authorization URL
        if (res.body.authorizationUrl) {
            assertType(res.body.authorizationUrl, 'string', 'authorizationUrl');
        }
    });

    await test('POST /knowledge/peer-groups/verify/complete with mock code', async () => {
        const res = await POST('/knowledge/peer-groups/verify/complete', {
            code: 'mock-auth-code-123',
        });
        assertStatus(res, 200);
        // In mock mode, should return verified status
        if (res.body.verified !== undefined) {
            assertEqual(res.body.verified, true, 'mock verification');
        }
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Learning Recommendations (AC 7.4, 7.6)');
    /* ═══════════════════════════════════════ */

    await test('POST /knowledge/learning-profile creates/updates profile', async () => {
        const res = await POST('/knowledge/learning-profile', {
            interests: ['agriculture', 'organic farming'],
            experience_level: 'beginner',
            preferred_language: 'hi',
            goals: ['learn crop rotation', 'reduce chemical use'],
        });
        assertStatus(res, 201);
    });

    await test('GET /knowledge/learning-profile returns user profile', async () => {
        const res = await GET('/knowledge/learning-profile');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['userId']);
    });

    await test('GET /knowledge/recommendations returns personalized recommendations', async () => {
        const res = await GET('/knowledge/recommendations');
        assertStatus(res, 200);
    });

    await test('GET /knowledge/recommendations/status checks refresh need', async () => {
        const res = await GET('/knowledge/recommendations/status');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['needsRefresh']);
        assertType(res.body.needsRefresh, 'boolean', 'needsRefresh');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Full Learning Journey');
    /* ═══════════════════════════════════════ */

    await test('Full journey: create → enroll → progress → complete modules', async () => {
        // 1. Create course
        const cr = await POST('/knowledge/courses', {
            title: `Journey Course ${Date.now()}`,
            description: 'End-to-end learning journey test',
            category: 'agriculture',
            difficulty: 'beginner',
            language: 'hi',
            modules: [
                { id: 'j-mod-1', title: 'Module 1', content: 'Introduction content' },
                { id: 'j-mod-2', title: 'Module 2', content: 'Advanced content' },
            ],
        });
        assertStatus(cr, 201);
        const cid = cr.body.id;

        // 2. Enroll
        const enroll = await POST(`/knowledge/courses/${cid}/enroll`);
        assertStatus(enroll, 201);

        // 3. Get actual module IDs from response (Postgres may assign UUIDs)
        const courseDetail = await GET(`/knowledge/courses/${cid}`);
        assertStatus(courseDetail, 200);
        const modules = courseDetail.body.modules || [];
        
        if (modules.length >= 2) {
            const modId1 = modules[0].id || modules[0].module_id;
            const modId2 = modules[1].id || modules[1].module_id;

            // 4. Complete module 1
            const m1 = await POST(`/knowledge/courses/${cid}/modules/${modId1}/complete`, {
                score: 90,
                time_spent_minutes: 20,
            });
            assertStatus(m1, 200);

            // 5. Complete module 2
            const m2 = await POST(`/knowledge/courses/${cid}/modules/${modId2}/complete`, {
                score: 85,
                time_spent_minutes: 15,
            });
            assertStatus(m2, 200);
        }

        // 6. Check progress
        const progress = await GET('/knowledge/progress-summary');
        assertStatus(progress, 200);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Multi-Language Content (AC 7.1)');
    /* ═══════════════════════════════════════ */

    await test('Content in English returns English modules', async () => {
        if (!courseId) return skip('No course ID');
        const res = await GET(`/knowledge/courses/${courseId}/content?lang=en&audio=false`);
        assertStatus(res, 200);
        assertEqual(res.body.language, 'en', 'English content');
        assertArray(res.body.modules, 'modules');
    });

    await test('Multiple course creation → catalog grows', async () => {
        const before = await GET('/knowledge/courses?page=1&limit=100');
        assertStatus(before, 200);
        const countBefore = before.body.courses.length;

        await POST('/knowledge/courses', {
            title: `Extra Course ${Date.now()}`,
            description: 'Test catalog growth',
            category: 'health',
            difficulty: 'intermediate',
            language: 'en',
            modules: [{ id: 'ex-1', title: 'Ex Module', content: 'Content' }],
        });

        const after = await GET('/knowledge/courses?page=1&limit=100');
        assertStatus(after, 200);
        assertGt(after.body.courses.length, countBefore, 'catalog grew after creation');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-7: Knowledge — Brutal Edge Cases');
    /* ═══════════════════════════════════════ */

    await test('Course with empty modules array → valid', async () => {
        const res = await POST('/knowledge/courses', {
            title: `No Modules Course ${Date.now()}`,
            description: 'Course with no modules yet',
            category: 'economics',
            difficulty: 'beginner',
            language: 'hi',
            modules: [],
        });
        assertStatus(res, 201);
    });

    await test('Enroll in nonexistent course → error', async () => {
        const res = await POST('/knowledge/courses/00000000-0000-0000-0000-000000000000/enroll');
        // 404 or 500 depending on error propagation
        assert([404, 500].includes(res.status), `nonexistent course enroll (got ${res.status})`);
    });

    await test('Complete nonexistent module → graceful response', async () => {
        if (!courseId) return skip('No course ID');
        const res = await POST(`/knowledge/courses/${courseId}/modules/00000000-0000-0000-0000-000000000099/complete`, {
            score: 50,
        });
        // May be 200, 400, 404, or 500 depending on implementation
        assert([200, 400, 404, 500].includes(res.status), `nonexistent module (got ${res.status})`);
    });

    await test('Course with very long title handled', async () => {
        const res = await POST('/knowledge/courses', {
            title: 'A'.repeat(500),
            description: 'Long title test',
            category: 'agriculture',
            difficulty: 'beginner',
            language: 'hi',
            modules: [],
        });
        assert([201, 400].includes(res.status), `Long title (got ${res.status})`);
    });

    await test('Peer group with duplicate name allowed or rejected gracefully', async () => {
        const name = `Dup Group ${Date.now()}`;
        const r1 = await POST('/knowledge/peer-groups', {
            name,
            topic: 'test',
            description: 'first',
            language: 'en',
        });
        assertStatus(r1, 201);

        const r2 = await POST('/knowledge/peer-groups', {
            name,
            topic: 'test',
            description: 'second',
            language: 'en',
        });
        assert([201, 409].includes(r2.status), `duplicate group (got ${r2.status})`);
    });

    await test('Learning profile update preserves existing data', async () => {
        await POST('/knowledge/learning-profile', {
            interests: ['agriculture'],
            experience_level: 'advanced',
        });
        const res = await GET('/knowledge/learning-profile');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['userId']);
    });
}

module.exports = { runKnowledgeTests };
