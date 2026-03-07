/**
 * Government Portal/Scheme operations – Aurora PostgreSQL.
 */

const { query } = require('../../utils/db');

async function listPortals({ page = 1, limit = 10, category, region, search }) {
  console.log(`[ACTION] Listing portals. Filters -> Page: ${page}, Category: ${category}, Region: ${region}, Search: ${search}`);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (category) { conditions.push(`category = $${idx}`); params.push(category); idx++; }
  if (region) { conditions.push(`region = $${idx}`); params.push(region); idx++; }
  if (search) {
    conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(description) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`); idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*) as total FROM government_portals ${where}`, params);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT * FROM government_portals ${where} ORDER BY name LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { portals: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getPortalById(id) {
  console.log(`[ACTION] Fetching government portal details for ID: ${id}`);
  const result = await query('SELECT * FROM government_portals WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = { listPortals, getPortalById };
