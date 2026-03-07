/**
 * Livelihood – Categories & Guidance operations.
 */

const { query } = require('../../utils/db');

async function listCategories() {
  const result = await query(
    `SELECT lc.*, COUNT(lg.id) as guidance_count
     FROM livelihood_categories lc
     LEFT JOIN livelihood_guidance lg ON lc.id = lg.category_id
     GROUP BY lc.id ORDER BY lc.name`
  );
  return result.rows;
}

async function listGuidance({ page = 1, limit = 10, categoryId, search }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (categoryId) { conditions.push(`lg.category_id = $${idx}`); params.push(categoryId); idx++; }
  if (search) {
    conditions.push(`(LOWER(lg.title) LIKE $${idx} OR LOWER(lg.description) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`); idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*) as total FROM livelihood_guidance lg ${where}`, params);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT lg.*, lc.name as category_name, lc.display_name, lc.icon
     FROM livelihood_guidance lg
     LEFT JOIN livelihood_categories lc ON lg.category_id = lc.id
     ${where} ORDER BY lg.title LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { guidance: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getGuidanceById(id) {
  const result = await query(
    `SELECT lg.*, lc.name as category_name, lc.display_name, lc.icon
     FROM livelihood_guidance lg
     LEFT JOIN livelihood_categories lc ON lg.category_id = lc.id
     WHERE lg.id = $1`, [id]
  );
  return result.rows[0] || null;
}

module.exports = { listCategories, listGuidance, getGuidanceById };
