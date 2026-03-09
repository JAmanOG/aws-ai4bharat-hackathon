/**
 * BRUTAL TEST SUITE – Requirement 2: Voice Interface Pipeline
 * Covers untested edge cases across: orchestrator, nova, mcp, llm,
 * memory, transcribe, sarvam, agents
 */

/* ────── top-level fetch mock ────── */
const mockFetch = jest.fn();
global.fetch = mockFetch;

/* ────── AWS SDK mocks ────── */
const mockBedrockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockSend })),
  InvokeModelCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-transcribe', () => ({
  TranscribeClient: jest.fn(() => ({ send: jest.fn() })),
  StartTranscriptionJobCommand: jest.fn((p) => p),
  GetTranscriptionJobCommand: jest.fn((p) => p),
  DeleteTranscriptionJobCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn((p) => p),
  DeleteObjectCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

const mockDynSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDynSend })) },
  PutCommand: jest.fn(function (p) { this.input = p; }),
  QueryCommand: jest.fn(function (p) { this.input = p; }),
  DeleteCommand: jest.fn(function (p) { this.input = p; }),
  UpdateCommand: jest.fn(function (p) { this.input = p; }),
}));

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn(() => ({ send: jest.fn() })),
  PublishCommand: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockBedrockSend.mockReset();
  mockDynSend.mockReset();
  mockFetch.mockReset();
  process.env.SARVAM_API_KEY = 'test-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
});

afterAll(() => {
  delete process.env.SARVAM_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

/* ═══════════════════════════════════════════════════
   SECTION A – nova.js: parseAnalysisResponse + basicRoute
   ═══════════════════════════════════════════════════ */
const nova = require('../../services/nova');

describe('Nova – parseAnalysisResponse edge cases', () => {
  test('strips markdown code fences from Nova output', () => {
    const raw = '```json\n{"english_text":"hi","domain":"agriculture","intent":"crop_advice","complexity":"simple","summary":"","entities":{}}\n```';
    const r = nova.parseAnalysisResponse(raw);
    expect(r.domain).toBe('agriculture');
    expect(r.intent).toBe('crop_advice');
  });

  test('handles missing english_text → falls back to raw text', () => {
    const r = nova.parseAnalysisResponse('{"domain":"market","intent":"prices","complexity":"moderate"}');
    expect(r.english_text).toBeDefined();
    expect(r.domain).toBe('market');
    expect(r.complexity).toBe('moderate');
  });

  test('invalid domain → defaults to general', () => {
    const r = nova.parseAnalysisResponse('{"english_text":"x","domain":"aliens","intent":"x","complexity":"simple"}');
    expect(r.domain).toBe('general');
  });

  test('invalid complexity → defaults to simple', () => {
    const r = nova.parseAnalysisResponse('{"english_text":"x","domain":"general","intent":"x","complexity":"mega"}');
    expect(r.complexity).toBe('simple');
  });

  test('can_answer_directly:true keeps direct_response', () => {
    const json = JSON.stringify({
      english_text: 'hello', domain: 'general', intent: 'greeting',
      complexity: 'simple', can_answer_directly: true,
      direct_response: 'Namaste!',
    });
    const r = nova.parseAnalysisResponse(json);
    expect(r.can_answer_directly).toBe(true);
    expect(r.direct_response).toBe('Namaste!');
  });

  test('can_answer_directly:false → direct_response is null', () => {
    const json = JSON.stringify({
      english_text: 'what is wheat price',
      domain: 'market', intent: 'crop_prices', complexity: 'moderate',
      can_answer_directly: false, direct_response: 'should be nulled',
    });
    const r = nova.parseAnalysisResponse(json);
    expect(r.can_answer_directly).toBe(false);
    expect(r.direct_response).toBeNull();
  });

  test('completely invalid JSON → fallback defaults', () => {
    const r = nova.parseAnalysisResponse('THIS IS NOT JSON');
    expect(r.domain).toBe('general');
    expect(r.complexity).toBe('simple');
    expect(r.english_text).toBe('THIS IS NOT JSON');
    expect(r.can_answer_directly).toBe(false);
  });

  test('empty string → fallback defaults', () => {
    const r = nova.parseAnalysisResponse('');
    expect(r.domain).toBe('general');
  });
});

describe('Nova – basicRoute keyword matching', () => {
  test('Hindi farming keywords → agriculture', () => {
    const r = nova.basicRoute('meri kheti mein samasya hai', 'hi-IN');
    expect(r.domain).toBe('agriculture');
  });

  test('fertilizer keyword → agriculture', () => {
    const r = nova.basicRoute('which fertilizer should I use?');
    expect(r.domain).toBe('agriculture');
  });

  test('₹ symbol → market (no agri keyword)', () => {
    // 'wheat' matches agriKeywords first, so use text without agri keywords
    const r = nova.basicRoute('₹2000 per quintal today');
    expect(r.domain).toBe('market');
  });

  test('daam/bhav → market', () => {
    const r = nova.basicRoute('gehu ka daam kya hai');
    expect(r.domain).toBe('market');
  });

  test('yojana/sarkar → schemes', () => {
    const r = nova.basicRoute('sarkar ki yojana batao');
    expect(r.domain).toBe('schemes');
  });

  test('pm-kisan → schemes', () => {
    const r = nova.basicRoute('pm-kisan ka status');
    expect(r.domain).toBe('schemes');
  });

  test('bukhar/tabiyat → health', () => {
    const r = nova.basicRoute('meri tabiyat kharab hai');
    expect(r.domain).toBe('health');
  });

  test('pregnant → health', () => {
    const r = nova.basicRoute('pregnant woman nutrition advice');
    expect(r.domain).toBe('health');
  });

  test('city weather query → general weather_info', () => {
    const r = nova.basicRoute('what is the weather in Pune today?');
    expect(r.domain).toBe('general');
    expect(r.intent).toBe('weather_info');
    expect(r.entities.location).toBe('Pune');
  });

  test('AQI query → general air_quality_info', () => {
    const r = nova.basicRoute('Delhi AQI status');
    expect(r.domain).toBe('general');
    expect(r.intent).toBe('air_quality_info');
    expect(r.entities.location).toBe('Delhi');
  });

  test('namaste → general greeting', () => {
    const r = nova.basicRoute('namaskar');
    expect(r.domain).toBe('general');
    expect(r.intent).toBe('greeting');
  });

  test('vanakkam → general greeting', () => {
    const r = nova.basicRoute('vanakkam');
    expect(r.domain).toBe('general');
    expect(r.intent).toBe('greeting');
  });

  test('random gibberish → general', () => {
    const r = nova.basicRoute('asdfghjkl qwerty');
    expect(r.domain).toBe('general');
    expect(r.can_answer_directly).toBe(false);
  });

  test('preserves detectedLang from parameter', () => {
    const r = nova.basicRoute('hello', 'ta-IN');
    expect(r.original_language).toBe('ta-IN');
  });

  test('missing detectedLang defaults to unknown', () => {
    const r = nova.basicRoute('hello');
    expect(r.original_language).toBe('unknown');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION B – mcp.js: selectTool routing logic
   ═══════════════════════════════════════════════════ */
// MCP has its own mocks for llm and agents — we test selectTool (pure function)
// and TOOL_DEFINITIONS/DOMAIN_CONTEXT directly
const mcp = require('../../services/mcp');

describe('MCP – selectTool routing rules', () => {
  test('complex query → deep_reasoning', () => {
    const s = mcp.selectTool({ domain: 'agriculture', complexity: 'complex', intent: 'crop_advice' });
    expect(s.tool).toBe('deep_reasoning');
  });

  test('health symptom guidance → domain_agent', () => {
    const s = mcp.selectTool({ domain: 'health', complexity: 'simple', intent: 'symptom_guidance' });
    expect(s.tool).toBe('domain_agent');
  });

  test('health report insights → domain_agent', () => {
    const s = mcp.selectTool({ domain: 'health', complexity: 'moderate', intent: 'medical_report_analysis' });
    expect(s.tool).toBe('domain_agent');
  });

  test('schemes + moderate → deep_reasoning', () => {
    const s = mcp.selectTool({ domain: 'schemes', complexity: 'moderate', intent: 'scheme_eligibility' });
    expect(s.tool).toBe('deep_reasoning');
  });

  test('schemes + simple → domain_agent (not deep_reasoning)', () => {
    const s = mcp.selectTool({ domain: 'schemes', complexity: 'simple', intent: 'scheme_eligibility' });
    expect(s.tool).toBe('domain_agent');
  });

  test('agriculture + simple → domain_agent', () => {
    const s = mcp.selectTool({ domain: 'agriculture', complexity: 'simple', intent: 'crop_advice' });
    expect(s.tool).toBe('domain_agent');
  });

  test('market + moderate → domain_agent', () => {
    const s = mcp.selectTool({ domain: 'market', complexity: 'moderate', intent: 'crop_prices' });
    expect(s.tool).toBe('domain_agent');
  });

  test('general + simple → domain_agent', () => {
    const s = mcp.selectTool({ domain: 'general', complexity: 'simple', intent: 'greeting' });
    expect(s.tool).toBe('domain_agent');
  });

  test('weather_info → weather_lookup', () => {
    const s = mcp.selectTool({ domain: 'general', complexity: 'simple', intent: 'weather_info' });
    expect(s.tool).toBe('weather_lookup');
  });

  test('air_quality_info → weather_lookup', () => {
    const s = mcp.selectTool({ domain: 'general', complexity: 'moderate', intent: 'air_quality_info' });
    expect(s.tool).toBe('weather_lookup');
  });

  test('create_listing intent wins over wrong domain labels', () => {
    const s = mcp.selectTool({ domain: 'general', complexity: 'simple', intent: 'create_listing' });
    expect(s.tool).toBe('marketplace_tool');
  });

  test('weather intent wins over wrong domain labels', () => {
    const s = mcp.selectTool({ domain: 'market', complexity: 'simple', intent: 'weather_info' });
    expect(s.tool).toBe('weather_lookup');
  });
});

describe('MCP – TOOL_DEFINITIONS', () => {
  test('has exactly 5 MCP tools', () => {
    expect(mcp.TOOL_DEFINITIONS).toHaveLength(5);
  });

  test('tool names include domain_agent, marketplace_tool, weather_lookup, deep_reasoning, fallback_llm', () => {
    const names = mcp.TOOL_DEFINITIONS.map(t => t.name);
    expect(names).toContain('domain_agent');
    expect(names).toContain('marketplace_tool');
    expect(names).toContain('weather_lookup');
    expect(names).toContain('deep_reasoning');
    expect(names).toContain('fallback_llm');
  });

  test('each tool has description and inputSchema', () => {
    for (const t of mcp.TOOL_DEFINITIONS) {
      expect(t.description).toBeDefined();
      expect(t.inputSchema).toBeDefined();
      expect(t.inputSchema.type).toBe('object');
    }
  });
});

describe('MCP – DOMAIN_CONTEXT', () => {
  test('has context for all 6 domains', () => {
    expect(mcp.DOMAIN_CONTEXT.agriculture).toBeDefined();
    expect(mcp.DOMAIN_CONTEXT.market).toBeDefined();
    expect(mcp.DOMAIN_CONTEXT.schemes).toBeDefined();
    expect(mcp.DOMAIN_CONTEXT.health).toBeDefined();
    expect(mcp.DOMAIN_CONTEXT.knowledge).toBeDefined();
    expect(mcp.DOMAIN_CONTEXT.general).toBeDefined();
  });

  test('health context warns against diagnosing', () => {
    expect(mcp.DOMAIN_CONTEXT.health).toContain('NEVER diagnose');
  });

  test('agriculture context references practical units', () => {
    expect(mcp.DOMAIN_CONTEXT.agriculture).toContain('quintal');
  });

  test('schemes context references PM-KISAN or KCC', () => {
    const ctx = mcp.DOMAIN_CONTEXT.schemes;
    expect(ctx.includes('KCC') || ctx.includes('PM-KISAN')).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════
   SECTION C – sarvam.js: toBcp47, language maps, DEFAULT_SPEAKERS
   ═══════════════════════════════════════════════════ */
const sarvam = require('../../services/sarvam');

describe('Sarvam – toBcp47 conversions', () => {
  test('hi → hi-IN', () => expect(sarvam.toBcp47('hi')).toBe('hi-IN'));
  test('en → en-IN', () => expect(sarvam.toBcp47('en')).toBe('en-IN'));
  test('ta → ta-IN', () => expect(sarvam.toBcp47('ta')).toBe('ta-IN'));
  test('bn → bn-IN', () => expect(sarvam.toBcp47('bn')).toBe('bn-IN'));
  test('mr → mr-IN', () => expect(sarvam.toBcp47('mr')).toBe('mr-IN'));
  test('null → hi-IN default', () => expect(sarvam.toBcp47(null)).toBe('hi-IN'));
  test('undefined → hi-IN default', () => expect(sarvam.toBcp47(undefined)).toBe('hi-IN'));
  test('empty string → hi-IN default', () => expect(sarvam.toBcp47('')).toBe('hi-IN'));
  test('already BCP-47 hi-IN passes through', () => expect(sarvam.toBcp47('hi-IN')).toBe('hi-IN'));
  test('unknown code → hi-IN default', () => expect(sarvam.toBcp47('zz')).toBe('hi-IN'));
});

describe('Sarvam – SARVAM_LANGUAGES coverage', () => {
  test('has 23 Indian language mappings', () => {
    expect(Object.keys(sarvam.SARVAM_LANGUAGES).length).toBe(23);
  });

  test('every entry has code and name', () => {
    for (const [key, value] of Object.entries(sarvam.SARVAM_LANGUAGES)) {
      expect(value.code).toBeDefined();
      expect(value.name).toBeDefined();
      expect(value.code).toMatch(/-IN$/);
    }
  });

  test('includes Hindi, English, Bengali, Tamil, Telugu', () => {
    expect(sarvam.SARVAM_LANGUAGES.hi.name).toBe('Hindi');
    expect(sarvam.SARVAM_LANGUAGES.en.name).toBe('English');
    expect(sarvam.SARVAM_LANGUAGES.bn.name).toBe('Bengali');
    expect(sarvam.SARVAM_LANGUAGES.ta.name).toBe('Tamil');
    expect(sarvam.SARVAM_LANGUAGES.te.name).toBe('Telugu');
  });

  test('includes less common languages: Bodo, Santali, Manipuri', () => {
    expect(sarvam.SARVAM_LANGUAGES.brx.name).toBe('Bodo');
    expect(sarvam.SARVAM_LANGUAGES.sat.name).toBe('Santali');
    expect(sarvam.SARVAM_LANGUAGES.mni.name).toBe('Manipuri');
  });
});

describe('Sarvam – DEFAULT_SPEAKERS', () => {
  test('has speaker for hi-IN', () => expect(sarvam.DEFAULT_SPEAKERS['hi-IN']).toBeDefined());
  test('has speaker for en-IN', () => expect(sarvam.DEFAULT_SPEAKERS['en-IN']).toBeDefined());
  test('has at least 10 language speakers', () => {
    expect(Object.keys(sarvam.DEFAULT_SPEAKERS).length).toBeGreaterThanOrEqual(10);
  });
});

/* ═══════════════════════════════════════════════════
   SECTION D – transcribe.js: detectMediaFormat edge cases
   ═══════════════════════════════════════════════════ */
const transcribeService = require('../../services/transcribe');

describe('Transcribe – detectMediaFormat additional formats', () => {
  test('WebM header → webm', () => {
    const buf = Buffer.from('1a45dfa300000000', 'hex');
    expect(transcribeService.detectMediaFormat(buf)).toBe('webm');
  });

  test('AMR header → amr', () => {
    const buf = Buffer.from('2321414d520a0000', 'hex');
    expect(transcribeService.detectMediaFormat(buf)).toBe('amr');
  });

  test('MP4 ftyp at offset 4 → mp4', () => {
    const buf = Buffer.alloc(16);
    Buffer.from('66747970', 'hex').copy(buf, 4); // 'ftyp' at offset 4
    expect(transcribeService.detectMediaFormat(buf)).toBe('mp4');
  });

  test('FLAC header → flac', () => {
    const buf = Buffer.from('664c614300000000', 'hex');
    expect(transcribeService.detectMediaFormat(buf)).toBe('flac');
  });

  test('MP3 ID3 header → mp3', () => {
    const buf = Buffer.from('49443300000000', 'hex');
    expect(transcribeService.detectMediaFormat(buf)).toBe('mp3');
  });

  test('MP3 sync word 0xfff3 → mp3', () => {
    const buf = Buffer.from('fff300000000', 'hex');
    expect(transcribeService.detectMediaFormat(buf)).toBe('mp3');
  });

  test('OGG header → ogg', () => {
    const buf = Buffer.from('4f67675300000000', 'hex');
    expect(transcribeService.detectMediaFormat(buf)).toBe('ogg');
  });

  test('null buffer → wav default', () => {
    expect(transcribeService.detectMediaFormat(null)).toBe('wav');
  });

  test('3-byte buffer (too short) → wav default', () => {
    expect(transcribeService.detectMediaFormat(Buffer.alloc(3))).toBe('wav');
  });

  test('zeros buffer → wav default', () => {
    expect(transcribeService.detectMediaFormat(Buffer.alloc(16))).toBe('wav');
  });
});

describe('Transcribe – TRANSCRIBE_LANGUAGES', () => {
  test('includes en-IN, hi-IN, ta-IN, te-IN, kn-IN, ml-IN', () => {
    const l = transcribeService.TRANSCRIBE_LANGUAGES;
    expect(l).toContain('en-IN');
    expect(l).toContain('hi-IN');
    expect(l).toContain('ta-IN');
    expect(l).toContain('te-IN');
    expect(l).toContain('kn-IN');
    expect(l).toContain('ml-IN');
  });

  test('includes at least 6 codes', () => {
    expect(transcribeService.TRANSCRIBE_LANGUAGES.length).toBeGreaterThanOrEqual(6);
  });
});

/* ═══════════════════════════════════════════════════
   SECTION E – agents/index.js: INTENT_DOMAIN_MAP full coverage
   ═══════════════════════════════════════════════════ */
const agentRegistry = require('../../services/agents');

describe('Agent Registry – INTENT_DOMAIN_MAP', () => {
  const map = agentRegistry.INTENT_DOMAIN_MAP;

  test('has at least 30 intent mappings', () => {
    expect(Object.keys(map).length).toBeGreaterThanOrEqual(30);
  });

  test('all agriculture intents map to agriculture', () => {
    const agriIntents = ['crop_advice', 'soil_management', 'weather_impact', 'irrigation',
      'pest_disease', 'farming_technique', 'seasonal_planning', 'fertilizer',
      'post_harvest', 'organic_farming'];
    for (const intent of agriIntents) {
      expect(map[intent]).toBe('agriculture');
    }
  });

  test('all market intents map to market', () => {
    const marketIntents = ['crop_prices', 'price_trend', 'mandi_info', 'sell_timing',
      'buyer_connection', 'supply_chain', 'msp_info', 'transport_logistics'];
    for (const intent of marketIntents) {
      expect(map[intent]).toBe('market');
    }
  });

  test('all scheme intents map to schemes', () => {
    const schemeIntents = ['scheme_eligibility', 'scheme_application', 'subsidy_info',
      'loan_info', 'insurance_claim', 'document_help', 'financial_aid', 'deadline_reminder'];
    for (const intent of schemeIntents) {
      expect(map[intent]).toBe('schemes');
    }
  });

  test('all health intents map to health', () => {
    const healthIntents = ['symptom_guidance', 'nutrition_advice', 'maternal_health',
      'child_health', 'first_aid', 'heat_prevention', 'health_scheme', 'facility_referral'];
    for (const intent of healthIntents) {
      expect(map[intent]).toBe('health');
    }
  });

  test('general intents map to general', () => {
    const generalIntents = ['greeting', 'general_question', 'digital_literacy',
      'app_help', 'weather_info', 'air_quality_info', 'unknown'];
    for (const intent of generalIntents) {
      expect(map[intent]).toBe('general');
    }
  });
});

describe('Agent Registry – resolveDomain', () => {
  test('unknown intent → general', () => {
    expect(agentRegistry.resolveDomain('nonexistent_intent')).toBe('general');
  });

  test('null/undefined intent → general', () => {
    expect(agentRegistry.resolveDomain(undefined)).toBe('general');
    expect(agentRegistry.resolveDomain(null)).toBe('general');
  });
});

describe('Agent Registry – getAgent', () => {
  test('each known domain returns agent with handle()', () => {
    const domains = ['agriculture', 'market', 'schemes', 'health', 'general'];
    for (const d of domains) {
      const agent = agentRegistry.getAgent(d);
      expect(agent).toBeDefined();
      expect(typeof agent.handle).toBe('function');
    }
  });

  test('unknown domain → general agent', () => {
    const agent = agentRegistry.getAgent('aliens');
    const general = agentRegistry.getAgent('general');
    expect(agent).toBe(general);
  });
});

describe('Agent Registry – listAgents', () => {
  test('lists all registered agents', () => {
    const agents = agentRegistry.listAgents();
    expect(agents.length).toBeGreaterThanOrEqual(6);
  });

  test('each agent has name and description', () => {
    const agents = agentRegistry.listAgents();
    for (const a of agents) {
      expect(a.name).toBeDefined();
      expect(a.description).toBeDefined();
    }
  });
});

/* ═══════════════════════════════════════════════════
   SECTION F – llm.js: generateResponse quad-fallback exhaustion
   ═══════════════════════════════════════════════════ */
const llm = require('../../services/llm');

describe('LLM – callNova message format', () => {
  test('callNova separates system and non-system messages', async () => {
    mockBedrockSend.mockResolvedValueOnce({
      body: Buffer.from(JSON.stringify({
        output: { message: { content: [{ text: 'Nova reply' }] } },
        usage: { inputTokens: 10, outputTokens: 5 },
      })),
    });
    const result = await llm.callNova([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ]);
    expect(result.content).toBe('Nova reply');
    expect(result.provider).toBe('nova-micro');
    expect(result.usage.total_tokens).toBe(15);
  });
});

describe('LLM – callBedrock Anthropic format', () => {
  test('callBedrock sends anthropic_version and returns content', async () => {
    mockBedrockSend.mockResolvedValueOnce({
      body: Buffer.from(JSON.stringify({
        content: [{ text: 'Claude reply' }],
        usage: { input_tokens: 8, output_tokens: 12 },
      })),
    });
    const result = await llm.callBedrock([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'What is KCC?' },
    ]);
    expect(result.content).toBe('Claude reply');
    expect(result.provider).toBe('bedrock-claude');
    expect(result.usage.total_tokens).toBe(20);
  });
});

describe('LLM – callGemini', () => {
  test('throws when GEMINI_API_KEY not set', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(llm.callGemini([{ role: 'user', content: 'hi' }])).rejects.toThrow('GEMINI_API_KEY');
  });

  test('returns content from Gemini on success', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini says hi' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
      }),
    });
    const result = await llm.callGemini([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Gemini says hi');
    expect(result.provider).toBe('gemini');
  });
});

describe('LLM – generateResponse full chain exhaustion', () => {
  test('throws 503 when all 4 providers fail', async () => {
    // Sarvam fails
    mockFetch.mockRejectedValueOnce(new Error('Sarvam down'));
    // Nova fails
    mockBedrockSend.mockRejectedValueOnce(new Error('Nova down'));
    // Bedrock fails
    mockBedrockSend.mockRejectedValueOnce(new Error('Bedrock down'));
    // Gemini fails
    mockFetch.mockRejectedValueOnce(new Error('Gemini down'));

    await expect(
      llm.generateResponse([{ role: 'user', content: 'test' }])
    ).rejects.toThrow(/All LLM providers failed/);
  });
});

/* ═══════════════════════════════════════════════════
   SECTION G – Nova ANALYSIS_PROMPT existence
   ═══════════════════════════════════════════════════ */
describe('Nova – ANALYSIS_PROMPT', () => {
  test('exported and non-empty', () => {
    expect(nova.ANALYSIS_PROMPT).toBeDefined();
    expect(nova.ANALYSIS_PROMPT.length).toBeGreaterThan(100);
  });

  test('mentions all 5 domains', () => {
    expect(nova.ANALYSIS_PROMPT).toContain('agriculture');
    expect(nova.ANALYSIS_PROMPT).toContain('market');
    expect(nova.ANALYSIS_PROMPT).toContain('schemes');
    expect(nova.ANALYSIS_PROMPT).toContain('health');
    expect(nova.ANALYSIS_PROMPT).toContain('general');
  });

  test('instructs JSON-only output', () => {
    expect(nova.ANALYSIS_PROMPT).toContain('JSON');
  });
});
