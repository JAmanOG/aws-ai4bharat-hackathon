#!/usr/bin/env node
/**
 * Frontend ↔ Backend Contract Integration Test Runner
 * ────────────────────────────────────────────────────
 * Verifies that every API call the RuralAi React Native app makes
 * returns responses matching the shapes / contracts the screens depend on.
 *
 *   BASE_URL=http://localhost:3000 node tests/integration/run.js
 */

'use strict';

const { BASE_URL, GET, POST, setAuth, runAll } = require('./framework');
const fs = require('fs');
const path = require('path');

/* ── Load all test suites ── */
require('./auth-contract');
require('./voice-contract');
require('./market-contract');
require('./supply-chain-contract');
require('./precision-contract');
require('./knowledge-contract');
require('./economic-contract');
require('./screen-data-contract');

/* ══════════════════════════════════════════════ */
/*  Bootstrap & Run                                */
/* ══════════════════════════════════════════════ */

async function main() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  FRONTEND ↔ BACKEND CONTRACT TESTS — RuralAi App');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Target:   ${BASE_URL}`);
  console.log(`  Time:     ${new Date().toISOString()}`);
  console.log(`  Node:     ${process.version}`);
  console.log();

  // Pre-flight check
  console.log(`🔍 Checking server at ${BASE_URL} ...`);
  try {
    const hRes = await GET('/health');
    if (hRes.status !== 200) throw new Error(`Health returned ${hRes.status}`);
    console.log(`   ✅ Server reachable (${hRes.elapsed}ms)`);
  } catch (err) {
    console.error(`   ❌ Cannot reach server: ${err.message}`);
    process.exit(1);
  }

  // Bootstrap: register/login to get JWT (mirrors AuthContext login flow)
  const phone = `9${Date.now().toString().slice(-9)}`;
  const pin = '1234';
  console.log('🔑 Bootstrapping test user (AuthContext flow) …');

  const regRes = await POST('/auth/register', {
    phone, pin, name: 'FE Test User', language: 'hi', state: 'madhya pradesh', district: 'bhopal',
  });
  if (regRes.status === 201 || regRes.status === 200) {
    const { token, user } = regRes.body;
    setAuth(token, user.userId || user.user_id);
    console.log(`   ✅ Registered as ${(user.userId || user.user_id).slice(0, 12)}… (JWT)`);
  } else if (regRes.status === 400 || regRes.status === 409) {
    // Already exists → login
    const loginRes = await POST('/auth/login', { phone, pin });
    if (loginRes.status !== 200) {
      console.error('   ❌ Login failed:', loginRes.body);
      process.exit(1);
    }
    setAuth(loginRes.body.token, loginRes.body.user.userId || loginRes.body.user.user_id);
    console.log(`   ✅ Logged in (JWT)`);
  } else {
    console.error('   ❌ Registration failed:', regRes.body);
    process.exit(1);
  }

  // Run
  const results = await runAll();

  // Report
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  FRONTEND CONTRACT TEST REPORT');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Total:   ${results.total}`);
  console.log(`  Passed:  ${results.passed}  ✅`);
  console.log(`  Failed:  ${results.failed}  ❌`);
  console.log(`  Skipped: ${results.skipped}  ⏭️`);
  const rate = results.total > 0 ? ((results.passed / (results.total - results.skipped)) * 100).toFixed(1) : '0';
  console.log(`  Pass %:  ${rate}%`);
  console.log('────────────────────────────────────────────────────────────');

  console.log('\n  SUITE BREAKDOWN:');
  results.suites.forEach((s) => {
    const icon = s.failed === 0 ? '✅' : '❌';
    const skipNote = s.skipped > 0 ? ` (${s.skipped} skipped)` : '';
    console.log(`  ${icon} ${s.name}: ${s.passed}/${s.total} passed${skipNote}`);
  });

  if (results.failures.length > 0) {
    console.log('\n────────────────────────────────────────────────────────────');
    console.log('  FAILURES:');
    console.log('────────────────────────────────────────────────────────────');
    results.failures.forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.suite}] ${f.test}`);
      console.log(`     ${f.error}`);
    });
  }

  // Write JSON report
  const reportPath = process.env.REPORT_PATH || path.join(__dirname, 'test-report.json');
  const report = {
    summary: {
      base_url: BASE_URL,
      timestamp: new Date().toISOString(),
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      pass_rate: `${rate}%`,
    },
    suites: results.suites,
    failures: results.failures,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report: ${reportPath}`);

  if (results.failed === 0) {
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  🎉 ALL FRONTEND CONTRACT TESTS PASSED');
    console.log('════════════════════════════════════════════════════════════\n');
  } else {
    console.log(`\n  💥 ${results.failed} TEST(S) FAILED\n`);
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
