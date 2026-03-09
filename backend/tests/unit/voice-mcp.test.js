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
    const map = {
      crop_advice: 'agriculture',
      get_prices: 'market',
      crop_prices: 'market',
      create_listing: 'market',
      listing_management: 'market',
      contact_buyer: 'market',
      orders: 'market',
      scheme_eligibility: 'schemes',
      symptom_guidance: 'health',
      medical_report_analysis: 'health',
      health_platform_help: 'health',
      weather_info: 'general',
      air_quality_info: 'general',
      request_video: 'knowledge',
      greeting: 'general',
    };
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

jest.mock('../../services/weather-aqi', () => ({
  getWeatherAndAqi: jest.fn(async () => ({
    response: 'In Pune, it is currently 28°C, partly cloudy. Air quality is AQI 74, moderate.',
    provider: 'weather-open-meteo',
    metadata: {
      domain: 'general',
      intent: 'weather_info',
      entities: { location: 'Pune, Maharashtra', city: 'Pune', state: 'Maharashtra' },
      weather: { temperatureC: 28, description: 'partly cloudy' },
      airQuality: { usAqi: 74, category: 'moderate' },
    },
  })),
}));

jest.mock('../../services/marketplace-tool', () => ({
  handleMarketplaceRequest: jest.fn(async () => ({
    response: 'Marketplace workflow result',
    provider: 'marketplace-tool',
    metadata: { domain: 'market' },
  })),
}));

const mcp = require('../../services/mcp');
const marketplaceTool = require('../../services/marketplace-tool');
const weatherAqi = require('../../services/weather-aqi');

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

    test('defines weather_lookup tool', () => {
      const tool = mcp.TOOL_DEFINITIONS.find(t => t.name === 'weather_lookup');
      expect(tool).toBeDefined();
    });

    test('defines fallback_llm tool', () => {
      const tool = mcp.TOOL_DEFINITIONS.find(t => t.name === 'fallback_llm');
      expect(tool).toBeDefined();
    });
  });

  describe('selectTool', () => {
    test('aligns mismatched market workflow intent to marketplace_tool', () => {
      const result = mcp.selectTool({
        domain: 'general',
        intent: 'create_listing',
        complexity: 'simple',
      });

      expect(result.tool).toBe('marketplace_tool');
    });

    test('aligns mismatched weather intent to live weather tool', () => {
      const result = mcp.selectTool({
        domain: 'market',
        intent: 'weather_info',
        complexity: 'simple',
      });

      expect(result.tool).toBe('weather_lookup');
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

    test('routes weather_info through weather_lookup tool', async () => {
      const result = await mcp.routeToAgent({
        domain: 'general',
        intent: 'weather_info',
        messages: [{ role: 'user', content: 'What is the weather in Pune?' }],
        entities: { location: 'Pune' },
        complexity: 'simple',
        userId: 'u-1',
      });

      expect(weatherAqi.getWeatherAndAqi).toHaveBeenCalledTimes(1);
      expect(result.tool).toBe('weather_lookup');
      expect(result.route).toBe('weather_lookup');
      expect(result.provider).toBe('weather-open-meteo');
    });

    test('routes health symptom guidance through the health domain agent', async () => {
      const result = await mcp.routeToAgent({
        domain: 'health',
        intent: 'symptom_guidance',
        messages: [{ role: 'user', content: 'I have fever and cough' }],
        entities: { symptoms: 'fever and cough' },
        complexity: 'simple',
        userId: 'u-1',
      });

      expect(result.tool).toBe('domain_agent');
      expect(result.route).toBe('agent');
      expect(mockAgentHandle).toHaveBeenCalledTimes(1);
    });

    test('corrects weather false positives before tool selection', async () => {
      const result = await mcp.routeToAgent({
        domain: 'market',
        intent: 'crop_prices',
        messages: [{ role: 'user', content: 'What is the weather in Pune today?' }],
        entities: {},
        complexity: 'simple',
        userId: 'u-1',
      });

      expect(weatherAqi.getWeatherAndAqi).toHaveBeenCalledTimes(1);
      expect(result.tool).toBe('weather_lookup');
      expect(result.route).toBe('weather_lookup');
    });

    test('corrects weak general intents into marketplace workflow routing', async () => {
      const result = await mcp.routeToAgent({
        domain: 'general',
        intent: 'unknown',
        messages: [{ role: 'user', content: 'Please create a listing for my onion crop' }],
        entities: { crop: 'onion' },
        complexity: 'simple',
        userId: 'u-1',
      });

      expect(marketplaceTool.handleMarketplaceRequest).toHaveBeenCalledTimes(1);
      expect(result.tool).toBe('marketplace_tool');
      expect(result.provider).toBe('marketplace-tool');
    });

    test('routes complex health symptom guidance to domain agent before deep reasoning', async () => {
      const result = await mcp.routeToAgent({
        domain: 'health',
        intent: 'symptom_guidance',
        messages: [{ role: 'user', content: 'I am not feeling well, can you check me?' }],
        entities: {},
        complexity: 'complex',
        userId: 'u-1',
      });

      expect(result.tool).toBe('domain_agent');
      expect(mockAgentHandle).toHaveBeenCalledTimes(1);
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

    test('executes weather_lookup tool', async () => {
      const result = await mcp.executeTool('weather_lookup', {
        intent: 'weather_info',
        entities: { location: 'Pune' },
      }, [
        { role: 'user', content: 'weather in Pune' },
      ]);

      expect(result.tool).toBe('weather_lookup');
      expect(result.response).toContain('Pune');
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
