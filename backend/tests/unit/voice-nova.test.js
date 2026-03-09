/**
 * Unit tests for Voice – nova.js
 * Tests AWS Nova via Bedrock for language analysis + routing.
 */

/* ---------- Mock AWS SDK ---------- */
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({
    send: mockSend,
  })),
  InvokeModelCommand: jest.fn((p) => ({ ...p, _cmd: 'invoke' })),
}));

const nova = require('../../services/nova');

describe('AWS Nova Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  describe('parseAnalysisResponse', () => {
    test('parses valid JSON analysis from Nova', () => {
      const text = `\`\`\`json
{
  "english_text": "What is the price of wheat?",
  "original_language": "hi-IN",
  "intent": "crop_prices",
  "domain": "market",
  "entities": { "crop": "wheat" },
  "complexity": "simple"
}
\`\`\``;

      const result = nova.parseAnalysisResponse(text);
      expect(result.english_text).toBe('What is the price of wheat?');
      expect(result.domain).toBe('market');
      expect(result.intent).toBe('crop_prices');
      expect(result.entities.crop).toBe('wheat');
      expect(result.complexity).toBe('simple');
    });

    test('handles raw JSON without markdown fences', () => {
      const text = '{"english_text":"Hello","detected_language":"en","intent":"greeting","domain":"general","entities":{},"complexity":"simple"}';

      const result = nova.parseAnalysisResponse(text);
      expect(result.english_text).toBe('Hello');
      expect(result.domain).toBe('general');
    });

    test('returns defaults on parse failure', () => {
      const result = nova.parseAnalysisResponse('This is not JSON at all');
      expect(result.english_text).toBeDefined();
      expect(result.domain).toBe('general');
      expect(result.complexity).toBe('simple');
    });

    test('corrects knowledge requests mislabeled as general chat', () => {
      const text = JSON.stringify({
        english_text: 'Show me videos on drip irrigation',
        original_language: 'en-IN',
        intent: 'general_question',
        domain: 'general',
        entities: {},
        complexity: 'simple',
        can_answer_directly: true,
        direct_response: 'Here are some tips.',
      });

      const result = nova.parseAnalysisResponse(text);
      expect(result.domain).toBe('knowledge');
      expect(result.intent).toBe('request_video');
      expect(result.can_answer_directly).toBe(false);
      expect(result.direct_response).toBeNull();
    });

    test('realigns city weather queries away from wrong domain labels', () => {
      const text = JSON.stringify({
        english_text: 'What is the weather in Pune today?',
        original_language: 'en-IN',
        intent: 'crop_advice',
        domain: 'agriculture',
        entities: {},
        complexity: 'simple',
      });

      const result = nova.parseAnalysisResponse(text);
      expect(result.domain).toBe('general');
      expect(result.intent).toBe('weather_info');
      expect(result.entities.location).toBe('Pune');
    });
  });

  describe('basicRoute', () => {
    test('routes agriculture keywords to agriculture domain', () => {
      const result = nova.basicRoute('Tell me about wheat crop pest control');
      expect(result.domain).toBe('agriculture');
    });

    test('routes market keywords to market domain', () => {
      const result = nova.basicRoute('bazaar mein kya rate hai aaj?');
      expect(result.domain).toBe('market');
    });

    test('routes scheme keywords to schemes domain', () => {
      const result = nova.basicRoute('How to apply for PM-KISAN yojana?');
      expect(result.domain).toBe('schemes');
    });

    test('routes health keywords to health domain', () => {
      const result = nova.basicRoute('I have fever and body pain');
      expect(result.domain).toBe('health');
    });

    test('defaults to general for unrecognized input', () => {
      const result = nova.basicRoute('Hello, how are you?');
      expect(result.domain).toBe('general');
    });

    test('routes Hindi agriculture keywords', () => {
      const result = nova.basicRoute('meri fasal mein keede lag gaye');
      expect(result.domain).toBe('agriculture');
    });

    test('routes Hindi market keywords', () => {
      const result = nova.basicRoute('bazaar mein bhav kya hai aaj');
      expect(result.domain).toBe('market');
    });

    test('routes video requests to knowledge domain', () => {
      const result = nova.basicRoute('show me videos on drip irrigation');
      expect(result.domain).toBe('knowledge');
      expect(result.intent).toBe('request_video');
    });

    test('routes crop weather questions to agriculture weather impact', () => {
      const result = nova.basicRoute('what is the weather for my wheat crop in Punjab');
      expect(result.domain).toBe('agriculture');
      expect(result.intent).toBe('weather_impact');
    });

    test('routes medical report uploads to health report analysis', () => {
      const result = nova.basicRoute('please upload my MRI report for insights');
      expect(result.domain).toBe('health');
      expect(result.intent).toBe('medical_report_analysis');
    });

    test('does not treat non-market rate language as a crop price query', () => {
      const result = nova.basicRoute('my heart rate is high');
      expect(result.domain).toBe('general');
      expect(result.intent).toBe('general_question');
    });
  });

  describe('analyzeAndRoute', () => {
    test('returns parsed Nova analysis on success', async () => {
      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(JSON.stringify({
          output: {
            message: {
              content: [{
                text: JSON.stringify({
                  english_text: 'How to control pest in wheat?',
                  original_language: 'hi-IN',
                  intent: 'pest_disease',
                  domain: 'agriculture',
                  entities: { crop: 'wheat' },
                  complexity: 'moderate',
                }),
              }],
            },
          },
        })),
      });

      const result = await nova.analyzeAndRoute('gehun mein keede kaise roke?', 'hi-IN');

      expect(result.domain).toBe('agriculture');
      expect(result.intent).toBe('pest_disease');
      expect(result.english_text).toContain('pest');
    });

    test('falls back to basicRoute when Nova and fallback both fail', async () => {
      // Nova fails
      mockSend.mockRejectedValueOnce(new Error('Nova timeout'));
      // Fallback (Claude) also fails
      mockSend.mockRejectedValueOnce(new Error('Claude timeout'));

      const result = await nova.analyzeAndRoute('bazaar mein kya rate hai?', 'en-IN');

      // Should use basicRoute keyword matching
      expect(result.domain).toBe('market');
      expect(result.english_text).toBe('bazaar mein kya rate hai?');
    });
  });
});
