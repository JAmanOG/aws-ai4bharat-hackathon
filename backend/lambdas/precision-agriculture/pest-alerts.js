/**
 * Precision Agriculture – pest and disease early warning logic.
 * Req 6.2: Early warning alerts through image recognition and field evidence.
 */

const PEST_RULES = [
    {
        id: 'rice_blast',
        crop: 'rice',
        labels: ['rice blast', 'blast'],
        symptomKeywords: ['diamond lesion', 'leaf spot', 'blast'],
        weatherRule: (weather) => weather.humidity_pct >= 85 && weather.rain_mm >= 15,
        treatment: 'Start immediate scouting in humid pockets and isolate severely infected leaves.',
        preventive: 'Reduce prolonged leaf wetness and avoid excessive nitrogen in the next dose.',
    },
    {
        id: 'wheat_rust',
        crop: 'wheat',
        labels: ['wheat rust', 'rust'],
        symptomKeywords: ['orange pustule', 'yellow stripe', 'rust'],
        weatherRule: (weather) => weather.humidity_pct >= 70 && weather.temp_max_c <= 28,
        treatment: 'Prioritize field scouting and confirm rust spread before a fungicide decision.',
        preventive: 'Avoid dense canopy and watch for spread along wind direction.',
    },
    {
        id: 'tomato_leaf_curl',
        crop: 'tomato',
        labels: ['leaf curl', 'tomato leaf curl virus'],
        symptomKeywords: ['leaf curl', 'stunted growth', 'yellowing'],
        weatherRule: (weather) => weather.temp_max_c >= 30,
        treatment: 'Rogue the worst-affected plants and inspect whitefly pressure immediately.',
        preventive: 'Use yellow sticky traps and avoid planting infected nursery material.',
    },
    {
        id: 'cotton_whitefly',
        crop: 'cotton',
        labels: ['whitefly', 'cotton whitefly'],
        symptomKeywords: ['honeydew', 'sooty mold', 'leaf curl'],
        weatherRule: (weather) => weather.temp_max_c >= 28 && weather.humidity_pct >= 60,
        treatment: 'Inspect undersides of leaves and use threshold-based IPM, not blanket sprays.',
        preventive: 'Preserve beneficial insects and rotate chemistry if spraying becomes necessary.',
    },
];

function normalizeDetections(detections) {
    if (!Array.isArray(detections)) return [];
    return detections.map((item) => ({
        label: String(item.label || '').toLowerCase(),
        confidence: Number(item.confidence || 0),
    }));
}

function detectPestAlerts(payload) {
    const cropType = String(payload.crop_type || '').toLowerCase();
    const text = [
        ...(Array.isArray(payload.observed_symptoms) ? payload.observed_symptoms : []),
        payload.notes || '',
    ].join(' | ').toLowerCase();
    const detections = normalizeDetections(payload.detections);
    const weather = payload.weather || {};

    const alerts = PEST_RULES
        .filter((rule) => rule.crop === cropType)
        .map((rule) => {
            const symptomScore = rule.symptomKeywords.filter((keyword) => text.includes(keyword)).length * 25;
            const detectionScore = detections
                .filter((item) => rule.labels.some((label) => item.label.includes(label)))
                .reduce((max, item) => Math.max(max, item.confidence), 0) * 0.6;
            const weatherScore = rule.weatherRule(weather) ? 15 : 0;
            const total = Math.round(symptomScore + detectionScore + weatherScore);

            if (total < 40) return null;

            let severity = 'medium';
            if (total >= 85) severity = 'critical';
            else if (total >= 65) severity = 'high';

            return {
                alert_type: rule.id,
                issue: rule.id.replace(/_/g, ' '),
                confidence: Math.min(99, total),
                severity,
                treatment: rule.treatment,
                preventive_action: rule.preventive,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.confidence - a.confidence);

    if (alerts.length === 0 && (text.includes('hole') || text.includes('chewed') || text.includes('insect'))) {
        alerts.push({
            alert_type: 'generic_pest_pressure',
            issue: 'generic pest pressure',
            confidence: 52,
            severity: 'medium',
            treatment: 'Scout 20 plants before spraying and confirm the pest stage with a local expert.',
            preventive_action: 'Use threshold-based integrated pest management instead of preventive blanket spraying.',
        });
    }

    return {
        crop_type: payload.crop_type,
        alerts,
        scouting_checklist: [
            'Inspect 10 to 20 plants from different field patches.',
            'Check the underside of leaves and new growth first.',
            'Photograph one affected leaf and one full plant for comparison tomorrow.',
        ],
        next_review_in_hours: alerts.some((alert) => alert.severity === 'critical') ? 12 : 24,
        generatedAt: new Date().toISOString(),
    };
}

module.exports = {
    detectPestAlerts,
};
