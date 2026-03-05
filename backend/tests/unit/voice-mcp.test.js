/**
 * Unit tests for Voice – mcp.js
 * Tests MCP (Model Context Protocol) tool routing layer.
 */

/* ---------- Mock agent registry ---------- */
const mockAgentHandle = jest.fn(async () => ({
  response: 'Agent response about wheat',
  provider: 'sarvam-m',
  metadata: { domain: 'agriculture' },
}));

jest.mock('../../services/agents', () => ({
  getAgent: jest.fn((domain) => ({
    name: domain || 'general',
    handle: mockAgentHandle,
  })),
  resolveDomain: jest.fn((intent) => {
    const map = { crop_advice: 'agriculture', get_prices: 'market', greeting: 'general' };
    return map[intent] || 'general';
  }),
}));

/* ---------- Mock LLM ---------- */
jest.mock('../../services/llm', () => ({
  generateResponse: jest.fn(async () => ({
    content: 'Bedrock deep reasoning result',
    provider: 'bedrock-claude',
  })),
  callBedrock: jest.fn(async () => ({
    content: 'Bedrock deep reasoning result',
    provider: 'bedrock-claude',
  })),
  callGemini: jest.fn(async () => ({
    content: 'Gemini fallback result',
    provider: 'gemini',
  })),
}));

const mcp = require('../../services/mcp');

describe('MCP Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TOOL_DEFINITIONS', () => {
    test('defines domain_agent tool', () => {
      const tool = mcp.TOOL_DEFINITIONS.find(t => t.name === 'domain_agent');
      expect(tool).toBeDefined();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    });

    test('defines deep_reasoning tool', () => {
      const tool = mcp.TOOL_DEFINITIONS.find(t => t.name === 'deep_reasoning');
      expect(tool).toBeDefined();
    });

    test('defines fallback_llm tool', () => {
      const tool = mcp.TOOL_DEFINITIONS.find(t => t.name === 'fallback_llm');
      expect(tool).toBeDefined();
    });
  });

  describe('routeToAgent', () => {
    test('routes to correct domain agent', async () => {
      const result = await mcp.routeToAgent({
        domain: 'agriculture',
        intent: 'crop_advice',
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'wheat advice' },
        ],
        entities: { crop: 'wheat' },
        complexity: 'simple',
        userId: 'u-1',
      });

      expect(result.response).toBe('Agent response about wheat');
      expect(result.provider).toBe('sarvam-m');
      expect(result.route).toBe('agent');
      expect(mockAgentHandle).toHaveBeenCalledTimes(1);
    });

    test('falls back to deep_reasoning when agent fails', async () => {
      mockAgentHandle.mockRejectedValueOnce(new Error('Agent crashed'));

      const result = await mcp.routeToAgent({
        domain: 'agriculture',
        intent: 'crop_advice',
        messages: [{ role: 'user', content: 'complex question' }],
        entities: {},
        complexity: 'moderate',
        userId: 'u-1',
      });

      expect(result.response).toBe('Bedrock deep reasoning result');
      expect(result.route).toContain('deep_reasoning');
    });

    test('falls back to Gemini when both agent and Bedrock fail', async () => {
      mockAgentHandle.mockRejectedValueOnce(new Error('Agent crashed'));
      const llm = require('../../services/llm');
      llm.callBedrock.mockRejectedValueOnce(new Error('Bedrock down'));

      const result = await mcp.routeToAgent({
        domain: 'market',
        intent: 'get_prices',
        messages: [{ role: 'user', content: 'prices' }],
        entities: {},
        complexity: 'simple',
        userId: 'u-1',
      });

      expect(result.response).toBe('Gemini fallback result');
      expect(result.route).toContain('fallback');
    });
  });

  describe('executeTool', () => {
    test('executes domain_agent tool', async () => {
      const result = await mcp.executeTool('domain_agent', {
        domain: 'agriculture',
        intent: 'crop_advice',
        entities: {},
        complexity: 'simple',
        userId: 'u-1',
      }, [{ role: 'user', content: 'test' }]);

      expect(result.response).toBeDefined();
    });

    test('executes deep_reasoning tool', async () => {
      const result = await mcp.executeTool('deep_reasoning', {}, [
        { role: 'user', content: 'complex reasoning query' },
      ]);

      expect(result.response).toBe('Bedrock deep reasoning result');
    });

    test('executes fallback_llm tool', async () => {
      const result = await mcp.executeTool('fallback_llm', {}, [
        { role: 'user', content: 'fallback query' },
      ]);

      expect(result.response).toBe('Gemini fallback result');
    });

    test('throws for unknown tool', async () => {
      await expect(
        mcp.executeTool('unknown_tool', {}, [])
      ).rejects.toThrow(/Unknown tool/);
    });
  });
});
