/**
 * Knowledge routes – Req 7: Knowledge Sharing & Learning
 * Wires existing business logic modules to Fastify routes.
 */

const courses = require('../lambdas/knowledge-api/courses');
const enrollment = require('../lambdas/knowledge-api/enrollment');
const content = require('../lambdas/knowledge-api/content');
const govtIntegration = require('../lambdas/knowledge-api/govt-integration');
const clustering = require('../lambdas/peer-grouping/clustering');
const groups = require('../lambdas/peer-grouping/groups');
const digilocker = require('../lambdas/peer-grouping/digilocker');
const recommendations = require('../lambdas/learning-path/recommendations');
const learningProfile = require('../lambdas/learning-path/learning-profile');
const analytics = require('../lambdas/learning-path/analytics');
const { searchKnowledgeResources } = require('../services/knowledge-search');

async function knowledgeRoutes(fastify) {
    // ═══════════════════════════════════════
    //  Courses
    // ═══════════════════════════════════════

    fastify.get('/knowledge/courses', async (req) => {
        const { language, category, difficulty, search, page = 1, limit = 20 } = req.query;
        return courses.listCourses({ language, category, difficulty, search, page: +page, limit: +limit });
    });

    fastify.get('/knowledge/courses/:id', async (req) => {
        const result = await courses.getCourseById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Course not found' };
        return result;
    });

    fastify.post('/knowledge/courses', async (req, reply) => {
        const result = await courses.createCourse(req.body);
        return reply.status(201).send(result);
    });

    // ═══════════════════════════════════════
    //  Enrollment
    // ═══════════════════════════════════════

    fastify.post('/knowledge/courses/:id/enroll', async (req, reply) => {
        const result = await enrollment.enrollUser(req.userId, req.params.id);
        return reply.status(201).send(result);
    });

    fastify.get('/knowledge/my-courses', async (req) => {
        return enrollment.getUserEnrollments(req.userId);
    });

    fastify.post('/knowledge/courses/:courseId/modules/:moduleId/complete', async (req) => {
        return enrollment.completeModule(req.userId, req.params.courseId, req.params.moduleId, req.body);
    });

    // ═══════════════════════════════════════
    //  Content Delivery (TTS + Translation)
    // ═══════════════════════════════════════

    fastify.get('/knowledge/courses/:id/content', async (req) => {
        const { lang = 'hi', audio = 'true' } = req.query;
        const course = await courses.getCourseById(req.params.id);
        if (!course) throw { statusCode: 404, message: 'Course not found' };

        const moduleContents = [];
        for (const mod of course.modules) {
            const moduleContent = await content.getModuleContent(
                mod.id,
                lang,
                audio === 'true'
            );
            if (moduleContent) moduleContents.push(moduleContent);
        }

        return {
            course_title: course.title,
            course_id: req.params.id,
            language: lang,
            modules: moduleContents,
        };
    });

    // ═══════════════════════════════════════
    //  Government Courses
    // ═══════════════════════════════════════

    fastify.get('/knowledge/govt-courses', async (req) => {
        return govtIntegration.listGovtCourses(req.query);
    });

    fastify.get('/knowledge/govt-courses/portals', async () => {
        return { portals: govtIntegration.getAvailablePortals() };
    });

    fastify.post('/knowledge/govt-courses/sync', async (req) => {
        return govtIntegration.syncGovtCourses(req.body.portal);
    });

    fastify.get('/knowledge/resources/search', async (req) => {
        const { q, language = 'en', limit = 4 } = req.query;
        return searchKnowledgeResources({
            query: q,
            language,
            limit: +limit,
        });
    });

    // ═══════════════════════════════════════
    //  Peer Groups
    // ═══════════════════════════════════════

    fastify.post('/knowledge/peer-groups/join', async (req) => {
        return clustering.findPeersForUser(req.userId);
    });

    fastify.get('/knowledge/peer-groups', async () => {
        const result = await groups.listGroups();
        return { groups: result };
    });

    fastify.get('/knowledge/peer-groups/my-groups', async (req) => {
        return groups.getUserGroups(req.userId);
    });

    fastify.get('/knowledge/peer-groups/:id', async (req) => {
        const result = await groups.getGroupById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Peer group not found' };
        return result;
    });

    fastify.post('/knowledge/peer-groups/:id/join', async (req) => {
        return groups.joinGroup(req.params.id, req.userId);
    });

    fastify.post('/knowledge/peer-groups/:id/leave', async (req) => {
        return groups.leaveGroup(req.params.id, req.userId);
    });

    fastify.post('/knowledge/peer-groups', async (req, reply) => {
        const result = await groups.createGroup(req.body);
        return reply.status(201).send(result);
    });

    // ═══════════════════════════════════════
    //  DigiLocker Verification
    // ═══════════════════════════════════════

    fastify.post('/knowledge/peer-groups/verify/start', async (req) => {
        return digilocker.startVerification(req.userId);
    });

    fastify.post('/knowledge/peer-groups/verify/complete', async (req) => {
        return digilocker.completeVerification(req.userId, req.body.code);
    });

    // ═══════════════════════════════════════
    //  Learning Path & Recommendations
    // ═══════════════════════════════════════

    fastify.get('/knowledge/recommendations', async (req) => {
        const forceRefresh = req.query.refresh === 'true';
        return recommendations.getLatestRecommendations(req.userId, forceRefresh);
    });

    fastify.get('/knowledge/recommendations/status', async (req) => {
        const needsRefresh = await analytics.shouldRefreshRecommendations(req.userId);
        return { needsRefresh };
    });

    fastify.get('/knowledge/learning-profile', async (req) => {
        const profile = await learningProfile.getLearningProfile(req.userId);
        if (!profile) throw { statusCode: 404, message: 'Learning profile not found. Create one first.' };
        return profile;
    });

    fastify.post('/knowledge/learning-profile', async (req, reply) => {
        const result = await learningProfile.upsertLearningProfile(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/knowledge/progress-summary', async (req) => {
        return analytics.getProgressSummary(req.userId);
    });
}

module.exports = knowledgeRoutes;
