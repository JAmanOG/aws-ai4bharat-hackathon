/**
 * Knowledge API Lambda – enrollment.js
 * Enrollment management and progress tracking.
 */

const { query } = require('../../utils/db');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

/**
 * Enroll a user in a course.
 */
async function enrollUser(userId, courseId) {
    // Check if course exists
    const courseCheck = await query('SELECT id, title FROM courses WHERE id = $1 AND is_active = true', [courseId]);
    if (courseCheck.rows.length === 0) {
        throw new Error('COURSE_NOT_FOUND');
    }

    // Check if already enrolled
    const existingEnrollment = await query(
        'SELECT id, status FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
    );

    if (existingEnrollment.rows.length > 0) {
        const existing = existingEnrollment.rows[0];
        if (existing.status === 'active') {
            throw new Error('ALREADY_ENROLLED');
        }
        // Re-activate paused/dropped enrollment
        const result = await query(
            `UPDATE enrollments SET status = 'active', last_accessed = NOW() WHERE id = $1 RETURNING *`,
            [existing.id]
        );
        return result.rows[0];
    }

    // Create new enrollment
    const result = await query(
        `INSERT INTO enrollments (user_id, course_id, status) VALUES ($1, $2, 'active') RETURNING *`,
        [userId, courseId]
    );

    // Record interaction in DynamoDB
    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.CONTENT_INTERACTIONS,
        Item: {
            userId,
            interactionId: uuidv4(),
            contentType: 'course',
            contentId: courseId,
            interactionType: 'start',
            durationSecs: 0,
            language: 'hi',
            voiceUsed: false,
            timestamp: new Date().toISOString(),
        },
    }));

    return result.rows[0];
}

/**
 * Get all enrollments for a user with course details and progress.
 */
async function getUserEnrollments(userId, status = null) {
    let sql = `
    SELECT e.*, c.title, c.category, c.language, c.difficulty, c.duration_minutes, c.thumbnail_s3_key,
           (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) as total_modules,
           (SELECT COUNT(*) FROM module_progress mp
            JOIN course_modules cm ON mp.module_id = cm.id
            WHERE mp.enrollment_id = e.id AND mp.status = 'completed') as completed_modules
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = $1
  `;
    const params = [userId];

    if (status) {
        sql += ' AND e.status = $2';
        params.push(status);
    }

    sql += ' ORDER BY e.last_accessed DESC';

    const result = await query(sql, params);

    return result.rows.map(row => ({
        ...row,
        progressPercent: row.total_modules > 0
            ? Math.round((row.completed_modules / row.total_modules) * 100)
            : 0,
    }));
}

/**
 * Complete a module and update progress.
 */
async function completeModule(userId, courseId, moduleId, { score = 0, timeSpentSecs = 0 } = {}) {
    // Get enrollment
    const enrollmentResult = await query(
        `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'`,
        [userId, courseId]
    );

    if (enrollmentResult.rows.length === 0) {
        throw new Error('NOT_ENROLLED');
    }

    const enrollmentId = enrollmentResult.rows[0].id;

    // Upsert module progress
    const progressResult = await query(
        `INSERT INTO module_progress (enrollment_id, module_id, status, score, time_spent_secs, completed_at)
     VALUES ($1, $2, 'completed', $3, $4, NOW())
     ON CONFLICT (enrollment_id, module_id) 
     DO UPDATE SET status = 'completed', score = $3, time_spent_secs = module_progress.time_spent_secs + $4, completed_at = NOW()
     RETURNING *`,
        [enrollmentId, moduleId, score, timeSpentSecs]
    );

    // Check if all modules completed → mark course as completed
    const totalModules = await query(
        'SELECT COUNT(*) as total FROM course_modules WHERE course_id = $1',
        [courseId]
    );
    const completedModules = await query(
        `SELECT COUNT(*) as completed FROM module_progress 
     WHERE enrollment_id = $1 AND status = 'completed'`,
        [enrollmentId]
    );

    if (parseInt(completedModules.rows[0].completed) >= parseInt(totalModules.rows[0].total)) {
        await query(
            `UPDATE enrollments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
            [enrollmentId]
        );
    }

    // Update last_accessed
    await query('UPDATE enrollments SET last_accessed = NOW() WHERE id = $1', [enrollmentId]);

    // Record interaction
    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.CONTENT_INTERACTIONS,
        Item: {
            userId,
            interactionId: uuidv4(),
            contentType: 'module',
            contentId: moduleId,
            interactionType: 'complete',
            durationSecs: timeSpentSecs,
            rating: null,
            language: 'hi',
            voiceUsed: false,
            timestamp: new Date().toISOString(),
        },
    }));

    return progressResult.rows[0];
}

module.exports = { enrollUser, getUserEnrollments, completeModule };
