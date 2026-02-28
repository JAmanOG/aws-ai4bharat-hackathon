/**
 * Economic Services – insurance claim facilitation.
 * Req 8.4: Help facilitate insurance claims for crops and farmlands.
 */

const { QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');

function assessDamageEvidence(payload) {
    const symptoms = [
        ...(Array.isArray(payload.damage_signals) ? payload.damage_signals : []),
        payload.notes || '',
    ].join(' | ').toLowerCase();

    let probableCause = 'general crop damage';
    let severity = 'medium';
    let claimReadiness = 60;

    if (symptoms.includes('flood') || symptoms.includes('waterlogging')) {
        probableCause = 'flood or waterlogging damage';
        severity = 'high';
        claimReadiness = 82;
    } else if (symptoms.includes('hail') || symptoms.includes('storm')) {
        probableCause = 'hail or storm damage';
        severity = 'high';
        claimReadiness = 80;
    } else if (symptoms.includes('drought') || symptoms.includes('dry spell')) {
        probableCause = 'drought-related stress';
        severity = 'medium';
        claimReadiness = 74;
    } else if (symptoms.includes('pest') || symptoms.includes('disease')) {
        probableCause = 'pest or disease-related loss';
        severity = 'medium';
        claimReadiness = 68;
    }

    return {
        probable_cause: probableCause,
        severity,
        claim_readiness_score: claimReadiness,
        next_documents: [
            'Aadhaar or farmer identity document',
            'Land or crop record',
            'Photo evidence with date and location',
            'Bank account details for settlement',
        ],
    };
}

async function createInsuranceClaim(userId, payload) {
    const claimId = uuidv4();
    const damageAssessment = assessDamageEvidence(payload);
    const now = new Date().toISOString();

    const claim = {
        userId,
        claimId,
        scheme_id: payload.scheme_id || 'pmfby',
        crop_type: payload.crop_type || null,
        loss_date: payload.loss_date || null,
        area_affected_acres: Number(payload.area_affected_acres || 0),
        location: payload.location || {},
        damage_signals: Array.isArray(payload.damage_signals) ? payload.damage_signals : [],
        notes: payload.notes || null,
        digilocker_consent: !!payload.digilocker_consent,
        status: payload.digilocker_consent ? 'draft_ready' : 'awaiting_consent',
        damage_assessment: damageAssessment,
        createdAt: now,
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.INSURANCE_CLAIMS,
        Item: claim,
    }));

    return claim;
}

async function listInsuranceClaims(userId, limit = 20) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.INSURANCE_CLAIMS,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: limit,
    }));

    return {
        claims: result.Items || [],
    };
}

module.exports = {
    assessDamageEvidence,
    createInsuranceClaim,
    listInsuranceClaims,
};
