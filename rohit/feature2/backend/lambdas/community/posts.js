/**
 * Community – Knowledge Posts CRUD – Aurora PostgreSQL.
 */

const { v4: uuidv4 } = require('uuid');
const { query } = require('../../utils/db');

async function createPost(data, userId) {
  console.log(`[ACTION] User ${userId} requested post creation. Params: ${JSON.stringify(data)}`);
  const validTopics = ['agriculture', 'health', 'education', 'finance', 'infrastructure', 'general', 'livestock', 'business', 'government'];
  if (data.topic && !validTopics.includes(data.topic)) {
    console.log(`[ACTION] Invalid topic rejected: ${data.topic}`);
    throw new Error('INVALID_TOPIC');
  }

  const id = uuidv4();
  console.log(`[TRACE] Persisting post to DB. ID: ${id}, Topic: ${data.topic || 'general'}, Author: ${userId}`);
  const result = await query(
    `INSERT INTO knowledge_posts (id, title, content, topic, author_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, data.title, data.content, data.topic || 'general', userId]
  );
  console.log(`[ACTION] Post created successfully. Title: "${data.title}"`);
  return result.rows[0];
}

async function listPosts({ page = 1, limit = 10, topic, authorId, search }) {
  console.log(`[ACTION] Listing posts. Filters -> Page: ${page}, Limit: ${limit}, Topic: ${topic}, Author: ${authorId}, Search: ${search}`);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (topic) { conditions.push(`p.topic = $${idx}`); params.push(topic); idx++; }
  if (authorId) { conditions.push(`p.author_id = $${idx}`); params.push(authorId); idx++; }
  if (search) {
    conditions.push(`(LOWER(p.title) LIKE $${idx} OR LOWER(p.content) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`); idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*) as total FROM knowledge_posts p ${where}`, params);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT p.*, u.name as author_name,
                (SELECT COUNT(*) FROM bookmarks b WHERE b.post_id = p.id) as bookmark_count
         FROM knowledge_posts p
         LEFT JOIN users u ON p.author_id = u.id
         ${where} ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { posts: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getPostById(id) {
  console.log(`[ACTION] Fetching post details for ID: ${id}`);
  const result = await query(
    `SELECT p.*, u.name as author_name,
                (SELECT COUNT(*) FROM bookmarks b WHERE b.post_id = p.id) as bookmark_count
         FROM knowledge_posts p
         LEFT JOIN users u ON p.author_id = u.id
         WHERE p.id = $1`, [id]
  );
  return result.rows[0] || null;
}

module.exports = { createPost, listPosts, getPostById };
