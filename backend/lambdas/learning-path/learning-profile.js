/**
 * Learning Path Lambda – learning-profile.js
 * User learning profile management (DynamoDB).
 */

const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

/**
 * Create or update a user's learning profile.
 */
async function upsertLearningProfile(userId, profileData) {
    const now = new Date().toISOString();

    // Check if profile exists
    const existing = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));

    if (existing.Items?.length > 0) {
        // Update existing profile
        const updateParts = [];
        const exprValues = { ':now': now };
        const exprNames = {};

        if (profileData.displayName !== undefined) {
            updateParts.push('#dn = :dn');
            exprValues[':dn'] = profileData.displayName;
            exprNames['#dn'] = 'displayName';
        }
        if (profileData.preferredLanguage !== undefined) {
            updateParts.push('preferredLanguage = :pl');
            exprValues[':pl'] = profileData.preferredLanguage;
        }
        if (profileData.spokenLanguages !== undefined) {
            updateParts.push('spokenLanguages = :sl');
            exprValues[':sl'] = profileData.spokenLanguages;
        }
        if (profileData.learningGoals !== undefined) {
            updateParts.push('learningGoals = :lg');
            exprValues[':lg'] = profileData.learningGoals;
        }
        if (profileData.skillLevel !== undefined) {
            updateParts.push('skillLevel = :skl');
            exprValues[':skl'] = profileData.skillLevel;
        }
        if (profileData.interests !== undefined) {
            updateParts.push('interests = :int');
            exprValues[':int'] = profileData.interests;
        }
        if (profileData.location !== undefined) {
            updateParts.push('#loc = :loc');
            exprValues[':loc'] = profileData.location;
            exprNames['#loc'] = 'location';
        }

        updateParts.push('updatedAt = :now');

        await dynamoDB.send(new UpdateCommand({
            TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
            Key: { userId },
            UpdateExpression: 'SET ' + updateParts.join(', '),
            ExpressionAttributeValues: exprValues,
            ...(Object.keys(exprNames).length > 0 ? { ExpressionAttributeNames: exprNames } : {}),
            ReturnValues: 'ALL_NEW',
        }));

        return getLearningProfile(userId);
    }

    // Create new profile
    const profile = {
        userId,
        displayName: profileData.displayName || '',
        preferredLanguage: profileData.preferredLanguage || 'hi',
        spokenLanguages: profileData.spokenLanguages || ['hi'],
        learningGoals: profileData.learningGoals || [],
        skillLevel: profileData.skillLevel || 'beginner',
        interests: profileData.interests || [],
        location: profileData.location || {},
        trustScore: 0,
        isVerified: false,
        verificationDetails: null,
        totalCoursesCompleted: 0,
        totalTimeSpentMins: 0,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        Item: profile,
    }));

    return profile;
}

/**
 * Get a user's learning profile.
 */
async function getLearningProfile(userId) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items?.[0] || null;
}

/**
 * Update aggregate stats on the profile (called after course completion).
 */
async function updateProfileStats(userId, { coursesCompleted = 0, timeSpentMins = 0 }) {
    const now = new Date().toISOString();

    await dynamoDB.send(new UpdateCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        Key: { userId },
        UpdateExpression: `SET totalCoursesCompleted = totalCoursesCompleted + :cc,
                           totalTimeSpentMins = totalTimeSpentMins + :ts,
                           lastActiveAt = :now, updatedAt = :now`,
        ExpressionAttributeValues: {
            ':cc': coursesCompleted,
            ':ts': timeSpentMins,
            ':now': now,
        },
    }));
}

module.exports = { upsertLearningProfile, getLearningProfile, updateProfileStats };
