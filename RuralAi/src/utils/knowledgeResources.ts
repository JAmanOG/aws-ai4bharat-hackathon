export type ResourceKind = "official" | "video" | "article" | "live";

export interface KnowledgeResource {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  tag?: string;
  secondaryTag?: string;
  ctaLabel: string;
  url: string;
  kind: ResourceKind;
  thumbnail?: string;
}

export interface KnowledgeLiveRoom {
  id: string;
  title: string;
  host: string;
  listeners: string;
  roomId?: string;
  url?: string;
  verified?: boolean;
}

type BuilderInput = {
  courses?: any[];
  govtCourses?: any[];
  recommendations?: any;
  learningProfile?: any;
  voiceRooms?: any[];
  externalSearch?: any;
  strictExternalOnly?: boolean;
  strictRealDataOnly?: boolean;
};

const DEFAULT_VIDEOS = [
  "Organic Farming Techniques",
  "Pest Management Strategies",
  "Drip Irrigation Basics",
];

const DEFAULT_ARTICLES = [
  "Guide to Dairy Cattle Health",
  "Composting for Beginners",
  "How to Improve Soil Health Naturally",
];

const DEFAULT_OFFICIAL = [
  {
    id: "pmkvy",
    title: "Rural Economics & Finance",
    subtitle: "PMKVY • 8 lessons",
    meta: "Government skill training source",
    tag: "Official",
    ctaLabel: "View Source",
    url: "https://www.pmkvyofficial.org/",
    kind: "official" as const,
  },
  {
    id: "icar",
    title: "Organic Farming 101",
    subtitle: "ICAR KVK • 12 lessons",
    meta: "Agricultural extension training",
    tag: "Official",
    ctaLabel: "View Source",
    url: "https://kvk.icar.gov.in/",
    kind: "official" as const,
  },
];

function encodeQuery(query: string) {
  return encodeURIComponent(String(query ?? "").trim());
}

export function buildGoogleArticleUrl(query: string) {
  return `https://www.google.com/search?q=${encodeQuery(query)}+article+guide+india`;
}

export function buildYouTubeVideoUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeQuery(query)}`;
}

export function buildYouTubeLiveUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeQuery(`${query} live`)}`;
}

function uniqueByTitle(items: KnowledgeResource[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractGoals(profile: any): string[] {
  return safeArray(profile?.learningGoals ?? profile?.goals ?? profile?.interests).map(String);
}

function getPreferredLanguage(profile: any) {
  return String(profile?.preferredLanguage ?? profile?.language ?? "Hindi");
}

function toOfficialResource(course: any, index: number): KnowledgeResource {
  const portalInfo = course?.portal_info ?? {};
  const portalName = portalInfo?.name ?? course?.source_portal ?? course?.provider_name ?? "Official portal";
  const lessons = course?.modules?.length ?? course?.lesson_count ?? course?.estimated_hours ?? 0;

  return {
    id: String(course?.id ?? course?.course_id ?? `official-${index}`),
    title: String(course?.title ?? "Government Training"),
    subtitle: `${portalName}${lessons ? ` • ${lessons} lessons` : ""}`,
    meta: String(portalInfo?.description ?? course?.description ?? "Government learning source"),
    tag: "Official",
    ctaLabel: "View Source",
    url: String(portalInfo?.url ?? course?.provider_url ?? buildGoogleArticleUrl(`${course?.title ?? "government training"} official portal`)),
    kind: "official",
  };
}

function toVideoResource(title: string, subtitle: string, tag: string, index: number): KnowledgeResource {
  return {
    id: `video-${index}-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    subtitle,
    tag,
    ctaLabel: "Watch Video",
    url: buildYouTubeVideoUrl(`${title} farming training ${subtitle}`),
    kind: "video",
  };
}

function toArticleResource(title: string, subtitle: string, tag: string, index: number): KnowledgeResource {
  return {
    id: `article-${index}-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    subtitle,
    tag,
    ctaLabel: "Read Article",
    url: buildGoogleArticleUrl(`${title} ${subtitle}`),
    kind: "article",
  };
}

function toLiveFallbackResource(topic: string, language: string, index: number): KnowledgeResource {
  const title = `${titleCase(topic)} Live Learning`;
  return {
    id: `live-${index}-${topic}`,
    title,
    subtitle: `YouTube Live • ${language}`,
    meta: "Open live learning search results",
    tag: "LIVE",
    ctaLabel: "Watch Live",
    url: buildYouTubeLiveUrl(`${topic} training ${language} india`),
    kind: "live",
  };
}

export function buildKnowledgeContent(input: BuilderInput) {
  const courses = safeArray(input.courses);
  const govtCourses = safeArray(input.govtCourses);
  const voiceRooms = safeArray(input.voiceRooms);
  const strictExternalOnly = Boolean(input.strictExternalOnly);
  const strictRealDataOnly = Boolean(input.strictRealDataOnly ?? input.strictExternalOnly);
  const recommendationCourses = safeArray(input.recommendations?.recommendations?.courses ?? input.recommendations?.courses);
  const nextSteps = safeArray(input.recommendations?.recommendations?.nextSteps ?? input.recommendations?.nextSteps).map(String);
  const goals = extractGoals(input.learningProfile);
  const language = getPreferredLanguage(input.learningProfile);
  const externalSearch = input.externalSearch ?? {};

  const officialSearchSources: KnowledgeResource[] = safeArray(externalSearch.official_sources)
    .map((item: any, index: number) => {
      const fallbackTitle = !strictRealDataOnly ? DEFAULT_OFFICIAL[index]?.title : undefined;
      const fallbackSubtitle = !strictRealDataOnly ? DEFAULT_OFFICIAL[index]?.subtitle : undefined;
      const fallbackUrl = !strictRealDataOnly ? DEFAULT_OFFICIAL[index]?.url : undefined;

      return {
        id: String(item?.id ?? `official-live-${index}`),
        title: String(item?.title ?? fallbackTitle ?? "Official Training"),
        subtitle: String(item?.source ?? fallbackSubtitle ?? "Official source"),
        meta: String(item?.snippet ?? "Official training source"),
        tag: "Official",
        ctaLabel: "View Source",
        url: String(item?.url ?? fallbackUrl ?? buildGoogleArticleUrl("government training official")),
        kind: "official" as const,
        thumbnail: item?.thumbnail,
      };
    })
    .filter((item) => Boolean(item.url));

  const govtOfficialSources: KnowledgeResource[] = govtCourses.slice(0, 4).map(toOfficialResource);

  const featuredSources = strictExternalOnly
    ? officialSearchSources
    : govtOfficialSources.length > 0
      ? govtOfficialSources
      : officialSearchSources.length > 0
        ? officialSearchSources
        : strictRealDataOnly
          ? []
          : DEFAULT_OFFICIAL;

  const courseSeeds = uniqueStrings(
    strictRealDataOnly
      ? [
        ...recommendationCourses.map((item: any) => String(item?.title ?? "")),
        ...courses.map((item: any) => String(item?.title ?? "")),
      ]
      : [
        ...recommendationCourses.map((item: any) => String(item?.title ?? "")),
        ...courses.map((item: any) => String(item?.title ?? "")),
        ...goals.map((goal) => `${titleCase(goal)} Basics`),
      ],
  ).slice(0, 6);

  const popularCourses: (KnowledgeResource & { courseId?: string })[] = (strictRealDataOnly
    ? courseSeeds
    : courseSeeds.length > 0
      ? courseSeeds
      : DEFAULT_VIDEOS).map((title, index) => {
    const source = courses[index] ?? recommendationCourses[index] ?? {};
    const primaryTag = String(source?.category ?? source?.difficulty ?? goals[0] ?? "Agriculture");
    const secondaryTag = String(source?.language ?? language);

    return {
      id: String(source?.course_id ?? source?.courseId ?? source?.id ?? `course-${index}`),
      title,
      subtitle: String(source?.description ?? source?.reason ?? "Practical skill course"),
      tag: titleCase(primaryTag),
      secondaryTag: secondaryTag.toUpperCase(),
      ctaLabel: source?.course_id || source?.courseId || source?.id ? "Open Course" : "View Source",
      url: buildYouTubeVideoUrl(`${title} tutorial ${language}`),
      kind: "video" as const,
      thumbnail: source?.thumbnail ?? source?.thumbnail_url ?? source?.thumbnail_s3_key,
      courseId: source?.course_id ?? source?.courseId ?? source?.id ? String(source?.course_id ?? source?.courseId ?? source?.id) : undefined,
    };
  });

  const videoResources = safeArray(externalSearch.videos).length > 0
    ? safeArray(externalSearch.videos).map((item: any, index: number) => ({
      id: String(item?.id ?? `video-live-${index}`),
      title: String(item?.title ?? DEFAULT_VIDEOS[index] ?? "Learning Video"),
      subtitle: String(item?.snippet ?? item?.source ?? `${language} learning`),
      meta: String(item?.published ?? item?.viewers ?? ""),
      tag: String(item?.source ?? "YouTube"),
      ctaLabel: "Watch Video",
      url: String(item?.url ?? buildYouTubeVideoUrl(`${item?.title ?? "farming training"} ${language}`)),
      kind: "video" as const,
      thumbnail: item?.thumbnail,
    }))
    : strictRealDataOnly
      ? []
      : uniqueStrings([
        ...popularCourses.map((item) => item.title),
        ...DEFAULT_VIDEOS,
      ]).slice(0, 6).map((title, index) =>
        toVideoResource(title, `${language} learning`, "YouTube", index),
      );

  const articleTitles = uniqueStrings([
    ...nextSteps,
    ...courses.map((item: any) => String(item?.title ?? "")),
    ...DEFAULT_ARTICLES,
  ])
    .map((title) => normalizeArticleTitle(title))
    .slice(0, 6);

  const articleResources = safeArray(externalSearch.articles).length > 0
    ? safeArray(externalSearch.articles).map((item: any, index: number) => ({
      id: String(item?.id ?? `article-live-${index}`),
      title: String(item?.title ?? articleTitles[index] ?? "Rural Learning Guide"),
      subtitle: String(item?.snippet ?? "Filtered educational search"),
      meta: String(item?.source ?? ""),
      tag: String(item?.source ?? "Web"),
      ctaLabel: "Read Article",
      url: String(item?.url ?? buildGoogleArticleUrl(`${item?.title ?? "rural learning"} ${language}`)),
      kind: "article" as const,
      thumbnail: item?.thumbnail,
    }))
    : strictRealDataOnly
      ? []
      : articleTitles.map((title, index) =>
        toArticleResource(title, "Filtered educational search", "Google", index),
      );

  const liveRooms: KnowledgeLiveRoom[] = voiceRooms.slice(0, 3).map((room: any, index) => ({
    id: String(room?.roomId ?? `room-${index}`),
    title: String(room?.title ?? "Live Expert Session"),
    host: String(room?.creatorName ?? "Community Host"),
    listeners: `${room?.participantCount ?? 0} listening`,
    roomId: room?.roomId,
    verified: true,
  }));

  const liveFallback = safeArray(externalSearch.live_streams).length > 0
    ? safeArray(externalSearch.live_streams).map((item: any, index: number) => ({
      id: String(item?.id ?? `live-search-${index}`),
      title: String(item?.title ?? "Live Learning"),
      subtitle: String(item?.snippet ?? item?.source ?? "Open live stream"),
      meta: String(item?.viewers ?? item?.published ?? ""),
      tag: String(item?.source ?? "YouTube Live"),
      ctaLabel: "Watch Live",
      url: String(item?.url ?? buildYouTubeLiveUrl(`${item?.title ?? "rural training"} ${language}`)),
      kind: "live" as const,
      thumbnail: item?.thumbnail,
    }))
    : strictRealDataOnly
      ? []
      : uniqueStrings([
        ...goals,
        ...courses.map((item: any) => String(item?.category ?? item?.title ?? "")),
        "monsoon crop strategies",
      ])
        .slice(0, 3)
        .map((topic, index) => toLiveFallbackResource(topic, language, index));

  return {
    featuredSources,
    popularCourses,
    videoResources,
    articleResources,
    nextSteps,
    liveRooms,
    liveFallback,
  };
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeArticleTitle(title: string) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) return "Rural Learning Guide";
  if (trimmed.length <= 50) return titleCase(trimmed);
  return titleCase(trimmed.slice(0, 50));
}
