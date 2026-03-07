/**
 * Business Category operations – Aurora PostgreSQL.
 */

const { query } = require('../../utils/db');

async function listCategories() {
  const result = await query(
    `SELECT c.*, COUNT(b.id) as business_count,
            json_agg(json_build_object('id', sc.id, 'name', sc.name, 'sortOrder', sc.sort_order) ORDER BY sc.sort_order)
            FILTER (WHERE sc.id IS NOT NULL) as subcategories
     FROM business_categories c
     LEFT JOIN business_subcategories sc ON c.id = sc.category_id
     LEFT JOIN businesses b ON c.id = b.category_id AND b.is_active = TRUE
     GROUP BY c.id
     ORDER BY c.sort_order`
  );
  return result.rows;
}

async function getCategoryById(id) {
  const result = await query(
    `SELECT c.*,
            json_agg(json_build_object('id', sc.id, 'name', sc.name, 'sortOrder', sc.sort_order) ORDER BY sc.sort_order)
            FILTER (WHERE sc.id IS NOT NULL) as subcategories
     FROM business_categories c
     LEFT JOIN business_subcategories sc ON c.id = sc.category_id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { listCategories, getCategoryById };
