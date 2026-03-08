/**
 * Market Data Lambda – alerts.js
 * Price alert subscriptions and notification dispatch.
 * Satisfies Req 5.6: Push notifications for significant price changes.
 */

const { dynamoDB, query, TABLE_NAMES } = require('../../utils/db');
const { PutCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { v4: uuidv4 } = require('uuid');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const PRICE_ALERTS_TOPIC = process.env.PRICE_ALERTS_TOPIC_ARN || '';

const CREATE_PRICE_ALERTS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS price_alerts (
        user_id TEXT NOT NULL,
        alert_id TEXT NOT NULL,
        crop_type TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'all',
        threshold_percent NUMERIC NOT NULL DEFAULT 10,
        notify_via TEXT NOT NULL DEFAULT 'push',
        target_price NUMERIC,
        direction TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, alert_id)
    );
`;

function toFiniteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAlert(rawAlert) {
    const alertId = String(rawAlert.alertId ?? rawAlert.alert_id ?? rawAlert.id ?? '');
    const userId = String(rawAlert.userId ?? rawAlert.user_id ?? '');
    const createdAtSource = rawAlert.createdAt ?? rawAlert.created_at;
    const createdAt = createdAtSource instanceof Date
        ? createdAtSource.toISOString()
        : String(createdAtSource ?? new Date().toISOString());
    const isActive = rawAlert.active ?? rawAlert.is_active;
    const normalized = {
        userId,
        user_id: userId,
        alertId,
        alert_id: alertId,
        crop_type: String(rawAlert.crop_type ?? rawAlert.cropType ?? ''),
        state: String(rawAlert.state ?? 'all'),
        threshold_percent: toFiniteNumber(rawAlert.threshold_percent ?? rawAlert.thresholdPercent, 10),
        notify_via: String(rawAlert.notify_via ?? rawAlert.notifyVia ?? 'push'),
        is_active: typeof isActive === 'boolean' ? isActive : true,
        active: typeof isActive === 'boolean' ? isActive : true,
        createdAt,
        created_at: createdAt,
    };

    if (rawAlert.target_price != null || rawAlert.targetPrice != null) {
        normalized.target_price = toFiniteNumber(rawAlert.target_price ?? rawAlert.targetPrice, null);
    }

    if (rawAlert.direction) {
        normalized.direction = String(rawAlert.direction);
    }

    return normalized;
}

function toStorageAlert(alert) {
    return {
        userId: alert.userId,
        alertId: alert.alertId,
        crop_type: alert.crop_type,
        state: alert.state,
        threshold_percent: alert.threshold_percent,
        notify_via: alert.notify_via,
        target_price: alert.target_price ?? undefined,
        direction: alert.direction ?? undefined,
        is_active: alert.is_active,
        createdAt: alert.createdAt,
    };
}

function logStorageFallback(operation, error) {
    const reason = error?.message || error?.name || String(error);
    console.warn(`[alerts] ${operation}: DynamoDB unavailable, using PostgreSQL fallback (${reason})`);
}

async function withAlertStoreFallback(operation, dynamoOperation, postgresOperation) {
    try {
        return await dynamoOperation();
    } catch (error) {
        logStorageFallback(operation, error);
        return postgresOperation();
    }
}

async function ensureAlertsTable() {
    await query(CREATE_PRICE_ALERTS_TABLE_SQL);
}

async function insertAlertPostgres(alert) {
    await ensureAlertsTable();
    await query(`
        INSERT INTO price_alerts (
            user_id, alert_id, crop_type, state, threshold_percent,
            notify_via, target_price, direction, is_active, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
        alert.userId,
        alert.alert_id,
        alert.crop_type,
        alert.state,
        alert.threshold_percent,
        alert.notify_via,
        alert.target_price ?? null,
        alert.direction ?? null,
        alert.is_active,
        alert.created_at,
    ]);
    return alert;
}

async function selectUserAlertsPostgres(userId) {
    await ensureAlertsTable();
    const result = await query(`
        SELECT user_id, alert_id, crop_type, state, threshold_percent,
               notify_via, target_price, direction, is_active, created_at
        FROM price_alerts
        WHERE user_id = $1
        ORDER BY created_at DESC
    `, [userId]);
    return result.rows.map(normalizeAlert);
}

async function deleteAlertPostgres(userId, alertId) {
    await ensureAlertsTable();
    await query('DELETE FROM price_alerts WHERE user_id = $1 AND alert_id = $2', [userId, alertId]);
    return { deleted: true };
}

async function scanActiveAlertsPostgres() {
    await ensureAlertsTable();
    const result = await query(`
        SELECT user_id, alert_id, crop_type, state, threshold_percent,
               notify_via, target_price, direction, is_active, created_at
        FROM price_alerts
        WHERE is_active = TRUE
    `);
    return result.rows.map(normalizeAlert);
}

/**
 * Subscribe a farmer to price alerts for a crop.
 */
async function subscribePriceAlert(userId, data) {
    const { crop_type, state, threshold_percent = 10, notify_via = 'push' } = data;
    const alert = normalizeAlert({
        userId,
        alertId: uuidv4(),
        crop_type,
        state: state || 'all',
        threshold_percent,
        notify_via, // push, sms, both
        target_price: data.target_price,
        direction: data.direction,
        is_active: true,
        createdAt: new Date().toISOString(),
    });

    return withAlertStoreFallback(
        'subscribePriceAlert',
        async () => {
            await dynamoDB.send(new PutCommand({
                TableName: TABLE_NAMES.PRICE_ALERTS,
                Item: toStorageAlert(alert),
            }));
            return alert;
        },
        async () => insertAlertPostgres(alert),
    );
}

/**
 * Get a user's active price alert subscriptions.
 */
async function getUserAlerts(userId) {
    try {
        return await withAlertStoreFallback(
            'getUserAlerts',
            async () => {
                const result = await dynamoDB.send(new QueryCommand({
                    TableName: TABLE_NAMES.PRICE_ALERTS,
                    KeyConditionExpression: 'userId = :uid',
                    ExpressionAttributeValues: { ':uid': userId },
                }));
                return (result.Items || []).map(normalizeAlert);
            },
            async () => selectUserAlertsPostgres(userId),
        );
    } catch (error) {
        console.error('[alerts] getUserAlerts failed:', error?.message || error);
        return [];
    }
}

/**
 * Delete a price alert subscription.
 */
async function deleteAlert(userId, alertId) {
    return withAlertStoreFallback(
        'deleteAlert',
        async () => {
            await dynamoDB.send(new DeleteCommand({
                TableName: TABLE_NAMES.PRICE_ALERTS,
                Key: { userId, alertId },
            }));
            return { deleted: true };
        },
        async () => deleteAlertPostgres(userId, alertId),
    );
}

/**
 * Dispatch price change notifications to subscribed farmers.
 * Called by price change detection (cron or event-driven).
 */
async function dispatchPriceAlerts(priceChanges) {
    if (!priceChanges || priceChanges.length === 0) return { sent: 0 };

    try {
        const alerts = await withAlertStoreFallback(
            'dispatchPriceAlerts',
            async () => {
                const allAlerts = await dynamoDB.send(new ScanCommand({
                    TableName: TABLE_NAMES.PRICE_ALERTS,
                    FilterExpression: 'is_active = :active',
                    ExpressionAttributeValues: { ':active': true },
                }));
                return (allAlerts.Items || []).map(normalizeAlert);
            },
            async () => scanActiveAlertsPostgres(),
        );

        let sentCount = 0;

        for (const change of priceChanges) {
            const matchingAlerts = alerts.filter((alert) =>
                alert.crop_type === change.crop_type &&
                (alert.state === 'all' || alert.state === change.state) &&
                Math.abs(parseFloat(change.change_percent)) >= alert.threshold_percent
            );

            for (const alert of matchingAlerts) {
                try {
                    if (PRICE_ALERTS_TOPIC) {
                        await sns.send(new PublishCommand({
                            TopicArn: PRICE_ALERTS_TOPIC,
                            Subject: `Price Alert: ${change.crop_type}`,
                            Message: JSON.stringify({
                                userId: alert.userId,
                                alert_type: 'price_change',
                                crop_type: change.crop_type,
                                mandi: change.mandi_name,
                                state: change.state,
                                change_percent: change.change_percent,
                                direction: change.direction,
                                current_price: change.modal_price,
                                previous_price: change.prev_price,
                                message_hi: `${change.crop_type} की कीमत ${change.mandi_name} में ${Math.abs(change.change_percent)}% ${change.direction === 'up' ? 'बढ़ी' : 'घटी'} है। वर्तमान मूल्य: ₹${change.modal_price}/क्विंटल`,
                                message_en: change.alert_message,
                            }),
                            MessageAttributes: {
                                userId: { DataType: 'String', StringValue: alert.userId },
                                crop_type: { DataType: 'String', StringValue: change.crop_type },
                            },
                        }));
                    }
                    sentCount++;
                } catch (err) {
                    console.error('Alert dispatch error:', err.message);
                }
            }
        }

        return { sent: sentCount, total_changes: priceChanges.length, total_subscriptions: alerts.length };
    } catch (error) {
        console.error('[alerts] dispatchPriceAlerts failed:', error?.message || error);
        return { sent: 0, total_changes: priceChanges.length, total_subscriptions: 0 };
    }
}

module.exports = { subscribePriceAlert, getUserAlerts, deleteAlert, dispatchPriceAlerts };
