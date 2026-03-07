/**
 * External knowledge resource search for Requirement 7.
 * Returns live educational videos, live streams, and web articles.
 */

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-IN,en;q=0.9',
};

const STOP_WORDS = new Set([
  'show', 'me', 'a', 'an', 'the', 'of', 'for', 'to', 'and', 'in', 'on', 'about', 'please',
  'video', 'videos', 'article', 'articles', 'live', 'stream', 'streams', 'course', 'courses',
  'training', 'resource', 'resources', 'watch', 'read', 'find', 'search',
]);

const IRRELEVANT_HINTS = [
  /movie|trailer|song|music|status|dance|comedy|prank|roast|meme/i,
  /pubg|free fire|gaming|fortnite/i,
  /asmr|vlog/i,
  /pdf farming|selling pdf|digital products|make money|earn money|passive income|affiliate/i,
  /stock market tips|crypto|trading signals/i,
];

const HARD_BLOCK_HINTS = [
  /pdf farming|selling pdf|digital products|earn money online|passive income/i,
  /crypto giveaway|trading signals/i,
];

function getCacheKey(query, language, limit) {
  return `${String(query || '').trim().toLowerCase()}|${String(language || '').toLowerCase()}|${limit}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { ts: Date.now(), value });
}

async function fetchText(url, timeoutMs = 8000) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`FETCH_FAILED_${res.status}`);
  }

  return res.text();
}

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value = '') {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseEscapedText(value = '') {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function extractJsonTextRuns(block, key) {
  const start = block.indexOf(`"${key}":`);
  if (start === -1) return '';

  const slice = block.slice(start, start + 1200);
  const texts = [];
  const regex = /"text":"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = regex.exec(slice)) !== null) {
    texts.push(parseEscapedText(match[1]));
  }
  return texts.join(' ').trim();
}

function extractQuoted(block, regex) {
  const match = block.match(regex);
  return match ? parseEscapedText(match[1]) : '';
}

function extractMeta(html, name) {
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  const match = html.match(regex);
  return match ? decodeHtml(match[1]) : '';
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function normalizeDuckDuckGoUrl(url) {
  if (!url) return '';

  try {
    const raw = url.startsWith('//') ? `https:${url}` : url;
    const parsed = new URL(raw, 'https://html.duckduckgo.com');
    const target = parsed.searchParams.get('uddg');
    if (target) return decodeURIComponent(target);
    return raw;
  } catch {
    return url;
  }
}

function extractTopicTokens(query = '') {
  return String(query)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !STOP_WORDS.has(t) && t.length > 1);
}

function normalizeRepeatingTitle(value = '') {
  const words = String(value).split(/\s+/).filter(Boolean);
  if (words.length < 2) return String(value || '').trim();

  // Collapse direct repeated phrase halves: "Knowledge Star Knowledge Star"
  if (words.length % 2 === 0) {
    const mid = words.length / 2;
    const first = words.slice(0, mid).join(' ').toLowerCase();
    const second = words.slice(mid).join(' ').toLowerCase();
    if (first && first === second) {
      return words.slice(0, mid).join(' ');
    }
  }

  const deduped = [];
  for (const word of words) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.toLowerCase() === word.toLowerCase()) continue;
    deduped.push(word);
  }
  return deduped.join(' ');
}

function tokenMatches(hay, token) {
  if (!token) return false;
  if (token.length <= 2) {
    const shortPattern = token === 'ai'
      ? /\b(ai|a\.i\.|artificial intelligence|machine learning|ml)\b/i
      : new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
    return shortPattern.test(hay);
  }

  return hay.includes(token) || new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(hay);
}

function relevanceScore(item, tokens) {
  const hay = `${item?.title || ''} ${item?.snippet || ''} ${item?.source || ''}`.toLowerCase();
  if (!hay.trim()) return { score: 0, tokenHits: 0 };

  let score = 0;
  let tokenHits = 0;

  for (const token of tokens) {
    if (!token) continue;
    if (!tokenMatches(hay, token)) continue;

    tokenHits += 1;
    score += token.length <= 2 ? 7 : 6;
  }

  for (const pattern of IRRELEVANT_HINTS) {
    if (pattern.test(hay)) score -= 6;
  }

  if (/course|tutorial|training|learn|education|guide/i.test(hay)) score += 2;
  if (item?.live) score += 1;
  if (item?.published && /hour|day|live/i.test(String(item.published))) score += 1;

  return { score, tokenHits };
}

function rankAndFilter(results = [], topicQuery = '', limit = 4, options = {}) {
  const tokens = extractTopicTokens(topicQuery);
  const requireMatch = Boolean(options.requireMatch);
  const withScore = results
    .map((item) => {
      const normalized = {
        ...item,
        title: normalizeRepeatingTitle(item?.title || ''),
        source: normalizeRepeatingTitle(item?.source || ''),
      };
      const rank = relevanceScore(normalized, tokens);
      return { item: normalized, score: rank.score, tokenHits: rank.tokenHits };
    })
    .filter(({ item }) => {
      if (!item?.title || !item?.url) return false;
      const hay = `${item.title || ''} ${item.snippet || ''} ${item.source || ''}`;
      if (HARD_BLOCK_HINTS.some((pattern) => pattern.test(hay))) return false;
      return true;
    });

  if (tokens.length > 0) {
    const strict = withScore.filter(({ score, tokenHits }) => tokenHits > 0 && score >= 2);
    if (strict.length > 0) {
      return strict
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((row) => row.item);
    }

    if (requireMatch) {
      return [];
    }
  }

  return withScore
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}

function isValidArticleUrl(url = '') {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (host.includes('duckduckgo.com') && path.includes('/y.js')) return false;
    if (host.includes('bing.com') && path.includes('/aclick')) return false;
    if (host.includes('google.com') && path.includes('/aclk')) return false;
    return true;
  } catch {
    return false;
  }
}

async function enrichArticle(result) {
  try {
    const html = await fetchText(result.url, 5000);
    const description = extractMeta(html, 'description') || result.snippet;
    const image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');
    const siteName = extractMeta(html, 'og:site_name');

    return {
      ...result,
      snippet: description || result.snippet,
      thumbnail: image || `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(result.url)}`,
      source: siteName || result.source,
    };
  } catch {
    return {
      ...result,
      thumbnail: `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(result.url)}`,
    };
  }
}

async function searchArticles(query, limit) {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, 8000);
  const matches = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g)];

  const base = matches.slice(0, limit).map((match, index) => {
    const rawUrl = normalizeDuckDuckGoUrl(match[1]);
    const title = stripTags(match[2]);
    const snippetRegex = new RegExp(`${escapeRegExp(match[2].slice(0, 20))}[\\s\\S]{0,600}?<a[^>]+class="result__snippet"[^>]*>(.*?)<\\/a>`, 'i');
    const snippetMatch = html.match(snippetRegex);
    const snippet = stripTags(snippetMatch?.[1] || '');
    let source = '';
    try {
      source = new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch {}

    return {
      id: `article-${index}`,
      kind: 'article',
      title,
      url: rawUrl,
      snippet,
      source,
    };
  });

  const enriched = await Promise.all(base.map(enrichArticle));
  return enriched.filter((item) => item.url && item.title && isValidArticleUrl(item.url));
}

function parseYouTubeResults(html, limit, liveOnly = false) {
  const blocks = [...html.matchAll(/"videoRenderer":\{([\s\S]*?)\}\s*,\s*"(?:trackingParams|thumbnailOverlays)"/g)];
  const results = [];

  for (const blockMatch of blocks) {
    if (results.length >= limit) break;
    const block = blockMatch[1];
    const videoId = extractQuoted(block, /"videoId":"([^"]+)"/);
    const title = extractJsonTextRuns(block, 'title') || extractQuoted(block, /"title":\{"simpleText":"([^"]+)"/);

    if (!videoId || !title) continue;

    const isLive =
      /"style":"LIVE"/.test(block)
      || /"label":"LIVE"/.test(block)
      || /"badgeText":"LIVE"/.test(block)
      || /"isLive":true/.test(block)
      || /LIVE/i.test(extractJsonTextRuns(block, 'badges'));

    if (liveOnly && !isLive) continue;

    const channel = extractJsonTextRuns(block, 'ownerText') || extractJsonTextRuns(block, 'shortBylineText');
    const snippet = extractJsonTextRuns(block, 'detailedMetadataSnippets') || extractJsonTextRuns(block, 'descriptionSnippet');
    const viewers =
      extractQuoted(block, /"viewCountText":\{"simpleText":"([^"]+)"/)
      || extractQuoted(block, /"shortViewCountText":\{"simpleText":"([^"]+)"/)
      || (isLive ? 'Live now' : '');
    const published =
      extractQuoted(block, /"publishedTimeText":\{"simpleText":"([^"]+)"/)
      || (isLive ? 'Live now' : '');

    results.push({
      id: `yt-${videoId}`,
      kind: liveOnly ? 'live' : 'video',
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      snippet,
      source: channel || 'YouTube',
      viewers,
      published,
      live: isLive,
    });
  }

  return results;
}

async function searchYouTube(query, limit, liveOnly = false) {
  const suffix = liveOnly ? '&sp=EgJAAQ%253D%253D' : '';
  const html = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${suffix}`, 8000);
  return parseYouTubeResults(html, limit, liveOnly);
}

function buildOfficialSources(query) {
  return [
    {
      id: 'official-pmkvy',
      kind: 'official',
      title: 'Pradhan Mantri Kaushal Vikas Yojana',
      url: 'https://www.pmkvyofficial.org/',
      snippet: `Official skill development resources for ${query}`,
      thumbnail: 'https://www.google.com/s2/favicons?sz=128&domain_url=https://www.pmkvyofficial.org/',
      source: 'PMKVY',
    },
    {
      id: 'official-icar',
      kind: 'official',
      title: 'ICAR KVK Training',
      url: 'https://kvk.icar.gov.in/',
      snippet: `Agricultural extension and training resources for ${query}`,
      thumbnail: 'https://www.google.com/s2/favicons?sz=128&domain_url=https://kvk.icar.gov.in/',
      source: 'ICAR',
    },
  ];
}

async function searchKnowledgeResources({ query, language = 'en', limit = 4 }) {
  const safeQuery = String(query || '').trim() || 'rural farming training india';
  const safeLimit = Math.max(1, Math.min(Number(limit) || 4, 6));
  const cacheKey = getCacheKey(safeQuery, language, safeLimit);
  const cached = getCached(cacheKey);

  if (cached) {
    return { ...cached, cached: true };
  }

  const [videosResult, articlesResult, liveResult] = await Promise.allSettled([
    searchYouTube(`${safeQuery} ${language} farming education tutorial`, safeLimit * 2, false),
    searchArticles(`${safeQuery} ${language} guide training farming ai`, safeLimit * 2),
    searchYouTube(`${safeQuery} ${language} live training farming`, Math.min(6, safeLimit * 2), true),
  ]);

  const rawVideos = videosResult.status === 'fulfilled' ? videosResult.value : [];
  const rawArticles = articlesResult.status === 'fulfilled' ? articlesResult.value : [];
  const rawLive = liveResult.status === 'fulfilled' ? liveResult.value : [];

  const rankedVideos = rankAndFilter(rawVideos, safeQuery, safeLimit, { requireMatch: true });
  const rankedArticles = rankAndFilter(rawArticles, safeQuery, safeLimit, { requireMatch: true });
  const rankedLive = rankAndFilter(rawLive, `${safeQuery} live`, Math.min(3, safeLimit), { requireMatch: true });

  const result = {
    query: safeQuery,
    language,
    videos: rankedVideos,
    articles: rankedArticles,
    live_streams: rankedLive,
    official_sources: buildOfficialSources(safeQuery),
    cached: false,
  };

  setCached(cacheKey, result);
  return result;
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  searchKnowledgeResources,
};
