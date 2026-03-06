/**
 * Voice Contract Tests — mirrors voiceApi + voice.ts service
 * Used by: AskScreen, SymptomCheckerScreen, ProfileScreen (memory facts)
 */

'use strict';

const { GET, POST,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  Voice Languages (voiceApi.getLanguages)        */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Voice — Languages (AskScreen)', () => {

  test('GET /voice/languages returns { languages[] } with expected shape', async () => {
    const res = await GET('/voice/languages');
    assertStatus(res, 200);
    assertExists(res.body, 'languages');
    assertArray(res.body.languages, 'languages must be array');

    // VoiceLanguage interface: { code, bcp47, name, tts_available }
    const lang = res.body.languages[0];
    assertShape(lang, ['code', 'bcp47', 'name', 'tts_available'], 'VoiceLanguage');
    assertType(lang.tts_available, 'boolean', 'tts_available must be boolean');
  });

  test('Hindi (hi) is in the language list', async () => {
    const res = await GET('/voice/languages');
    const hi = res.body.languages.find((l) => l.code === 'hi');
    assert(hi, 'Hindi must be in language list');
    assert(hi.tts_available === true, 'Hindi TTS must be available');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Voice Chat (voiceApi.chat → AskScreen)         */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Voice — Chat (AskScreen, SymptomChecker)', () => {

  test('POST /voice/chat returns ChatResult shape', async () => {
    const res = await POST('/voice/chat', {
      text: 'मेरी फसल में पीले पत्ते हैं',
      language_code: 'hi',
      session_id: `fe-contract-${Date.now()}`,
      generate_audio: false,
    });
    assertStatus(res, 200);

    // ChatResult interface from voice.ts
    assertExists(res.body, 'response_text', 'ChatResult needs response_text');
    assertExists(res.body, 'session_id', 'ChatResult needs session_id');
    assertExists(res.body, 'language_code', 'ChatResult needs language_code');
    assertType(res.body.response_text, 'string');
    assert(res.body.response_text.length > 0, 'response_text must not be empty');
  });

  test('POST /voice/chat with generate_audio=true returns audio_base64', async () => {
    const res = await POST('/voice/chat', {
      text: 'hello',
      language_code: 'en',
      generate_audio: true,
    });
    assertStatus(res, 200);
    assertExists(res.body, 'response_text');
    // audio_base64 may be empty string if TTS fails, but key must exist
    assert(res.body.audio_base64 !== undefined, 'audio_base64 key must exist');
  });

  test('POST /voice/chat empty text → 400 (AskScreen guards this)', async () => {
    const res = await POST('/voice/chat', { text: '', language_code: 'hi' });
    assertStatus(res, 400);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Voice Synthesis (voiceApi.synthesize)           */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Voice — Synthesis', () => {

  test('POST /voice/synthesize returns { audio_base64, request_id }', async () => {
    const res = await POST('/voice/synthesize', {
      text: 'नमस्ते किसान भाई',
      language_code: 'hi',
    });
    assertStatus(res, 200);
    assertExists(res.body, 'audio_base64', 'synthesize must return audio_base64');
    assertType(res.body.audio_base64, 'string');
    assert(res.body.audio_base64.length > 100, 'audio_base64 must have content');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Voice Translation (voiceApi.translate)         */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Voice — Translation', () => {

  test('POST /voice/translate returns { translated_text }', async () => {
    const res = await POST('/voice/translate', {
      text: 'मेरे खेत में धान है',
      source_language: 'hi',
      target_language: 'en',
    });
    assertStatus(res, 200);
    assertExists(res.body, 'translated_text');
    assertType(res.body.translated_text, 'string');
    assert(res.body.translated_text.length > 0, 'translated_text must not be empty');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Voice Sessions (voiceApi.getSessions)          */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Voice — Sessions & Memory', () => {

  test('GET /voice/sessions returns session list', async () => {
    const res = await GET('/voice/sessions', { limit: 5 });
    assertStatus(res, 200);
    // Response shape used by useVoiceSessions hook
    assert(res.body.sessions !== undefined || Array.isArray(res.body), 'sessions data expected');
  });

  test('GET /voice/memory/facts returns { facts } (ProfileScreen, EligibilityScreen)', async () => {
    const res = await GET('/voice/memory/facts');
    assertStatus(res, 200);
    assertExists(res.body, 'facts', 'memory facts must return facts object');
  });

  test('GET /voice/pipeline/health returns component status', async () => {
    const res = await GET('/voice/pipeline/health');
    assertStatus(res, 200);
  });

  test('GET /voice/agents returns agent list', async () => {
    const res = await GET('/voice/agents');
    assertStatus(res, 200);
    // AIAgent interface: { name, description, supportedIntents }
    const agents = res.body.agents || res.body;
    assert(Array.isArray(agents), 'agents must be array');
    if (agents.length > 0) {
      assertExists(agents[0], 'name', 'agent needs name');
    }
  });
});
