/**
 * Community Lambda – Main handler.
 */

const { success, error, badRequest, notFound, conflict } = require('../../utils/response');
const posts = require('./posts');
const social = require('./social');

exports.handler = async (event) => {
  console.log('Community API event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath;
  const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-user';
  const queryParams = event.queryStringParameters || {};
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { return badRequest('Invalid JSON body'); }

  try {
    // ── Create Post ──
    if (path.match(/\/posts$/) && method === 'POST') {
      if (!body.title || !body.content) return badRequest('title and content are required');
      try {
        const result = await posts.createPost(body, userId);
        return success(result, 201);
      } catch (err) {
        if (err.message === 'INVALID_TOPIC') return badRequest('Invalid topic');
        throw err;
      }
    }

    // ── List Posts ──
    if (path.match(/\/posts$/) && method === 'GET') {
      const result = await posts.listPosts({
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
        topic: queryParams.topic,
        authorId: queryParams.authorId,
        search: queryParams.search,
      });
      return success(result);
    }

    // ── Get Post ──
    if (path.match(/\/posts\/([a-f0-9-]+)$/) && !path.includes('/bookmark') && !path.includes('/report') && method === 'GET') {
      const id = path.match(/\/posts\/([a-f0-9-]+)$/)[1];
      const result = await posts.getPostById(id);
      if (!result) return notFound('Post not found');
      return success(result);
    }

    // ── Bookmark Toggle ──
    if (path.match(/\/posts\/([a-f0-9-]+)\/bookmark$/) && method === 'POST') {
      const postId = path.match(/\/posts\/([a-f0-9-]+)\/bookmark$/)[1];
      const result = await social.toggleBookmark(postId, userId);
      return success(result);
    }

    // ── Report Post ──
    if (path.match(/\/posts\/([a-f0-9-]+)\/report$/) && method === 'POST') {
      const postId = path.match(/\/posts\/([a-f0-9-]+)\/report$/)[1];
      if (!body.reason) return badRequest('reason is required');
      try {
        const result = await social.reportPost(postId, userId, body.reason);
        return success(result, 201);
      } catch (err) {
        if (err.message === 'ALREADY_REPORTED') return conflict('Already reported this post');
        throw err;
      }
    }

    // ── Bookmarks List ──
    if (path.match(/\/bookmarks$/) && method === 'GET') {
      const result = await social.listBookmarks(userId, {
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
      });
      return success(result);
    }

    // ── Follow Toggle ──
    if (path.match(/\/follow\/([a-f0-9-]+)$/) && method === 'POST') {
      const targetUserId = path.match(/\/follow\/([a-f0-9-]+)$/)[1];
      try {
        const result = await social.toggleFollow(targetUserId, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'CANNOT_FOLLOW_SELF') return badRequest('Cannot follow yourself');
        throw err;
      }
    }

    // ── Following List ──
    if (path.match(/\/following$/) && method === 'GET') {
      const result = await social.listFollowing(userId, {
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
      });
      return success(result);
    }

    return notFound(`Route not found: ${method} ${path}`);

  } catch (err) {
    console.error('Community API error:', err);
    return error('Internal server error', 500, err.message);
  }
};
