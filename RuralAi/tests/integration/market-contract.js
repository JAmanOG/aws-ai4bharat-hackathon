/**
 * Market Data Contract Tests — mirrors marketApi + alertsApi
 * Used by: MarketPricesScreen, AgriMarketScreen, AlertsScreen
 */

'use strict';

const { GET, POST, DELETE,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape, assertGte,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  Market Prices (marketApi — MarketPricesScreen) */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Market — Prices (MarketPricesScreen)', () => {

  test('GET /agriculture/prices/wheat returns PricesResult shape', async () => {
    const res = await GET('/agriculture/prices/wheat');
    assertStatus(res, 200);
    // Backend returns: { crop_type, prices[], summary }
    assertExists(res.body, 'crop_type');
    assertExists(res.body, 'prices');
    assertArray(res.body.prices);
    assertExists(res.body, 'summary');
  });

  test('GET /agriculture/prices/rice with state filter', async () => {
    const res = await GET('/agriculture/prices/rice', { state: 'punjab' });
    assertStatus(res, 200);
    assertExists(res.body, 'prices');
  });

  test('GET /agriculture/prices/:crop/trend returns trend data', async () => {
    const res = await GET('/agriculture/prices/wheat/trend', { days: 30 });
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Mandis (marketApi — AgriMarketScreen)          */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Market — Mandis (AgriMarketScreen)', () => {

  test('GET /agriculture/mandis returns { mandis[] } with expected shape', async () => {
    const res = await GET('/agriculture/mandis');
    assertStatus(res, 200);
    assertExists(res.body, 'mandis');
    assertArray(res.body.mandis);
    if (res.body.mandis.length > 0) {
      // Backend returns mandi_name, mandi_code, state
      assertShape(res.body.mandis[0], ['mandi_name', 'mandi_code', 'state'], 'Mandi');
    }
  });

  test('GET /agriculture/mandis with state filter', async () => {
    const res = await GET('/agriculture/mandis', { state: 'punjab' });
    assertStatus(res, 200);
    assertExists(res.body, 'mandis');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Price Alerts (alertsApi — AlertsScreen)        */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Market — Price Alerts (AlertsScreen)', () => {

  let alertId;

  test('POST /agriculture/alerts creates alert (alertsApi.createAlert)', async () => {
    const res = await POST('/agriculture/alerts', {
      crop_type: 'rice',
    });
    assertStatus(res, [200, 201]);
    alertId = res.body.alertId || res.body.alert_id || res.body.id;
    assert(alertId, 'alert must return an ID');
  });

  test('GET /agriculture/alerts returns { alerts: PriceAlert[] }', async () => {
    const res = await GET('/agriculture/alerts');
    assertStatus(res, 200);
    assertExists(res.body, 'alerts');
    assertArray(res.body.alerts);
    if (res.body.alerts.length > 0) {
      // Backend returns alertId (camelCase)
      const a = res.body.alerts[0];
      assert(a.alertId || a.alert_id || a.id, 'alert needs id');
      assertExists(a, 'crop_type');
    }
  });

  test('DELETE /agriculture/alerts/:id removes alert (alertsApi.deleteAlert)', async () => {
    if (!alertId) return skip('No alert to delete');
    const res = await DELETE(`/agriculture/alerts/${alertId}`);
    assertStatus(res, [200, 204]);
  });
});
