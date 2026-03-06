/**
 * Frontend-Backend Contract Integration Test Framework
 * ────────────────────────────────────────────────────
 * Zero-dependency Node.js HTTP client that mirrors the exact behavior of
 * RuralAi/src/services/api.ts — same endpoints, same auth headers, same
 * request shapes — to verify the frontend-backend contract.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node tests/integration/run.js
 */

'use strict';

const http = require('http');
const https = require('https');

/* ══════════════════════════════════════════════ */
/*  Configuration                                  */
/* ══════════════════════════════════════════════ */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const parsed = new URL(BASE_URL);
const IS_HTTPS = parsed.protocol === 'https:';
const HOST = parsed.hostname;
const PORT = parsed.port || (IS_HTTPS ? 443 : 80);

/* ══════════════════════════════════════════════ */
/*  Auth state (mirrors api.ts _authToken)         */
/* ══════════════════════════════════════════════ */

let _authToken = null;
let _userId = 'demo-user';

function setAuth(token, userId) {
  _authToken = token;
  _userId = userId || _userId;
}

function getAuth() {
  return { token: _authToken, userId: _userId };
}

/* ══════════════════════════════════════════════ */
/*  HTTP client — mirrors api.ts request()         */
/* ══════════════════════════════════════════════ */

function request(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    let fullPath = path;
    if (body && method === 'GET') {
      const qs = Object.entries(body)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (qs) fullPath += `?${qs}`;
      body = null;
    }

    const payload = body ? JSON.stringify(body) : null;

    const headers = {
      ...(_authToken
        ? { Authorization: `Bearer ${_authToken}` }
        : { 'X-User-Id': _userId }),
      ...extraHeaders,
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const opts = { hostname: HOST, port: PORT, path: fullPath, method, headers };
    const transport = IS_HTTPS ? https : http;
    const start = Date.now();

    const req = transport.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const elapsed = Date.now() - start;
        let json;
        try { json = data ? JSON.parse(data) : {}; } catch { json = { raw: data }; }
        resolve({ status: res.statusCode, body: json, elapsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

const GET = (p, params) => request('GET', p, params);
const POST = (p, body) => request('POST', p, body);
const PUT = (p, body) => request('PUT', p, body);
const DELETE = (p) => request('DELETE', p);

/* ══════════════════════════════════════════════ */
/*  Assertion helpers                              */
/* ══════════════════════════════════════════════ */

function assert(cond, msg) { if (!cond) throw new Error(`Assertion failed: ${msg}`); }
function assertStatus(res, expected) {
  const codes = Array.isArray(expected) ? expected : [expected];
  assert(codes.includes(res.status), `expected status ${codes.join('|')}, got ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
}
function assertExists(obj, key, msg) { assert(obj && obj[key] !== undefined, msg || `missing key "${key}"`); }
function assertType(val, type, msg) { assert(typeof val === type, msg || `expected ${type}, got ${typeof val}`); }
function assertArray(val, msg) { assert(Array.isArray(val), msg || `expected array, got ${typeof val}`); }
function assertShape(obj, keys, label) {
  keys.forEach((k) => {
    assert(obj[k] !== undefined, `${label || 'object'} missing key "${k}" (keys: ${Object.keys(obj).join(',')})`);
  });
}
function assertGte(a, b, msg) { assert(a >= b, `${msg}: expected >= ${b}, got ${a}`); }

/* ══════════════════════════════════════════════ */
/*  Test runner DSL                                */
/* ══════════════════════════════════════════════ */

const _suites = [];
let _currentSuite = null;

function suite(name, fn) { _suites.push({ name, fn }); }

function test(name, fn) {
  if (!_currentSuite) throw new Error('test() must be inside a suite');
  _currentSuite.tests.push({ name, fn });
}

function skip(reason) { throw { __skip: true, reason }; }

async function runAll() {
  const results = { suites: [], total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

  for (const s of _suites) {
    _currentSuite = { name: s.name, tests: [] };
    s.fn(); // registers tests
    const suiteResult = { name: s.name, total: 0, passed: 0, failed: 0, skipped: 0, tests: [] };

    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║  ${s.name.padEnd(40)}║`);
    console.log(`╚══════════════════════════════════════════╝`);

    for (const t of _currentSuite.tests) {
      suiteResult.total++;
      results.total++;
      const start = Date.now();
      try {
        await t.fn();
        const elapsed = Date.now() - start;
        console.log(`  ✅ ${t.name} (${elapsed}ms)`);
        suiteResult.passed++;
        results.passed++;
        suiteResult.tests.push({ name: t.name, status: 'PASS', elapsed });
      } catch (err) {
        const elapsed = Date.now() - start;
        if (err && err.__skip) {
          console.log(`  ⏭️  ${t.name} — ${err.reason}`);
          suiteResult.skipped++;
          results.skipped++;
          suiteResult.tests.push({ name: t.name, status: 'SKIP', elapsed, reason: err.reason });
        } else {
          const msg = err.message || String(err);
          console.log(`  ❌ ${t.name} (${elapsed}ms)`);
          console.log(`     └─ ${msg}`);
          suiteResult.failed++;
          results.failed++;
          results.failures.push({ suite: s.name, test: t.name, error: msg });
          suiteResult.tests.push({ name: t.name, status: 'FAIL', elapsed, error: msg });
        }
      }
    }

    results.suites.push(suiteResult);
  }

  _currentSuite = null;
  return results;
}

/* ══════════════════════════════════════════════ */
/*  Exports                                        */
/* ══════════════════════════════════════════════ */

module.exports = {
  BASE_URL, GET, POST, PUT, DELETE,
  setAuth, getAuth,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape, assertGte,
  suite, test, skip, runAll,
};
