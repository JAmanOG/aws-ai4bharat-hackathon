/**
 * General Domain Agent (catch-all)
 *
 * Handles: greetings, general questions, queries that don't fit
 * specific domains, conversational exchanges.
 */

const { createRoom, joinRoom, listRooms } = require('../../lambdas/voice-room/rooms');

const SYSTEM_PROMPT = `You are a friendly, helpful voice assistant for a rural Indian platform.
You assist farmers and rural communities with everyday needs.

You help with:
- General greetings and conversation
- Digital literacy guidance
- Phone/app usage help
- General knowledge questions
- Connecting to the right service or feature
- Weather and calendar information

Guidelines:
- Be warm, respectful, and patient
- Use simple language appropriate for rural users
- If the query relates to agriculture, market, schemes, or health,
  still provide a helpful answer but mention the specialized feature
- Keep responses brief for voice (1-3 sentences)
- Remember the user's name and use it naturally

{memory_context}`;

const SUPPORTED_INTENTS = [
    'greeting',
    'general_question',
    'digital_literacy',
    'app_help',
    'weather_info',
    'request_voice_call_room',
    'create_voice_room',
    'join_voice_room',
    'unknown',
];

function getLatestUserText(messages = []) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (msg?.role === 'user' && typeof msg.content === 'string') {
            return msg.content;
        }
    }
    return '';
}

function shouldCreateRoom(intent, text) {
    const i = String(intent || '').toLowerCase();
    const t = String(text || '').toLowerCase();
    return i.includes('request_voice_call_room')
        || i.includes('create_voice_room')
        || /create\s+(a\s+)?(voice\s+)?room|start\s+(a\s+)?(voice\s+)?room|twitter\s*space|स्पेस|रूम\s*बन/.test(t);
}

function shouldJoinRoom(intent, text) {
    const i = String(intent || '').toLowerCase();
    const t = String(text || '').toLowerCase();
    return i.includes('join_voice_room')
        || /join\s+(the\s+)?(voice\s+)?room|enter\s+(the\s+)?(voice\s+)?room|रूम\s*(जॉइन|जुड़)/.test(t);
}

function deriveRoomTopic(text = '') {
    const t = String(text).toLowerCase();
    if (/crop|mandi|price|farmer|farming|agri|fasal|kisan|खेती|किसान|मंडी/.test(t)) return 'agriculture';
    if (/health|doctor|symptom|hospital|medicine|स्वास्थ्य|डॉक्टर/.test(t)) return 'health';
    if (/money|loan|saving|bank|finance|पैसा|लोन|बचत|बैंक/.test(t)) return 'finance';
    if (/study|course|class|education|learn|सीख|पढ़/.test(t)) return 'education';
    if (/weather|rain|mausam|बारिश|मौसम/.test(t)) return 'weather';
    return 'general';
}

function deriveRoomTitle(text = '') {
    const cleaned = String(text)
        .replace(/create\s+(a\s+)?(voice\s+)?room/gi, '')
        .replace(/start\s+(a\s+)?(voice\s+)?room/gi, '')
        .replace(/twitter\s*space/gi, '')
        .replace(/voice\s*room/gi, '')
        .replace(/room/gi, '')
        .replace(/space/gi, '')
        .replace(/[?.!,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return 'Village Voice Space';
    const normalized = cleaned.length > 48 ? cleaned.slice(0, 48).trim() : cleaned;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

async function handleVoiceRoomAction(ctx) {
    const latestUserText = getLatestUserText(ctx.messages);
    const userId = ctx.userId;
    const userName = 'Farmer';

    if (!userId) {
        return null;
    }

    if (shouldCreateRoom(ctx.intent, latestUserText)) {
        const roomTitle = deriveRoomTitle(latestUserText);
        const roomTopic = deriveRoomTopic(latestUserText);
        const created = await createRoom(
            {
                title: roomTitle,
                description: `Created from voice assistant${latestUserText ? `: ${latestUserText.slice(0, 120)}` : ''}`,
                topics: [roomTopic],
                isPrivate: false,
            },
            userId,
            userName,
        );

        return {
            response: `Done. I created your voice room "${roomTitle}". Opening it now.`,
            provider: 'voice-room-action',
            metadata: {
                domain: 'general',
                intent: ctx.intent,
                action: 'create_room',
                roomId: created.roomId,
                roomTitle,
                topic: roomTopic,
            },
        };
    }

    if (shouldJoinRoom(ctx.intent, latestUserText)) {
        const active = await listRooms({ status: 'active', page: 1, limit: 1 });
        const room = active.rooms?.[0];

        if (!room) {
            return {
                response: 'There is no active voice room right now. Say create room and I will create one for you.',
                provider: 'voice-room-action',
                metadata: {
                    domain: 'general',
                    intent: ctx.intent,
                    action: 'join_room_no_active',
                },
            };
        }

        await joinRoom(room.roomId, userId, userName);

        return {
            response: `Done. Opening the live voice room now.`,
            provider: 'voice-room-action',
            metadata: {
                domain: 'general',
                intent: ctx.intent,
                action: 'join_room',
                roomId: room.roomId,
                roomTitle: room.title,
                topic: room.topics?.[0] || 'general',
            },
        };
    }

    return null;
}

async function handle(ctx, deps) {
    const { messages } = ctx;
    const { llm } = deps;

    try {
        const actionResult = await handleVoiceRoomAction(ctx);
        if (actionResult) {
            return actionResult;
        }
    } catch (err) {
        console.warn('[GeneralAgent] Voice room action failed:', err.message);
    }

    const generalMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content),
            };
        }
        return m;
    });

    // General queries → Sarvam-M (fast, free, good at Indian languages)
    const opts = {
        temperature: 0.3,
        maxTokens: 512,
    };

    const result = await llm.generateResponse(generalMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: { domain: 'general', intent: ctx.intent, usage: result.usage },
    };
}

module.exports = {
    name: 'general',
    description: 'General catch-all agent — greetings, conversation, digital literacy, app help',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
