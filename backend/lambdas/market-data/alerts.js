/**
 * Market Data Lambda – alerts.js
 * Price alert subscriptions and notification dispatch.
 * Satisfies Req 5.6: Push notifications for significant price changes.
 */

const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { PutCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { v4: uuidv4 } = require('uuid');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const PRICE_ALERTS_TOPIC = process.env.PRICE_ALERTS_TOPIC_ARN || '';

/**
 * Subscribe a farmer to price alerts for a crop.
 */
async function subscribePriceAlert(userId, data) {
    const { crop_type, state, threshold_percent = 10, notify_via = 'push' } = data;
    const alertId = uuidv4();
    const now = new Date().toISOString();

    const alert = {
        userId,
        alertId,
        crop_type,
        state: state || 'all',
        threshold_percent,
        notify_via, // push, sms, both
        is_active: true,
        createdAt: now,
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.PRICE_ALERTS,
        Item: alert,
    }));

    return alert;
}

/**
 * Get a user's active price alert subscriptions.
 */
async function getUserAlerts(userId) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.PRICE_ALERTS,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
}

/**
 * Delete a price alert subscription.
 */
async function deleteAlert(userId, alertId) {
    await dynamoDB.send(new DeleteCommand({
        TableName: TABLE_NAMES.PRICE_ALERTS,
        Key: { userId, alertId },
    }));
    return { deleted: true };
}

/**
 * Dispatch price change notifications to subscribed farmers.
 * Called by price change detection (cron or event-driven).
 */
async function dispatchPriceAlerts(priceChanges) {
    if (!priceChanges || priceChanges.length === 0) return { sent: 0 };

    // Get all active alert subscriptions
    const allAlerts = await dynamoDB.send(new ScanCommand({
        TableName: TABLE_NAMES.PRICE_ALERTS,
        FilterExpression: 'is_active = :active',
        ExpressionAttributeValues: { ':active': true },
    }));

    const alerts = allAlerts.Items || [];
    let sentCount = 0;

    for (const change of priceChanges) {
        // Find matching alert subscriptions
        const matchingAlerts = alerts.filter(alert =>
            alert.crop_type === change.crop_type &&
            (alert.state === 'all' || alert.state === change.state) &&
            Math.abs(parseFloat(change.change_percent)) >= alert.threshold_percent
        );

        for (const alert of matchingAlerts) {
            try {
                // Send via SNS
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
}

module.exports = { subscribePriceAlert, getUserAlerts, deleteAlert, dispatchPriceAlerts };
