/**
 * Economic Services – farmer economic profile storage.
 */

const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');

async function getEconomicProfile(userId) {
    try {
        const result = await dynamoDB.send(new GetCommand({
            TableName: TABLE_NAMES.ECONOMIC_PROFILES,
            Key: { userId },
        }));

        return result.Item || null;
    } catch (err) {
        return null;
    }
}

async function upsertEconomicProfile(userId, payload) {
    const now = new Date().toISOString();
    const existing = await getEconomicProfile(userId);

    const profile = {
        userId,
        full_name: payload.full_name || existing?.full_name || null,
        state: payload.state || existing?.state || null,
        district: payload.district || existing?.district || null,
        primary_language: payload.primary_language || existing?.primary_language || 'hi',
        land_size_acres: Number(payload.land_size_acres ?? existing?.land_size_acres ?? 0),
        crop_types: Array.isArray(payload.crop_types) ? payload.crop_types : (existing?.crop_types || []),
        annual_income_inr: Number(payload.annual_income_inr ?? existing?.annual_income_inr ?? 0),
        expected_harvest_income_inr: Number(
            payload.expected_harvest_income_inr ?? existing?.expected_harvest_income_inr ?? 0
        ),
        seasonal_expenses: Array.isArray(payload.seasonal_expenses)
            ? payload.seasonal_expenses
            : (existing?.seasonal_expenses || []),
        harvest_months: Array.isArray(payload.harvest_months)
            ? payload.harvest_months
            : (existing?.harvest_months || []),
        has_bank_account: payload.has_bank_account ?? existing?.has_bank_account ?? false,
        has_kcc: payload.has_kcc ?? existing?.has_kcc ?? false,
        digilocker_verified: payload.digilocker_verified ?? existing?.digilocker_verified ?? false,
        insurance_provider: payload.insurance_provider || existing?.insurance_provider || null,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.ECONOMIC_PROFILES,
        Item: profile,
    }));

    return profile;
}

module.exports = {
    getEconomicProfile,
    upsertEconomicProfile,
};
