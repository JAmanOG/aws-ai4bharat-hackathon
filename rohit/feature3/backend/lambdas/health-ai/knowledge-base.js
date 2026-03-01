/**
 * Module 5 — Health Knowledge Base.
 * AI-generated health articles cached in DynamoDB.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { PutCommand, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { BEDROCK_MODEL_ID, HEALTH_TOPICS, DISCLAIMER } = require('../../utils/constants');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

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

  // Without topic, we scan (limited for demo)
  const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
  const result = await dynamoDB.send(new ScanCommand({ ...params }));
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
 */
async function generateArticle(topic, language = 'en') {
  if (!topic) throw { statusCode: 400, message: 'Topic is required' };

  // Check if article already exists for this topic
  const existing = await listArticles(topic.toLowerCase(), 1);
  if (existing.length > 0) {
    return { article: existing[0], cached: true };
  }

  let content;
  try {
    content = await getBedrockArticle(topic, language);
  } catch (err) {
    console.warn('[KnowledgeBase] Bedrock unavailable, using fallback:', err.message);
    content = getFallbackArticle(topic);
  }

  // Store in DynamoDB
  const article = {
    articleId: uuidv4(),
    topic: topic.toLowerCase(),
    title: content.title,
    sections: content.sections,
    language,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAMES.HEALTH_ARTICLES,
    Item: article,
  }));

  return { article, cached: false };
}

/**
 * Call Bedrock for article generation.
 */
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

  try {
    return JSON.parse(cleaned);
  } catch {
    return getFallbackArticle(topic);
  }
}

/**
 * Fallback article template.
 */
function getFallbackArticle(topic) {
  return {
    title: `Understanding ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
    sections: [
      { heading: 'What is it?', content: `${topic} is a common health condition. Please consult a healthcare professional for detailed information.` },
      { heading: 'Common Symptoms', content: 'Symptoms vary by individual. Monitor your health and note any changes.' },
      { heading: 'Prevention', content: 'Maintain good hygiene, eat nutritious food, exercise regularly, and get adequate sleep.' },
      { heading: 'When to See a Doctor', content: 'If symptoms persist for more than 3 days, worsen suddenly, or include fever above 103°F, seek medical attention immediately. Visit your nearest PHC or CHC.' },
    ],
  };
}

module.exports = { listArticles, getArticle, generateArticle, getFallbackArticle };
