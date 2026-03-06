#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 *  Integration Test Runner — Rural Ecosystem Platform
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Runs ALL real endpoint integration tests and produces a full
 *  report (console + JSON artifact for CI/CD).
 *
 *  Usage:
 *    BASE_URL=http://localhost:3000  node tests/integration/run.js
 *    BASE_URL=https://api.prod.com   node tests/integration/run.js
 *
 *  Environment variables:
 *    BASE_URL          – API base URL (default: http://localhost:3000)
 *    TEST_SUITES       – Comma-separated list of suites to run (default: all)
 *                        Example: TEST_SUITES=req2,req8
 *    TEST_USER_PHONE   – Phone for auth (default: random)
 *    TEST_USER_PIN     – PIN for auth (default: 1234)
 *    VERBOSE           – Show request/response details (set to "true")
 *    REPORT_PATH       – Path for JSON report (default: test-report.json)
 *
 *  Exit codes:
 *    0 – All tests passed
 *    1 – One or more tests failed
 */

const fs = require('fs');
const path = require('path');
const {
    BASE_URL,
    startTimer, stopTimer,
    generateReport, generateJsonReport,
    results,
    setAuth,
    POST,
} = require('./framework');

/* ─── Import test suites ─── */
const { runVoiceTests }               = require('./req2-voice');
const { runSupplyChainTests }         = require('./req5-supply-chain');
const { runPrecisionAgriTests }       = require('./req6-precision-agriculture');
const { runKnowledgeTests }           = require('./req7-knowledge');
const { runEconomicTests }            = require('./req8-economic');
const { runAiProcessingTests }        = require('./req13-ai-processing');

/* ─── Suite registry ─── */
const SUITES = {
    req2:  { name: 'Voice Interface (Req 2)',              fn: runVoiceTests },
    req5:  { name: 'Supply Chain (Req 5)',                 fn: runSupplyChainTests },
    req6:  { name: 'Precision Agriculture (Req 6)',        fn: runPrecisionAgriTests },
    req7:  { name: 'Knowledge Sharing (Req 7)',            fn: runKnowledgeTests },
    req8:  { name: 'Economic Services (Req 8)',            fn: runEconomicTests },
    req13: { name: 'AI Processing & Context (Req 13)',     fn: runAiProcessingTests },
};

/* ─── Determine which suites to run ─── */
function getSelectedSuites() {
    const envSuites = process.env.TEST_SUITES;
    if (!envSuites) return Object.keys(SUITES);

    return envSuites.split(',').map(s => s.trim().toLowerCase()).filter(s => SUITES[s]);
}

/* ─── Pre-flight: connectivity check ─── */
async function preflightCheck() {
    console.log(`\n🔍 Pre-flight: checking connectivity to ${BASE_URL} ...`);
    try {
        const res = await require('./framework').GET('/voice/pipeline/health');
        if (res.status >= 200 && res.status < 500) {
            console.log(`   ✅ Server reachable (${res.status}) — ${res.elapsed}ms`);
            return true;
        }
        console.error(`   ❌ Server returned ${res.status}`);
        return false;
    } catch (err) {
        console.error(`   ❌ Cannot reach ${BASE_URL}: ${err.message}`);
        return false;
    }
}

/* ─── Bootstrap test user (demo mode auth via X-User-Id) ─── */
async function bootstrapAuth() {
    console.log('🔑 Bootstrapping test user …');

    // Try to register a fresh test user
    const phone = process.env.TEST_USER_PHONE || `9${Date.now().toString().slice(-9)}`;
    const pin   = process.env.TEST_USER_PIN   || '1234';

    try {
        const res = await POST('/auth/register', {
            phone,
            pin,
            name: 'Integration Runner',
            language: 'hi',
            state: 'Madhya Pradesh',
            district: 'Sehore',
        });

        if (res.body?.token) {
            const userId = res.body.user?.userId || res.body.user?.id || 'integration-test-user';
            setAuth(res.body.token, userId);
            console.log(`   ✅ Authenticated as ${userId.slice(0, 12)}… (JWT)`);
            return;
        }
    } catch { /* silent */ }

    // Try login if register failed (user already exists)
    try {
        const res = await POST('/auth/login', { phone, pin });
        if (res.body?.token) {
            const userId = res.body.user?.userId || res.body.user?.id || 'integration-test-user';
            setAuth(res.body.token, userId);
            console.log(`   ✅ Logged in as ${userId.slice(0, 12)}… (JWT)`);
            return;
        }
    } catch { /* silent */ }

    // Fallback: demo mode (X-User-Id header, no JWT)
    setAuth(null, 'integration-test-user');
    console.log('   ⚠️  Using demo mode auth (X-User-Id header)');
}

/* ─── Main ─── */
async function main() {
    console.log('═'.repeat(60));
    console.log('  INTEGRATION TEST RUNNER — Rural Ecosystem Platform');
    console.log('═'.repeat(60));
    console.log(`  Target:   ${BASE_URL}`);
    console.log(`  Time:     ${new Date().toISOString()}`);
    console.log(`  Node:     ${process.version}`);

    // Pre-flight
    const reachable = await preflightCheck();
    if (!reachable) {
        console.error('\n❌ Server not reachable. Aborting.\n');
        process.exit(2);
    }

    // Auth bootstrap
    await bootstrapAuth();

    // Run selected suites
    const selected = getSelectedSuites();
    console.log(`\n📋 Running ${selected.length} suite(s): ${selected.join(', ')}\n`);
    console.log('─'.repeat(60));

    startTimer();

    for (const key of selected) {
        const { name, fn } = SUITES[key];
        console.log(`\n▶ Starting suite: ${name}`);
        try {
            await fn();
        } catch (err) {
            console.error(`\n💥 Suite ${name} threw unhandled error: ${err.message}`);
            results.errors.push({
                suite: name,
                test: '(suite-level crash)',
                error: err.message,
            });
        }
    }

    stopTimer();

    // Generate reports
    const report = generateReport();
    const jsonReport = generateJsonReport();

    // Write JSON report
    const reportPath = process.env.REPORT_PATH || path.join(__dirname, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
    console.log(`\n📄 JSON report written to: ${reportPath}`);

    // Exit code
    const exitCode = report.failed > 0 ? 1 : 0;
    console.log(`\n🏁 Exit code: ${exitCode}\n`);
    process.exit(exitCode);
}

main().catch(err => {
    console.error('Fatal runner error:', err);
    process.exit(2);
});
