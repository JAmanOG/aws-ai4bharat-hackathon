/**
 * Government Scheme operations – Aurora PostgreSQL.
 */

const { v4: uuidv4 } = require('uuid');
const { query } = require('../../utils/db');

async function listSchemes({ page = 1, limit = 10, categoryId, search }) {
  const conditions = ['gs.is_active = TRUE'];
  const params = [];
  let idx = 1;

  if (categoryId) { conditions.push(`gs.category_id = $${idx}`); params.push(categoryId); idx++; }
  if (search) {
    conditions.push(`(LOWER(gs.name) LIKE $${idx} OR LOWER(gs.description) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`); idx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const countResult = await query(`SELECT COUNT(*) as total FROM government_schemes gs ${where}`, params);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT gs.*, sc.name as category_name, sc.icon as category_icon
     FROM government_schemes gs
     LEFT JOIN scheme_categories sc ON gs.category_id = sc.id
     ${where} ORDER BY gs.name LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { schemes: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getSchemeById(id) {
  const result = await query(
    `SELECT gs.*, sc.name as category_name, sc.icon as category_icon
     FROM government_schemes gs
     LEFT JOIN scheme_categories sc ON gs.category_id = sc.id
     WHERE gs.id = $1`, [id]
  );
  return result.rows[0] || null;
}

async function listSchemeCategories() {
  const result = await query(
    `SELECT sc.*, COUNT(gs.id) as scheme_count
     FROM scheme_categories sc
     LEFT JOIN government_schemes gs ON sc.id = gs.category_id AND gs.is_active = TRUE
     GROUP BY sc.id ORDER BY sc.name`
  );
  return result.rows;
}

async function saveComplaint(data, userId) {
  const id = uuidv4();
  const result = await query(
    `INSERT INTO saved_complaints (id, portal_name, reference_no, description, status, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, data.portalName, data.referenceNo, data.description || null, 'filed', userId]
  );
  return result.rows[0];
}

async function listComplaints(userId, { page = 1, limit = 10 } = {}) {
  const countResult = await query('SELECT COUNT(*) as total FROM saved_complaints WHERE user_id = $1', [userId]);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const result = await query(
    'SELECT * FROM saved_complaints WHERE user_id = $1 ORDER BY filed_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );

  return { complaints: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

module.exports = { listSchemes, getSchemeById, listSchemeCategories, saveComplaint, listComplaints };
