/**
 * Community social features – bookmarks, follows, reports – Aurora PostgreSQL.
 */

const { v4: uuidv4 } = require('uuid');
const { query } = require('../../utils/db');

// ── Bookmarks ──
async function toggleBookmark(postId, userId) {
  const existing = await query(
    'SELECT id FROM bookmarks WHERE user_id = $1 AND post_id = $2', [userId, postId]
  );

  if (existing.rows.length > 0) {
    await query('DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2', [userId, postId]);
    return { postId, bookmarked: false };
  }

  await query(
    'INSERT INTO bookmarks (id, user_id, post_id) VALUES ($1, $2, $3)',
    [uuidv4(), userId, postId]
  );
  return { postId, bookmarked: true };
}

async function listBookmarks(userId, { page = 1, limit = 10 }) {
  const countResult = await query('SELECT COUNT(*) as total FROM bookmarks WHERE user_id = $1', [userId]);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT p.*, u.name as author_name, b.created_at as bookmarked_at
     FROM bookmarks b
     JOIN knowledge_posts p ON b.post_id = p.id
     LEFT JOIN users u ON p.author_id = u.id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { bookmarks: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ── Follows ──
async function toggleFollow(targetUserId, followerId) {
  if (targetUserId === followerId) {
    throw new Error('CANNOT_FOLLOW_SELF');
  }

  const existing = await query(
    'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2', [followerId, targetUserId]
  );

  if (existing.rows.length > 0) {
    await query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [followerId, targetUserId]);
    return { userId: targetUserId, following: false };
  }

  await query(
    'INSERT INTO follows (id, follower_id, following_id) VALUES ($1, $2, $3)',
    [uuidv4(), followerId, targetUserId]
  );
  return { userId: targetUserId, following: true };
}

async function listFollowing(userId, { page = 1, limit = 10 }) {
  const countResult = await query('SELECT COUNT(*) as total FROM follows WHERE follower_id = $1', [userId]);
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT u.id, u.name, u.avatar_url, f.created_at as followed_at
     FROM follows f
     JOIN users u ON f.following_id = u.id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { following: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ── Reports ──
async function reportPost(postId, userId, reason) {
  const existing = await query(
    'SELECT id FROM content_reports WHERE reporter_id = $1 AND post_id = $2', [userId, postId]
  );
  if (existing.rows.length > 0) {
    throw new Error('ALREADY_REPORTED');
  }

  const id = uuidv4();
  await query(
    'INSERT INTO content_reports (id, reason, reporter_id, post_id) VALUES ($1, $2, $3, $4)',
    [id, reason, userId, postId]
  );
  return { postId, reported: true };
}

module.exports = { toggleBookmark, listBookmarks, toggleFollow, listFollowing, reportPost };
