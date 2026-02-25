/**
 * Knowledge API Lambda – courses.js
 * Course CRUD, search, and filtering operations.
 */

const { query } = require('../../utils/db');

/**
 * List courses with optional filters.
 */
async function listCourses({ language, category, difficulty, search, page = 1, limit = 20 }) {
    let sql = 'SELECT * FROM courses WHERE is_active = true';
    const params = [];
    let paramIndex = 1;

    if (language) {
        sql += ` AND language = $${paramIndex++}`;
        params.push(language);
    }
    if (category) {
        sql += ` AND category = $${paramIndex++}`;
        params.push(category);
    }
    if (difficulty) {
        sql += ` AND difficulty = $${paramIndex++}`;
        params.push(difficulty);
    }
    if (search) {
        sql += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR $${paramIndex}::text = ANY(tags))`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    // Count total
    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Paginate
    const offset = (page - 1) * limit;
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return {
        courses: result.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get a single course by ID with its modules.
 */
async function getCourseById(courseId) {
    const courseResult = await query('SELECT * FROM courses WHERE id = $1 AND is_active = true', [courseId]);
    if (courseResult.rows.length === 0) return null;

    const modulesResult = await query(
        'SELECT * FROM course_modules WHERE course_id = $1 ORDER BY module_number ASC',
        [courseId]
    );

    return {
        ...courseResult.rows[0],
        modules: modulesResult.rows,
        totalModules: modulesResult.rows.length,
    };
}

/**
 * Create a new course (admin / community contribution).
 */
async function createCourse(courseData) {
    const {
        title, description, category, language, difficulty,
        source, provider_name, provider_url, duration_minutes, tags,
    } = courseData;

    const result = await query(
        `INSERT INTO courses (title, description, category, language, difficulty, source, provider_name, provider_url, duration_minutes, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
        [title, description, category, language || 'hi', difficulty || 'beginner',
            source || 'curated', provider_name, provider_url, duration_minutes || 0, tags || []]
    );

    return result.rows[0];
}

/**
 * Add a module to a course.
 */
async function addModule(courseId, moduleData) {
    const { module_number, title, content_text, audio_s3_key, language, duration_minutes } = moduleData;

    const result = await query(
        `INSERT INTO course_modules (course_id, module_number, title, content_text, audio_s3_key, language, duration_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
        [courseId, module_number, title, content_text, audio_s3_key, language || 'hi', duration_minutes || 0]
    );

    return result.rows[0];
}

module.exports = { listCourses, getCourseById, createCourse, addModule };
