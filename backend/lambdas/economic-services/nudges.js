/**
 * Economic Services – seasonal financial nudges.
 * Req 8.5: Financial planning nudges based on seasonal cycles.
 */

const { QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const FINANCIAL_NOTIFICATIONS_TOPIC_ARN = process.env.FINANCIAL_NOTIFICATIONS_TOPIC_ARN || '';

function buildSeasonalMessages(profile, season = 'pre-sowing') {
    const cropText = (profile.crop_types || []).slice(0, 2).join(', ') || 'your crops';
    const messages = {
        'pre-sowing': `Pre-sowing for ${cropText} is near. Keep seed and fertilizer money separate before other spending.`,
        sowing: `Sowing season has started. Review working capital and avoid taking high-cost informal credit at the last minute.`,
        'mid-season': `Mid-season cash flow matters. Track pesticide and irrigation expenses against the harvest target.`,
        harvest: `Harvest season is the time to lock in savings. Reserve money first for the next crop cycle and emergency needs.`,
        'post-harvest': `Post-harvest income should be split between loan repayment, household needs, and next-season inputs.`,
    };

    return messages[season] || messages['pre-sowing'];
}

async function generateFinancialNudge(userId, payload = {}) {
    const profile = payload.profile || null;
    const season = payload.season || 'pre-sowing';
    const generatedAt = new Date().toISOString();
    const message = buildSeasonalMessages(profile || {}, season);

    const nudge = {
        userId,
        generatedAt,
        season,
        channel: payload.channel || 'push',
        message,
        related_crop_types: profile?.crop_types || [],
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.FINANCIAL_NUDGES,
        Item: nudge,
    }));

    if (FINANCIAL_NOTIFICATIONS_TOPIC_ARN) {
        await sns.send(new PublishCommand({
            TopicArn: FINANCIAL_NOTIFICATIONS_TOPIC_ARN,
            Subject: `Financial nudge: ${season}`,
            Message: JSON.stringify(nudge),
        }));
    }

    return nudge;
}

async function listFinancialNudges(userId, limit = 20) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.FINANCIAL_NUDGES,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: limit,
    }));

    return {
        nudges: result.Items || [],
    };
}

module.exports = {
    buildSeasonalMessages,
    generateFinancialNudge,
    listFinancialNudges,
};
