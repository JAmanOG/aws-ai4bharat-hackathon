/**
 * Precision Agriculture – image and field observation analysis.
 * Req 6.1: Analyze crop/soil/weather evidence and return recommendations.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { GEMINI_MODEL, GEMINI_API_KEY } = require('../../utils/constants');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const BEDROCK_MODEL_ID = process.env.PRECISION_BEDROCK_MODEL_ID
    || process.env.BEDROCK_MODEL_ID
    || 'anthropic.claude-3-haiku-20240307-v1:0';
const BEDROCK_ENABLED = process.env.PRECISION_ENABLE_BEDROCK === 'true';

const ISSUE_RULES = [
    {
        id: 'nitrogen_deficiency',
        keywords: ['yellow', 'yellowing', 'chlorosis', 'pale leaves'],
        issue: 'Possible nitrogen deficiency',
        severityBoost: 2,
        actions: [
            'Apply split nitrogen based on crop stage instead of a single heavy dose.',
            'Use neem-coated urea or compost-enriched top dressing where possible.',
            'Recheck irrigation after application so nutrients are not lost.',
        ],
        prevention: [
            'Schedule soil testing before the next fertilizer cycle.',
            'Combine nitrogen with organic matter to improve nutrient retention.',
        ],
    },
    {
        id: 'potassium_deficiency',
        keywords: ['brown edge', 'leaf burn', 'scorched margin', 'curling edge'],
        issue: 'Possible potassium deficiency',
        severityBoost: 1,
        actions: [
            'Apply potash as per crop recommendation and irrigate lightly after application.',
            'Remove severely damaged leaves only if the canopy remains healthy.',
        ],
        prevention: [
            'Balance NPK application instead of repeating nitrogen-only feeding.',
        ],
    },
    {
        id: 'fungal_leaf_spot',
        keywords: ['spot', 'lesion', 'diamond patch', 'powdery growth', 'mildew'],
        issue: 'Fungal disease pressure is likely',
        severityBoost: 2,
        actions: [
            'Remove the most infected leaves and avoid overhead irrigation for 48 hours.',
            'Scout 10 to 20 plants across the field before any spray decision.',
            'Use a crop-specific fungicide only after confirming the disease locally.',
        ],
        prevention: [
            'Improve field aeration and avoid late-evening irrigation.',
            'Do not repeat the same chemistry continuously; rotate modes of action.',
        ],
    },
    {
        id: 'water_stress',
        keywords: ['wilting', 'drooping', 'rolled leaves', 'dry soil', 'cracked soil'],
        issue: 'Moisture stress detected',
        severityBoost: 2,
        actions: [
            'Check root-zone moisture before the next irrigation cycle.',
            'Irrigate in shorter controlled turns instead of flooding the plot.',
            'Add mulch where feasible to reduce evaporation.',
        ],
        prevention: [
            'Track irrigation intervals against crop stage and forecast temperature.',
        ],
    },
    {
        id: 'soil_compaction',
        keywords: ['hard soil', 'surface crust', 'compacted', 'poor infiltration'],
        issue: 'Soil compaction may be reducing root growth',
        severityBoost: 1,
        actions: [
            'Avoid working the field when soil is too wet.',
            'Add organic matter and break compaction in the next field operation window.',
        ],
        prevention: [
            'Reduce repeated tractor passes in the same strip.',
        ],
    },
];

function normalizeSymptoms(payload) {
    const symptoms = Array.isArray(payload.observed_symptoms) ? payload.observed_symptoms : [];
    const notes = typeof payload.notes === 'string' ? [payload.notes] : [];
    const soilNotes = typeof payload.soil_condition === 'string' ? [payload.soil_condition] : [];
    return [...symptoms, ...notes, ...soilNotes]
        .join(' | ')
        .toLowerCase();
}

function mapSeverity(score) {
    if (score >= 5) return 'critical';
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
}

function buildAdvisoryPrompt(payload) {
    return `You are an agronomist for Indian smallholder farmers.
Review the field report and respond in strict JSON.

FIELD REPORT:
- Crop: ${payload.crop_type || 'unknown'}
- Image type: ${payload.image_type || 'crop'}
- Crop stage: ${payload.crop_stage || 'unknown'}
- Observed symptoms: ${JSON.stringify(payload.observed_symptoms || [])}
- Notes: ${payload.notes || 'none'}
- Soil condition: ${payload.soil_condition || 'unknown'}
- Weather context: ${JSON.stringify(payload.weather || {})}

Return JSON:
{
  "issue_identified": "short diagnosis",
  "severity": "low|medium|high|critical",
  "confidence": 0-100,
  "recommended_actions": ["action 1"],
  "preventive_actions": ["prevention 1"],
  "follow_up_questions": ["question 1"]
}`;
}

function runRuleBasedDiagnosis(payload) {
    const text = normalizeSymptoms(payload);
    const matches = ISSUE_RULES.filter((rule) =>
        rule.keywords.some((keyword) => text.includes(keyword))
    );

    const weather = payload.weather || {};
    const extraSeverity = (weather.humidity_pct >= 85 ? 1 : 0)
        + (weather.rain_mm >= 20 ? 1 : 0)
        + (weather.temp_max_c >= 38 ? 1 : 0);
    const totalSeverity = matches.reduce((sum, rule) => sum + rule.severityBoost, 0) + extraSeverity;

    const recommendedActions = [...new Set(matches.flatMap((rule) => rule.actions))];
    const preventiveActions = [...new Set(matches.flatMap((rule) => rule.prevention))];

    let issueIdentified = 'General crop stress detected';
    if (matches.length === 1) {
        issueIdentified = matches[0].issue;
    } else if (matches.length > 1) {
        issueIdentified = `${matches[0].issue} with overlapping field stress indicators`;
    } else if ((payload.image_type || '').toLowerCase() === 'soil') {
        issueIdentified = 'Soil condition needs a moisture and texture check';
    }

    if (recommendedActions.length === 0) {
        recommendedActions.push(
            'Capture one close-up leaf image and one full-plant image for better confirmation.',
            'Check irrigation timing, fertilizer history, and pest presence before taking action.'
        );
    }

    if (preventiveActions.length === 0) {
        preventiveActions.push(
            'Maintain a field diary with irrigation, fertilizer, and spray events for the next 7 days.'
        );
    }

    return {
        issue_identified: issueIdentified,
        severity: mapSeverity(totalSeverity),
        confidence: Math.min(92, 45 + matches.length * 18 + extraSeverity * 8),
        recommended_actions: recommendedActions,
        preventive_actions: preventiveActions,
        follow_up_questions: [
            'How many days ago did the symptom first appear?',
            'Is the issue spread across the whole field or only in patches?',
            'Was fertilizer or pesticide applied in the last 7 days?',
        ],
        contributing_signals: matches.map((rule) => rule.id),
    };
}

async function invokeBedrockAdvisory(payload) {
    const prompt = buildAdvisoryPrompt(payload);
    const response = await bedrock.send(new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
        }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
        throw new Error('Failed to parse precision advisory response');
    }

    return JSON.parse(jsonMatch[0]);
}

async function invokeGeminiAdvisory(payload) {
    const apiKey = GEMINI_API_KEY();
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const prompt = buildAdvisoryPrompt(payload);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse Gemini advisory response');
    return JSON.parse(jsonMatch[0]);
}

async function analyzeFarmImage(payload) {
    const fallback = runRuleBasedDiagnosis(payload);

    if (!BEDROCK_ENABLED) {
        return {
            ...fallback,
            engine: 'rules',
            generatedAt: new Date().toISOString(),
        };
    }

    try {
        const modelResult = await invokeBedrockAdvisory(payload);
        return {
            ...fallback,
            ...modelResult,
            engine: 'bedrock',
            generatedAt: new Date().toISOString(),
        };
    } catch (bedrockErr) {
        console.warn('[Advisory] Bedrock failed, trying Gemini fallback:', bedrockErr.message);
        try {
            const geminiResult = await invokeGeminiAdvisory(payload);
            return {
                ...fallback,
                ...geminiResult,
                engine: 'gemini',
                generatedAt: new Date().toISOString(),
            };
        } catch (geminiErr) {
            console.warn('[Advisory] Gemini fallback also failed:', geminiErr.message);
            return {
                ...fallback,
                engine: 'rules-fallback',
                warning: `AI advisory unavailable (Bedrock: ${bedrockErr.message}, Gemini: ${geminiErr.message}). Using rule-based analysis.`,
                generatedAt: new Date().toISOString(),
            };
        }
    }
}

module.exports = {
    analyzeFarmImage,
    buildAdvisoryPrompt,
    runRuleBasedDiagnosis,
};
