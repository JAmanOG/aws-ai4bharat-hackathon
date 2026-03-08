/**
 * Health Domain Agent
 *
 * Handles: basic health guidance, symptom triage, nutrition advice,
 * maternal/child health, nearest facility referral.
 *
 * IMPORTANT: Always recommends professional medical consultation.
 */

const govtPortals = require('../../lambdas/health-directory/govt-portals');
const providersDirectory = require('../../lambdas/health-directory/providers');
const symptomChecker = require('../../lambdas/health-ai/symptom-checker');
const { parseScreenContext } = require('../platform-context');
const {
    buildSymptomContextSummary,
    buildSymptomFollowUp,
    extractSymptomIntake,
    getMissingSymptomSlot,
    mergeSymptomIntake,
    normalizeGender,
    parseAge,
    toSymptomEntities,
} = require('../symptom-intake');

const SYSTEM_PROMPT = `You are a rural health guidance assistant for Indian communities.
You provide basic health information and always recommend professional consultation.

You help with:
- Basic symptom understanding (NOT diagnosis)
- Nutrition and diet advice for farming families
- Maternal and child health guidance
- First aid for common farming injuries
- Heat stroke, dehydration prevention
- Nearest PHC/CHC referral guidance
- Government health schemes (Ayushman Bharat, JSY, etc.)
- Using the health features available in this app, including symptom screening and medical report insights

CRITICAL RULES:
- NEVER diagnose conditions — only provide general information
- ALWAYS recommend consulting a doctor for any health concern
- Suggest the nearest Primary Health Centre (PHC) visit
- For emergencies, direct to call 108 (ambulance) or 112 (emergency)
- Be sensitive to rural health challenges (access, cost, literacy)
- Keep responses brief for voice (2-3 sentences)
- If current screen context mentions HealthDashboard or SymptomChecker, use the exact on-screen actions and labels in your answer
- If the user asks about report upload or report insights, explain the app flow clearly: Upload Report, then Get Insights

{memory_context}`;

const SUPPORTED_INTENTS = [
    'symptom_guidance',
    'nutrition_advice',
    'maternal_health',
    'child_health',
    'first_aid',
    'heat_prevention',
    'health_scheme',
    'facility_referral',
    'medical_report_analysis',
    'health_platform_help',
];

const FALLBACK_SCHEMES = [
    'Ayushman Bharat (PM-JAY)',
    'National Health Mission',
    'Central Government Health Scheme',
    'eSanjeevani',
];

const FALLBACK_PROVIDERS = [
    'eSanjeevani',
    'Apollo Hospitals',
    'Practo',
    'Tata 1mg',
];

function getLatestUserText(messages = []) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === 'user' && typeof messages[i].content === 'string') {
            return messages[i].content;
        }
    }
    return '';
}

function naturalJoin(items = []) {
    const filtered = items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
    if (filtered.length === 0) return '';
    if (filtered.length === 1) return filtered[0];
    if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
    return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`;
}

function valueFromScreen(screenState, key, fallback = '') {
    const value = screenState?.values?.[key];
    return value == null ? fallback : String(value).trim();
}

function normalizeScreenValue(value = '') {
    const cleaned = String(value || '').trim();
    if (!cleaned || /^(none|not captured yet|waiting)$/i.test(cleaned)) {
        return '';
    }
    return cleaned;
}

function isHealthDashboard(screenState) {
    return screenState?.screen === 'HealthDashboard';
}

function isSymptomChecker(screenState) {
    return screenState?.screen === 'SymptomChecker';
}

function looksLikeSymptomRequest(intent, text) {
    const combined = `${intent} ${text}`.toLowerCase();
    return /symptom_guidance|symptom|symptoms|fever|cough|pain|vomit|vomiting|headache|breathing|dizziness|weakness|rash|infection|triage|screening|लक्षण|बुखार|खांसी|दर्द|उल्टी|सांस/.test(combined);
}

function readSymptomIntakeFromEntities(entities = {}) {
    return mergeSymptomIntake({}, {
        symptoms: entities.symptoms || entities.symptom || '',
        age: entities.age,
        gender: entities.gender,
        duration: entities.duration,
        severity: entities.severity,
    });
}

function readSymptomIntakeFromScreen(screenState) {
    return mergeSymptomIntake({}, {
        symptoms: normalizeScreenValue(valueFromScreen(screenState, 'capturedSymptoms')),
        age: normalizeScreenValue(valueFromScreen(screenState, 'capturedAge')),
        gender: normalizeScreenValue(valueFromScreen(screenState, 'capturedGender')),
        duration: normalizeScreenValue(valueFromScreen(screenState, 'capturedDuration')),
        severity: normalizeScreenValue(valueFromScreen(screenState, 'capturedSeverity')),
    });
}

function formatSymptomVoiceResponse(result) {
    const conditions = Array.isArray(result?.possible_conditions)
        ? result.possible_conditions.filter(Boolean).slice(0, 2).join(', ')
        : '';
    const warning = Array.isArray(result?.warning_signs)
        ? result.warning_signs.filter(Boolean)[0]
        : '';

    let response = `Health screening complete. Risk level is ${String(result?.risk_level || 'Medium').toLowerCase()} and urgency is ${String(result?.urgency || 'soon').toLowerCase()}.`;
    if (conditions) {
        response += ` Possible conditions include ${conditions}.`;
    }
    if (result?.recommended_action) {
        response += ` Recommended action: ${result.recommended_action}`;
    }
    if (warning) {
        response += ` Warning sign: ${warning}.`;
    }
    response += ' This is not a diagnosis, so please consult a doctor or nearby PHC.';
    return response;
}

async function buildSymptomAgentResponse(ctx, screenState) {
    const latestUserText = getLatestUserText(ctx.messages);
    const fromScreen = readSymptomIntakeFromScreen(screenState);
    const fromEntities = readSymptomIntakeFromEntities(ctx.entities);
    const carried = mergeSymptomIntake(fromScreen, fromEntities);
    const intake = extractSymptomIntake(latestUserText, carried);
    const missingSlot = getMissingSymptomSlot(intake);
    const retryCount = Number(ctx.entities?._slotRetryCount) || 0;

    if (missingSlot) {
        const response = buildSymptomFollowUp(missingSlot, intake, retryCount);
        return {
            response,
            provider: 'health-symptom-agent',
            metadata: {
                domain: 'health',
                intent: 'symptom_guidance',
                entities: toSymptomEntities(intake),
                symptomIntake: intake,
                conversationStage: 'collecting',
                followUp: {
                    pendingSlot: missingSlot,
                    retryCount,
                    intent: 'symptom_guidance',
                    intentDomain: 'health',
                    entities: toSymptomEntities(intake),
                },
            },
        };
    }

    let triage;
    try {
        triage = await symptomChecker.checkSymptoms(
            intake.symptoms,
            parseAge(intake.age),
            normalizeGender(intake.gender),
            buildSymptomContextSummary(intake),
            ctx.userId,
        );
    } catch (err) {
        return {
            response: 'I collected the symptom details, but the health screening service is unavailable right now. Please try again in a moment, and if symptoms are urgent please contact a doctor, nearby PHC, or call 108.',
            provider: 'health-symptom-agent',
            metadata: {
                domain: 'health',
                intent: 'symptom_guidance',
                entities: toSymptomEntities(intake),
                symptomIntake: intake,
                conversationStage: 'error',
            },
        };
    }

    return {
        response: formatSymptomVoiceResponse(triage),
        provider: 'health-symptom-triage',
        metadata: {
            domain: 'health',
            intent: 'symptom_guidance',
            entities: toSymptomEntities(intake),
            symptomIntake: intake,
            triage_result: triage,
            conversationStage: 'complete',
        },
    };
}

async function getVisibleSchemeNames(screenState) {
    const visibleOnScreen = valueFromScreen(screenState, 'visibleSchemeNames');
    if (visibleOnScreen) {
        return visibleOnScreen.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4);
    }

    try {
        const rows = await govtPortals.listHealthPortals();
        return rows.slice(0, 4).map((row) => row.name).filter(Boolean);
    } catch (err) {
        console.warn('[HealthAgent] Failed to load scheme names:', err.message);
        return FALLBACK_SCHEMES;
    }
}

async function getVisibleProviderNames(screenState) {
    const visibleOnScreen = valueFromScreen(screenState, 'visibleProviderNames');
    if (visibleOnScreen) {
        return visibleOnScreen.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4);
    }

    try {
        const result = await providersDirectory.listProviders({ limit: 4, page: 1 });
        const names = (result.providers || []).map((row) => row.name).filter(Boolean);
        return names.length > 0 ? names.slice(0, 4) : FALLBACK_PROVIDERS;
    } catch (err) {
        console.warn('[HealthAgent] Failed to load provider names:', err.message);
        return FALLBACK_PROVIDERS;
    }
}

function looksLikeReportRequest(intent, text) {
    const combined = `${intent} ${text}`.toLowerCase();
    return /medical_report_analysis|upload|report|reports|scan|scans|x[\s-]?ray|\bmri\b|\bct\b|\bct scan\b|\bultrasound\b|\bpathology\b|lab report|medical report|insights|analysis|अपलोड|रिपोर्ट|स्कैन/.test(combined);
}

function looksLikePlatformHelp(intent, text) {
    const combined = `${intent} ${text}`.toLowerCase();
    return /health_platform_help|what can i do|how to use|this screen|current screen|this page|dashboard|screening|यहां क्या|कैसे/.test(combined);
}

function looksLikeSchemeRequest(intent, text) {
    const combined = `${intent} ${text}`.toLowerCase();
    return /health_scheme|scheme|schemes|yojana|ayushman|pm[-\s]?jay|cghs|esanjeevani|योजना|आयुष्मान/.test(combined);
}

function looksLikeProviderRequest(intent, text) {
    const combined = `${intent} ${text}`.toLowerCase();
    return /facility_referral|doctor|doctors|provider|providers|consult|consultation|telemedicine|hospital|clinic|phc|डॉक्टर|अस्पताल/.test(combined);
}

async function buildPlatformResponse(ctx) {
    const latestUserText = getLatestUserText(ctx.messages);
    const screenState = parseScreenContext(ctx.screenContext || '');
    const selectedReportType = valueFromScreen(screenState, 'selectedReportType');
    const availableReportTypes = valueFromScreen(screenState, 'availableReportTypes', 'lab report, X-ray, MRI, CT, and ultrasound');
    const reportStatus = valueFromScreen(screenState, 'reportStatus');

    if (looksLikeReportRequest(ctx.intent, latestUserText)) {
        const flowPrefix = isHealthDashboard(screenState)
            ? 'On the AI Health Screening screen, open Medical Report Insights.'
            : 'Open the AI Health Screening screen and use Medical Report Insights.';

        let response = `${flowPrefix} First tap Upload Report, then tap Get Insights. We currently support ${availableReportTypes} as PDF, JPG, or PNG files.`;
        if (selectedReportType) {
            response += ` The selected report type is ${selectedReportType}.`;
        }
        if (reportStatus && !/^Upload a report or scan/i.test(reportStatus)) {
            response += ` Current status on your screen: ${reportStatus}.`;
        }
        response += ' If you want symptom triage instead of report analysis, use Start Screening.';
        response += ' These are AI observations only, so please share the result with a doctor for interpretation.';

        return {
            response,
            provider: 'health-platform',
            metadata: {
                domain: 'health',
                intent: 'medical_report_analysis',
                screen: screenState.screen || 'HealthDashboard',
                entities: {
                    current_screen: screenState.screen || 'HealthDashboard',
                    report_type: selectedReportType || undefined,
                },
            },
        };
    }

    if (looksLikePlatformHelp(ctx.intent, latestUserText)) {
        if (isHealthDashboard(screenState)) {
            const schemes = await getVisibleSchemeNames(screenState);
            const providerNames = await getVisibleProviderNames(screenState);
            return {
                response: `On this AI Health Screening screen, you can start symptom screening, upload a medical report for AI insights, review schemes like ${naturalJoin(schemes)}, and explore consultation options such as ${naturalJoin(providerNames)}.`,
                provider: 'health-platform',
                metadata: {
                    domain: 'health',
                    intent: 'health_platform_help',
                    screen: 'HealthDashboard',
                },
            };
        }

        if (isSymptomChecker(screenState)) {
            return {
                response: 'On this Symptom Checker screen, speak with the AI Doctor by voice. First describe symptoms, then answer the age and gender follow-up questions, and I will generate possible conditions, urgency, recommended action, home remedies, and warning signs. It is screening guidance only, not a diagnosis.',
                provider: 'health-platform',
                metadata: {
                    domain: 'health',
                    intent: 'health_platform_help',
                    screen: 'SymptomChecker',
                },
            };
        }
    }

    if (isSymptomChecker(screenState) || looksLikeSymptomRequest(ctx.intent, latestUserText)) {
        return buildSymptomAgentResponse(ctx, screenState);
    }

    if (looksLikeSchemeRequest(ctx.intent, latestUserText)) {
        const schemes = await getVisibleSchemeNames(screenState);
        return {
            response: `On our health dashboard, the main scheme options available right now are ${naturalJoin(schemes)}. You can open Government Health Schemes on screen to review them in detail.`,
            provider: 'health-platform',
            metadata: {
                domain: 'health',
                intent: 'health_scheme',
                screen: screenState.screen || 'HealthDashboard',
            },
        };
    }

    if (looksLikeProviderRequest(ctx.intent, latestUserText)) {
        const providerNames = await getVisibleProviderNames(screenState);
        return {
            response: `On this platform, you can consult through ${naturalJoin(providerNames)}. eSanjeevani is also available for government telemedicine, and for urgent symptoms you should contact a nearby PHC or call 108.`,
            provider: 'health-platform',
            metadata: {
                domain: 'health',
                intent: 'facility_referral',
                screen: screenState.screen || 'HealthDashboard',
            },
        };
    }

    return null;
}

async function handle(ctx, deps) {
    const { messages, intent, entities, complexity, screenContext = '' } = ctx;
    const { llm } = deps;

    const platformResponse = await buildPlatformResponse({ ...ctx, screenContext });
    if (platformResponse) {
        return platformResponse;
    }

    let enrichment = '';
    if (entities?.symptom) enrichment += `\nSymptom mentioned: ${entities.symptom}`;
    if (entities?.symptoms) enrichment += `\nSymptoms mentioned: ${entities.symptoms}`;
    if (entities?.age) enrichment += `\nAge mentioned: ${entities.age}`;
    if (entities?.gender) enrichment += `\nGender mentioned: ${entities.gender}`;
    if (entities?.age_group) enrichment += `\nAge group: ${entities.age_group}`;
    if (entities?.location) enrichment += `\nLocation: ${entities.location}`;
    if (screenContext) enrichment += `\nCurrent screen context: ${screenContext}`;

    const healthMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content) + enrichment,
            };
        }
        return m;
    });

    // Agent uses Sarvam-M (fast, free) — health queries are routed to Claude by MCP
    const opts = {
        temperature: 0.1,
        maxTokens: 512,
    };

    const result = await llm.generateResponse(healthMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: { domain: 'health', intent, entities, usage: result.usage },
    };
}

module.exports = {
    name: 'health',
    description: 'Health guidance agent — symptom info, nutrition, maternal health, facility referral',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
