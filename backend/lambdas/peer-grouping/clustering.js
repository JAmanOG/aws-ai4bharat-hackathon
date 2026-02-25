/**
 * Peer Grouping Lambda – clustering.js
 * AI-powered peer group formation using Amazon Bedrock.
 * Satisfies Requirement 7.2: AI-created peer groups with similar learning goals.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

/**
 * Find matching peers for a user and suggest/create a peer group.
 * Uses Bedrock to analyze user profiles and determine optimal grouping.
 */
async function findPeersForUser(userId) {
    // 1. Get the requesting user's learning profile
    const userProfile = await getUserLearningProfile(userId);
    if (!userProfile) {
        throw new Error('USER_PROFILE_NOT_FOUND');
    }

    // 2. Scan for candidate peers with similar characteristics
    const candidates = await findCandidatePeers(userProfile);

    if (candidates.length === 0) {
        return {
            matched: false,
            message: 'No matching peers found yet. We\'ll notify you when peers join.',
            suggestedGroups: [],
        };
    }

    // 3. Use Bedrock to analyze and cluster peers
    const clusteringResult = await clusterWithBedrock(userProfile, candidates);

    return {
        matched: true,
        suggestedGroups: clusteringResult.groups,
        reasoning: clusteringResult.reasoning,
    };
}

/**
 * Get user's learning profile from DynamoDB.
 */
async function getUserLearningProfile(userId) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));

    return result.Items?.[0] || null;
}

/**
 * Find candidate peers based on similar goals, location, and skill level.
 */
async function findCandidatePeers(userProfile) {
    // Scan users with overlapping interests (in production, use GSIs for efficiency)
    const result = await dynamoDB.send(new ScanCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        FilterExpression: 'userId <> :uid AND skillLevel = :sl',
        ExpressionAttributeValues: {
            ':uid': userProfile.userId,
            ':sl': userProfile.skillLevel || 'beginner',
        },
        Limit: 50, // Limit scan for performance
    }));

    return result.Items || [];
}

/**
 * Use Bedrock (Claude) to intelligently cluster users into peer groups.
 */
async function clusterWithBedrock(userProfile, candidates) {
    const prompt = `You are an AI assistant for a rural education platform in India. 
Your job is to form peer learning groups from user profiles.

TARGET USER:
- Name: ${userProfile.displayName || 'Unknown'}
- Goals: ${JSON.stringify(userProfile.learningGoals || [])}
- Interests: ${JSON.stringify(userProfile.interests || [])}
- Skill Level: ${userProfile.skillLevel || 'beginner'}
- Location: ${JSON.stringify(userProfile.location || {})}
- Language: ${userProfile.preferredLanguage || 'hi'}

CANDIDATE PEERS (${candidates.length} users):
${candidates.map((c, i) => `${i + 1}. Name: ${c.displayName || 'User ' + (i + 1)}, Goals: ${JSON.stringify(c.learningGoals || [])}, Interests: ${JSON.stringify(c.interests || [])}, Skill: ${c.skillLevel || 'beginner'}, Location: ${JSON.stringify(c.location || {})}`).join('\n')}

Form 1-3 peer learning groups from these candidates for the target user. Each group should have 3-10 members with shared goals.

Respond in JSON format:
{
  "groups": [
    {
      "name": "Group name in Hindi or English",
      "description": "Brief group description",
      "goals": ["shared goal 1", "shared goal 2"],
      "memberUserIds": ["userId1", "userId2"],
      "matchScore": 0.0-1.0,
      "reason": "Why these users should learn together"
    }
  ],
  "reasoning": "Overall reasoning for the grouping"
}`;

    try {
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

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { groups: [], reasoning: 'Could not parse AI response' };
    } catch (err) {
        console.error('Bedrock clustering error:', err.message);
        // Fallback: simple rule-based grouping
        return fallbackClustering(userProfile, candidates);
    }
}

/**
 * Fallback rule-based clustering when Bedrock is unavailable.
 */
function fallbackClustering(userProfile, candidates) {
    const targetGoals = new Set(userProfile.learningGoals || []);
    const targetInterests = new Set(userProfile.interests || []);

    const scored = candidates.map(c => {
        const goalOverlap = (c.learningGoals || []).filter(g => targetGoals.has(g)).length;
        const interestOverlap = (c.interests || []).filter(i => targetInterests.has(i)).length;
        const sameLocation = (c.location?.state === userProfile.location?.state) ? 1 : 0;
        const score = (goalOverlap * 3 + interestOverlap * 2 + sameLocation) / 10;
        return { ...c, matchScore: Math.min(score, 1) };
    });

    const matched = scored.filter(c => c.matchScore > 0.2).sort((a, b) => b.matchScore - a.matchScore);

    if (matched.length === 0) {
        return { groups: [], reasoning: 'No sufficiently matching peers found' };
    }

    return {
        groups: [{
            name: 'Learning Group',
            description: `Group for ${(userProfile.learningGoals || []).join(', ')}`,
            goals: userProfile.learningGoals || [],
            memberUserIds: matched.slice(0, 10).map(m => m.userId),
            matchScore: matched[0].matchScore,
            reason: 'Grouped by shared learning goals and interests',
        }],
        reasoning: 'Used rule-based matching based on goal and interest overlap',
    };
}

module.exports = { findPeersForUser, getUserLearningProfile, clusterWithBedrock };
