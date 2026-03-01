/**
 * Unit tests for Voice – sarvam.js
 * Tests Sarvam AI service with mocked fetch calls.
 */

/* ---------- Mock fetch globally ---------- */
const mockFetch = jest.fn();
global.fetch = mockFetch;

const sarvam = require('../../services/sarvam');

describe('Sarvam AI Service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.SARVAM_API_KEY = 'test-key-123';
  });

  afterAll(() => {
    delete process.env.SARVAM_API_KEY;
  });

  describe('transcribe', () => {
    test('sends audio buffer to STT endpoint and returns transcript', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcript: 'namaste kisan bhai',
          language_code: 'hi-IN',
          language_probability: 0.95,
        }),
      });

      const buffer = Buffer.from('fake-audio-data');
      const result = await sarvam.transcribe(buffer, { language: 'hi-IN' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.sarvam.ai/speech-to-text');
      expect(opts.method).toBe('POST');
      expect(opts.headers['api-subscription-key']).toBe('test-key-123');
      expect(result.transcript).toBe('namaste kisan bhai');
      expect(result.language_code).toBe('hi-IN');
    });

    test('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const buffer = Buffer.from('fake-audio');
      await expect(sarvam.transcribe(buffer)).rejects.toThrow(/Sarvam STT error/);
    });
  });

  describe('synthesize', () => {
    test('requests TTS and returns base64 audio', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audios: ['base64audiocontent'], request_id: 'req-1' }),
      });

      const result = await sarvam.synthesize('Hello farmer', { targetLanguageCode: 'en-IN' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.sarvam.ai/text-to-speech');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.text).toBe('Hello farmer');
      expect(body.target_language_code).toBe('en-IN');
      expect(result.audios[0]).toBe('base64audiocontent');
    });
  });

  describe('translate', () => {
    test('translates text between languages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translated_text: 'नमस्ते किसान' }),
      });

      const result = await sarvam.translate('Hello farmer', 'en-IN', 'hi-IN');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.sarvam.ai/translate');
      const body = JSON.parse(opts.body);
      expect(body.source_language_code).toBe('en-IN');
      expect(body.target_language_code).toBe('hi-IN');
      expect(result.translated_text).toBe('नमस्ते किसान');
    });
  });

  describe('chat', () => {
    test('sends messages to Sarvam-M and returns response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Wheat price is ₹2200/quintal today.' } }],
        }),
      });

      const result = await sarvam.chat([
        { role: 'user', content: 'What is the wheat price?' },
      ]);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.sarvam.ai/v1/chat/completions');
      expect(result.content).toBe('Wheat price is ₹2200/quintal today.');
      expect(result.provider).toBe('sarvam-m');
    });
  });

  describe('toBcp47', () => {
    test('converts short codes to BCP-47', () => {
      expect(sarvam.toBcp47('hi')).toBe('hi-IN');
      expect(sarvam.toBcp47('en')).toBe('en-IN');
      expect(sarvam.toBcp47('ta')).toBe('ta-IN');
      expect(sarvam.toBcp47('bn')).toBe('bn-IN');
    });

    test('passes through already-valid BCP-47 codes', () => {
      expect(sarvam.toBcp47('hi-IN')).toBe('hi-IN');
      expect(sarvam.toBcp47('te-IN')).toBe('te-IN');
    });
  });

  describe('SARVAM_LANGUAGES', () => {
    test('contains at least 10 Indian languages', () => {
      expect(Object.keys(sarvam.SARVAM_LANGUAGES).length).toBeGreaterThanOrEqual(10);
    });

    test('has Hindi and English entries', () => {
      expect(sarvam.SARVAM_LANGUAGES['hi']).toBeDefined();
      expect(sarvam.SARVAM_LANGUAGES['en']).toBeDefined();
    });
  });
});
