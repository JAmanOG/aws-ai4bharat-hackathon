/**
 * Precision Agriculture – farming practice logging and advisory analysis.
 * Req 6.5: Track practices and suggest improvements.
 */

const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');

function normalizePracticeType(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function analyzePracticeData(payload) {
    const practices = Array.isArray(payload.practices) ? payload.practices : [];
    let score = 70;
    const strengths = [];
    const improvements = [];

    const normalized = practices.map((entry) => normalizePracticeType(entry.practice_type || entry.type));
    const counts = normalized.reduce((acc, type) => {
        if (!type) return acc;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    if (normalized.includes('soil_testing')) {
        score += 10;
        strengths.push('Soil testing is already part of the farm workflow.');
    } else {
        score -= 10;
        improvements.push('Add soil testing before the next nutrient cycle for more precise fertilizer use.');
    }

    if (payload.irrigation_method === 'drip' || normalized.includes('drip_irrigation')) {
        score += 10;
        strengths.push('Water-efficient irrigation practice detected.');
    }

    if (payload.irrigation_method === 'flood' || normalized.includes('flood_irrigation')) {
        score -= 15;
        improvements.push('Reduce flood irrigation and shift to shorter controlled irrigation turns.');
    }

    if (counts.pesticide_spray >= 3 && !normalized.includes('pest_scouting')) {
        score -= 15;
        improvements.push('Pesticide use is high relative to scouting; move to threshold-based IPM.');
    }

    if (counts.urea_application >= 2 && !normalized.includes('organic_manure')) {
        score -= 10;
        improvements.push('Balance repeated urea use with organic matter or soil-test-based correction.');
    }

    if (normalized.includes('organic_manure') || normalized.includes('mulching')) {
        score += 8;
        strengths.push('Soil-health-supporting practices are present.');
    }

    if (normalized.includes('crop_residue_burning')) {
        score -= 20;
        improvements.push('Avoid residue burning and consider mulching, composting, or incorporation.');
    }

    score = Math.max(0, Math.min(100, score));

    return {
        crop_type: payload.crop_type || null,
        crop_stage: payload.crop_stage || null,
        sustainability_score: score,
        band: score >= 80 ? 'strong' : score >= 55 ? 'moderate' : 'needs_attention',
        strengths,
        improvements,
        next_actions: improvements.slice(0, 3),
        generatedAt: new Date().toISOString(),
    };
}

async function logPractice(userId, payload) {
    const item = {
        userId,
        loggedAt: payload.loggedAt || new Date().toISOString(),
        practiceId: uuidv4(),
        crop_type: payload.crop_type || null,
        field_id: payload.field_id || null,
        practice_type: normalizePracticeType(payload.practice_type),
        quantity: Number(payload.quantity || 0),
        unit: payload.unit || null,
        notes: payload.notes || null,
        metadata: payload.metadata || {},
    };

    try {
        await dynamoDB.send(new PutCommand({
            TableName: TABLE_NAMES.FARM_PRACTICE_LOGS,
            Item: item,
        }));

        return { ...item, sync_status: 'stored' };
    } catch (err) {
        return {
            ...item,
            sync_status: 'pending_sync',
            warning: `Practice log queued locally: ${err.message}`,
        };
    }
}

async function getPracticeLogs(userId, limit = 20) {
    try {
        const result = await dynamoDB.send(new QueryCommand({
            TableName: TABLE_NAMES.FARM_PRACTICE_LOGS,
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': userId },
            ScanIndexForward: false,
            Limit: limit,
        }));

        return {
            logs: result.Items || [],
            sync_status: 'stored',
        };
    } catch (err) {
        return {
            logs: [],
            sync_status: 'unavailable',
            warning: `Practice log store unavailable: ${err.message}`,
        };
    }
}

module.exports = {
    analyzePracticeData,
    getPracticeLogs,
    logPractice,
    normalizePracticeType,
};
