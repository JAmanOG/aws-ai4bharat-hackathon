/**
 * Learning Path Lambda – recommendations.js
 * AI-powered personalized learning recommendations using Amazon Bedrock.
 * Satisfies Requirement 7.4: Suggest next learning steps based on progress & goals.
 * Satisfies Requirement 7.6: Track learning outcomes and adjust recommendations.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { dynamoDB, TABLE_NAMES, query } = require('../../utils/db');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

/**
 * Generate personalized learning recommendations for a user.
 */
async function generateRecommendations(userId) {
    // 1. Gather user context
    const userProfile = await getUserProfile(userId);
    const enrollmentHistory = await getEnrollmentHistory(userId);
    const recentInteractions = await getRecentInteractions(userId);
    const availableCourses = await getAvailableCourses(userId);

    // 2. Build context for Bedrock
    const prompt = buildRecommendationPrompt(userProfile, enrollmentHistory, recentInteractions, availableCourses);

    // 3. Get AI recommendations
    let recommendations;
    try {
        recommendations = await getBedrockRecommendations(prompt);
    } catch (err) {
        console.error('Bedrock recommendation error:', err.message);
        recommendations = generateFallbackRecommendations(userProfile, enrollmentHistory, availableCourses);
    }

    // 4. Store recommendations in DynamoDB
    const now = new Date().toISOString();
    const ttl = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.LEARNING_RECOMMENDATIONS,
        Item: {
            userId,
            generatedAt: now,
            recommendedCourses: recommendations.courses || [],
            recommendedGroups: recommendations.groups || [],
            nextSteps: recommendations.nextSteps || [],
            reasoning: recommendations.reasoning || '',
            modelVersion: BEDROCK_MODEL_ID,
            isActedUpon: false,
            expiresAt: ttl,
        },
    }));

    return {
        userId,
        generatedAt: now,
        recommendations: {
            courses: recommendations.courses || [],
            groups: recommendations.groups || [],
            nextSteps: recommendations.nextSteps || [],
        },
        reasoning: recommendations.reasoning,
    };
}

/**
 * Get the latest recommendations for a user (from cache or generate new).
 */
async function getLatestRecommendations(userId, forceRefresh = false) {
    if (!forceRefresh) {
        // Check for recent recommendations (< 24 hours old)
        const result = await dynamoDB.send(new QueryCommand({
            TableName: TABLE_NAMES.LEARNING_RECOMMENDATIONS,
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': userId },
            ScanIndexForward: false, // Latest first
            Limit: 1,
        }));

        const latest = result.Items?.[0];
        if (latest) {
            const age = Date.now() - new Date(latest.generatedAt).getTime();
            if (age < 24 * 60 * 60 * 1000) { // Less than 24 hours
                return {
                    userId,
                    generatedAt: latest.generatedAt,
                    recommendations: {
                        courses: latest.recommendedCourses,
                        groups: latest.recommendedGroups,
                        nextSteps: latest.nextSteps,
                    },
                    reasoning: latest.reasoning,
                    cached: true,
                };
            }
        }
    }

    return generateRecommendations(userId);
}

/**
 * Build the recommendation prompt for Bedrock.
 */
function buildRecommendationPrompt(profile, enrollments, interactions, courses) {
    return `You are an AI tutor for a rural education platform in India.
Generate personalized learning recommendations for this user.

USER PROFILE:
- Goals: ${JSON.stringify(profile?.learningGoals || ['general learning'])}
- Interests: ${JSON.stringify(profile?.interests || [])}
- Skill Level: ${profile?.skillLevel || 'beginner'}
- Language: ${profile?.preferredLanguage || 'hi'}
- Courses Completed: ${profile?.totalCoursesCompleted || 0}
- Total Time Spent: ${profile?.totalTimeSpentMins || 0} minutes

ENROLLMENT HISTORY (${enrollments.length} courses):
${enrollments.map(e => `- "${e.title}" (${e.category}, ${e.difficulty}) - Status: ${e.status}, Progress: ${e.progressPercent || 0}%${e.status === 'completed' ? '' : ''}`).join('\n')}

RECENT ACTIVITY (last ${interactions.length} interactions):
${interactions.slice(0, 10).map(i => `- ${i.interactionType} on ${i.contentType} "${i.contentId}" (${i.durationSecs}s)`).join('\n')}

AVAILABLE COURSES (${courses.length} options):
${courses.slice(0, 15).map(c => `- ID: ${c.id}, "${c.title}" (${c.category}, ${c.difficulty}, ${c.language})`).join('\n')}

Based on the user's profile, learning history, and available courses, provide recommendations.

Rules:
1. If user has low scores in completed courses, suggest prerequisites or review courses
2. If user completes courses quickly with high scores, suggest advanced content
3. Prioritize courses matching user's goals and interests
4. Recommend courses in user's preferred language
5. Suggest 3-5 courses, each with a clear reason

Respond in JSON:
{
  "courses": [
    { "courseId": "id", "title": "name", "reason": "why this course", "priority": 1-5 }
  ],
  "nextSteps": ["Step 1 description", "Step 2 description"],
  "reasoning": "Overall reasoning for these recommendations"
}`;
}

/**
 * Call Bedrock for recommendations.
 */
async function getBedrockRecommendations(prompt) {
    const response = await bedrock.send(new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }],
        }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse Bedrock response');
}

/**
 * Fallback rule-based recommendations when Bedrock is unavailable.
 */
function generateFallbackRecommendations(profile, enrollments, courses) {
    const completedIds = new Set(enrollments.filter(e => e.status === 'completed').map(e => e.course_id));
    const enrolledIds = new Set(enrollments.map(e => e.course_id));
    const targetInterests = new Set(profile?.interests || []);
    const targetGoals = new Set(profile?.learningGoals || []);

    const scored = courses
        .filter(c => !enrolledIds.has(c.id))
        .map(c => {
            let score = 0;
            if (targetInterests.has(c.category)) score += 3;
            if (targetGoals.has(c.category)) score += 3;
            if (c.language === (profile?.preferredLanguage || 'hi')) score += 2;
            if (c.difficulty === (profile?.skillLevel || 'beginner')) score += 1;
            return { ...c, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    return {
        courses: scored.map((c, i) => ({
            courseId: c.id,
            title: c.title,
            reason: `Matches your interests in ${c.category}`,
            priority: i + 1,
        })),
        nextSteps: [
            completedIds.size === 0
                ? 'Start with a beginner course in your area of interest'
                : `Continue building on your ${completedIds.size} completed courses`,
            'Join a peer learning group to learn with others',
            'Complete your DigiLocker verification for trusted peer interactions',
        ],
        reasoning: 'Recommendations based on matching your interests and skill level with available courses',
    };
}

// ── Helper functions ──

async function getUserProfile(userId) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items?.[0] || null;
}

async function getEnrollmentHistory(userId) {
    const result = await query(
        `SELECT e.*, c.title, c.category, c.difficulty,
            (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) as total_modules,
            (SELECT COUNT(*) FROM module_progress mp WHERE mp.enrollment_id = e.id AND mp.status = 'completed') as completed_modules
     FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1 ORDER BY e.enrolled_at DESC`,
        [userId]
    );
    return result.rows.map(r => ({
        ...r,
        progressPercent: r.total_modules > 0 ? Math.round((r.completed_modules / r.total_modules) * 100) : 0,
    }));
}

async function getRecentInteractions(userId) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.CONTENT_INTERACTIONS,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: 20,
    }));
    return result.Items || [];
}

async function getAvailableCourses(userId) {
    const result = await query(
        'SELECT id, title, category, language, difficulty FROM courses WHERE is_active = true ORDER BY created_at DESC LIMIT 50',
        []
    );
    return result.rows;
}

module.exports = { generateRecommendations, getLatestRecommendations };
