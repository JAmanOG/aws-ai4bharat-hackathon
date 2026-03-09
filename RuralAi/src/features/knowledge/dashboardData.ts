export function normalizeFacts(factsRaw: any): Record<string, string> {
  if (!factsRaw) return {};
  if (Array.isArray(factsRaw)) {
    return factsRaw.reduce((acc: Record<string, string>, fact: any) => {
      if (fact?.factKey) acc[fact.factKey] = String(fact.factValue ?? "");
      return acc;
    }, {});
  }
  if (typeof factsRaw === "object") {
    return Object.entries(factsRaw).reduce((acc: Record<string, string>, [key, value]) => {
      if (value != null) acc[key] = String(value);
      return acc;
    }, {});
  }
  return {};
}

export function buildVoiceLearningProfile(
  factsMap: Record<string, string>,
  history: Array<{ role: string; text: string }>,
  lastCommand: any,
  voiceLanguage: string,
  courses: any[],
) {
  const recentUserTexts = history
    .filter((entry) => entry.role === "user")
    .slice(-6)
    .map((entry) => entry.text);
  const recentTopics = extractRecentTopics([
    ...recentUserTexts,
    lastCommand?.transcript ?? "",
    lastCommand?.responseTextEnglish ?? "",
  ]);
  const goals = uniqueStrings([
    ...toStringArray((factsMap.crops ?? "").split(",")),
    ...toStringArray((factsMap.livestock ?? "").split(",")),
    ...recentTopics,
  ]).slice(0, 4);
  const interests = uniqueStrings([
    factsMap.irrigation_type,
    factsMap.income_source,
    factsMap.education_level,
    ...recentTopics,
    ...toStringArray(courses.map((course: any) => course?.category)),
  ]).slice(0, 6);

  return {
    learningGoals: goals,
    interests,
    preferredLanguage: normalizeLanguageCode(factsMap.primary_language || factsMap.preferred_language || voiceLanguage),
    location: {
      state: factsMap.location_state || "",
      district: factsMap.location_district || "",
    },
  };
}

export function deriveLearningQuery(profileData: any, courses: any[]) {
  const candidates = [
    ...(toStringArray(profileData?.learningGoals)),
    ...(toStringArray(profileData?.interests)),
    ...toStringArray(courses?.map((item: any) => item?.title ?? item?.category)),
  ];

  return candidates.map((candidate) => normalizeSearchQuery(candidate)).find(Boolean);
}

export function buildKnowledgeBanner(profileData: any, nextStep?: string, query?: string) {
  if (nextStep) return nextStep;
  const goal = toStringArray(profileData?.learningGoals)[0] ?? toStringArray(profileData?.interests)[0];
  if (goal) return `Showing resources and groups aligned to your learning goal: ${goal}.`;
  if (query) return `Showing real resources for ${query}.`;
  return "Add learning goals in your profile to unlock personalized resources and peer groups.";
}

export function rankKnowledgeItems(items: any[], profileData: any) {
  const preferredLanguage = String(profileData?.preferredLanguage ?? "").toLowerCase();
  const profileTerms = new Set(
    [
      ...toStringArray(profileData?.learningGoals),
      ...toStringArray(profileData?.interests),
    ].map((value) => value.toLowerCase()),
  );

  return [...items].sort((a, b) => scoreKnowledgeItem(b, profileTerms, preferredLanguage) - scoreKnowledgeItem(a, profileTerms, preferredLanguage));
}

export function selectRelevantPeerGroups(allGroups: any[], profileData: any) {
  const profileTerms = [
    ...toStringArray(profileData?.learningGoals),
    ...toStringArray(profileData?.interests),
  ].map((value) => value.toLowerCase());
  const preferredLanguage = String(profileData?.preferredLanguage ?? "").toLowerCase();
  const state = String(profileData?.location?.state ?? "").toLowerCase();
  const merged = dedupeGroups(allGroups);

  return merged
    .map((group) => ({ group, score: scorePeerGroup(group, profileTerms, preferredLanguage, state) }))
    .filter(({ score }) => profileTerms.length > 0 && score > 0)
    .sort((a, b) => b.score - a.score || getGroupMemberCount(b.group) - getGroupMemberCount(a.group))
    .map(({ group }) => group);
}

export function getGroupMemberCount(group: any) {
  if (typeof group?.member_count === "number") return group.member_count;
  if (Array.isArray(group?.members)) return group.members.length;
  return Number(group?.members ?? 0);
}

function extractRecentTopics(texts: string[]) {
  const stopWords = new Set([
    "show", "tell", "give", "open", "search", "find", "watch", "read", "video", "videos", "article", "articles",
    "youtube", "live", "stream", "streams", "please", "me", "for", "about", "need", "want", "help", "best",
  ]);

  return uniqueStrings(
    texts
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u097f\s]/g, " ")
      .split(/\s+/)
      .filter((word) => isUsableTopic(word) && !stopWords.has(word)),
  ).slice(0, 6);
}

function normalizeLanguageCode(value?: string) {
  const lang = String(value ?? "").trim().toLowerCase();
  if (!lang) return "hi";
  return lang.includes("-") ? lang.split("-")[0] : lang;
}

function scoreKnowledgeItem(item: any, profileTerms: Set<string>, preferredLanguage: string) {
  const text = [item?.title, item?.description, item?.reason, item?.category].filter(Boolean).join(" ").toLowerCase();
  let score = 0;

  for (const term of profileTerms) {
    if (term && text.includes(term)) score += 3;
  }
  if (preferredLanguage && String(item?.language ?? "").toLowerCase() === preferredLanguage) score += 2;
  return score;
}

function scorePeerGroup(group: any, profileTerms: string[], preferredLanguage: string, state: string) {
  const text = [
    group?.group_name,
    group?.name,
    group?.description,
    group?.category,
    ...(Array.isArray(group?.goals) ? group.goals : []),
  ].filter(Boolean).join(" ").toLowerCase();

  let score = 0;
  for (const term of profileTerms) {
    if (text.includes(term)) score += 4;
  }
  if (preferredLanguage && String(group?.language ?? "").toLowerCase() === preferredLanguage) score += 2;
  if (state && String(group?.location?.state ?? "").toLowerCase() === state) score += 2;
  score += Math.min(getGroupMemberCount(group), 20) * 0.1;
  return score;
}

function dedupeGroups(groups: any[]) {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const key = String(group?.group_id ?? group?.groupId ?? group?.id ?? group?.name ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toStringArray(values: any) {
  const raw = Array.isArray(values) ? values : [];
  return raw.flatMap((value) => String(value ?? "").split(",")).map((value) => value.trim()).filter(Boolean);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) return false;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isUsableTopic(word: string) {
  if (!word || word.length < 3 || word.length > 40) return false;
  if (/^(.)\1{5,}$/i.test(word)) return false;
  return true;
}

function normalizeSearchQuery(value: string) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > 80) return "";
  if (/^(.)\1{5,}$/i.test(cleaned.replace(/\s/g, ""))) return "";
  return cleaned;
}
