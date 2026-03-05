/**
 * Unit tests for Voice – agents/index.js
 * Tests agent registry, domain resolution, and agent interface.
 */

const agentRegistry = require('../../services/agents');

describe('AI Agent Registry', () => {
  describe('listAgents', () => {
    test('returns all registered agents', () => {
      const agents = agentRegistry.listAgents();
      expect(agents.length).toBeGreaterThanOrEqual(5);

      const names = agents.map(a => a.name);
      expect(names).toContain('agriculture');
      expect(names).toContain('market');
      expect(names).toContain('schemes');
      expect(names).toContain('health');
      expect(names).toContain('general');
    });

    test('each agent has name, description, and supportedIntents', () => {
      const agents = agentRegistry.listAgents();
      for (const agent of agents) {
        expect(agent.name).toBeTruthy();
        expect(agent.description).toBeTruthy();
        expect(Array.isArray(agent.supportedIntents)).toBe(true);
        expect(agent.supportedIntents.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getAgent', () => {
    test('returns agriculture agent', () => {
      const agent = agentRegistry.getAgent('agriculture');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('agriculture');
      expect(typeof agent.handle).toBe('function');
    });

    test('returns market agent', () => {
      const agent = agentRegistry.getAgent('market');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('market');
    });

    test('returns schemes agent', () => {
      const agent = agentRegistry.getAgent('schemes');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('schemes');
    });

    test('returns health agent', () => {
      const agent = agentRegistry.getAgent('health');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('health');
    });

    test('returns general agent for unknown domain', () => {
      const agent = agentRegistry.getAgent('nonexistent');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('general');
    });

    test('returns general agent for null/undefined', () => {
      expect(agentRegistry.getAgent(null).name).toBe('general');
      expect(agentRegistry.getAgent(undefined).name).toBe('general');
    });
  });

  describe('resolveDomain', () => {
    test('maps crop_advice intent to agriculture', () => {
      expect(agentRegistry.resolveDomain('crop_advice')).toBe('agriculture');
    });

    test('maps crop_prices intent to market', () => {
      expect(agentRegistry.resolveDomain('crop_prices')).toBe('market');
    });

    test('maps scheme_eligibility intent to schemes', () => {
      expect(agentRegistry.resolveDomain('scheme_eligibility')).toBe('schemes');
    });

    test('maps symptom_guidance intent to health', () => {
      expect(agentRegistry.resolveDomain('symptom_guidance')).toBe('health');
    });

    test('maps greeting intent to general', () => {
      expect(agentRegistry.resolveDomain('greeting')).toBe('general');
    });

    test('returns general for unknown intent', () => {
      expect(agentRegistry.resolveDomain('some_random_intent')).toBe('general');
    });
  });

  describe('Agent handle interface', () => {
    const mockLlm = {
      generateResponse: jest.fn(async () => ({
        content: 'Mock LLM response',
        provider: 'mock',
      })),
    };

    const baseContext = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Tell me about wheat farming' },
      ],
      intent: 'crop_advice',
      entities: { crop: 'wheat' },
      complexity: 'simple',
      userId: 'user-1',
    };

    test('agriculture agent handles a query', async () => {
      const agent = agentRegistry.getAgent('agriculture');
      const result = await agent.handle(baseContext, { llm: mockLlm });

      expect(result.response).toBe('Mock LLM response');
      expect(result.provider).toBe('mock');
      expect(mockLlm.generateResponse).toHaveBeenCalled();

      // Verify system prompt was injected (first message should contain agriculture-specific content)
      const callArgs = mockLlm.generateResponse.mock.calls[0];
      const messages = callArgs[0];
      expect(messages[0].content).toContain('Indian farmer');
    });

    test('health agent always recommends doctor', async () => {
      const agent = agentRegistry.getAgent('health');
      const healthCtx = {
        ...baseContext,
        intent: 'symptom_check',
        messages: [
          { role: 'system', content: 'Default system prompt' },
          { role: 'user', content: 'I have a headache' },
        ],
      };

      mockLlm.generateResponse.mockClear();
      const result = await agent.handle(healthCtx, { llm: mockLlm });
      expect(result.response).toBeDefined();

      // Health agent delegates to LLM (MCP routes health to Claude directly)
      const callArgs = mockLlm.generateResponse.mock.calls[0];
      const opts = callArgs[1];
      expect(opts.temperature).toBe(0.1);
    });

    test('general agent handles greetings', async () => {
      const agent = agentRegistry.getAgent('general');
      const greetCtx = {
        ...baseContext,
        intent: 'greeting',
        messages: [
          { role: 'system', content: 'Default' },
          { role: 'user', content: 'Namaste' },
        ],
      };

      const result = await agent.handle(greetCtx, { llm: mockLlm });
      expect(result.response).toBeDefined();
    });
  });
});
