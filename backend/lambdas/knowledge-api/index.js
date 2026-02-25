/**
 * Knowledge API Lambda – Main handler
 * Routes API Gateway events to the appropriate handler function.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const courses = require('./courses');
const enrollment = require('./enrollment');
const content = require('./content');
const govtIntegration = require('./govt-integration');

exports.handler = async (event) => {
    console.log('Knowledge API event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-user';
    const queryParams = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        // ── Courses ──
        if (path.match(/\/knowledge\/courses$/) && method === 'GET') {
            const result = await courses.listCourses({
                language: queryParams.language,
                category: queryParams.category,
                difficulty: queryParams.difficulty,
                search: queryParams.search,
                page: parseInt(queryParams.page || '1', 10),
                limit: parseInt(queryParams.limit || '20', 10),
            });
            return success(result);
        }

        if (path.match(/\/knowledge\/courses\/([a-f0-9-]+)$/) && method === 'GET') {
            const courseId = path.match(/\/knowledge\/courses\/([a-f0-9-]+)$/)[1];
            const result = await courses.getCourseById(courseId);
            if (!result) return notFound('Course not found');
            return success(result);
        }

        if (path.match(/\/knowledge\/courses$/) && method === 'POST') {
            const result = await courses.createCourse(body);
            return success(result, 201);
        }

        // ── Enrollment ──
        if (path.match(/\/knowledge\/courses\/([a-f0-9-]+)\/enroll$/) && method === 'POST') {
            const courseId = path.match(/\/knowledge\/courses\/([a-f0-9-]+)\/enroll$/)[1];
            try {
                const result = await enrollment.enrollUser(userId, courseId);
                return success(result, 201);
            } catch (err) {
                if (err.message === 'COURSE_NOT_FOUND') return notFound('Course not found');
                if (err.message === 'ALREADY_ENROLLED') return badRequest('Already enrolled in this course');
                throw err;
            }
        }

        if (path.match(/\/knowledge\/my-courses$/) && method === 'GET') {
            const result = await enrollment.getUserEnrollments(userId, queryParams.status);
            return success({ enrollments: result });
        }

        // ── Module Completion ──
        if (path.match(/\/knowledge\/courses\/([a-f0-9-]+)\/modules\/([a-f0-9-]+)\/complete$/) && method === 'POST') {
            const matches = path.match(/\/knowledge\/courses\/([a-f0-9-]+)\/modules\/([a-f0-9-]+)\/complete$/);
            const courseId = matches[1];
            const moduleId = matches[2];
            try {
                const result = await enrollment.completeModule(userId, courseId, moduleId, body);
                return success(result);
            } catch (err) {
                if (err.message === 'NOT_ENROLLED') return badRequest('Not enrolled in this course');
                throw err;
            }
        }

        // ── Content Delivery (with TTS + translation) ──
        if (path.match(/\/knowledge\/courses\/([a-f0-9-]+)\/content$/) && method === 'GET') {
            const courseId = path.match(/\/knowledge\/courses\/([a-f0-9-]+)\/content$/)[1];
            const course = await courses.getCourseById(courseId);
            if (!course) return notFound('Course not found');

            // Return all modules with content
            const moduleContents = [];
            for (const mod of course.modules) {
                const moduleContent = await content.getModuleContent(
                    mod.id,
                    queryParams.language || 'hi',
                    queryParams.audio !== 'false'
                );
                if (moduleContent) moduleContents.push(moduleContent);
            }

            return success({
                course_title: course.title,
                course_id: courseId,
                language: queryParams.language || 'hi',
                modules: moduleContents,
            });
        }

        // ── Government Courses ──
        if (path.match(/\/knowledge\/govt-courses$/) && method === 'GET') {
            const result = await govtIntegration.listGovtCourses({
                language: queryParams.language,
                category: queryParams.category,
                portal: queryParams.portal,
                search: queryParams.search,
                page: parseInt(queryParams.page || '1', 10),
                limit: parseInt(queryParams.limit || '20', 10),
            });
            return success(result);
        }

        if (path.match(/\/knowledge\/govt-courses\/portals$/) && method === 'GET') {
            return success({ portals: govtIntegration.getAvailablePortals() });
        }

        if (path.match(/\/knowledge\/govt-courses\/sync$/) && method === 'POST') {
            const result = await govtIntegration.syncGovtCourses(body.portal);
            return success(result);
        }

        return notFound(`Route not found: ${method} ${path}`);

    } catch (err) {
        console.error('Knowledge API error:', err);
        return error('Internal server error', 500, err.message);
    }
};
