/**
 * Health AI Lambda — handler.
 * Routes: symptom-check, articles.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const { checkSymptoms } = require('./symptom-checker');
const { listArticles, getArticle, generateArticle } = require('./knowledge-base');

exports.handler = async (event) => {
  console.log('Health AI event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const path = event.path;
  const userId = event.requestContext?.authorizer?.claims?.sub
    || event.headers?.['x-user-id'] || 'anonymous';

  try {
    // ── Symptom Check ──
    if (path.match(/\/health\/symptom-check$/) && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await checkSymptoms(body.symptoms, body.age, body.gender, body.medicalHistory, userId);
      return success(result);
    }

    // ── Generate Article ──
    if (path.match(/\/health\/articles\/generate$/) && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await generateArticle(body.topic, body.language);
      return success(result, result.cached ? 200 : 201);
    }

    // ── Get Article by ID ──
    const articleMatch = path.match(/\/health\/articles\/([a-f0-9-]+)$/);
    if (articleMatch && method === 'GET') {
      const article = await getArticle(articleMatch[1]);
      return article ? success(article) : notFound('Article not found');
    }

    // ── List Articles ──
    if (path.match(/\/health\/articles$/) && method === 'GET') {
      const { topic, limit } = event.queryStringParameters || {};
      const articles = await listArticles(topic, parseInt(limit || '10', 10));
      return success({ articles, count: articles.length });
    }

    return notFound(`Route not found: ${method} ${path}`);
  } catch (err) {
    if (err.statusCode) return badRequest(err.message);
    console.error('Health AI error:', err);
    return error('Internal server error', 500, err.message);
  }
};
