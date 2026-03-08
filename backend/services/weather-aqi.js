const { parseScreenContext } = require('./platform-context');

const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const CACHE_TTL_MS = 10 * 60 * 1000;

const _cache = new Map();

const WEATHER_DESCRIPTIONS = {
    0: { day: 'clear sky', night: 'clear night' },
    1: { day: 'mostly clear', night: 'mostly clear' },
    2: { day: 'partly cloudy', night: 'partly cloudy' },
    3: { day: 'overcast', night: 'overcast' },
    45: { day: 'foggy', night: 'foggy' },
    48: { day: 'foggy', night: 'foggy' },
    51: { day: 'light drizzle', night: 'light drizzle' },
    53: { day: 'drizzle', night: 'drizzle' },
    55: { day: 'dense drizzle', night: 'dense drizzle' },
    56: { day: 'light freezing drizzle', night: 'light freezing drizzle' },
    57: { day: 'freezing drizzle', night: 'freezing drizzle' },
    61: { day: 'light rain', night: 'light rain' },
    63: { day: 'rain', night: 'rain' },
    65: { day: 'heavy rain', night: 'heavy rain' },
    66: { day: 'light freezing rain', night: 'light freezing rain' },
    67: { day: 'freezing rain', night: 'freezing rain' },
    71: { day: 'light snowfall', night: 'light snowfall' },
    73: { day: 'snowfall', night: 'snowfall' },
    75: { day: 'heavy snowfall', night: 'heavy snowfall' },
    77: { day: 'snow grains', night: 'snow grains' },
    80: { day: 'light rain showers', night: 'light rain showers' },
    81: { day: 'rain showers', night: 'rain showers' },
    82: { day: 'heavy rain showers', night: 'heavy rain showers' },
    85: { day: 'light snow showers', night: 'light snow showers' },
    86: { day: 'snow showers', night: 'snow showers' },
    95: { day: 'thunderstorms', night: 'thunderstorms' },
    96: { day: 'thunderstorms with hail', night: 'thunderstorms with hail' },
    99: { day: 'severe thunderstorms with hail', night: 'severe thunderstorms with hail' },
};

const LOCATION_STOPWORDS = new Set([
    'what', 'is', 'the', 'weather', 'temperature', 'forecast', 'rain', 'aqi',
    'air', 'quality', 'pollution', 'status', 'report', 'today', 'now', 'here',
    'there', 'please', 'current', 'live', 'show', 'tell', 'me', 'my',
]);

function getLatestUserText(messages = []) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (msg?.role === 'user' && typeof msg.content === 'string') {
            return msg.content.trim();
        }
    }
    return '';
}

function normalizeLocationLabel(value = '') {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\bmostly\b.*$/i, '')
        .replace(/\bnearby\b/gi, '')
        .replace(/\btoday\b/gi, '')
        .replace(/\bnow\b/gi, '')
        .replace(/[?.!,।]+$/g, '')
        .trim();
}

function cleanLocationCandidate(value = '') {
    const cleaned = normalizeLocationLabel(value)
        .replace(/\b(?:city|town|village|district|state)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return '';

    const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.every((word) => LOCATION_STOPWORDS.has(word))) {
        return '';
    }

    return cleaned;
}

function parseLocationFromText(text = '') {
    const cleaned = normalizeLocationLabel(text);
    if (!cleaned) return '';

    const patterns = [
        /\b(?:weather|temperature|forecast|rain|aqi|air quality|pollution)\s+(?:for|in|at|near|of)\s+([a-zA-Z][a-zA-Z\s-]{1,50})/i,
        /\b(?:in|at|near|around|of)\s+([a-zA-Z][a-zA-Z\s-]{1,50})\b/i,
        /\b([a-zA-Z][a-zA-Z\s-]{1,40})\s+(?:weather|temperature|forecast|aqi|air quality|pollution)\b/i,
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match?.[1]) {
            return cleanLocationCandidate(match[1].replace(/\b(?:today|now|please|report|status|current)\b/gi, ''));
        }
    }

    return '';
}

function resolveLocationQuery({ entities = {}, messages = [], screenContext = '' }) {
    if (entities.location) return cleanLocationCandidate(entities.location);
    if (entities.city) return cleanLocationCandidate(entities.city);

    const latestUserText = getLatestUserText(messages);
    const parsedFromText = parseLocationFromText(latestUserText);
    if (parsedFromText) return parsedFromText;

    const parsedScreen = parseScreenContext(screenContext);
    const screenLocation = parsedScreen.values.location
        || parsedScreen.values.locationFilter
        || parsedScreen.values.visibleScope;
    if (screenLocation && !/^all india$/i.test(String(screenLocation).trim())) {
        return cleanLocationCandidate(screenLocation);
    }

    return '';
}

function buildCacheKey(locationQuery) {
    return String(locationQuery || '').toLowerCase().trim();
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    return res.json();
}

async function geocodeLocation(locationQuery) {
    const params = new URLSearchParams({
        name: locationQuery,
        count: '1',
        language: 'en',
        format: 'json',
    });
    const json = await fetchJson(`${GEOCODING_BASE}?${params.toString()}`);
    const result = Array.isArray(json.results) ? json.results[0] : null;

    if (!result) {
        throw new Error(`No geocoding match for "${locationQuery}"`);
    }

    const city = result.name || locationQuery;
    const state = result.admin1 || result.admin2 || '';
    const country = result.country || '';
    const labelParts = [city];
    if (state && !labelParts.includes(state)) labelParts.push(state);
    if (country && country !== 'India') labelParts.push(country);

    return {
        city,
        state,
        country,
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone || 'auto',
        displayName: labelParts.join(', '),
    };
}

async function fetchCurrentWeather(place) {
    const params = new URLSearchParams({
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        current: [
            'temperature_2m',
            'apparent_temperature',
            'relative_humidity_2m',
            'precipitation',
            'rain',
            'showers',
            'weather_code',
            'wind_speed_10m',
            'wind_direction_10m',
            'is_day',
        ].join(','),
        timezone: 'auto',
        forecast_days: '1',
    });

    const json = await fetchJson(`${WEATHER_BASE}?${params.toString()}`);
    return json.current || {};
}

async function fetchCurrentAirQuality(place) {
    const params = new URLSearchParams({
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        current: [
            'us_aqi',
            'pm2_5',
            'pm10',
            'carbon_monoxide',
            'nitrogen_dioxide',
            'sulphur_dioxide',
            'ozone',
        ].join(','),
        timezone: 'auto',
    });

    const json = await fetchJson(`${AIR_QUALITY_BASE}?${params.toString()}`);
    return json.current || {};
}

function describeWeatherCode(code, isDay) {
    const entry = WEATHER_DESCRIPTIONS[Number(code)];
    if (!entry) return 'mixed weather';
    return isDay ? entry.day : entry.night;
}

function classifyAqi(usAqi) {
    const value = Number(usAqi);
    if (!Number.isFinite(value)) return 'unavailable';
    if (value <= 50) return 'good';
    if (value <= 100) return 'moderate';
    if (value <= 150) return 'unhealthy for sensitive groups';
    if (value <= 200) return 'unhealthy';
    if (value <= 300) return 'very unhealthy';
    return 'hazardous';
}

function roundMaybe(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.round(num) : null;
}

function buildResponse({ intent, place, latestUserText, weather, airQuality }) {
    const asksAqi = String(intent || '').includes('air_quality')
        || /\baqi\b|air quality|pollution|smog|pm2\.?5|pm10/i.test(latestUserText);
    const asksWeather = String(intent || '').includes('weather')
        || /\bweather\b|temperature|forecast|rain|humidity|wind/i.test(latestUserText);

    const weatherDescription = describeWeatherCode(weather.weather_code, Number(weather.is_day) === 1);
    const temperature = roundMaybe(weather.temperature_2m);
    const feelsLike = roundMaybe(weather.apparent_temperature);
    const humidity = roundMaybe(weather.relative_humidity_2m);
    const windSpeed = roundMaybe(weather.wind_speed_10m);
    const precipitation = Number(weather.precipitation) || Number(weather.rain) || Number(weather.showers) || 0;

    const aqiValue = roundMaybe(airQuality.us_aqi);
    const pm25 = roundMaybe(airQuality.pm2_5);
    const pm10 = roundMaybe(airQuality.pm10);
    const aqiCategory = classifyAqi(aqiValue);

    const weatherBits = [];
    if (temperature != null) weatherBits.push(`${temperature}°C`);
    if (weatherDescription) weatherBits.push(weatherDescription);
    if (feelsLike != null && feelsLike !== temperature) weatherBits.push(`feels like ${feelsLike}°C`);
    if (humidity != null) weatherBits.push(`humidity ${humidity}%`);
    if (windSpeed != null) weatherBits.push(`wind ${windSpeed} km/h`);
    if (precipitation > 0) weatherBits.push(`precipitation ${precipitation.toFixed(1)} mm`);

    const aqiBits = [];
    if (aqiValue != null) aqiBits.push(`AQI ${aqiValue}`);
    if (aqiCategory !== 'unavailable') aqiBits.push(aqiCategory);
    if (pm25 != null) aqiBits.push(`PM2.5 ${pm25}`);
    if (pm10 != null) aqiBits.push(`PM10 ${pm10}`);

    const locationLabel = place.displayName || place.city;
    const weatherSummary = weatherBits.join(', ');
    const aqiSummary = aqiBits.join(', ');
    const weatherSentence = weatherSummary
        ? `In ${locationLabel}, it is currently ${weatherSummary}.`
        : '';
    const aqiSentence = aqiSummary
        ? `Air quality is ${aqiSummary}.`
        : '';

    if (asksAqi && aqiSentence && !asksWeather) {
        return weatherSummary
            ? `In ${locationLabel}, air quality is ${aqiSummary}. Current weather is ${weatherSummary}.`
            : `In ${locationLabel}, air quality is ${aqiSummary}.`;
    }

    if (asksWeather && weatherSentence && !aqiSentence) {
        return weatherSentence;
    }

    if (asksWeather && weatherSentence && aqiSentence) {
        return `${weatherSentence} ${aqiSentence}`;
    }

    if (aqiSentence && weatherSentence) {
        return `${aqiSentence} ${weatherSentence}`;
    }

    return weatherSentence || aqiSentence || `I found ${locationLabel}, but live weather data is unavailable right now.`;
}

async function getWeatherAndAqi({ intent = 'weather_info', entities = {}, messages = [], screenContext = '' } = {}) {
    const latestUserText = getLatestUserText(messages);
    const locationQuery = resolveLocationQuery({ entities, messages, screenContext });

    if (!locationQuery) {
        return {
            response: 'Please tell me your city name so I can check the live weather and air quality.',
            provider: 'weather-open-meteo',
            metadata: {
                domain: 'general',
                intent,
                source: 'open-meteo',
                missingLocation: true,
                followUp: {
                    pendingSlot: 'location',
                    intent,
                    intentDomain: 'general',
                    entities: { ...(entities || {}) },
                },
            },
        };
    }

    const cacheKey = buildCacheKey(locationQuery);
    const cached = _cache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
        return cached.data;
    }

    const place = await geocodeLocation(locationQuery);
    const [weather, airQuality] = await Promise.all([
        fetchCurrentWeather(place).catch(() => ({})),
        fetchCurrentAirQuality(place).catch(() => ({})),
    ]);

    const response = buildResponse({
        intent,
        place,
        latestUserText,
        weather,
        airQuality,
    });

    const result = {
        response,
        provider: 'weather-open-meteo',
        metadata: {
            domain: 'general',
            intent,
            source: 'open-meteo',
            entities: {
                location: place.displayName,
                city: place.city,
                state: place.state || '',
            },
            weather: {
                temperatureC: roundMaybe(weather.temperature_2m),
                feelsLikeC: roundMaybe(weather.apparent_temperature),
                humidityPercent: roundMaybe(weather.relative_humidity_2m),
                windSpeedKmh: roundMaybe(weather.wind_speed_10m),
                precipitationMm: Number(weather.precipitation) || Number(weather.rain) || Number(weather.showers) || 0,
                weatherCode: weather.weather_code ?? null,
                description: describeWeatherCode(weather.weather_code, Number(weather.is_day) === 1),
            },
            airQuality: {
                usAqi: roundMaybe(airQuality.us_aqi),
                category: classifyAqi(airQuality.us_aqi),
                pm25: roundMaybe(airQuality.pm2_5),
                pm10: roundMaybe(airQuality.pm10),
            },
        },
    };

    _cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
}

module.exports = {
    getWeatherAndAqi,
    resolveLocationQuery,
    parseLocationFromText,
    describeWeatherCode,
    classifyAqi,
};
