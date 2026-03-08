/**
 * Unit tests for Voice – orchestrator.js
 * Tests the AI orchestrator that coordinates the full voice pipeline.
 */

/* ---------- Mock all dependent services ---------- */
jest.mock('../../services/transcribe', () => ({
  transcribe: jest.fn(async () => ({
    transcript: 'kisan bhai meri fasal',
    language_code: 'hi-IN',
    confidence: 0.92,
    provider: 'amazon-transcribe',
  })),
}));

jest.mock('../../services/nova', () => ({
  analyzeAndRoute: jest.fn(async () => ({
    english_text: 'Farmer brother my crop',
    detected_language: 'hi',
    intent: 'crop_advice',
    domain: 'agriculture',
    entities: { crop: 'general' },
    complexity: 'simple',
  })),
}));

jest.mock('../../services/memory', () => ({
  storeTurn: jest.fn(async () => {}),
  getSessionHistory: jest.fn(async () => []),
  buildContextMessages: jest.fn(async () => [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Farmer brother my crop' },
  ]),
  extractAndStoreFacts: jest.fn(async () => {}),
}));

jest.mock('../../services/mcp', () => ({
  routeToAgent: jest.fn(async () => ({
    response: 'Here is advice about your crop.',
    provider: 'sarvam-m',
    route: 'mcp→domain_agent→agriculture',
  })),
}));

jest.mock('../../services/sarvam', () => ({
  translate: jest.fn(async () => ({
    translated_text: 'यहाँ आपकी फसल के बारे में सलाह है।',
  })),
  synthesize: jest.fn(async () => ({
    audios: ['base64-audio-data'],
  })),
  toBcp47: jest.fn((code) => {
    const map = { hi: 'hi-IN', en: 'en-IN', ta: 'ta-IN' };
    return map[code] || code;
  }),
}));

const orchestrator = require('../../services/orchestrator');
const transcribeService = require('../../services/transcribe');
const nova = require('../../services/nova');
const memory = require('../../services/memory');
const mcp = require('../../services/mcp');
const sarvam = require('../../services/sarvam');

describe('AI Orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processAudio', () => {
    test('runs full 6-stage pipeline: STT → Nova → Memory → Agent → Sarvam → Output', async () => {
      const result = await orchestrator.processAudio({
        audioBuffer: Buffer.from('fake-audio'),
        userId: 'user-123',
        sessionId: 'session-abc',
        languageCode: 'unknown',
        generateAudio: true,
      });

      // Stage 1: Transcribe was called
      expect(transcribeService.transcribe).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ languageCode: 'unknown' }),
      );

      // Stage 2: Nova analyzed the transcript
      expect(nova.analyzeAndRoute).toHaveBeenCalledWith(
        'kisan bhai meri fasal',
        'hi-IN',
      );

      // Stage 3: Memory stored user turn
      expect(memory.storeTurn).toHaveBeenCalledWith(
        'user-123', 'session-abc', 'user', 'kisan bhai meri fasal',
        expect.any(Object),
      );

      // Stage 4: MCP routed to agent
      expect(mcp.routeToAgent).toHaveBeenCalled();

      // Stage 5: Sarvam translated + synthesized
      expect(sarvam.translate).toHaveBeenCalled();
      expect(sarvam.synthesize).toHaveBeenCalled();

      // Stage 6: Memory stored assistant turn
      expect(memory.storeTurn).toHaveBeenCalledTimes(2);

      // Result shape
      expect(result.transcript).toBe('kisan bhai meri fasal');
      expect(result.response_text).toBeDefined();
      expect(result.audio_base64).toBe('base64-audio-data');
      expect(result.session_id).toBe('session-abc');
      expect(result.domain).toBe('agriculture');
      expect(result.intent).toBe('crop_advice');
      expect(result.pipeline).toBeDefined();
      expect(result.pipeline.stages).toBeDefined();
    });

    test('returns empty response for empty transcript', async () => {
      transcribeService.transcribe.mockResolvedValueOnce({
        transcript: '',
        language_code: 'hi-IN',
        provider: 'amazon-transcribe',
      });

      const result = await orchestrator.processAudio({
        audioBuffer: Buffer.from('silence'),
        userId: 'user-123',
        sessionId: 'session-abc',
      });

      expect(result.response_text).toBe('');
      expect(result.error).toMatch(/Could not transcribe/i);
    });
  });

  describe('processText', () => {
    test('skips STT and runs Nova → Agent → Sarvam pipeline', async () => {
      const result = await orchestrator.processText({
        text: 'Tell me wheat price',
        userId: 'user-456',
        sessionId: 'session-def',
        languageCode: 'en',
        generateAudio: true,
      });

      // STT should NOT be called
      expect(transcribeService.transcribe).not.toHaveBeenCalled();

      // Nova should analyze the text
      expect(nova.analyzeAndRoute).toHaveBeenCalledWith('Tell me wheat price', 'en');

      // Agent should be called
      expect(mcp.routeToAgent).toHaveBeenCalled();

      // Result shape
      expect(result.response_text).toBeDefined();
      expect(result.session_id).toBe('session-def');
      expect(result.response_time_ms).toBeDefined();
    });

    test('skips TTS when generateAudio is false', async () => {
      const result = await orchestrator.processText({
        text: 'Hello',
        userId: 'user-456',
        sessionId: 'session-def',
        languageCode: 'en',
        generateAudio: false,
      });

      expect(sarvam.synthesize).not.toHaveBeenCalled();
      expect(result.audio_base64).toBe('');
    });

    test('skips translation when language is English', async () => {
      nova.analyzeAndRoute.mockResolvedValueOnce({
        english_text: 'Tell me wheat price',
        detected_language: 'en',
        intent: 'get_prices',
        domain: 'market',
        entities: {},
        complexity: 'simple',
      });

      await orchestrator.processText({
        text: 'Tell me wheat price',
        userId: 'user-456',
        sessionId: 'session-def',
        languageCode: 'en',
        generateAudio: false,
      });

      // Should NOT translate (already English)
      expect(sarvam.translate).not.toHaveBeenCalled();
    });

    test('sanitizes think tags before translation and final response', async () => {
      mcp.routeToAgent.mockResolvedValueOnce({
        response: '<think>\ninternal reasoning\n</think>\nActual answer for user.',
        provider: 'sarvam-m',
        route: 'agent',
      });

      const result = await orchestrator.processText({
        text: 'What is this?',
        userId: 'user-456',
        sessionId: 'session-def',
        languageCode: 'en',
        generateAudio: false,
      });

      expect(result.response_text_english).toBe('Actual answer for user.');
      expect(result.response_text).toBe('Actual answer for user.');
      expect(result.response_text).not.toContain('<think>');
    });

    test('reuses pending location follow-up context before routing', async () => {
      memory.getSessionHistory.mockResolvedValueOnce([
        {
          role: 'user',
          text: 'What is the weather here?',
          intentDomain: 'general',
          intent: 'weather_info',
          entities: {},
        },
        {
          role: 'assistant',
          text: 'Please tell me your city name so I can check the live weather.',
          intentDomain: 'general',
          intent: 'weather_info',
          followUp: {
            pendingSlot: 'location',
            intent: 'weather_info',
            intentDomain: 'general',
            entities: {},
          },
        },
      ]);
      nova.analyzeAndRoute.mockResolvedValueOnce({
        english_text: 'Mumbai Mumbai.',
        detected_language: 'hi',
        intent: 'greeting',
        domain: 'general',
        entities: {},
        complexity: 'simple',
        can_answer_directly: true,
        direct_response: 'Hello! How can I assist you today?',
      });

      await orchestrator.processText({
        text: 'मुंबई मुंबई।',
        userId: 'user-456',
        sessionId: 'session-def',
        languageCode: 'hi-IN',
        generateAudio: false,
      });

      expect(mcp.routeToAgent).toHaveBeenCalledWith(expect.objectContaining({
        domain: 'general',
        intent: 'weather_info',
        entities: expect.objectContaining({ location: 'मुंबई' }),
      }));
    });

    test('reuses pending symptom age follow-up before routing', async () => {
      memory.getSessionHistory.mockResolvedValueOnce([
        {
          role: 'user',
          text: 'I have fever and cough',
          intentDomain: 'health',
          intent: 'symptom_guidance',
          entities: { symptoms: 'fever and cough' },
        },
        {
          role: 'assistant',
          text: 'What is the patient age?',
          intentDomain: 'health',
          intent: 'symptom_guidance',
          followUp: {
            pendingSlot: 'age',
            intent: 'symptom_guidance',
            intentDomain: 'health',
            entities: { symptoms: 'fever and cough' },
          },
        },
      ]);
      nova.analyzeAndRoute.mockResolvedValueOnce({
        english_text: '35',
        detected_language: 'hi',
        intent: 'greeting',
        domain: 'general',
        entities: {},
        complexity: 'simple',
        can_answer_directly: true,
        direct_response: 'Hello',
      });

      await orchestrator.processText({
        text: '35।',
        userId: 'user-456',
        sessionId: 'session-def',
        languageCode: 'en',
        generateAudio: false,
      });

      expect(mcp.routeToAgent).toHaveBeenCalledWith(expect.objectContaining({
        domain: 'health',
        intent: 'symptom_guidance',
        entities: expect.objectContaining({
          symptoms: 'fever and cough',
          age: '35',
        }),
      }));
    });
  });

  describe('pipeline timing', () => {
    test('includes stage timing in pipeline object', async () => {
      const result = await orchestrator.processAudio({
        audioBuffer: Buffer.from('audio'),
        userId: 'user-1',
        sessionId: 'sess-1',
        generateAudio: true,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.pipeline.stages).toBeDefined();
      expect(result.pipeline.stages.stt).toBeDefined();
      expect(typeof result.pipeline.stages.stt.ms).toBe('number');
    });
  });
});
