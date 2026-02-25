/**
 * Knowledge API Lambda – govt-integration.js
 * Government training course integration and sync.
 * Satisfies Requirement 7.5: Access to government training courses.
 */

const { query } = require('../../utils/db');

// Known government training portals we integrate with
const GOVT_PORTALS = {
    PMKVY: {
        name: 'Pradhan Mantri Kaushal Vikas Yojana',
        url: 'https://www.pmkvyofficial.org/',
        description: 'Skill development scheme under Ministry of Skill Development',
    },
    'DDU-GKY': {
        name: 'Deen Dayal Upadhyaya Grameen Kaushalya Yojana',
        url: 'https://ddugky.gov.in/',
        description: 'Rural youth skill training and employment',
    },
    PMGDISHA: {
        name: 'Pradhan Mantri Gramin Digital Saksharta Abhiyan',
        url: 'https://www.pmgdisha.in/',
        description: 'Digital literacy for rural households',
    },
    MANAGE: {
        name: 'National Institute of Agricultural Extension Management',
        url: 'https://www.manage.gov.in/',
        description: 'Agricultural extension training',
    },
    ICAR: {
        name: 'Indian Council of Agricultural Research',
        url: 'https://kvk.icar.gov.in/',
        description: 'KVK frontline demonstrations and training',
    },
    'Skill India': {
        name: 'Skill India Portal',
        url: 'https://www.skillindia.gov.in/',
        description: 'Unified skill training portal',
    },
    NSDC: {
        name: 'National Skill Development Corporation',
        url: 'https://nsdcindia.org/',
        description: 'Skill training through sector skill councils',
    },
};

/**
 * List government courses with optional filters.
 */
async function listGovtCourses({ language, category, portal, search, page = 1, limit = 20 }) {
    let sql = 'SELECT * FROM government_courses WHERE is_active = true';
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
    if (portal) {
        sql += ` AND source_portal = $${paramIndex++}`;
        params.push(portal);
    }
    if (search) {
        sql += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const offset = (page - 1) * limit;
    sql += ` ORDER BY last_synced DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return {
        courses: result.rows.map(row => ({
            ...row,
            portal_info: GOVT_PORTALS[row.source_portal] || null,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        available_portals: Object.keys(GOVT_PORTALS),
    };
}

/**
 * Get a specific government course by ID.
 */
async function getGovtCourseById(courseId) {
    const result = await query(
        'SELECT * FROM government_courses WHERE id = $1 AND is_active = true',
        [courseId]
    );
    if (result.rows.length === 0) return null;

    const course = result.rows[0];
    return {
        ...course,
        portal_info: GOVT_PORTALS[course.source_portal] || null,
    };
}

/**
 * Sync government courses from external portals.
 * In production, this would scrape/API-fetch from government websites.
 * For hackathon, we use the seeded data and this is a no-op refresh.
 */
async function syncGovtCourses(portal = null) {
    // TODO: In production, implement actual API calls to government portals
    // For now, update last_synced timestamps
    let sql = 'UPDATE government_courses SET last_synced = NOW()';
    const params = [];

    if (portal) {
        sql += ' WHERE source_portal = $1';
        params.push(portal);
    }

    sql += ' RETURNING id, title, source_portal';
    const result = await query(sql, params);

    return {
        synced: result.rows.length,
        portal: portal || 'all',
        courses: result.rows,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Get available government portals metadata.
 */
function getAvailablePortals() {
    return Object.entries(GOVT_PORTALS).map(([key, value]) => ({
        id: key,
        ...value,
    }));
}

module.exports = { listGovtCourses, getGovtCourseById, syncGovtCourses, getAvailablePortals };
