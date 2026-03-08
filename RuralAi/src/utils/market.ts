const MARKET_CROPS = [
  "wheat",
  "rice",
  "tomato",
  "onion",
  "potato",
  "brinjal",
  "soybean",
  "cotton",
  "sugarcane",
  "mustard",
  "chana",
  "maize",
  "sunflower",
  "groundnut",
  "turmeric",
  "cumin",
  "jowar",
  "bajra",
  "arhar",
  "urad",
  "moong",
  "barley",
  "copra",
  "pepper",
  "cardamom",
  "jute",
  "okra",
] as const;

export const MARKET_CROP_ALIASES: Record<string, string> = {
  sunflowers: "sunflower",
  tomatoes: "tomato",
  potatoes: "potato",
  onions: "onion",
  soybeans: "soybean",
  groundnuts: "groundnut",
  gehu: "wheat",
  gehun: "wheat",
  chawal: "rice",
  dhan: "rice",
  paddy: "rice",
  pyaaz: "onion",
  pyaz: "onion",
  kanda: "onion",
  aloo: "potato",
  aaloo: "potato",
  brinjal: "brinjal",
  brinjals: "brinjal",
  eggplant: "brinjal",
  eggplants: "brinjal",
  baingan: "brinjal",
  baigan: "brinjal",
  bagan: "brinjal",
  begun: "brinjal",
  began: "brinjal",
  bengan: "brinjal",
  tamatar: "tomato",
  sarson: "mustard",
  sarso: "mustard",
  surajmukhi: "sunflower",
  makka: "maize",
  makki: "maize",
  corn: "maize",
  ganna: "sugarcane",
  moongfali: "groundnut",
  mungfali: "groundnut",
  peanut: "groundnut",
  peanuts: "groundnut",
  haldi: "turmeric",
  jeera: "cumin",
  jira: "cumin",
  dal: "arhar",
  toor: "arhar",
  tur: "arhar",
  kapas: "cotton",
  kapaan: "cotton",
  jau: "barley",
  elaichi: "cardamom",
  mirch: "pepper",
  mirchi: "pepper",
  nariyal: "copra",
  coconut: "copra",
  gram: "chana",
  chickpea: "chana",
  chickpeas: "chana",
  ragi: "bajra",
  millet: "bajra",
  sorghum: "jowar",
  lentil: "moong",
  lentils: "moong",
  okras: "okra",
  bhindi: "okra",
  bhendi: "okra",
  "lady finger": "okra",
  "ladies finger": "okra",
};

const MARKET_CROP_SET = new Set<string>(MARKET_CROPS);

const MARKET_STATE_ALIASES: Record<string, string> = {
  ap: "Andhra Pradesh",
  "andhra pradesh": "Andhra Pradesh",
  ar: "Arunachal Pradesh",
  "arunachal pradesh": "Arunachal Pradesh",
  as: "Assam",
  assam: "Assam",
  br: "Bihar",
  bihar: "Bihar",
  cg: "Chhattisgarh",
  ct: "Chhattisgarh",
  chhattisgarh: "Chhattisgarh",
  ga: "Goa",
  goa: "Goa",
  gj: "Gujarat",
  gujarat: "Gujarat",
  hr: "Haryana",
  haryana: "Haryana",
  hp: "Himachal Pradesh",
  "himachal pradesh": "Himachal Pradesh",
  jh: "Jharkhand",
  jharkhand: "Jharkhand",
  ka: "Karnataka",
  karnataka: "Karnataka",
  kl: "Kerala",
  kerala: "Kerala",
  mp: "Madhya Pradesh",
  "madhya pradesh": "Madhya Pradesh",
  mh: "Maharashtra",
  maha: "Maharashtra",
  maharashtra: "Maharashtra",
  maharastra: "Maharashtra",
  mn: "Manipur",
  manipur: "Manipur",
  ml: "Meghalaya",
  meghalaya: "Meghalaya",
  mz: "Mizoram",
  mizoram: "Mizoram",
  nl: "Nagaland",
  nagaland: "Nagaland",
  od: "Odisha",
  or: "Odisha",
  odisha: "Odisha",
  orissa: "Odisha",
  pb: "Punjab",
  punjab: "Punjab",
  rj: "Rajasthan",
  rajasthan: "Rajasthan",
  sk: "Sikkim",
  sikkim: "Sikkim",
  tn: "Tamil Nadu",
  "tamil nadu": "Tamil Nadu",
  tg: "Telangana",
  ts: "Telangana",
  telangana: "Telangana",
  tr: "Tripura",
  tripura: "Tripura",
  up: "Uttar Pradesh",
  "uttar pradesh": "Uttar Pradesh",
  uk: "Uttarakhand",
  uttarakhand: "Uttarakhand",
  wb: "West Bengal",
  "west bengal": "West Bengal",
  dl: "Delhi",
  delhi: "Delhi",
};

function sanitizeMarketText(raw?: string) {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeMarketCropName(raw?: string, fallback = "wheat"): string {
  const name = sanitizeMarketText(raw);
  if (!name) return fallback;
  if (MARKET_CROP_SET.has(name)) return name;
  if (MARKET_CROP_ALIASES[name]) return MARKET_CROP_ALIASES[name];

  const singular = name.replace(/e?s$/, "");
  if (MARKET_CROP_SET.has(singular)) return singular;
  if (MARKET_CROP_ALIASES[singular]) return MARKET_CROP_ALIASES[singular];

  const prefixMatch = Array.from(MARKET_CROP_SET).find(
    (crop) => crop.startsWith(name) || name.startsWith(crop)
  );
  return prefixMatch ?? name;
}

export function formatMarketCropLabel(raw?: string) {
  const normalized = normalizeMarketCropName(raw, "");
  if (!normalized) return "";
  return titleCase(normalized);
}

export function normalizeMarketStateName(raw?: string): string | undefined {
  const name = sanitizeMarketText(raw);
  if (!name) return undefined;
  return MARKET_STATE_ALIASES[name];
}
