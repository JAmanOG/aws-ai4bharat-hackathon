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
  responseText: string;
  responseTextEnglish?: string;
  audioBase64?: string;
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
    msp_info: "AgriMarket",
    create_listing: "CreateListing",
    orders: "Orders",
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
    orders: "order_list",
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
};

/* ────────── Engine ────────── */

/**
 * Resolve a voice command to one or more app actions.
 */
export function resolveCommand(cmd: VoiceCommand): CommandAction {
  const { domain, intent, entities, responseText, responseTextEnglish, audioBase64 } = cmd;

  const domainNav = NAVIGATION_MAP[domain];
  const domainViz = VISUALIZATION_MAP[domain];

  // Find the best matching intent key
  const intentKey = intent?.toLowerCase().replace(/\s+/g, "_") ?? "default";

  // Determine target screen
  const screen =
    domainNav?.[intentKey] ??
    domainNav?.["default"] ??
    NAVIGATION_MAP.general?.["default"] ??
    null;

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
    },
    entities,
  };

  // Multi action: navigate + show visualization
  const actions: CommandAction[] = [];

  // Always visualize (this renders the dynamic card)
  actions.push({ type: "visualize", visualization });

  // If we have a screen target, also navigate
  if (screen) {
    const params = buildNavParams(screen, entities);
    actions.push({ type: "navigate", screen, params });
  }

  return actions.length === 1 ? actions[0] : { type: "multi", actions };
}

/**
 * Check if a command should auto-navigate (vs just showing inline viz)
 */
export function shouldAutoNavigate(cmd: VoiceCommand): boolean {
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
  const intentKey = intent?.toLowerCase().replace(/\s+/g, "_") ?? "default";
  return NAVIGATION_MAP[domain]?.[intentKey] ?? NAVIGATION_MAP[domain]?.["default"] ?? null;
}

/* ────────── Helpers ────────── */

function buildTitle(domain: string, intent: string, entities: Record<string, string>): string {
  const crop = entities?.crop;
  const location = entities?.location;

  switch (domain) {
    case "agriculture":
    case "market":
      if (crop && location) return `${capitalize(crop)} prices in ${location}`;
      if (crop) return `${capitalize(crop)} Market Info`;
      if (intent?.includes("weather")) return "Weather Advisory";
      if (intent?.includes("pest")) return "Pest Alert";
      return "Market Intelligence";
    case "schemes":
      if (entities?.scheme_name) return entities.scheme_name;
      if (intent?.includes("insurance")) return "Insurance Claims";
      if (intent?.includes("eligibility")) return "Eligibility Check";
      return "Government Schemes";
    case "finance":
      if (intent?.includes("savings")) return "Savings Plan";
      if (intent?.includes("insurance")) return "Insurance";
      return "Financial Overview";
    case "knowledge":
      if (intent?.includes("course")) return "Available Courses";
      if (intent?.includes("peer")) return "Peer Groups";
      return "Learning Hub";
    case "logistics":
      if (intent?.includes("transport")) return "Transport Options";
      return "Logistics";
    case "health":
      return "Health Advisory";
    default:
      return "AI Response";
  }
}

function buildNavParams(screen: string, entities: Record<string, string>): Record<string, any> {
  const params: Record<string, any> = {};
  if (entities?.crop) params.crop = entities.crop;
  if (entities?.location) params.location = entities.location;
  if (entities?.scheme_name) params.schemeName = entities.scheme_name;

  // Screen-specific param mapping
  switch (screen) {
    case "MarketPrices":
      params.moduleTitle = "AGRICULTURE";
      break;
    case "SchemeDetail":
      if (entities?.scheme_id) params.schemeId = entities.scheme_id;
      break;
    case "CourseDetail":
      if (entities?.course_id) params.courseId = entities.course_id;
      break;
  }

  return params;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
