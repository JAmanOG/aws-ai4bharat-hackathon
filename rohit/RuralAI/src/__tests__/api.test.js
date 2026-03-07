/**
 * Frontend API Integration Tests
 * Tests the API client modules against real backend services.
 * Run: node api.test.js  (from the RuralAI directory)
 */

const BASE_F2 = 'http://localhost:3002';  // Community, Voice Rooms, Government
const BASE_F1 = 'http://localhost:3001';  // Open Data Export
const BASE_F3 = 'http://localhost:3003';  // Health Services

const MOCK_USER = {
  id: '4edbc9c5-ebc5-421f-8ea5-c75ce0904baa',
  name: 'Rural User',
};

let passed = 0;
let failed = 0;

async function api(method, baseUrl, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': MOCK_USER.id,
    'x-user-name': MOCK_USER.name,
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { }
  return { status: res.status, data, error: !res.ok ? (data?.error || text) : null };
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} — ${err.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ════════════════════════════════════════════════════════════
// CommunityScreen.tsx — Voice Rooms  (data source)
// ════════════════════════════════════════════════════════════

async function testVoiceRoomsForUI() {
  console.log('\n═══ CommunityScreen: Voice Rooms (Spaces) ═══');

  await test('Fetch active rooms for Community Spaces carousel', async () => {
    const res = await api('GET', BASE_F2, '/voice-rooms?status=active');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.rooms, 'Should have rooms array');
    assert(res.data.pagination, 'Should have pagination metadata');
    // UI maps these fields:
    for (const room of res.data.rooms) {
      assert(room.roomId, 'Room must have roomId for Space.id');
      assert(room.title, 'Room must have title for Space.title');
      assert(room.status, 'Room must have status for LIVE/SCHEDULED badge');
    }
  });

  await test('Create a room then verify it appears in active list', async () => {
    const create = await api('POST', BASE_F2, '/voice-rooms', {
      title: 'Water Pump Discussion Frontend Test',
      topics: ['infrastructure'],
    });
    assert(create.status === 201, `Create: expected 201, got ${create.status}`);
    const roomId = create.data.roomId;

    const list = await api('GET', BASE_F2, '/voice-rooms?status=active');
    const found = list.data.rooms.find(r => r.roomId === roomId);
    assert(found, 'Newly created room should appear in active list');
    assert(found.title === 'Water Pump Discussion Frontend Test', 'Title should match');
  });
}

// ════════════════════════════════════════════════════════════
// CommunityScreen.tsx — Posts  (data source)
// ════════════════════════════════════════════════════════════

async function testPostsForUI() {
  console.log('\n═══ CommunityScreen: Forum Posts ═══');

  await test('Fetch posts with pagination for Forum feed', async () => {
    const res = await api('GET', BASE_F2, '/posts?page=1&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.posts !== undefined, 'Should have posts array');
    assert(res.data.pagination, 'Should have pagination');
  });

  await test('Create post and verify it appears in list', async () => {
    const create = await api('POST', BASE_F2, '/posts', {
      title: 'New irrigation method discussion',
      content: 'Anyone tried drip irrigation for sugarcane? Sharing my experience.',
      topic: 'agriculture',
    });
    assert(create.status === 201, `Create: expected 201, got ${create.status}`);
    // UI maps these fields:
    assert(create.data.id, 'Post must have id for Post.id');
    assert(create.data.title, 'Post must have title');

    const list = await api('GET', BASE_F2, '/posts?topic=agriculture');
    assert(list.data.posts.length >= 1, 'Agriculture posts should appear');
  });

  await test('Bookmark a post (toggle functionality)', async () => {
    const list = await api('GET', BASE_F2, '/posts?page=1&limit=1');
    if (list.data.posts.length > 0) {
      const postId = list.data.posts[0].id;
      const res = await api('POST', BASE_F2, `/posts/${postId}/bookmark`);
      assert(res.status === 200, `Bookmark: expected 200, got ${res.status}`);
    }
  });
}

// ════════════════════════════════════════════════════════════
// SchemesListScreen.tsx — Government Schemes (data source)
// ════════════════════════════════════════════════════════════

async function testSchemesForUI() {
  console.log('\n═══ SchemesListScreen: Government Schemes ═══');

  await test('Fetch scheme categories for filter tabs', async () => {
    const res = await api('GET', BASE_F2, '/government/schemes/categories');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Fetch schemes list (all categories)', async () => {
    const res = await api('GET', BASE_F2, '/government/schemes');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.schemes, 'Should have schemes array');
    assert(res.data.schemes.length >= 1, `Expected ≥1 scheme from seed data, got ${res.data.schemes.length}`);
    // UI needs these fields:
    for (const s of res.data.schemes) {
      assert(s.id, 'Scheme must have id');
      assert(s.name, 'Scheme must have name');
    }
  });

  await test('Fetch specific scheme details', async () => {
    const list = await api('GET', BASE_F2, '/government/schemes');
    if (list.data.schemes.length > 0) {
      const id = list.data.schemes[0].id;
      const detail = await api('GET', BASE_F2, `/government/schemes/${id}`);
      assert(detail.status === 200, `Detail: expected 200, got ${detail.status}`);
      assert(detail.data.name, 'Scheme detail should have name');
    }
  });

  await test('Search schemes by keyword', async () => {
    const res = await api('GET', BASE_F2, '/government/schemes?search=PM');
    assert(res.status === 200, `Search: expected 200, got ${res.status}`);
  });
}

// ════════════════════════════════════════════════════════════
// Health Screen — Symptom Checker & Knowledge Base
// ════════════════════════════════════════════════════════════

async function testHealthForUI() {
  console.log('\n═══ Health Screen: Symptom Check & Articles ═══');

  await test('Symptom check returns structured risk assessment', async () => {
    const res = await api('POST', BASE_F3, '/health/symptom-check', {
      symptoms: 'I have headache and mild fever since yesterday',
      age: 30,
      gender: 'female',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    // UI renders these:
    assert(res.data.risk_level, 'Must have risk_level for badge display');
    assert(res.data.possible_conditions, 'Must have possible_conditions for list');
    assert(res.data.recommended_action, 'Must have recommended_action');
    assert(res.data.disclaimer, 'Must have disclaimer text');
  });

  await test('Critical symptom detection (chest pain → emergency)', async () => {
    const res = await api('POST', BASE_F3, '/health/symptom-check', {
      symptoms: 'severe chest pain and shortness of breath',
      age: 60,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.risk_level === 'Critical', `Expected Critical risk, got ${res.data.risk_level}`);
    assert(res.data.urgency === 'emergency', 'Should flag as emergency');
  });

  await test('Generate health article for knowledge base', async () => {
    const res = await api('POST', BASE_F3, '/health/articles/generate', {
      topic: 'nutrition',
      language: 'en',
    });
    assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
    assert(res.data.article, 'Must return article object');
    assert(res.data.article.title, 'Article must have title');
    assert(res.data.article.sections, 'Article must have sections array');
  });

  await test('List health articles for browsing', async () => {
    const res = await api('GET', BASE_F3, '/health/articles');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Fetch health providers with filters', async () => {
    const res = await api('GET', BASE_F3, '/health/providers');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.providers, 'Must have providers array');
    assert(res.data.providers.length >= 1, 'Seed data should have providers');
    // UI uses these:
    for (const p of res.data.providers) {
      assert(p.id, 'Provider must have id');
      assert(p.name, 'Provider must have name');
    }
  });

  await test('Fetch govt health portals', async () => {
    const res = await api('GET', BASE_F3, '/health/govt-portals');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.portals, 'Must have portals');
    assert(res.data.portals.length >= 1, 'Seed data should have health portals');
  });
}

// ════════════════════════════════════════════════════════════
// Government Portals Screen
// ════════════════════════════════════════════════════════════

async function testGovernmentPortals() {
  console.log('\n═══ Government Portals Screen ═══');

  await test('Fetch all portals for list view', async () => {
    const res = await api('GET', BASE_F2, '/government/portals');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.portals, 'Must have portals');
    assert(res.data.portals.length >= 1, `Expected ≥1 portal, got ${res.data.portals.length}`);
  });

  await test('Filter portals by category', async () => {
    const res = await api('GET', BASE_F2, '/government/portals?category=water');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Search portals', async () => {
    const res = await api('GET', BASE_F2, '/government/portals?search=PMGSY');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('File a complaint', async () => {
    const res = await api('POST', BASE_F2, '/government/complaints', {
      portalName: 'CPGRAMS',
      referenceNo: 'FRONTEND-TEST-001',
      description: 'Road repair pending since 3 months - test from frontend',
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  await test('List complaints for user', async () => {
    const res = await api('GET', BASE_F2, '/government/complaints');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ════════════════════════════════════════════════════════════
// Edge Cases & Error Handling
// ════════════════════════════════════════════════════════════

async function testEdgeCases() {
  console.log('\n═══ Edge Cases & Error Handling ═══');

  await test('POST /posts without title → 400', async () => {
    const res = await api('POST', BASE_F2, '/posts', { content: 'no title' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('POST /voice-rooms short title → 400', async () => {
    const res = await api('POST', BASE_F2, '/voice-rooms', { title: 'A' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('POST /health/symptom-check short input → 400', async () => {
    const res = await api('POST', BASE_F3, '/health/symptom-check', { symptoms: 'hi' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('GET /unknown-route → 404', async () => {
    const res = await api('GET', BASE_F2, '/nonexistent-endpoint');
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await test('Medical imaging upload & analyze round-trip', async () => {
    const upload = await api('POST', BASE_F3, '/health/imaging/upload', {
      imagingType: 'xray',
      description: 'Frontend test upload',
    });
    assert(upload.status === 201, `Upload: expected 201, got ${upload.status}`);
    const docId = upload.data.documentId || upload.data.docId;
    assert(docId, 'Should return document ID');

    const status = await api('GET', BASE_F3, `/health/imaging/${docId}`);
    assert(status.status === 200, `Status: expected 200, got ${status.status}`);

    const analyze = await api('POST', BASE_F3, `/health/imaging/${docId}/analyze`, {
      imagingType: 'xray',
    });
    assert(analyze.status === 200, `Analyze: expected 200, got ${analyze.status}`);
  });
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Frontend API Integration Tests              ║');
  console.log('║  Tests API endpoints used by UI screens      ║');
  console.log('╚══════════════════════════════════════════════╝');

  await testVoiceRoomsForUI();
  await testPostsForUI();
  await testSchemesForUI();
  await testHealthForUI();
  await testGovernmentPortals();
  await testEdgeCases();

  console.log('\n══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('══════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
