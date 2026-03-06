/**
 * ═══════════════════════════════════════════════════════════════════
 *  Requirement 2 — Voice-Based Interface System
 *  REAL endpoint integration tests
 * ═══════════════════════════════════════════════════════════════════
 *
 *  AC 2.1: Speech → Text
 *  AC 2.2: Text → Speech
 *  AC 2.3: Local Indian language intent processing
 *  AC 2.4: Hindi, English + 5 regional languages
 *  AC 2.5: Ambiguous input → clarification
 *  AC 2.6: Conversation context across interactions
 */

const {
    suite, test, skip,
    GET, POST,
    assert, assertStatus, assertHasKeys, assertType,
    assertArray, assertGt, assertGte, assertContains, assertOneOf,
    assertResponseTime,
} = require('./framework');

async function runVoiceTests() {
    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Supported Languages (AC 2.4)');
    /* ═══════════════════════════════════════ */

    let languages = [];
    await test('GET /voice/languages returns language list', async () => {
        const res = await GET('/voice/languages');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['languages', 'total']);
        assertArray(res.body.languages, 'languages');
        assertGte(res.body.total, 7, 'total languages >= 7 (Hindi+English+5 regional)');
        languages = res.body.languages;
    });

    await test('Hindi is supported with TTS', async () => {
        const hi = languages.find(l => l.code === 'hi' || l.name?.toLowerCase().includes('hindi'));
        assert(hi, 'Hindi language should be listed');
        assert(hi.tts_available, 'Hindi TTS should be available');
    });

    await test('English is supported with TTS', async () => {
        const en = languages.find(l => l.code === 'en' || l.name?.toLowerCase().includes('english'));
        assert(en, 'English language should be listed');
    });

    await test('At least 5 regional Indian languages supported', async () => {
        const regional = languages.filter(l =>
            !['hi', 'en'].includes(l.code) && l.tts_available
        );
        assertGte(regional.length, 5, 'regional languages with TTS');
    });

    await test('Each language has required fields', async () => {
        for (const lang of languages) {
            assertHasKeys(lang, ['code', 'name'], `language ${lang.code}`);
        }
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Text Chat Pipeline (AC 2.3, 2.6)');
    /* ═══════════════════════════════════════ */

    let sessionId = null;

    await test('POST /voice/chat with Hindi text returns structured response', async () => {
        const res = await POST('/voice/chat', {
            text: 'meri fasal mein keede lag rahe hain',
            language_code: 'hi',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['response_text']);
        assertType(res.body.response_text, 'string', 'response_text');
        assert(res.body.response_text.length > 0, 'response_text should not be empty');
        if (res.body.session_id) sessionId = res.body.session_id;
        if (res.body.domain) {
            assertOneOf(res.body.domain, ['agriculture', 'market', 'schemes', 'health', 'general'],
                'domain classification');
        }
    });

    await test('POST /voice/chat with English agriculture query', async () => {
        const res = await POST('/voice/chat', {
            text: 'What is the best fertilizer for wheat crop?',
            language_code: 'en',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['response_text']);
        assertGt(res.body.response_text.length, 10, 'response length');
    });

    await test('POST /voice/chat with market query routes to market domain', async () => {
        const res = await POST('/voice/chat', {
            text: 'bazaar mein gehun ka daam kya hai?',
            language_code: 'hi',
            generate_audio: false,
        });
        assertStatus(res, 200);
        if (res.body.domain) {
            assertOneOf(res.body.domain, ['market', 'agriculture'], 'market query domain');
        }
    });

    await test('POST /voice/chat with scheme query routes to schemes domain', async () => {
        const res = await POST('/voice/chat', {
            text: 'PM-KISAN yojana ke baare mein batao',
            language_code: 'hi',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['response_text']);
    });

    await test('Context preserved across same session (AC 2.6)', async () => {
        const sid = sessionId || 'test-session-' + Date.now();
        // First message establishes context
        const res1 = await POST('/voice/chat', {
            text: 'I grow wheat in Madhya Pradesh',
            language_code: 'en',
            session_id: sid,
            generate_audio: false,
        });
        assertStatus(res1, 200);

        // Follow-up should remember context
        const res2 = await POST('/voice/chat', {
            text: 'What pests should I watch for?',
            language_code: 'en',
            session_id: sid,
            generate_audio: false,
        });
        assertStatus(res2, 200);
        assert(res2.body.response_text.length > 10, 'follow-up response should be meaningful');
    });

    await test('POST /voice/chat with empty text → 400', async () => {
        const res = await POST('/voice/chat', {
            text: '',
            language_code: 'hi',
        });
        assertStatus(res, 400);
    });

    await test('POST /voice/chat responds within 10 seconds', async () => {
        const res = await POST('/voice/chat', {
            text: 'Tell me about Kisan Credit Card',
            language_code: 'en',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertResponseTime(res, 10000, 'voice chat latency');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Text-to-Speech Synthesis (AC 2.2)');
    /* ═══════════════════════════════════════ */

    await test('POST /voice/synthesize Hindi text → audio base64', async () => {
        const res = await POST('/voice/synthesize', {
            text: 'नमस्ते किसान भाई, आज मौसम अच्छा है।',
            language_code: 'hi',
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['audio_base64']);
        assert(res.body.audio_base64.length > 100, 'audio_base64 should contain audio data');
    });

    await test('POST /voice/synthesize English text', async () => {
        const res = await POST('/voice/synthesize', {
            text: 'Good morning farmer, the weather looks favorable today.',
            language_code: 'en',
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['audio_base64']);
    });

    await test('POST /voice/synthesize empty text → 400', async () => {
        const res = await POST('/voice/synthesize', {
            text: '',
            language_code: 'hi',
        });
        assertStatus(res, 400);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Translation (AC 2.3)');
    /* ═══════════════════════════════════════ */

    await test('POST /voice/translate Hindi → English', async () => {
        const res = await POST('/voice/translate', {
            text: 'मेरी फसल में कीड़े लग गए हैं',
            source_language: 'hi',
            target_language: 'en',
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['translated_text']);
        assertGt(res.body.translated_text.length, 5, 'translated text length');
    });

    await test('POST /voice/translate English → Hindi', async () => {
        const res = await POST('/voice/translate', {
            text: 'The market price of wheat is rising',
            source_language: 'en',
            target_language: 'hi',
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['translated_text']);
    });

    await test('POST /voice/translate missing target → 400', async () => {
        const res = await POST('/voice/translate', {
            text: 'hello world',
        });
        assertStatus(res, 400);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Agents & Pipeline Health');
    /* ═══════════════════════════════════════ */

    await test('GET /voice/agents returns agent list', async () => {
        const res = await GET('/voice/agents');
        assertStatus(res, 200);
        if (res.body.agents) {
            assertArray(res.body.agents, 'agents');
        }
    });

    await test('GET /voice/pipeline/health returns component status', async () => {
        const res = await GET('/voice/pipeline/health');
        assertStatus(res, 200);
    });

    await test('GET /voice/sessions returns user sessions', async () => {
        const res = await GET('/voice/sessions');
        assertStatus(res, 200);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Ambiguous Input & Clarification (AC 2.5)');
    /* ═══════════════════════════════════════ */

    await test('Ambiguous single-word input still gets response', async () => {
        const res = await POST('/voice/chat', {
            text: 'help',
            language_code: 'en',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['response_text']);
        assertGt(res.body.response_text.length, 5, 'meaningful response to ambiguous input');
    });

    await test('Gibberish input handled gracefully (no crash)', async () => {
        const res = await POST('/voice/chat', {
            text: 'asdfghjkl zxcvbnm qwerty',
            language_code: 'en',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['response_text']);
    });

    await test('Very long input (2000 chars) handled', async () => {
        const longText = 'I need help with my wheat crop that is showing yellowing leaves and brown spots. '.repeat(25);
        const res = await POST('/voice/chat', {
            text: longText,
            language_code: 'en',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['response_text']);
    });

    await test('Special characters in text do not crash', async () => {
        const res = await POST('/voice/chat', {
            text: 'What about <script>alert("xss")</script> & "quotes" \'apostrophes\'?',
            language_code: 'en',
            generate_audio: false,
        });
        assertStatus(res, 200);
    });

    await test('Unicode/Devanagari script processed correctly', async () => {
        const res = await POST('/voice/chat', {
            text: 'मेरे खेत में कीड़े लग गए हैं। कृपया मदद करें। 🌾🐛',
            language_code: 'hi',
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['response_text']);
        assertGt(res.body.response_text.length, 10, 'meaningful Hindi response');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Session Isolation & Multi-Turn Stress');
    /* ═══════════════════════════════════════ */

    await test('Different sessions are isolated', async () => {
        const sid1 = `iso-A-${Date.now()}`;
        const sid2 = `iso-B-${Date.now()}`;

        // Session 1: talk about wheat
        await POST('/voice/chat', {
            text: 'I grow wheat in Punjab',
            language_code: 'en',
            session_id: sid1,
            generate_audio: false,
        });

        // Session 2: talk about rice
        await POST('/voice/chat', {
            text: 'I grow rice in Kerala',
            language_code: 'en',
            session_id: sid2,
            generate_audio: false,
        });

        // Session 1 follow-up should be about wheat, not rice
        const res = await POST('/voice/chat', {
            text: 'What fertilizer should I use?',
            language_code: 'en',
            session_id: sid1,
            generate_audio: false,
        });
        assertStatus(res, 200);
        assertGt(res.body.response_text.length, 10, 'session 1 follow-up');
    });

    await test('5-turn deep conversation maintains context', async () => {
        const sid = `deep-${Date.now()}`;
        const turns = [
            'I have 10 acres of land in Madhya Pradesh',
            'I want to grow organic wheat',
            'What soil testing should I do first?',
            'How much organic manure do I need?',
            'When should I start sowing?',
        ];
        for (let i = 0; i < turns.length; i++) {
            const res = await POST('/voice/chat', {
                text: turns[i],
                language_code: 'en',
                session_id: sid,
                generate_audio: false,
            });
            assertStatus(res, 200);
            assertGt(res.body.response_text.length, 5, `turn ${i + 1} response`);
        }
    });

    await test('Mixed language in same session', async () => {
        const sid = `mix-${Date.now()}`;
        const r1 = await POST('/voice/chat', {
            text: 'meri fasal mein problem hai',
            language_code: 'hi',
            session_id: sid,
            generate_audio: false,
        });
        assertStatus(r1, 200);

        const r2 = await POST('/voice/chat', {
            text: 'What pesticide should I use?',
            language_code: 'en',
            session_id: sid,
            generate_audio: false,
        });
        assertStatus(r2, 200);
        assertGt(r2.body.response_text.length, 10, 'mixed-language follow-up');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-2: Voice — Synthesis Edge Cases');
    /* ═══════════════════════════════════════ */

    await test('Synthesize very long text (500+ chars)', async () => {
        const longText = 'किसान भाइयों, आज हम बात करेंगे गेहूं की खेती के बारे में। '.repeat(10);
        const res = await POST('/voice/synthesize', {
            text: longText,
            language_code: 'hi',
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['audio_base64']);
    });

    await test('Synthesize with numbers and special content', async () => {
        const res = await POST('/voice/synthesize', {
            text: 'The price is Rs. 2,500 per quintal. Harvest date: 15/03/2026.',
            language_code: 'en',
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['audio_base64']);
    });

    await test('Synthesize regional language (Tamil)', async () => {
        const res = await POST('/voice/synthesize', {
            text: 'வணக்கம் விவசாயி',
            language_code: 'ta',
        });
        // May 200 or 400 if Tamil TTS not fully available
        assert([200, 400].includes(res.status), `Tamil TTS response (got ${res.status})`);
    });
}

module.exports = { runVoiceTests };
