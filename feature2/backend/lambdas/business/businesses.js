/**
 * Business CRUD – Aurora PostgreSQL operations.
 */

const { v4: uuidv4 } = require('uuid');
const { query } = require('../../utils/db');

async function createBusiness(data, userId) {
  // Validate phone
  if (!/^[6-9]\d{9}$/.test(data.phone)) {
    throw new Error('INVALID_PHONE');
  }

  // Check category exists
  const catResult = await query('SELECT id FROM business_categories WHERE id = $1', [data.categoryId]);
  if (catResult.rows.length === 0) throw new Error('CATEGORY_NOT_FOUND');

  // Check duplicate name by same owner
  const dupResult = await query(
    'SELECT id FROM businesses WHERE LOWER(name) = LOWER($1) AND owner_id = $2',
    [data.name, userId]
  );
  if (dupResult.rows.length > 0) throw new Error('DUPLICATE_BUSINESS');

  const id = uuidv4();
  const result = await query(
    `INSERT INTO businesses (id, name, description, phone, email, address, latitude, longitude, operating_hours, owner_id, category_id, sub_category_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
    [id, data.name, data.description || null, data.phone, data.email || null,
      data.address, data.latitude || null, data.longitude || null,
      data.operatingHours ? JSON.stringify(data.operatingHours) : null,
      userId, data.categoryId, data.subCategoryId || null]
  );

  return result.rows[0];
}

async function listBusinesses({ page = 1, limit = 10, search, categoryId, verified, active }) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(LOWER(b.name) LIKE $${paramIdx} OR LOWER(b.description) LIKE $${paramIdx})`);
    params.push(`%${search.toLowerCase()}%`);
    paramIdx++;
  }
  if (categoryId) {
    conditions.push(`b.category_id = $${paramIdx}`);
    params.push(categoryId);
    paramIdx++;
  }
  if (verified !== undefined) {
    conditions.push(`b.is_verified = $${paramIdx}`);
    params.push(verified === 'true');
    paramIdx++;
  }
  if (active !== undefined) {
    conditions.push(`b.is_active = $${paramIdx}`);
    params.push(active === 'true');
    paramIdx++;
  } else {
    conditions.push('b.is_active = TRUE');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) as total FROM businesses b ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const dataResult = await query(
    `SELECT b.*, c.name as category_name, c.icon as category_icon,
                u.name as owner_name
         FROM businesses b
         LEFT JOIN business_categories c ON b.category_id = c.id
         LEFT JOIN users u ON b.owner_id = u.id
         ${whereClause}
         ORDER BY b.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return {
    businesses: dataResult.rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getBusinessById(id) {
  const result = await query(
    `SELECT b.*, c.name as category_name, c.icon as category_icon,
                sc.name as subcategory_name, u.name as owner_name
         FROM businesses b
         LEFT JOIN business_categories c ON b.category_id = c.id
         LEFT JOIN business_subcategories sc ON b.sub_category_id = sc.id
         LEFT JOIN users u ON b.owner_id = u.id
         WHERE b.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateBusiness(id, data, userId) {
  const existing = await query('SELECT * FROM businesses WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new Error('BUSINESS_NOT_FOUND');
  if (existing.rows[0].owner_id !== userId) throw new Error('NOT_OWNER');

  if (data.phone && !/^[6-9]\d{9}$/.test(data.phone)) throw new Error('INVALID_PHONE');

  const fields = [];
  const params = [];
  let paramIdx = 1;

  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    fields.push(`${dbKey} = $${paramIdx}`);
    params.push(key === 'operatingHours' ? JSON.stringify(value) : value);
    paramIdx++;
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await query(
    `UPDATE businesses SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  return result.rows[0];
}

async function deactivateBusiness(id, userId) {
  const existing = await query('SELECT * FROM businesses WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new Error('BUSINESS_NOT_FOUND');
  if (existing.rows[0].owner_id !== userId) throw new Error('NOT_OWNER');

  await query('UPDATE businesses SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]);
  return { id, isActive: false };
}

module.exports = { createBusiness, listBusinesses, getBusinessById, updateBusiness, deactivateBusiness };
