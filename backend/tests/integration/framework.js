/**
 * ═══════════════════════════════════════════════════════════════════
 *  Integration Test Framework – Rural Ecosystem Platform
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Hits REAL deployed endpoints with REAL data.
 *  No mocks. No stubs. Production-grade verification.
 *
 *  Usage:
 *    BASE_URL=http://localhost:3000 node tests/integration/run.js
 *    BASE_URL=https://api.example.com node tests/integration/run.js
 *
 *  Environment:
 *    BASE_URL         – API base URL (required)
 *    TEST_USER_PHONE  – Phone for auth tests (default: random)
 *    TEST_USER_PIN    – PIN for auth tests  (default: 1234)
 *    VERBOSE          – Show request/response details (default: false)
 */

const http = require('http');
const https = require('https');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const VERBOSE = process.env.VERBOSE === 'true';

/* ─── Result collector ─── */
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    suites: {},
    startTime: null,
    endTime: null,
};

let currentSuite = 'default';

/* ─── Timing ─── */
function startTimer() { results.startTime = Date.now(); }
function stopTimer()  { results.endTime = Date.now(); }

/* ─── HTTP client (zero deps) ─── */
function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        function doRequest(retryCount) {
            const url = new URL(path, BASE_URL);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;

            const opts = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    'Accept': 'application/json',
                    ...headers,
                },
                timeout: 30000,
            };

            if (body && typeof body === 'object') {
                const bodyStr = JSON.stringify(body);
                opts.headers['Content-Type'] = 'application/json';
                opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
                var bodyData = bodyStr;
            }

            const startMs = Date.now();
            const req = lib.request(opts, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    const elapsed = Date.now() - startMs;
                    let parsed;
                    try { parsed = JSON.parse(data); } catch { parsed = data; }

                    // Retry on 429 (rate limit) with exponential backoff
                    if (res.statusCode === 429 && retryCount < 3) {
                        const retryAfter = parsed?.details?.match?.(/(\d+)/)?.[1] || 2;
                        const delay = Math.max(Number(retryAfter) * 1000, 1000 * (retryCount + 1));
                        if (VERBOSE) console.log(`    ⏳ Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
                        setTimeout(() => doRequest(retryCount + 1), delay);
                        return;
                    }

                    if (VERBOSE) {
                        console.log(`    → ${method} ${path} [${res.statusCode}] ${elapsed}ms`);
                        if (typeof parsed === 'object') console.log(`      `, JSON.stringify(parsed).slice(0, 300));
                    }

                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsed,
                        elapsed,
                        raw: data,
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
            if (bodyData) req.write(bodyData);
            else if (body && typeof body === 'object') req.write(JSON.stringify(body));
            req.end();
        }

        doRequest(0);
    });
}

/* ─── Auth helpers ─── */
let authToken = null;
let authUserId = null;

function setAuth(token, userId) {
    authToken = token;
    authUserId = userId;
}

function authHeaders() {
    const h = {};
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    if (authUserId) h['X-User-Id'] = authUserId;
    return h;
}

/* ─── Convenience HTTP methods ─── */
async function GET(path, extraHeaders = {}) {
    return request('GET', path, null, { ...authHeaders(), ...extraHeaders });
}
async function POST(path, body, extraHeaders = {}) {
    return request('POST', path, body, { ...authHeaders(), ...extraHeaders });
}
async function PUT(path, body, extraHeaders = {}) {
    return request('PUT', path, body, { ...authHeaders(), ...extraHeaders });
}
async function DELETE(path, extraHeaders = {}) {
    return request('DELETE', path, null, { ...authHeaders(), ...extraHeaders });
}

/* ─── Suite / Test DSL ─── */
function suite(name) {
    currentSuite = name;
    if (!results.suites[name]) {
        results.suites[name] = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [] };
    }
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║  ${name.padEnd(40)}║`);
    console.log(`╚══════════════════════════════════════════╝`);
}

async function test(name, fn) {
    results.total++;
    results.suites[currentSuite].total++;

    const startMs = Date.now();
    try {
        await fn();
        const elapsed = Date.now() - startMs;
        results.passed++;
        results.suites[currentSuite].passed++;
        results.suites[currentSuite].tests.push({ name, status: 'PASS', elapsed });
        console.log(`  ✅ ${name} (${elapsed}ms)`);
    } catch (err) {
        const elapsed = Date.now() - startMs;
        results.failed++;
        results.suites[currentSuite].failed++;
        const errorMsg = err.message || String(err);
        results.suites[currentSuite].tests.push({ name, status: 'FAIL', elapsed, error: errorMsg });
        results.errors.push({ suite: currentSuite, test: name, error: errorMsg });
        console.log(`  ❌ ${name} (${elapsed}ms)`);
        console.log(`     └─ ${errorMsg}`);
    }
}

function skip(name, reason = '') {
    results.total++;
    results.skipped++;
    results.suites[currentSuite].total++;
    results.suites[currentSuite].skipped++;
    results.suites[currentSuite].tests.push({ name, status: 'SKIP', elapsed: 0 });
    console.log(`  ⏭️  ${name}${reason ? ` (${reason})` : ''}`);
}

/* ─── Assertions ─── */
function assert(condition, msg) {
    if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function assertEqual(actual, expected, label = '') {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertStatus(res, expected) {
    if (res.status !== expected) {
        const bodySnip = typeof res.body === 'object' ? JSON.stringify(res.body).slice(0, 200) : String(res.body).slice(0, 200);
        throw new Error(`Expected HTTP ${expected}, got ${res.status} — ${bodySnip}`);
    }
}

function assertHasKeys(obj, keys, label = '') {
    for (const k of keys) {
        if (obj[k] === undefined) throw new Error(`${label}: missing key "${k}" in ${JSON.stringify(obj).slice(0, 200)}`);
    }
}

function assertType(val, type, label = '') {
    if (typeof val !== type) throw new Error(`${label}: expected type ${type}, got ${typeof val}`);
}

function assertArray(val, label = '') {
    if (!Array.isArray(val)) throw new Error(`${label}: expected array, got ${typeof val}`);
}

function assertGt(val, min, label = '') {
    if (val <= min) throw new Error(`${label}: expected > ${min}, got ${val}`);
}

function assertGte(val, min, label = '') {
    if (val < min) throw new Error(`${label}: expected >= ${min}, got ${val}`);
}

function assertLte(val, max, label = '') {
    if (val > max) throw new Error(`${label}: expected <= ${max}, got ${val}`);
}

function assertContains(str, sub, label = '') {
    if (!String(str).includes(sub)) throw new Error(`${label}: "${String(str).slice(0, 100)}" does not contain "${sub}"`);
}

function assertOneOf(val, options, label = '') {
    if (!options.includes(val)) throw new Error(`${label}: "${val}" not in [${options.join(', ')}]`);
}

function assertResponseTime(res, maxMs, label = '') {
    if (res.elapsed > maxMs) throw new Error(`${label}: response took ${res.elapsed}ms, max ${maxMs}ms`);
}

/* ─── Report generation ─── */
function generateReport() {
    const durationMs = results.endTime - results.startTime;
    const durationSec = (durationMs / 1000).toFixed(1);

    console.log(`\n\n${'═'.repeat(60)}`);
    console.log(`  INTEGRATION TEST REPORT — Rural Ecosystem Platform`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Target:     ${BASE_URL}`);
    console.log(`  Date:       ${new Date().toISOString()}`);
    console.log(`  Duration:   ${durationSec}s`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Total:   ${results.total}`);
    console.log(`  Passed:  ${results.passed}  ✅`);
    console.log(`  Failed:  ${results.failed}  ❌`);
    console.log(`  Skipped: ${results.skipped}  ⏭️`);
    console.log(`  Pass %:  ${results.total > 0 ? ((results.passed / (results.total - results.skipped)) * 100).toFixed(1) : 0}%`);
    console.log(`${'─'.repeat(60)}`);

    // Per-suite breakdown
    console.log(`\n  SUITE BREAKDOWN:`);
    for (const [suiteName, s] of Object.entries(results.suites)) {
        const icon = s.failed === 0 ? '✅' : '❌';
        console.log(`  ${icon} ${suiteName}: ${s.passed}/${s.total} passed${s.skipped ? ` (${s.skipped} skipped)` : ''}`);
    }

    // Failure details
    if (results.errors.length > 0) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`  FAILURES (${results.errors.length}):`);
        console.log(`${'─'.repeat(60)}`);
        results.errors.forEach((e, i) => {
            console.log(`  ${i + 1}. [${e.suite}] ${e.test}`);
            console.log(`     ${e.error}`);
        });
    }

    console.log(`\n${'═'.repeat(60)}`);
    const verdict = results.failed === 0 ? '🎉 ALL TESTS PASSED' : `💥 ${results.failed} TEST(S) FAILED`;
    console.log(`  ${verdict}`);
    console.log(`${'═'.repeat(60)}\n`);

    return results;
}

/* ─── JSON report for CI/CD ─── */
function generateJsonReport() {
    return {
        summary: {
            base_url: BASE_URL,
            timestamp: new Date().toISOString(),
            duration_ms: results.endTime - results.startTime,
            total: results.total,
            passed: results.passed,
            failed: results.failed,
            skipped: results.skipped,
            pass_rate: results.total > 0 ? ((results.passed / (results.total - results.skipped)) * 100).toFixed(1) + '%' : '0%',
        },
        suites: Object.entries(results.suites).map(([name, s]) => ({
            name,
            total: s.total,
            passed: s.passed,
            failed: s.failed,
            skipped: s.skipped,
            tests: s.tests,
        })),
        failures: results.errors,
    };
}

module.exports = {
    BASE_URL,
    request, GET, POST, PUT, DELETE,
    setAuth, authHeaders, authToken: () => authToken, authUserId: () => authUserId,
    suite, test, skip,
    assert, assertEqual, assertStatus, assertHasKeys, assertType,
    assertArray, assertGt, assertGte, assertLte, assertContains, assertOneOf,
    assertResponseTime,
    startTimer, stopTimer, generateReport, generateJsonReport,
    results,
};
