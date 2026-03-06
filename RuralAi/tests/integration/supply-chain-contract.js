/**
 * Supply Chain Contract Tests — mirrors supplyChainApi + logisticsApi
 * Used by: AgriMarketScreen (listings), various supply chain flows
 */

'use strict';

const { GET, POST, PUT,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape, assertGte,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  Listings (supplyChainApi)                      */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Supply Chain — Listings', () => {

  let listingId;

  test('POST /agriculture/listings creates listing (supplyChainApi.createListing)', async () => {
    const res = await POST('/agriculture/listings', {
      crop_type: 'maize',
      quantity_kg: 500,
      price_per_kg: 20,
      quality_grade: 'A',
      location: { state: 'bihar', district: 'patna' },
    });
    assertStatus(res, 201);
    listingId = res.body.id;
    assert(listingId, 'listing must return id');
  });

  test('GET /agriculture/listings returns paginated results (supplyChainApi.searchListings)', async () => {
    const res = await GET('/agriculture/listings');
    assertStatus(res, 200);
    // Screen iterates over results
    assert(res.body.listings || Array.isArray(res.body), 'listings data expected');
  });

  test('GET /agriculture/listings/:id returns detail (supplyChainApi.getListing)', async () => {
    if (!listingId) return skip('No listing');
    const res = await GET(`/agriculture/listings/${listingId}`);
    assertStatus(res, 200);
    assertExists(res.body, 'crop_type');
    assertExists(res.body, 'quantity_kg');
  });

  test('GET /agriculture/listings/my returns farmer listings (supplyChainApi.getMyListings)', async () => {
    const res = await GET('/agriculture/listings/my');
    assertStatus(res, 200);
  });

  test('GET /agriculture/buyers searches buyers (supplyChainApi.searchBuyers)', async () => {
    const res = await GET('/agriculture/buyers');
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Logistics (logisticsApi)                       */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Supply Chain — Logistics', () => {

  test('GET /agriculture/bargaining/groups returns groups (logisticsApi.getBargainingGroups)', async () => {
    const res = await GET('/agriculture/bargaining/groups');
    assertStatus(res, 200);
  });

  test('GET /agriculture/logistics/vehicles returns vehicle types', async () => {
    const res = await GET('/agriculture/logistics/vehicles');
    assertStatus(res, 200);
  });

  test('POST /agriculture/logistics/estimate returns cost', async () => {
    const res = await POST('/agriculture/logistics/estimate', {
      weight_kg: 1000,
    });
    assertStatus(res, 200);
  });
});
