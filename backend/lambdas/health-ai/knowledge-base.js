/**
 * Health Knowledge Base.
 * AI-generated health articles cached in DynamoDB.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { PutCommand, QueryCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { BEDROCK_MODEL_ID, HEALTH_TOPICS, HEALTH_DISCLAIMER } = require('../../utils/constants');

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.BEDROCK_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'test',
    sessionToken: process.env.BEDROCK_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN || undefined,
  },
});

/**
 * List articles by topic, with pagination.
 */
async function listArticles(topic, limit = 10) {
  const params = {
    TableName: TABLE_NAMES.HEALTH_ARTICLES,
    Limit: limit,
  };

  if (topic) {
    params.IndexName = 'ByTopic';
    params.KeyConditionExpression = 'topic = :t';
    params.ExpressionAttributeValues = { ':t': topic.toLowerCase() };
    const result = await dynamoDB.send(new QueryCommand(params));
    return result.Items || [];
  }

  const result = await dynamoDB.send(new ScanCommand(params));
  return result.Items || [];
}

/**
 * Get article by ID.
 */
async function getArticle(articleId) {
  const result = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAMES.HEALTH_ARTICLES,
    Key: { articleId },
  }));
  return result.Item || null;
}

/**
 * Generate a health article using Bedrock AI.
 * BUG FIX: Added missing `const` for content variable.
 */
async function generateArticle(topic, language = 'en') {
  if (!topic) {
    throw { statusCode: 400, message: 'Topic is required' };
  }

  // Check if article already exists for this topic
  const existing = await listArticles(topic.toLowerCase(), 1);
  if (existing.length > 0) {
    return { article: existing[0], cached: true };
  }

  let content;
  try {
    content = await getBedrockArticle(topic, language);
  } catch (err) {
    console.error('[KnowledgeBase] Bedrock generation failed:', err.message);
    throw { statusCode: 503, message: `AI Content Generation unavailable: ${err.message}` };
  }

  const article = {
    articleId: uuidv4(),
    topic: topic.toLowerCase(),
    title: content.title,
    sections: content.sections,
    language,
    generatedAt: new Date().toISOString(),
    disclaimer: HEALTH_DISCLAIMER,
    ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  };

  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAMES.HEALTH_ARTICLES,
    Item: article,
  }));

  return { article, cached: false };
}

async function getBedrockArticle(topic, language) {
  const langName = language === 'hi' ? 'Hindi' : language === 'bn' ? 'Bengali' : 'English';

  const prompt = `You are a health educator for rural India. Generate a structured health article about "${topic}" in ${langName}.

Return ONLY valid JSON (no markdown):
{
  "title": "Article title",
  "sections": [
    {"heading": "What is it?", "content": "Explanation in simple language"},
    {"heading": "Common Symptoms", "content": "List of symptoms"},
    {"heading": "Causes", "content": "What causes this condition"},
    {"heading": "Prevention", "content": "How to prevent it"},
    {"heading": "Home Remedies", "content": "Safe home remedies"},
    {"heading": "When to See a Doctor", "content": "Warning signs"}
  ]
}

Rules:
- Use simple language a rural villager can understand
- Include practical, low-cost remedies
- Mention government facilities (PHC, CHC) where applicable
- Keep each section 2-4 sentences`;

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const text = body.content?.[0]?.text || '';
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { listArticles, getArticle, generateArticle };
