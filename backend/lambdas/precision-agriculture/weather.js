/**
 * Precision Agriculture – weather risk and disaster preparedness guidance.
 * Req 6.4: Disaster preparedness based on local weather patterns.
 */

function toRiskLevel(score) {
    if (score >= 90) return 'critical';
    if (score >= 65) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

function buildWeatherAdvisory(payload) {
    const forecast = Array.isArray(payload.forecast) ? payload.forecast : [];
    const alerts = [];

    forecast.forEach((day) => {
        const rain = Number(day.rain_mm || 0);
        const wind = Number(day.wind_kph || 0);
        const humidity = Number(day.humidity_pct || 0);
        const tempMax = Number(day.temp_max_c || 0);
        const tempMin = Number(day.temp_min_c || 0);
        const date = day.date || 'upcoming period';

        if (rain >= 65) {
            alerts.push({
                hazard_type: 'heavy_rain',
                risk_level: toRiskLevel(85 + Math.min(15, rain - 65)),
                date,
                probable_impact: 'Waterlogging, lodging, and fertilizer runoff are likely.',
                recommended_actions: [
                    'Open drainage channels and protect low-lying field sections today.',
                    'Pause fertilizer application until rain intensity drops.',
                ],
            });
        }

        if (wind >= 50) {
            alerts.push({
                hazard_type: 'high_wind',
                risk_level: toRiskLevel(60 + Math.min(30, wind - 50)),
                date,
                probable_impact: 'Weak stems, trellised crops, and temporary structures may be damaged.',
                recommended_actions: [
                    'Secure trellis lines and postpone spraying during high-wind windows.',
                    'Harvest market-ready produce early if wind-sensitive.',
                ],
            });
        }

        if (tempMax >= 38) {
            alerts.push({
                hazard_type: 'heat_stress',
                risk_level: toRiskLevel(55 + Math.min(35, tempMax - 38)),
                date,
                probable_impact: 'Heat stress can reduce flowering, fruit set, and soil moisture.',
                recommended_actions: [
                    'Advance irrigation to cooler hours and use mulch where possible.',
                    'Avoid foliar sprays during midday heat.',
                ],
            });
        }

        if (tempMin <= 8) {
            alerts.push({
                hazard_type: 'cold_stress',
                risk_level: toRiskLevel(50 + Math.min(35, 8 - tempMin)),
                date,
                probable_impact: 'Young plants may face cold shock and slower recovery.',
                recommended_actions: [
                    'Avoid night irrigation and protect nursery areas with available covers.',
                    'Delay sensitive transplanting until the cold window passes.',
                ],
            });
        }

        if (humidity >= 85 && rain >= 10) {
            alerts.push({
                hazard_type: 'disease_pressure',
                risk_level: 'medium',
                date,
                probable_impact: 'Leaf wetness and humidity increase fungal disease pressure.',
                recommended_actions: [
                    'Scout the crop within 24 hours after the rain event.',
                    'Improve field aeration and avoid dense canopy moisture retention.',
                ],
            });
        }
    });

    const sortedAlerts = alerts.sort((a, b) => {
        const weight = { critical: 4, high: 3, medium: 2, low: 1 };
        return weight[b.risk_level] - weight[a.risk_level];
    });

    return {
        crop_type: payload.crop_type || null,
        location: payload.location || null,
        alerts: sortedAlerts,
        summary: sortedAlerts.length
            ? `Preparedness needed for ${sortedAlerts[0].hazard_type.replace(/_/g, ' ')} conditions.`
            : 'No major weather-triggered advisory detected from the submitted forecast.',
        proactive_steps: [
            'Review irrigation, drainage, and spray plans against the next 72 hours.',
            'Share critical alerts with nearby farmers if the same weather band affects the cluster.',
        ],
        generatedAt: new Date().toISOString(),
    };
}

module.exports = {
    buildWeatherAdvisory,
};
