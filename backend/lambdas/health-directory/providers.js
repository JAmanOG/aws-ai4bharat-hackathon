/**
 * Private Healthcare Provider Directory.
 * Curated static directory in Aurora PostgreSQL.
 */

const { query } = require('../../utils/db');

/**
 * Search providers with filters.
 */
async function listProviders(filters = {}) {
  const { city, type, search, limit = 20, page = 1 } = filters;

  let sql = `SELECT * FROM health_providers WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (city) {
    sql += ` AND (city ILIKE $${idx} OR city = 'Pan-India')`;
    params.push(`%${city}%`);
    idx++;
  }
  if (type) {
    sql += ` AND type = $${idx++}`;
    params.push(type);
  }
  if (search) {
    sql += ` AND (name ILIKE $${idx} OR $${idx} = ANY(services) OR $${idx} = ANY(specialties))`;
    params.push(`%${search}%`);
    idx++;
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0]?.total || '0', 10);

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  sql += ` ORDER BY rating DESC NULLS LAST, name LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(parseInt(limit, 10), offset);

  const result = await query(sql, params);

  return {
    providers: result.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  };
}

/**
 * Get provider by ID.
 */
async function getProvider(providerId) {
  const result = await query('SELECT * FROM health_providers WHERE id = $1', [providerId]);
  return result.rows[0] || null;
}

module.exports = { listProviders, getProvider };
