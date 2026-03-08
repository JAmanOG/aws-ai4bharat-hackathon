global.fetch = jest.fn();

describe('weather-aqi service', () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch.mockReset();
  });

  test('asks for a city when no location can be resolved', async () => {
    const weatherAqi = require('../../services/weather-aqi');

    const result = await weatherAqi.getWeatherAndAqi({
      intent: 'weather_info',
      messages: [{ role: 'user', content: 'what is the weather today?' }],
      entities: {},
      screenContext: '',
    });

    expect(result.response).toMatch(/city name/i);
    expect(result.metadata.missingLocation).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('fetches current weather and AQI for a city entity', async () => {
    const weatherAqi = require('../../services/weather-aqi');

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            name: 'Pune',
            admin1: 'Maharashtra',
            country: 'India',
            latitude: 18.52,
            longitude: 73.85,
            timezone: 'Asia/Kolkata',
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 28.2,
            apparent_temperature: 30.1,
            relative_humidity_2m: 54,
            precipitation: 0,
            weather_code: 2,
            wind_speed_10m: 9.4,
            is_day: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            us_aqi: 74,
            pm2_5: 19.2,
            pm10: 34.1,
          },
        }),
      });

    const result = await weatherAqi.getWeatherAndAqi({
      intent: 'weather_info',
      entities: { location: 'Pune' },
      messages: [{ role: 'user', content: 'What is the weather in Pune?' }],
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(String(global.fetch.mock.calls[0][0])).toContain('name=Pune');
    expect(result.provider).toBe('weather-open-meteo');
    expect(result.response).toContain('Pune, Maharashtra');
    expect(result.response).toContain('AQI 74');
    expect(result.metadata.entities.location).toBe('Pune, Maharashtra');
    expect(result.metadata.weather.temperatureC).toBe(28);
    expect(result.metadata.airQuality.category).toBe('moderate');
  });

  test('uses screen context location when the user asks for AQI here', async () => {
    const weatherAqi = require('../../services/weather-aqi');

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            name: 'Nagpur',
            admin1: 'Maharashtra',
            country: 'India',
            latitude: 21.15,
            longitude: 79.09,
            timezone: 'Asia/Kolkata',
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 31.1,
            apparent_temperature: 33.3,
            relative_humidity_2m: 40,
            precipitation: 0,
            weather_code: 1,
            wind_speed_10m: 11.2,
            is_day: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            us_aqi: 112,
            pm2_5: 44.7,
            pm10: 78.9,
          },
        }),
      });

    const result = await weatherAqi.getWeatherAndAqi({
      intent: 'air_quality_info',
      entities: {},
      messages: [{ role: 'user', content: 'What is the AQI here?' }],
      screenContext: 'User is on screen: MarketPrices. Location: Nagpur. visibleScope: Nagpur.',
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(String(global.fetch.mock.calls[0][0])).toContain('name=Nagpur');
    expect(result.response).toContain('Nagpur, Maharashtra');
    expect(result.response).toContain('unhealthy for sensitive groups');
    expect(result.metadata.airQuality.usAqi).toBe(112);
  });
});
