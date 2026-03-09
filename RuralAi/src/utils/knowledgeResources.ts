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

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function toOfficialResource(course: any, index: number): KnowledgeResource | null {
  const portalInfo = course?.portal_info ?? {};
  const portalName = safeText(portalInfo?.name ?? course?.source_portal ?? course?.provider_name) || "Official portal";
  const lessons = course?.modules?.length ?? course?.lesson_count ?? course?.estimated_hours ?? 0;
  const title = safeText(course?.title);
  const url = safeText(portalInfo?.url ?? course?.url ?? course?.provider_url);

  if (!title || !url) {
    return null;
  }

  return {
    id: safeText(course?.id ?? course?.course_id) || `official-${index}`,
    title,
    subtitle: `${portalName}${lessons ? ` • ${lessons} lessons` : ""}`,
    meta: safeText(portalInfo?.description ?? course?.description) || "Government learning source",
    tag: "Official",
    ctaLabel: "View Source",
    url,
    kind: "official",
  };
}

function toExternalResource(
  item: any,
  kind: ResourceKind,
  index: number,
  options: {
    ctaLabel: string;
    defaultSubtitle: string;
    defaultTag: string;
    defaultMeta?: string;
  },
): KnowledgeResource | null {
  const title = safeText(item?.title);
  const url = safeText(item?.url);

  if (!title || !url) {
    return null;
  }

  return {
    id: safeText(item?.id) || `${kind}-${index}`,
    title,
    subtitle: safeText(item?.snippet ?? item?.source) || options.defaultSubtitle,
    meta: safeText(item?.published ?? item?.viewers ?? item?.source) || options.defaultMeta,
    tag: safeText(item?.source) || options.defaultTag,
    ctaLabel: options.ctaLabel,
    url,
    kind,
    thumbnail: item?.thumbnail,
  };
}

function toLiveRoom(room: any, index: number): KnowledgeLiveRoom | null {
  const title = safeText(room?.title);
  const roomId = safeText(room?.roomId);

  if (!title || !roomId) {
    return null;
  }

  return {
    id: roomId || `room-${index}`,
    title,
    host: safeText(room?.creatorName) || "Community Host",
    listeners: `${Number(room?.participantCount ?? 0)} listening`,
    roomId,
    verified: true,
  };
}

export function buildKnowledgeContent(input: BuilderInput) {
  const courses = safeArray(input.courses);
  const govtCourses = safeArray(input.govtCourses);
  const voiceRooms = safeArray(input.voiceRooms);
  const strictExternalOnly = Boolean(input.strictExternalOnly);
  const strictRealDataOnly = input.strictRealDataOnly !== false;
  const recommendationCourses = safeArray(input.recommendations?.recommendations?.courses ?? input.recommendations?.courses);
  const nextSteps = safeArray(input.recommendations?.recommendations?.nextSteps ?? input.recommendations?.nextSteps).map(String);
  const goals = extractGoals(input.learningProfile);
  const language = getPreferredLanguage(input.learningProfile);
  const externalSearch = input.externalSearch ?? {};

  const officialSearchSources: KnowledgeResource[] = safeArray(externalSearch.official_sources)
    .map((item: any, index: number) =>
      toExternalResource(item, "official", index, {
        ctaLabel: "View Source",
        defaultSubtitle: "Official source",
        defaultTag: "Official",
        defaultMeta: "Government learning source",
      }),
    )
    .filter(Boolean) as KnowledgeResource[];

  const govtOfficialSources: KnowledgeResource[] = govtCourses
    .slice(0, 4)
    .map(toOfficialResource)
    .filter(Boolean) as KnowledgeResource[];

  const featuredSources = strictExternalOnly
    ? officialSearchSources
    : govtOfficialSources.length > 0
      ? govtOfficialSources
      : officialSearchSources.length > 0
        ? officialSearchSources
        : [];

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
      : []).map((title, index) => {
    const source = courses[index] ?? recommendationCourses[index] ?? {};
    const primaryTag = safeText(source?.category ?? source?.difficulty ?? goals[0]) || "Course";
    const secondaryTag = safeText(source?.language ?? language) || language;

    return {
      id: safeText(source?.course_id ?? source?.courseId ?? source?.id) || `course-${index}`,
      title,
      subtitle: safeText(source?.description ?? source?.reason) || "Practical skill course",
      tag: titleCase(primaryTag),
      secondaryTag: secondaryTag.toUpperCase(),
      ctaLabel: source?.course_id || source?.courseId || source?.id ? "Open Course" : "View Source",
      url: buildYouTubeVideoUrl(`${title} tutorial ${language}`),
      kind: "video" as const,
      thumbnail: source?.thumbnail ?? source?.thumbnail_url ?? source?.thumbnail_s3_key,
      courseId: source?.course_id ?? source?.courseId ?? source?.id ? String(source?.course_id ?? source?.courseId ?? source?.id) : undefined,
    };
  });

  const videoResources: KnowledgeResource[] = safeArray(externalSearch.videos)
    .map((item: any, index: number) =>
      toExternalResource(item, "video", index, {
        ctaLabel: "Watch Video",
        defaultSubtitle: `${language} learning`,
        defaultTag: "YouTube",
      }),
    )
    .filter(Boolean) as KnowledgeResource[];

  const articleTitles = uniqueStrings([
    ...nextSteps,
    ...courses.map((item: any) => String(item?.title ?? "")),
  ])
    .map((title) => normalizeArticleTitle(title))
    .slice(0, 6);

  const articleResources: KnowledgeResource[] = safeArray(externalSearch.articles)
    .map((item: any, index: number) =>
      toExternalResource(item, "article", index, {
        ctaLabel: "Read Article",
        defaultSubtitle: articleTitles[index] || "Filtered educational search",
        defaultTag: "Web",
      }),
    )
    .filter(Boolean) as KnowledgeResource[];

  const liveRooms: KnowledgeLiveRoom[] = voiceRooms
    .slice(0, 3)
    .map(toLiveRoom)
    .filter(Boolean) as KnowledgeLiveRoom[];

  const liveFallback: KnowledgeResource[] = safeArray(externalSearch.live_streams)
    .map((item: any, index: number) =>
      toExternalResource(item, "live", index, {
        ctaLabel: "Watch Live",
        defaultSubtitle: "Open live stream",
        defaultTag: "YouTube Live",
      }),
    )
    .filter(Boolean) as KnowledgeResource[];

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
