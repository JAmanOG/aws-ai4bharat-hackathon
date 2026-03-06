/**
 * Auth Contract Tests — mirrors AuthContext.tsx login/register flow
 * and authApi functions used by ProfileScreen, LoginScreen, etc.
 */

'use strict';

const { GET, POST, PUT, DELETE, setAuth, getAuth,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape, assertGte,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  Auth Flow (AuthContext.tsx)                     */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Auth — Register & Login (AuthContext)', () => {
  const phone = `8${Date.now().toString().slice(-9)}`;

  test('POST /auth/register returns { user, token } (AuthContext.register)', async () => {
    const res = await POST('/auth/register', {
      phone, pin: '5678', name: 'Contract Test', language: 'hi',
      state: 'punjab', district: 'amritsar',
    });
    assertStatus(res, [200, 201]);
    assertExists(res.body, 'token', 'register must return token');
    assertExists(res.body, 'user', 'register must return user');
    assertType(res.body.token, 'string', 'token must be string');

    // AuthContext expects these user fields
    const u = res.body.user;
    assert(u.userId || u.user_id, 'user must have userId');
    assert(u.phone !== undefined, 'user must have phone');
  });

  test('POST /auth/login returns { user, token } (AuthContext.login)', async () => {
    const res = await POST('/auth/login', { phone, pin: '5678' });
    assertStatus(res, 200);
    assertExists(res.body, 'token', 'login must return token');
    assertExists(res.body, 'user', 'login must return user');

    const u = res.body.user;
    assert(u.userId || u.user_id, 'user must have userId');
  });

  test('POST /auth/login wrong PIN → 401 (AuthContext error path)', async () => {
    const res = await POST('/auth/login', { phone, pin: '0000' });
    assertStatus(res, 401);
  });

  test('POST /auth/register missing phone → 400', async () => {
    const res = await POST('/auth/register', { pin: '1234' });
    assertStatus(res, 400);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Profile API (authApi — ProfileScreen)          */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Auth — Profile (ProfileScreen)', () => {

  test('GET /auth/profile returns { success, profile } (authApi.getProfile)', async () => {
    const res = await GET('/auth/profile');
    assertStatus(res, 200);
    assertExists(res.body, 'success');
    assertExists(res.body, 'profile');
  });

  test('GET /auth/profile/unified returns unified profile (authApi.getUnifiedProfile)', async () => {
    const res = await GET('/auth/profile/unified');
    assertStatus(res, 200);
    assertExists(res.body, 'success');
    assertExists(res.body, 'profile');
  });

  test('PUT /auth/profile updates fields (authApi.updateProfile)', async () => {
    const res = await PUT('/auth/profile', { name: 'Updated FE User', state: 'rajasthan' });
    assertStatus(res, [200, 204]);
  });
});

/* ═══════════════════════════════════════════════ */
/*  DigiLocker (authApi — LoginScreen/ProfileScreen)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Auth — DigiLocker', () => {

  test('GET /auth/digilocker/authorize returns { authorizationUrl } (authApi.getDigilockerUrl)', async () => {
    const res = await GET('/auth/digilocker/authorize');
    assertStatus(res, 200);
    assertExists(res.body, 'authorizationUrl');
    assertType(res.body.authorizationUrl, 'string');
  });

  test('POST /auth/digilocker/verify with valid Aadhaar (authApi.verifyAadhaar)', async () => {
    const res = await POST('/auth/digilocker/verify', { aadhaarNumber: '123456789012' });
    assertStatus(res, [200, 201]);
    assertExists(res.body, 'success');
    assertExists(res.body, 'verified');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Recommendations & Feedback (authApi)           */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Auth — Recommendations & Feedback', () => {

  test('GET /auth/recommendations returns { success, recommendations[] } (authApi.getRecommendations)', async () => {
    const res = await GET('/auth/recommendations');
    assertStatus(res, 200);
    assertExists(res.body, 'success');
    assertExists(res.body, 'recommendations');
    assertArray(res.body.recommendations);
  });

  test('POST /auth/recommendations/feedback accepts feedback (authApi.submitFeedback)', async () => {
    const res = await POST('/auth/recommendations/feedback', {
      domain: 'agriculture', rating: 4, action: 'followed',
    });
    assertStatus(res, [200, 201]);
  });

  test('GET /auth/engagement returns analytics (authApi.getEngagement)', async () => {
    const res = await GET('/auth/engagement');
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Peers & Groups (authApi)                       */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Auth — Peers & Groups', () => {

  test('GET /auth/peers returns matching peers (authApi.findPeers)', async () => {
    // Ensure learning profile exists first (required by peer matching)
    await POST('/knowledge/learning-profile', {
      interests: ['agriculture', 'finance'],
      preferred_difficulty: 'beginner',
      preferred_language: 'hi',
    });
    const res = await GET('/auth/peers');
    assertStatus(res, 200);
  });

  test('GET /auth/groups returns { success, groups[] } (authApi.getGroups)', async () => {
    const res = await GET('/auth/groups');
    assertStatus(res, 200);
    assertExists(res.body, 'success');
    assertExists(res.body, 'groups');
    assertArray(res.body.groups);
  });
});
