/**
 * Knowledge Domain Agent
 *
 * Handles: video requests, article requests, course discovery, learning content,
 * training resources, digital literacy, peer group info.
 *
 * KEY DIFFERENCE from other agents: this agent actually searches for real
 * resources (YouTube videos, web articles, government courses) using the
 * knowledge-search service, and returns structured resource data alongside
 * the spoken response — so the frontend can display real, clickable content.
 */

const { searchKnowledgeResources } = require('../knowledge-search');
const courses = require('../../lambdas/knowledge-api/courses');
const govtIntegration = require('../../lambdas/knowledge-api/govt-integration');
const { APP_NAME } = require('../brand');

const SYSTEM_PROMPT = `You are a helpful learning assistant inside ${APP_NAME} for rural Indian farmers.
You help find educational videos, articles, courses, and training resources.

When a user asks for videos, articles, or courses:
- Summarize what resources you found for them (titles and sources)
- Be specific — mention the actual resource names
- Keep responses brief for voice (2-3 sentences)
- If you found resources, say something like "I found X videos about Y. Here are the top results."
- If they asked for a specific topic, mention that topic in your reply
- Always mention you are showing the resources on their screen

Guidelines:
- Be warm and encouraging about learning
- Use simple language appropriate for rural users
- Reference government training portals when relevant (ICAR, KVK, PMKVY)
- Keep responses brief for voice output (2-3 sentences)

{memory_context}`;

const SUPPORTED_INTENTS = [
    'request_video',
    'request_article',
    'request_course',
    'knowledge_query',
    'learning_content',
    'training_resources',
    'digital_literacy',
    'peer_learning',
    'show_resources',
];

/**
 * Extract a search-friendly topic from the user's query.
 */
function extractSearchTopic(messages = [], entities = {}) {
    // Get the latest user message
    let userText = '';
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
            userText = messages[i].content || '';
            break;
        }
    }

    // Try entity-based topic first
    if (entities?.crop) return entities.crop;
    if (entities?.topic) return entities.topic;
    if (entities?.subject) return entities.subject;

    // Strip command words to extract the actual topic
    const cleaned = userText
        .toLowerCase()
        .replace(/\b(show|give|find|search|play|open|tell|watch|read|get|display|mujhe|dikhao|batao|dikha|chahiye)\b/gi, '')
        .replace(/\b(me|a|an|the|of|about|on|for|some|please|video|videos|article|articles|course|courses|training|resource|resources)\b/gi, '')
        .replace(/[?.!,।]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned || 'farming training india';
}

/**
 * Determine what kind of resource the user is asking for.
 */
function detectResourceType(intent, messages = []) {
    let userText = '';
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
            userText = (messages[i].content || '').toLowerCase();
            break;
        }
    }

    const combined = `${intent} ${userText}`;

    if (/video|watch|youtube|देख|वीडियो|play/.test(combined)) return 'video';
    if (/article|read|पढ़|लेख|guide|blog/.test(combined)) return 'article';
    if (/course|training|class|lesson|सीख|कोर्स|प्रशिक्षण/.test(combined)) return 'course';
    return 'all';
}

/**
 * Build a natural-language response that references the actual resources found.
 */
function buildResourceResponse(topic, resourceType, searchResults, govtCourseResults) {
    const videos = searchResults?.videos || [];
    const articles = searchResults?.articles || [];
    const official = searchResults?.official_sources || [];
    const govtCourses = govtCourseResults?.courses || [];

    const parts = [];

    if (resourceType === 'video' || resourceType === 'all') {
        if (videos.length > 0) {
            const topVideo = videos[0];
            parts.push(`I found ${videos.length} video${videos.length > 1 ? 's' : ''} about ${topic}. The top result is "${topVideo.title}" from ${topVideo.source || 'YouTube'}.`);
        } else {
            parts.push(`I searched for videos about ${topic} but didn't find exact matches right now.`);
        }
    }

    if (resourceType === 'article' || resourceType === 'all') {
        if (articles.length > 0) {
            parts.push(`I also found ${articles.length} article${articles.length > 1 ? 's' : ''} including "${articles[0].title}".`);
        }
    }

    if (resourceType === 'course' || resourceType === 'all') {
        if (govtCourses.length > 0) {
            parts.push(`There are ${govtCourses.length} official training course${govtCourses.length > 1 ? 's' : ''} available.`);
        }
    }

    if (parts.length === 0) {
        return `I searched for ${topic} resources. Let me show you what I found on your screen.`;
    }

    parts.push('I am showing all the results on your screen now.');
    return parts.join(' ');
}

/**
 * Handle a knowledge domain query.
 *
 * Unlike other agents, this one actually fetches real resources and returns
 * structured data alongside the spoken response.
 */
async function handle(ctx, deps) {
    const { messages, intent, entities, complexity, userId } = ctx;
    const { llm } = deps;

    const topic = extractSearchTopic(messages, entities);
    const resourceType = detectResourceType(intent, messages);

    // Fetch real resources in parallel
    const [searchResults, govtCourseResults] = await Promise.all([
        searchKnowledgeResources({
            query: topic,
            language: entities?.language || 'en',
            limit: 6,
        }).catch(err => {
            console.warn('[KnowledgeAgent] Search failed:', err.message);
            return { videos: [], articles: [], live_streams: [], official_sources: [] };
        }),
        govtIntegration.listGovtCourses({ search: topic }).catch(err => {
            console.warn('[KnowledgeAgent] Govt courses failed:', err.message);
            return { courses: [] };
        }),
    ]);

    // Build a spoken response that references actual resources
    const spokenResponse = buildResourceResponse(topic, resourceType, searchResults, govtCourseResults);

    return {
        response: spokenResponse,
        provider: 'knowledge-agent',
        metadata: {
            domain: 'knowledge',
            intent,
            entities,
            resourceType,
            searchTopic: topic,
            // Structured resource data for the frontend
            resources: {
                videos: (searchResults.videos || []).slice(0, 4),
                articles: (searchResults.articles || []).slice(0, 4),
                live_streams: (searchResults.live_streams || []).slice(0, 3),
                official_sources: (searchResults.official_sources || []).slice(0, 2),
                govt_courses: (govtCourseResults.courses || []).slice(0, 4),
            },
        },
    };
}

module.exports = {
    name: 'knowledge',
    description: 'Knowledge domain agent — videos, articles, courses, training resources, learning content',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
