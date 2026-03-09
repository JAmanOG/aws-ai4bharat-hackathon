type RawComponent = {
  status?: string;
  model?: string;
  region?: string;
};

type RawPipelineHealth = {
  components?: Record<string, RawComponent>;
  agents?: string[];
  healthy?: boolean;
  pipeline?: string;
};

export type PipelineStatusItem = {
  id: string;
  label: string;
  category: string;
  status: string;
  statusLabel: string;
  detail: string;
};

const COMPONENT_META: Record<string, { label: string; category: string }> = {
  stt_amazon_transcribe: { label: "Amazon Transcribe", category: "Voice Input" },
  stt_sarvam_fallback: { label: "Sarvam STT Fallback", category: "Voice Input" },
  nova_router: { label: "Nova Router", category: "AI Routing" },
  bedrock_llm: { label: "Bedrock LLM", category: "AI Routing" },
  gemini_fallback: { label: "Gemini Fallback", category: "AI Routing" },
  sarvam_tts: { label: "Sarvam TTS", category: "Voice Output" },
  sarvam_translate: { label: "Sarvam Translate", category: "Voice Output" },
  memory_dynamodb: { label: "DynamoDB Memory", category: "Storage" },
};

function humanizeKey(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "unknown").trim().toLowerCase();
  return status || "unknown";
}

function buildStatusLabel(status: string) {
  if (status === "available") return "Available";
  if (status === "missing_key") return "Missing Key";
  if (status === "unknown") return "Unknown";
  return humanizeKey(status);
}

function buildDetail(component: RawComponent | undefined, status: string) {
  if (component?.model) return component.model;
  if (component?.region) return component.region;
  if (status === "missing_key") return "Environment key not configured";
  return "No extra metadata reported";
}

export function buildPipelineStatusItems(payload: RawPipelineHealth | null | undefined) {
  const components = payload?.components ?? {};

  return Object.entries(components)
    .map(([id, component]) => {
      const meta = COMPONENT_META[id] ?? { label: humanizeKey(id), category: "Other" };
      const status = normalizeStatus(component?.status);

      return {
        id,
        label: meta.label,
        category: meta.category,
        status,
        statusLabel: buildStatusLabel(status),
        detail: buildDetail(component, status),
      } satisfies PipelineStatusItem;
    })
    .sort((left, right) =>
      left.category.localeCompare(right.category) || left.label.localeCompare(right.label),
    );
}

export function buildPipelineCategories(items: PipelineStatusItem[]) {
  return ["All", ...Array.from(new Set(items.map((item) => item.category)))];
}

export function countAvailableComponents(items: PipelineStatusItem[]) {
  return items.filter((item) => item.status === "available").length;
}

export function countDegradedComponents(items: PipelineStatusItem[]) {
  return items.filter((item) => item.status !== "available").length;
}
