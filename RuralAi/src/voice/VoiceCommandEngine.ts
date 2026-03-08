import { normalizeMarketCropName, normalizeMarketStateName } from "../utils/market";

/**
 * Voice Command Engine — maps AI pipeline output (domain/intent/entities)
 * to concrete app actions: navigation, data fetching, UI visualization.
 *
 * This is the brain that translates "mujhe gehu ka bhav batao" into
 * navigating to market prices and showing wheat data.
 */

/* ────────── Types ────────── */

export interface VoiceCommand {
  domain: string;
  intent: string;
  entities: Record<string, string>;
  complexity: string;
  transcript?: string;
  responseText: string;
  responseTextEnglish?: string;
  audioBase64?: string;
  metadata?: {
    action?: string;
    ui_target?: string;
    roomId?: string;
    roomTitle?: string;
    topic?: string;
    [key: string]: unknown;
  };
}

export type CommandAction =
  | { type: "navigate"; screen: string; params?: Record<string, any> }
  | { type: "visualize"; visualization: VisualizationCard }
  | { type: "action"; fn: string; args?: Record<string, any> }
  | { type: "speak"; text: string }
  | { type: "multi"; actions: CommandAction[] };

export interface VisualizationCard {
  kind:
    | "price_chart"
    | "scheme_list"
    | "weather_info"
    | "crop_advisory"
    | "savings_plan"
    | "course_list"
    | "insurance_status"
    | "transport_options"
    | "peer_groups"
    | "practice_log"
    | "eligibility_score"
    | "order_list"
    | "generic_info"
    | "error";
  title: string;
  subtitle?: string;
  data: any;
  entities?: Record<string, string>;
}

/* ────────── Intent → Navigation mapping ────────── */

const NAVIGATION_MAP: Record<string, Record<string, string>> = {
  agriculture: {
    crop_prices: "AgriMarket",
    mandi_prices: "MarketPrices",
    price_trend: "AgriMarket",
    crop_advisory: "PracticeLog",
    pest_alert: "Alerts",
    weather: "AgriMarket",
    soil_health: "PracticeLog",
    irrigation: "PracticeLog",
    farming_technique: "KnowledgeDashboard",
    default: "AgriMarket",
  },
  market: {
    crop_prices: "AgriMarket",
    mandi_info: "MarketPrices",
    price_trend: "AgriMarket",
    sell_timing: "AgriMarket",
    buyers: "Orders",
    buyer_connection: "Orders",
    msp_info: "AgriMarket",
    create_listing: "Orders",
    orders: "Orders",
    supply_chain: "Orders",
    listing_management: "Orders",
    contact_buyer: "Orders",
    bargaining: "BargainingGroups",
    transport: "Logistics",
    default: "AgriMarket",
  },
  schemes: {
    eligibility: "Eligibility",
    loan: "Eligibility",
    insurance: "InsuranceClaims",
    subsidy: "SchemesList",
    pm_kisan: "SchemesList",
    scheme_info: "SchemesList",
    scheme_list: "SchemesList",
    savings: "SavingsNudge",
    default: "SchemesList",
  },
  health: {
    symptom_guidance: "SymptomChecker",
    medical_report_analysis: "HealthDashboard",
    health_platform_help: "HealthDashboard",
    health_scheme: "HealthDashboard",
    facility_referral: "HealthDashboard",
    symptoms: "SymptomChecker",
    nutrition: "SymptomChecker",
    first_aid: "SymptomChecker",
    default: "SymptomChecker",
  },
  finance: {
    savings: "SavingsNudge",
    loan: "Eligibility",
    insurance: "InsuranceClaims",
    financial_literacy: "SavingsNudge",
    default: "SavingsNudge",
  },
  knowledge: {
    courses: "KnowledgeDashboard",
    training: "KnowledgeDashboard",
    peer_groups: "KnowledgeDashboard",
    digital_literacy: "KnowledgeDashboard",
    default: "KnowledgeDashboard",
  },
  logistics: {
    transport: "Logistics",
    bargaining: "BargainingGroups",
    default: "Logistics",
  },
  general: {},
};

/* ────────── Visualization mapping ────────── */

const VISUALIZATION_MAP: Record<string, Record<string, string>> = {
  agriculture: {
    crop_prices: "price_chart",
    mandi_prices: "price_chart",
    price_trend: "price_chart",
    weather: "weather_info",
    crop_advisory: "crop_advisory",
    pest_alert: "crop_advisory",
    default: "crop_advisory",
  },
  market: {
    crop_prices: "price_chart",
    mandi_info: "price_chart",
    price_trend: "price_chart",
    buyers: "order_list",
    buyer_connection: "order_list",
    create_listing: "order_list",
    orders: "order_list",
    supply_chain: "order_list",
    listing_management: "order_list",
    contact_buyer: "order_list",
    bargaining: "peer_groups",
    transport: "transport_options",
    default: "price_chart",
  },
  schemes: {
    eligibility: "eligibility_score",
    insurance: "insurance_status",
    savings: "savings_plan",
    default: "scheme_list",
  },
  finance: {
    savings: "savings_plan",
    insurance: "insurance_status",
    loan: "eligibility_score",
    default: "savings_plan",
  },
  knowledge: {
    courses: "course_list",
    training: "course_list",
    peer_groups: "peer_groups",
    default: "course_list",
  },
  logistics: {
    transport: "transport_options",
    bargaining: "peer_groups",
    default: "transport_options",
  },
  general: {
    weather_info: "weather_info",
    air_quality_info: "weather_info",
    default: "generic_info",
  },
};

function normalizeIntentKey(intent?: string): string {
  const key = intent?.toLowerCase().replace(/\s+/g, "_") ?? "default";
  if (key === "crop_price_query" || key === "crop_price" || /crop.*price/.test(key)) return "crop_prices";
  if (key === "mandi_price_query" || key === "mandi_prices" || /mandi.*(price|info)/.test(key)) return "mandi_info";
  if (key === "buyer_requests" || key === "show_buyers") return "buyer_connection";
  if (key === "market_orders" || key === "order_status" || key === "show_orders") return "orders";
  if (key === "listing_update" || key === "cancel_listing" || key === "mark_sold") return "listing_management";
  if (key === "buyer_contact" || key === "connect_buyer") return "contact_buyer";
  if (key === "scheme_eligibility" || key === "eligibility_check") return "eligibility";
  if (
    key === "loan_info"
    || key === "loan_information"
    || key === "loan_details"
    || key === "loan"
    || /crop.*loan/.test(key)
  ) return "loan";
  if (
    key === "insurance_claim"
    || key === "insurance_information"
    || key === "insurance_status"
    || key === "insurance_details"
    || key === "insurance"
  ) return "insurance";
  if (
    key === "financial_aid"
    || key === "savings_plan"
    || key === "saving_plan"
    || key === "financial_overview"
    || key === "profit_cost"
    || key === "savings"
  ) return "savings";
  return key;
}

/* ────────── Engine ────────── */

/**
 * Resolve a voice command to one or more app actions.
 */
export function resolveCommand(cmd: VoiceCommand): CommandAction {
  const { domain, intent, entities, responseText, responseTextEnglish, audioBase64, metadata } = cmd;

  const domainNav = NAVIGATION_MAP[domain];
  const domainViz = VISUALIZATION_MAP[domain];
  const knowledgeResourceTarget = getKnowledgeResourceTarget(cmd);

  // Find the best matching intent key
  const intentKey = normalizeIntentKey(intent);

  // Determine target screen
  const screen = knowledgeResourceTarget?.screen
    ?? (typeof metadata?.ui_target === "string" ? metadata.ui_target : null)
    ?? getVoiceRoomScreen(cmd)
    ?? domainNav?.[intentKey]
    ?? domainNav?.["default"]
    ?? NAVIGATION_MAP.general?.["default"]
    ?? null;

  // Determine visualization kind
  const vizKind =
    domainViz?.[intentKey] ??
    domainViz?.["default"] ??
    "generic_info";

  // Build visualization card
  const visualization: VisualizationCard = {
    kind: vizKind as VisualizationCard["kind"],
    title: buildTitle(domain, intent, entities),
    subtitle: responseTextEnglish ?? responseText,
    data: {
      responseText,
      responseTextEnglish,
      audioBase64,
      entities,
      domain,
      intent,
      metadata,
    },
    entities,
  };

  // Multi action: navigate + show visualization
  const actions: CommandAction[] = [];

  // Always visualize (this renders the dynamic card)
  actions.push({ type: "visualize", visualization });

  // If we have a screen target, also navigate
  if (screen) {
    const params = knowledgeResourceTarget?.params ?? buildNavParams(screen, entities, intentKey);
    actions.push({ type: "navigate", screen, params });
  }

  return actions.length === 1 ? actions[0] : { type: "multi", actions };
}

/**
 * Check if a command should auto-navigate (vs just showing inline viz)
 */
export function shouldAutoNavigate(cmd: VoiceCommand): boolean {
  if (getKnowledgeResourceTarget(cmd)) return true;
  if (typeof cmd.metadata?.ui_target === "string" && cmd.metadata.ui_target.length > 0) return true;
  if (cmd.metadata?.action === "create_room" || cmd.metadata?.action === "join_room") return true;
  const intentKey = normalizeIntentKey(cmd.intent);
  if (
    (cmd.domain === "schemes" || cmd.domain === "finance")
    && ["eligibility", "loan", "insurance", "savings"].includes(intentKey)
  ) {
    return true;
  }
  if (
    cmd.domain === "health" &&
    (
      intentKey === "symptom_guidance" ||
      intentKey === "medical_report_analysis" ||
      intentKey === "health_platform_help" ||
      intentKey === "health_scheme" ||
      intentKey === "facility_referral"
    )
  ) {
    return true;
  }
  if (
    cmd.domain === "market" &&
    ["buyer_connection", "create_listing", "orders", "listing_management", "contact_buyer", "supply_chain"].includes(intentKey)
  ) {
    return true;
  }
  // Complex queries or explicit "show me" / "take me to" should navigate
  if (cmd.complexity === "complex") return true;
  // Market/scheme queries with specific entities should navigate
  if (cmd.entities?.crop || cmd.entities?.scheme_name) return true;
  // Simple general chat should stay inline
  if (cmd.domain === "general") return false;
  return cmd.complexity !== "simple";
}

/**
 * Get the screen name for a domain/intent combo
 */
export function getScreenForIntent(domain: string, intent: string): string | null {
  const intentKey = normalizeIntentKey(intent);
  return NAVIGATION_MAP[domain]?.[intentKey] ?? NAVIGATION_MAP[domain]?.["default"] ?? null;
}

/* ────────── Helpers ────────── */

function buildTitle(domain: string, intent: string, entities: Record<string, string>): string {
  const crop = entities?.crop;
  const location = entities?.location;

  switch (domain) {
    case "agriculture":
    case "market":
      if (intent?.includes("listing") || intent?.includes("buyer") || intent?.includes("order") || intent?.includes("supply_chain")) {
        return "My Listings & Market";
      }
      if (crop && location) return `${capitalize(crop)} prices in ${location}`;
      if (crop) return `${capitalize(crop)} Market Info`;
      if (intent?.includes("weather")) return "Weather Advisory";
      if (intent?.includes("pest")) return "Pest Alert";
      return "Market Intelligence";
    case "schemes":
      if (entities?.scheme_name) return entities.scheme_name;
      if (intent?.includes("insurance")) return "Insurance & Claims";
      if (intent?.includes("eligibility") || intent?.includes("loan")) return "Loan Eligibility";
      if (intent?.includes("financial") || intent?.includes("saving")) return "Financial Overview";
      return "Government Schemes";
    case "finance":
      if (intent?.includes("saving")) return "Financial Overview";
      if (intent?.includes("insurance")) return "Insurance & Claims";
      if (intent?.includes("loan")) return "Loan Eligibility";
      return "Financial Overview";
    case "knowledge":
      if (intent?.includes("course")) return "Available Courses";
      if (intent?.includes("peer")) return "Peer Groups";
      return "Learning Hub";
    case "logistics":
      if (intent?.includes("transport")) return "Transport Options";
      return "Logistics";
    case "health":
      if (intent?.includes("symptom")) return "AI Doctor Screening";
      if (intent?.includes("medical_report") || intent?.includes("report") || intent?.includes("insight")) {
        return "Medical Report Insights";
      }
      if (intent?.includes("health_platform_help")) return "AI Health Screening";
      if (intent?.includes("scheme")) return "Health Schemes";
      if (intent?.includes("facility") || intent?.includes("referral")) return "Consult Doctors";
      return "Health Advisory";
    case "general":
      if (intent?.includes("air_quality") || intent?.includes("aqi")) {
        return location ? `AQI in ${location}` : "Air Quality Update";
      }
      if (intent?.includes("weather")) {
        return location ? `Weather in ${location}` : "Weather Update";
      }
      if (intent?.includes("app_help")) return "App Help";
      return "AI Response";
    default:
      return "AI Response";
  }
}

function buildNavParams(screen: string, entities: Record<string, string>, intent?: string): Record<string, any> {
  const params: Record<string, any> = {};
  if (entities?.crop) {
    params.crop = normalizeMarketCropName(entities.crop, entities.crop);
  }
  if (entities?.location) {
    params.location = normalizeMarketStateName(entities.location) ?? entities.location;
  }
  if (entities?.scheme_name) params.schemeName = entities.scheme_name;
  if (entities?.roomId) params.roomId = entities.roomId;
  if (entities?.room_id) params.roomId = entities.room_id;

  // Screen-specific param mapping
  switch (screen) {
    case "AgriMarket":
      // Pass tab + compareCrop so the screen can react
      if (entities?.tab) params.tab = entities.tab;
      if (entities?.compare_crop || entities?.compareCrop) {
        const compareCrop = entities.compare_crop ?? entities.compareCrop;
        params.compareCrop = normalizeMarketCropName(compareCrop, compareCrop);
      }
      // Infer tab from intent
      if (!params.tab && intent) {
        if (/trend|history|historical/.test(intent)) params.tab = "historical";
      }
      break;
    case "MarketPrices":
      params.moduleTitle = "AGRICULTURE";
      break;
    case "Orders":
      if (entities?.crop) {
        params.crop = normalizeMarketCropName(entities.crop, entities.crop);
      }
      if (entities?.location) {
        params.location = normalizeMarketStateName(entities.location) ?? entities.location;
      }
      break;
    case "SchemeDetail":
      if (entities?.scheme_id) params.schemeId = entities.scheme_id;
      break;
    case "CourseDetail":
      if (entities?.course_id) params.courseId = entities.course_id;
      break;
    case "VoiceRoom":
      if (entities?.roomId) params.roomId = entities.roomId;
      if (entities?.room_id) params.roomId = entities.room_id;
      break;
  }

  return params;
}

function getVoiceRoomScreen(cmd: VoiceCommand): string | null {
  const action = cmd.metadata?.action;
  if (action === "create_room" || action === "join_room") {
    return cmd.metadata?.roomId ? "VoiceRoom" : "VoiceRooms";
  }
  return null;
}

function getKnowledgeResourceTarget(cmd: VoiceCommand): { screen: "KnowledgeResources"; params?: Record<string, any> } | null {
  const transcript = String(cmd.transcript ?? "").toLowerCase();
  const combined = `${cmd.domain} ${cmd.intent} ${transcript}`;
  const asksForKnowledge =
    /knowledge|learn|learning|course|courses|training|article|articles|video|videos|youtube|live|stream|streams/.test(combined);
  const asksForResourceScreen =
    /article|articles|video|videos|youtube|resources|live|stream|streams|course.*article|article.*course/.test(combined);

  if (!asksForKnowledge || !asksForResourceScreen) return null;

  let initialTab: "all" | "videos" | "articles" = "all";
  if (/video|videos|youtube|live|stream|streams/.test(combined) && !/article|articles/.test(combined)) initialTab = "videos";
  if (/article|articles/.test(combined) && !/video|videos|youtube/.test(combined)) initialTab = "articles";

  const query = extractKnowledgeQuery(transcript, initialTab);
  const language = String((cmd.metadata as any)?.languageCode ?? "").trim();

  return {
    screen: "KnowledgeResources",
    params: {
      initialTab,
      ...(query ? { query } : {}),
      ...(language ? { language } : {}),
    },
  };
}

function extractKnowledgeQuery(transcript: string, tab: "all" | "videos" | "articles") {
  const cleaned = transcript
    .replace(/\b(open|show|give|tell|take|find|search|for|me|please|watch|read|learning|knowledge|resources|resource|youtube|videos?|articles?|courses?|live|stream|streams)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return tab === "articles" ? "organic farming articles" : tab === "videos" ? "organic farming videos" : "organic farming";
  }
  return cleaned;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
