/**
 * Tests for Symptom Checker (Module 1).
 */

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockSend })),
  InvokeModelCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn(() => ({})) }));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })) },
  PutCommand: jest.fn((p) => p),
}));

jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn() })) }));

const { checkSymptoms, getFallbackTriage, parseTriageResponse } = require('../../lambdas/health-ai/symptom-checker');

describe('Symptom Checker', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('checkSymptoms', () => {
    test('should reject empty symptoms', async () => {
      await expect(checkSymptoms('', 30, 'male', null, 'user-1'))
        .rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
    });

    test('should use fallback when Bedrock fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('Bedrock down'));

      const result = await checkSymptoms('fever and headache for 2 days', 30, 'male', null, 'user-1');
      expect(result.possible_conditions).toBeDefined();
      expect(result.risk_level).toBeDefined();
      expect(result.disclaimer).toContain('not a medical diagnosis');
    });

    test('should return structured response from Bedrock', async () => {
      const mockResponse = {
        possible_conditions: ['Common cold', 'Viral fever', 'Flu'],
        risk_level: 'Low',
        recommended_action: 'Rest and hydrate',
        urgency: 'routine',
        home_remedies: ['Warm water'],
        warning_signs: ['High fever'],
      };

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{ text: JSON.stringify(mockResponse) }],
        })),
      });

      const result = await checkSymptoms('mild cold and cough', 25, 'female', null, 'user-1');
      expect(result.possible_conditions).toHaveLength(3);
      expect(result.risk_level).toBe('Low');
      expect(result.disclaimer).toBeDefined();
    });
  });

  describe('getFallbackTriage', () => {
    test('should detect emergency keywords', () => {
      const result = getFallbackTriage('chest pain and breathing difficulty');
      expect(result.risk_level).toBe('Critical');
      expect(result.urgency).toBe('emergency');
    });

    test('should detect high risk keywords', () => {
      const result = getFallbackTriage('high fever and severe pain');
      expect(result.risk_level).toBe('High');
    });

    test('should handle fever and cold', () => {
      const result = getFallbackTriage('mild fever since yesterday');
      expect(result.risk_level).toBe('Low');
      expect(result.home_remedies.length).toBeGreaterThan(0);
    });

    test('should return medium for unknown symptoms', () => {
      const result = getFallbackTriage('feeling dizzy and tired');
      expect(result.risk_level).toBe('Medium');
    });
  });

  describe('parseTriageResponse', () => {
    test('should parse valid JSON', () => {
      const result = parseTriageResponse('{"possible_conditions": ["Cold"], "risk_level": "Low"}');
      expect(result.possible_conditions).toEqual(['Cold']);
    });

    test('should handle markdown-wrapped JSON', () => {
      const result = parseTriageResponse('```json\n{"risk_level": "Medium"}\n```');
      expect(result.risk_level).toBe('Medium');
    });

    test('should return fallback for invalid text', () => {
      const result = parseTriageResponse('Sorry, I cannot help with that.');
      expect(result.risk_level).toBe('Medium');
      expect(result.possible_conditions[0]).toContain('consult a doctor');
    });
  });
});
