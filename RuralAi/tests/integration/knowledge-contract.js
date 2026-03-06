/**
 * Knowledge Contract Tests — mirrors knowledgeApi
 * Used by: KnowledgeDashboardScreen (courses, peer-groups, learning-profile)
 */

'use strict';

const { GET, POST,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape, assertGte,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  Course Catalog (knowledgeApi.getCourses)        */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Knowledge — Courses (KnowledgeDashboardScreen)', () => {

  let courseId;

  test('GET /knowledge/courses returns { courses: Course[] }', async () => {
    const res = await GET('/knowledge/courses');
    assertStatus(res, 200);
    assertExists(res.body, 'courses');
    assertArray(res.body.courses);

    if (res.body.courses.length > 0) {
      // Course interface: { course_id, title, description, difficulty, language, modules[] }
      const c = res.body.courses[0];
      assert(c.course_id || c.id, 'course needs id');
      assertExists(c, 'title');
      courseId = c.course_id || c.id;
    }
  });

  test('GET /knowledge/courses with language filter', async () => {
    const res = await GET('/knowledge/courses', { language: 'hi' });
    assertStatus(res, 200);
    assertExists(res.body, 'courses');
  });

  test('GET /knowledge/courses/:id returns course detail', async () => {
    if (!courseId) return skip('No courses available');
    const res = await GET(`/knowledge/courses/${courseId}`);
    assertStatus(res, 200);
    assertExists(res.body, 'title');
  });

  test('GET /knowledge/my-courses returns user enrollments (knowledgeApi.getMyCourses)', async () => {
    const res = await GET('/knowledge/my-courses');
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Learning Profile (knowledgeApi.getLearningProfile)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Knowledge — Learning Profile', () => {

  test('POST /knowledge/learning-profile creates/updates profile', async () => {
    const res = await POST('/knowledge/learning-profile', {
      interests: ['agriculture', 'finance'],
      preferred_difficulty: 'beginner',
      preferred_language: 'hi',
    });
    assertStatus(res, [200, 201]);
  });

  test('GET /knowledge/learning-profile returns profile', async () => {
    const res = await GET('/knowledge/learning-profile');
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Peer Groups (knowledgeApi.getPeerGroups)        */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Knowledge — Peer Groups (KnowledgeDashboardScreen)', () => {

  test('GET /knowledge/peer-groups/my-groups returns groups', async () => {
    // Backend route is /knowledge/peer-groups/my-groups (not /knowledge/peer-groups)
    const res = await GET('/knowledge/peer-groups/my-groups');
    assertStatus(res, 200);
  });

  test('POST /knowledge/peer-groups creates group', async () => {
    const res = await POST('/knowledge/peer-groups', {
      name: `FE Contract Group ${Date.now()}`,
      topic: 'organic_farming',
      language: 'hi',
      max_members: 25,
    });
    assertStatus(res, [200, 201]);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Recommendations (knowledgeApi.getRecommendations)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Knowledge — Recommendations', () => {

  test('GET /knowledge/recommendations returns recommendations', async () => {
    const res = await GET('/knowledge/recommendations');
    assertStatus(res, 200);
  });

  test('GET /knowledge/progress-summary returns learning analytics', async () => {
    const res = await GET('/knowledge/progress-summary');
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Govt Courses (knowledgeApi.getGovtCourses)     */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Knowledge — Govt Courses', () => {

  test('GET /knowledge/govt-courses returns courses', async () => {
    const res = await GET('/knowledge/govt-courses');
    assertStatus(res, 200);
  });

  test('GET /knowledge/govt-courses/portals returns portals', async () => {
    const res = await GET('/knowledge/govt-courses/portals');
    assertStatus(res, 200);
  });
});
