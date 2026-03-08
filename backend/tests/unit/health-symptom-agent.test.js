jest.mock('../../lambdas/health-ai/symptom-checker', () => ({
  checkSymptoms: jest.fn(async () => ({
    possible_conditions: ['viral fever', 'seasonal infection'],
    risk_level: 'Low',
    recommended_action: 'Rest, hydrate, and monitor symptoms.',
    urgency: 'routine',
    home_remedies: ['Drink fluids'],
    warning_signs: ['Breathing difficulty'],
    disclaimer: 'Not a diagnosis',
  })),
}));

jest.mock('../../lambdas/health-directory/govt-portals', () => ({
  listHealthPortals: jest.fn(async () => []),
}));

jest.mock('../../lambdas/health-directory/providers', () => ({
  listProviders: jest.fn(async () => ({ providers: [] })),
}));

const symptomChecker = require('../../lambdas/health-ai/symptom-checker');
const healthAgent = require('../../services/agents/health');

describe('Health symptom agent', () => {
  const mockLlm = {
    generateResponse: jest.fn(async () => ({
      content: 'fallback',
      provider: 'mock',
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('asks follow-up age question when only symptoms are provided', async () => {
    const result = await healthAgent.handle({
      intent: 'symptom_guidance',
      entities: {},
      complexity: 'simple',
      userId: 'user-1',
      screenContext: 'User is on screen: SymptomChecker. conversationStage: ready. capturedSymptoms: None. capturedAge: None. capturedGender: None.',
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'I have fever and cough since yesterday' },
      ],
    }, { llm: mockLlm });

    expect(result.provider).toBe('health-symptom-agent');
    expect(result.response.toLowerCase()).toContain('age');
    expect(result.metadata.followUp.pendingSlot).toBe('age');
    expect(symptomChecker.checkSymptoms).not.toHaveBeenCalled();
  });

  test('runs triage once symptoms, age, and gender are available', async () => {
    const result = await healthAgent.handle({
      intent: 'symptom_guidance',
      entities: {
        symptoms: 'fever and cough',
        age: '35',
        gender: 'male',
      },
      complexity: 'simple',
      userId: 'user-1',
      screenContext: 'User is on screen: SymptomChecker. conversationStage: collecting. capturedSymptoms: fever and cough. capturedAge: 35. capturedGender: male.',
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'I also have body pain' },
      ],
    }, { llm: mockLlm });

    expect(symptomChecker.checkSymptoms).toHaveBeenCalledWith(
      expect.stringContaining('fever and cough'),
      35,
      'male',
      expect.any(String),
      'user-1',
    );
    expect(result.provider).toBe('health-symptom-triage');
    expect(result.metadata.triage_result.risk_level).toBe('Low');
    expect(result.response).toContain('Health screening complete');
  });

  test('moves to gender follow-up after repeated Hindi age reply', async () => {
    const result = await healthAgent.handle({
      intent: 'symptom_guidance',
      entities: {
        symptoms: 'not feeling well what can you check',
      },
      complexity: 'simple',
      userId: 'user-1',
      screenContext: 'User is on screen: SymptomChecker. conversationStage: collecting. capturedSymptoms: not feeling well what can you check. capturedAge: None. capturedGender: None.',
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: '18 साल, 18 साल।' },
      ],
    }, { llm: mockLlm });

    expect(result.provider).toBe('health-symptom-agent');
    expect(result.metadata.followUp.pendingSlot).toBe('gender');
    expect(result.metadata.symptomIntake.age).toBe(18);
    expect(result.metadata.symptomIntake.symptoms).toBe('not feeling well what can you check');
    expect(result.response.toLowerCase()).toContain('gender');
    expect(result.response.toLowerCase()).not.toContain('what can you check');
  });
});
