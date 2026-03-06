#!/usr/bin/env node
/**
 * Create DynamoDB tables in local DynamoDB-local for integration testing.
 * Schemas match actual service code (composite keys, GSIs).
 *
 * Run: node tests/integration/setup-local-db.js [--recreate]
 */
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const RECREATE = process.argv.includes('--recreate');

const client = new DynamoDBClient({
    region: 'ap-south-1',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

// Table definitions matching services and lambdas actual usage.
// "gsi" entries add GlobalSecondaryIndexes.
const TABLES = [
    /* ── Auth ─────────────────────────────────────────── */
    {
        name: 'Users', pk: 'userId',
        gsi: [{ name: 'ByPhone', pk: 'phone' }],
    },
    /* ── Recommendations / Profile ────────────────────── */
    { name: 'PersonalizedRecommendations', pk: 'userId' },
    { name: 'UserLearningProfile', pk: 'userId' },
    /* ── Knowledge ────────────────────────────────────── */
    { name: 'PeerGroups', pk: 'groupId' },
    { name: 'LearningRecommendations', pk: 'userId', sk: 'generatedAt' },
    { name: 'ContentInteractions', pk: 'userId', sk: 'interactionId' },
    /* ── Agriculture supply chain ─────────────────────── */
    { name: 'FarmerProfiles', pk: 'userId' },
    { name: 'PriceAlerts', pk: 'userId', sk: 'alertId' },
    { name: 'PriceWatch', pk: 'userId' },
    { name: 'FarmPracticeLogs', pk: 'userId', sk: 'loggedAt' },
    /* ── Economic services ────────────────────────────── */
    { name: 'EconomicProfiles', pk: 'userId' },
    { name: 'InsuranceClaims', pk: 'userId', sk: 'claimId' },
    { name: 'FinancialNudges', pk: 'userId', sk: 'generatedAt' },
    /* ── Voice / Memory (services/memory.js uses -dev suffix) ─ */
    {
        name: 'VoiceConversations-dev', pk: 'userId', sk: 'turnId',
        gsi: [{ name: 'SessionIndex', pk: 'sessionId', sk: 'turnId' }],
    },
    { name: 'UserMemoryFacts-dev', pk: 'userId', sk: 'factKey' },
];

async function createTable(t) {
    const attrs = [{ AttributeName: t.pk, AttributeType: 'S' }];
    const keys = [{ AttributeName: t.pk, KeyType: 'HASH' }];
    if (t.sk) {
        attrs.push({ AttributeName: t.sk, AttributeType: 'S' });
        keys.push({ AttributeName: t.sk, KeyType: 'RANGE' });
    }

    const params = {
        TableName: t.name,
        AttributeDefinitions: attrs,
        KeySchema: keys,
        BillingMode: 'PAY_PER_REQUEST',
    };

    if (t.gsi && t.gsi.length) {
        params.GlobalSecondaryIndexes = t.gsi.map(g => {
            // Ensure GSI attrs are in AttributeDefinitions
            if (!attrs.find(a => a.AttributeName === g.pk)) {
                attrs.push({ AttributeName: g.pk, AttributeType: 'S' });
            }
            if (g.sk && !attrs.find(a => a.AttributeName === g.sk)) {
                attrs.push({ AttributeName: g.sk, AttributeType: 'S' });
            }

            const gsiKeySchema = [{ AttributeName: g.pk, KeyType: 'HASH' }];
            if (g.sk) gsiKeySchema.push({ AttributeName: g.sk, KeyType: 'RANGE' });

            return {
                IndexName: g.name,
                KeySchema: gsiKeySchema,
                Projection: { ProjectionType: 'ALL' },
            };
        });
    }

    await client.send(new CreateTableCommand(params));
}

async function main() {
    const { TableNames: existing } = await client.send(new ListTablesCommand({}));
    console.log(`Existing tables: ${existing.join(', ') || '(none)'}`);

    for (const t of TABLES) {
        if (existing.includes(t.name)) {
            if (RECREATE) {
                await client.send(new DeleteTableCommand({ TableName: t.name }));
                console.log(`  🗑️  ${t.name} deleted`);
            } else {
                console.log(`  ⏭️  ${t.name} already exists`);
                continue;
            }
        }

        try {
            await createTable(t);
            const extras = [];
            if (t.sk) extras.push(`sk=${t.sk}`);
            if (t.gsi) extras.push(`gsi=${t.gsi.map(g => g.name).join(',')}`);
            console.log(`  ✅ ${t.name}${extras.length ? ` (${extras.join(', ')})` : ''}`);
        } catch (err) {
            console.log(`  ❌ ${t.name}: ${err.message}`);
        }
    }

    const { TableNames: final } = await client.send(new ListTablesCommand({}));
    console.log(`\nFinal tables (${final.length}): ${final.join(', ')}`);
}

main().catch(console.error);
