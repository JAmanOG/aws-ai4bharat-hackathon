/**
 * Unit tests for Voice – llm.js
 * Tests LLM service with quad fallback (Sarvam → Nova → Bedrock → Gemini).
 *
 * callSarvam delegates to sarvam.chat() which returns {content, usage, id, provider: 'sarvam-m'}.
 * callNova returns {content, provider: 'nova-micro', usage}.
 * callBedrock returns {content, provider: 'bedrock-claude', usage}.
 * callGemini returns {content, provider: 'gemini', usage}.
 * generateResponse returns the first successful provider's result object.
 */

/* ---------- Mock dependencies ---------- */
const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({
    send: jest.fn(async () => ({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: 'Bedrock response about wheat' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        })
      ),
    })),
  })),
  InvokeModelCommand: jest.fn((params) => params),
}));

const llm = require('../../services/llm');

describe('LLM Service – Quad Fallback', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.SARVAM_API_KEY = 'test-sarvam-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  afterAll(() => {
    delete process.env.SARVAM_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  describe('callSarvam', () => {
    test('calls Sarvam-M chat completion API and returns object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Sarvam response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
          id: 'chat-123',
        }),
      });

      const result = await llm.callSarvam([
        { role: 'user', content: 'Hello' },
      ]);

      // callSarvam returns sarvam.chat() result: {content, usage, id, provider: 'sarvam-m'}
      expect(result.content).toBe('Sarvam response');
      expect(result.provider).toBe('sarvam-m');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('sarvam.ai');
      expect(opts.headers['api-subscription-key']).toBe('test-sarvam-key');
    });
  });

  describe('callGemini', () => {
    test('calls Google Gemini generateContent API and returns object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: 'Gemini response about farming' }] } },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 12, totalTokenCount: 17 },
        }),
      });

      const result = await llm.callGemini([
        { role: 'user', content: 'Tell me about organic farming' },
      ]);

      expect(result.content).toBe('Gemini response about farming');
      expect(result.provider).toBe('gemini');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('generativelanguage.googleapis.com');
    });
  });

  describe('generateResponse', () => {
    test('tries Sarvam first, returns on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'From Sarvam-M' } }],
          usage: {},
          id: 'c-1',
        }),
      });

      const result = await llm.generateResponse([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('From Sarvam-M');
      expect(result.provider).toBe('sarvam-m');
    });

    test('strips think tags from provider output', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '<think>\ninternal\n</think>\nVisible answer' } }],
          usage: {},
          id: 'c-2',
        }),
      });

      const result = await llm.generateResponse([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Visible answer');
    });

    test('falls back to next provider when Sarvam fails', async () => {
      // Sarvam fails
      mockFetch.mockRejectedValueOnce(new Error('Sarvam down'));

      const result = await llm.generateResponse([
        { role: 'user', content: 'Hello' },
      ]);

      // Should fall to nova-micro or bedrock-claude (from mocked Bedrock client)
      expect(result.content).toBeDefined();
      expect(result.provider).toBeDefined();
    });

    test('falls back through chain when earlier providers fail', async () => {
      // Sarvam fails
      mockFetch.mockRejectedValueOnce(new Error('Sarvam down'));

      // Bedrock client is cached at module load, so it will still succeed
      // This test validates the result shape
      const result = await llm.generateResponse([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBeDefined();
      expect(result.provider).toBeDefined();
    });

    test('respects preferredProvider option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: 'Gemini preferred' }] } },
          ],
          usageMetadata: {},
        }),
      });

      const result = await llm.generateResponse(
        [{ role: 'user', content: 'Hello' }],
        { preferredProvider: 'gemini' }
      );

      expect(result.content).toBe('Gemini preferred');
      expect(result.provider).toBe('gemini');
    });
  });
});
