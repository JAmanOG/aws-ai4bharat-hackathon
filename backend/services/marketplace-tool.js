const listings = require('../lambdas/supply-chain-api/listings');
const buyers = require('../lambdas/supply-chain-api/buyers');
const liveFetcher = require('./market-data-fetcher');
const userService = require('./user');
const { APP_NAME } = require('./brand');

const ACTIVE_STATUSES = new Set(['active']);
const OPEN_ORDER_STATUSES = new Set(['pending', 'confirmed', 'accepted', 'in_transit']);

function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function capitalizeWords(value) {
    return String(value || '')
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function compactSpaces(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function getLatestUserMessage(messages = []) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === 'user' && typeof messages[i]?.content === 'string') {
            return messages[i].content;
        }
    }
    return '';
}

function detectMarketplaceAction({ intent = '', text = '' }) {
    const normalizedIntent = String(intent || '').toLowerCase();
    const lower = String(text || '').toLowerCase();

    if (
        /cancel.*listing|remove.*listing|delete.*listing|close.*listing|stop.*listing|listing.*cancel|लिस्टिंग.*हटा|लिस्टिंग.*बंद|remove sell order/.test(lower)
    ) {
        return 'cancel_listing';
    }

    if (/mark.*sold|sold.*listing|listing.*sold|बेच.*हो गया|sold out/.test(lower)) {
        return 'mark_sold';
    }

    if (
        normalizedIntent === 'contact_buyer'
        ||
        /contact.*buyer|call.*buyer|buyer.*number|buyer.*phone|connect.*buyer|talk to buyer|buyer contact|खरीदार.*नंबर|buyer details/.test(lower)
    ) {
        return 'contact_buyer';
    }

    if (
        normalizedIntent === 'create_listing'
        || /i want to sell|want to sell|sell\s+\d|list my|create listing|post listing|sell order|sale order|बेचना|बेचनी|बेचना है|लिस्ट कर|लिस्टिंग बना/.test(lower)
    ) {
        return 'create_listing';
    }

    if (
        normalizedIntent === 'orders'
        || /my orders|incoming orders|order updates|show orders|buyer requests|requests|ऑर्डर|रिक्वेस्ट/.test(lower)
    ) {
        return 'show_orders';
    }

    if (
        normalizedIntent === 'buyer_connection'
        || /buyers nearby|buyer nearby|find buyers|show buyers|interested buyer|खरीदार|buyer/.test(lower)
    ) {
        return 'show_buyers';
    }

    return 'market_dashboard';
}

function extractCrop(text = '', entities = {}) {
    if (entities.crop) {
        return liveFetcher.normalizeCropName(entities.crop);
    }

    const cleaned = compactSpaces(text).toLowerCase();
    if (!cleaned) return '';

    const match = cleaned.match(/\b(wheat|rice|paddy|cotton|maize|corn|soybean|soyabean|tomato|potato|onion|mustard|sugarcane|chana|moong|urad|bajra|jowar|okra|vegetable|vegetables)\b/);
    return match?.[1] ? liveFetcher.normalizeCropName(match[1]) : '';
}

function extractQuantityKg(text = '', entities = {}) {
    const direct = toNumber(
        entities.quantity_kg
        || entities.quantityKg
        || entities.quantity
        || entities.amount_kg
    );
    if (direct > 0) return direct;

    const lower = String(text || '').toLowerCase();
    const match = lower.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|quintals?|qtl|qtl\.|tons?|tonnes?|टन|किलो)/i);
    if (!match) return 0;

    const value = Number(match[1]);
    const unit = String(match[2] || '').toLowerCase();
    if (!Number.isFinite(value)) return 0;
    if (unit.startsWith('quintal') || unit.startsWith('qtl')) return value * 100;
    if (unit.startsWith('ton') || unit === 'टन') return value * 1000;
    return value;
}

function extractPricePerKg(text = '', entities = {}) {
    const direct = toNumber(
        entities.price_per_kg
        || entities.pricePerKg
        || entities.offer_price
        || entities.agreed_price_per_kg
        || entities.price
    );
    if (direct > 0) return direct;

    const lower = String(text || '').toLowerCase();
    const patterns = [
        /(?:at|for|price|offer|asking price|rate)\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:\/|per)?\s*(kg|kilogram|quintal|qtl)?/i,
        /₹\s*(\d+(?:\.\d+)?)\s*(?:\/|per)?\s*(kg|kilogram|quintal|qtl)?/i,
        /(\d+(?:\.\d+)?)\s*(?:rupees|rs)\s*(?:\/|per)?\s*(kg|kilogram|quintal|qtl)?/i,
    ];

    for (const pattern of patterns) {
        const match = lower.match(pattern);
        if (!match) continue;
        const amount = Number(match[1]);
        const unit = String(match[2] || 'kg').toLowerCase();
        if (!Number.isFinite(amount) || amount <= 0) continue;
        if (unit.startsWith('quintal') || unit.startsWith('qtl')) return amount / 100;
        return amount;
    }

    return 0;
}

function mapListing(listing) {
    if (!listing) return null;
    const quantityKg = toNumber(listing.quantity_kg);
    const pricePerKg = toNumber(listing.price_per_kg);

    return {
        id: listing.id,
        cropType: String(listing.crop_type || ''),
        title: `${capitalizeWords(listing.crop_type)} - ${Math.round(quantityKg)}kg`,
        quantityKg,
        pricePerKg,
        pricePerQuintal: pricePerKg > 0 ? Math.round(pricePerKg * 100) : 0,
        qualityGrade: String(listing.quality_grade || 'standard'),
        visibilityLabel: ACTIVE_STATUSES.has(String(listing.status || 'active')) ? 'Visible to buyers' : capitalizeWords(listing.status || 'inactive'),
        locationState: String(listing.location_state || ''),
        locationDistrict: String(listing.location_district || ''),
        status: String(listing.status || 'active'),
        description: String(listing.description || ''),
        createdAt: listing.created_at || null,
    };
}

function mapBuyerOrder(order, buyer) {
    const quantityKg = toNumber(order.quantity_kg);
    const pricePerKg = toNumber(order.agreed_price_per_kg);

    return {
        id: order.id,
        kind: 'order',
        title: String(buyer?.business_name || order.business_name || 'Interested buyer'),
        subtitle: capitalizeWords(buyer?.business_type || 'verified buyer'),
        demandKg: quantityKg,
        offerPricePerKg: pricePerKg,
        offerPricePerQuintal: pricePerKg > 0 ? Math.round(pricePerKg * 100) : 0,
        verified: !!buyer?.is_verified,
        trustScore: toNumber(buyer?.trust_score),
        locationLabel: [buyer?.location_district, buyer?.location_state].filter(Boolean).join(', '),
        contactPhone: String(buyer?.contact_phone || ''),
        contactEmail: String(buyer?.contact_email || ''),
        status: String(order.status || 'pending'),
        notes: String(order.notes || ''),
    };
}

function mapBuyerMatch(buyer, cropType = '') {
    return {
        id: buyer.id,
        kind: 'buyer',
        title: String(buyer.business_name || 'Verified buyer'),
        subtitle: capitalizeWords(buyer.business_type || 'buyer'),
        demandKg: 0,
        offerPricePerKg: 0,
        offerPricePerQuintal: 0,
        verified: !!buyer.is_verified,
        trustScore: toNumber(buyer.trust_score),
        locationLabel: [buyer.location_district, buyer.location_state].filter(Boolean).join(', '),
        contactPhone: String(buyer.contact_phone || ''),
        contactEmail: String(buyer.contact_email || ''),
        interestLabel: cropType ? `Interested in ${capitalizeWords(cropType)}` : 'Interested buyer nearby',
    };
}

function mapNearbyListing(listing) {
    if (!listing) return null;
    const quantityKg = toNumber(listing.quantity_kg);
    const pricePerKg = toNumber(listing.price_per_kg);
    return {
        id: listing.id,
        cropType: String(listing.crop_type || ''),
        quantityKg,
        pricePerKg,
        pricePerQuintal: pricePerKg > 0 ? Math.round(pricePerKg * 100) : 0,
        locationLabel: [listing.location_district, listing.location_state].filter(Boolean).join(', '),
        qualityGrade: String(listing.quality_grade || 'standard'),
    };
}

function buildProfileCard(profile = {}) {
    const missingFields = [];
    if (!profile?.name) missingFields.push('name');
    if (!profile?.phone) missingFields.push('phone');
    if (!profile?.state) missingFields.push('state');
    if (!profile?.district) missingFields.push('district');
    if (!profile?.pincode) missingFields.push('pincode');

    return {
        name: String(profile?.name || ''),
        phone: String(profile?.phone || ''),
        state: String(profile?.state || ''),
        district: String(profile?.district || ''),
        pincode: String(profile?.pincode || ''),
        village: String(profile?.village || ''),
        missingFields,
        readinessLabel: missingFields.length === 0 ? 'Saved seller profile ready' : `Missing ${missingFields.join(', ')}`,
    };
}

function buildDashboardSummary({ activeListing, buyerRequests, nearbyListings, profileCard }) {
    const parts = [];
    if (activeListing) {
        parts.push(`Your ${capitalizeWords(activeListing.cropType)} listing is live`);
    } else {
        parts.push('You do not have an active listing yet');
    }
    if (buyerRequests.length > 0) {
        parts.push(`${buyerRequests.length} buyer matches are ready`);
    }
    if (nearbyListings.length > 0) {
        parts.push(`${nearbyListings.length} nearby market listings are visible`);
    }
    if (profileCard.missingFields.length > 0) {
        parts.push(`profile is missing ${profileCard.missingFields.join(', ')}`);
    }
    return parts.join('. ');
}

function pickTargetListing(listingsList = [], crop = '') {
    if (!Array.isArray(listingsList) || listingsList.length === 0) return null;
    if (!crop) return listingsList.length === 1 ? listingsList[0] : listingsList[0];
    return listingsList.find((item) => liveFetcher.normalizeCropName(item.crop_type) === crop) || null;
}

async function buildDashboard({ userId, cropHint = '', stateHint = '', districtHint = '' }) {
    const profile = await userService.getUnifiedProfile(userId);
    const activeListings = await listings.getFarmerListings(userId, 'active');
    const activeListing = pickTargetListing(activeListings, cropHint);
    const profileCropHint = Array.isArray(profile?.crops)
        ? String(profile.crops[0] || '')
        : String(profile?.crops || '');

    const focusCrop = cropHint
        || (activeListing?.crop_type ? liveFetcher.normalizeCropName(activeListing.crop_type) : '')
        || (profileCropHint ? liveFetcher.normalizeCropName(profileCropHint) : '');
    const focusState = stateHint || activeListing?.location_state || profile?.state || '';
    const focusDistrict = districtHint || activeListing?.location_district || profile?.district || '';

    const [ordersRaw, buyersRaw, nearbyRaw] = await Promise.all([
        buyers.getOrders(userId, 'farmer').catch(() => []),
        focusCrop
            ? buyers.searchBuyers({
                crop_type: focusCrop,
                state: focusState || undefined,
                district: focusDistrict || undefined,
                verified_only: true,
                limit: 6,
            }).catch(() => ({ buyers: [] }))
            : Promise.resolve({ buyers: [] }),
        listings.searchListings({
            crop_type: focusCrop || undefined,
            state: focusState || undefined,
            district: focusDistrict || undefined,
            page: 1,
            limit: 6,
        }).catch(() => ({ listings: [] })),
    ]);

    const openOrders = Array.isArray(ordersRaw)
        ? ordersRaw.filter((order) => OPEN_ORDER_STATUSES.has(String(order.status || '').toLowerCase()))
        : [];

    let buyerRequests = [];
    if (openOrders.length > 0) {
        const enriched = await Promise.all(
            openOrders.slice(0, 4).map(async (order) => {
                const buyerProfile = order?.buyer_id
                    ? await buyers.getBuyerById(order.buyer_id).catch(() => null)
                    : null;
                return mapBuyerOrder(order, buyerProfile);
            })
        );
        buyerRequests = enriched.filter(Boolean);
    }

    if (buyerRequests.length === 0) {
        buyerRequests = (buyersRaw?.buyers || []).slice(0, 4).map((buyer) => mapBuyerMatch(buyer, focusCrop));
    }

    const nearbyListings = (nearbyRaw?.listings || [])
        .filter((listing) => String(listing.farmer_id || '') !== String(userId))
        .slice(0, 4)
        .map(mapNearbyListing)
        .filter(Boolean);

    const profileCard = buildProfileCard(profile || {});
    const normalizedActiveListing = mapListing(activeListing);

    return {
        focusCrop,
        focusState,
        focusDistrict,
        prompt: 'Tap and hold the mic.',
        examples: [
            'I want to sell 1000kg of wheat',
            'Are there buyers nearby?',
            'Mark my listing as sold',
        ],
        summary: buildDashboardSummary({
            activeListing: normalizedActiveListing,
            buyerRequests,
            nearbyListings,
            profileCard,
        }),
        activeListing: normalizedActiveListing,
        buyerRequests,
        buyerSectionTitle: openOrders.length > 0 ? 'Verified Buyer Requests' : 'Verified Buyers Nearby',
        nearbyListings,
        contactProfile: profileCard,
    };
}

function buildMissingFieldResponse(missingFields = []) {
    if (!missingFields.length) {
        return 'I need a few more listing details before I can post it.';
    }
    if (missingFields.length === 1) {
        return `I can post the listing using your saved ${APP_NAME} profile, but I still need the ${missingFields[0]}.`;
    }
    const head = missingFields.slice(0, -1).join(', ');
    const tail = missingFields[missingFields.length - 1];
    return `I can post the listing using your saved ${APP_NAME} profile, but I still need the ${head}, and ${tail}.`;
}

async function createListingFromVoice({ userId, crop, quantityKg, pricePerKg, profile }) {
    if (!crop || !quantityKg || !pricePerKg) {
        return null;
    }

    const payload = {
        crop_type: crop,
        quantity_kg: quantityKg,
        price_per_kg: pricePerKg,
        quality_grade: 'standard',
        available_from: new Date().toISOString(),
        location_state: profile?.state || undefined,
        location_district: profile?.district || undefined,
        location_pincode: profile?.pincode || undefined,
        description: profile?.name ? `Voice listing created by ${profile.name}` : 'Voice listing created from saved profile',
    };

    return listings.createListing(userId, payload);
}

async function updateListingFromVoice({ userId, crop, nextStatus }) {
    const activeListings = await listings.getFarmerListings(userId, 'active');
    const target = pickTargetListing(activeListings, crop);
    if (!target) {
        return null;
    }
    return listings.updateListingStatus(target.id, userId, nextStatus);
}

async function handleMarketplaceRequest({
    intent = '',
    entities = {},
    messages = [],
    userId,
}) {
    const latestText = getLatestUserMessage(messages);
    const action = detectMarketplaceAction({ intent, text: latestText });
    const crop = extractCrop(latestText, entities);
    const quantityKg = extractQuantityKg(latestText, entities);
    const pricePerKg = extractPricePerKg(latestText, entities);
    const profile = await userService.getUnifiedProfile(userId);

    let response = '';
    let executedAction = action;
    let changedListing = null;

    if (action === 'create_listing') {
        const missingFields = [];
        if (!crop) missingFields.push('crop');
        if (!quantityKg) missingFields.push('quantity');
        if (!pricePerKg) missingFields.push('price per kg');

        if (missingFields.length > 0) {
            response = `${buildMissingFieldResponse(missingFields)} Say, for example, sell 1000 kg wheat at 24 rupees per kg.`;
            executedAction = 'create_listing_missing_fields';
        } else {
            changedListing = await createListingFromVoice({ userId, crop, quantityKg, pricePerKg, profile });
            if (changedListing) {
                response = `Your ${capitalizeWords(crop)} listing for ${Math.round(quantityKg)} kg at Rs ${Number(pricePerKg).toFixed(0)} per kg is live. I am showing the matching buyers and nearby listings now.`;
                executedAction = 'listing_created';
            } else {
                response = 'I could not create the listing right now. I am still opening your market dashboard so you can review current buyers and listings.';
                executedAction = 'listing_create_failed';
            }
        }
    } else if (action === 'cancel_listing') {
        changedListing = await updateListingFromVoice({ userId, crop, nextStatus: 'cancelled' });
        if (changedListing) {
            response = `I cancelled your ${capitalizeWords(changedListing.crop_type)} listing. Your market dashboard is updated.`;
            executedAction = 'listing_cancelled';
        } else {
            response = 'I could not find an active listing to cancel. I am opening your market dashboard so you can review the current listings.';
            executedAction = 'listing_cancel_missing';
        }
    } else if (action === 'mark_sold') {
        changedListing = await updateListingFromVoice({ userId, crop, nextStatus: 'sold' });
        if (changedListing) {
            response = `I marked your ${capitalizeWords(changedListing.crop_type)} listing as sold. I am updating the market view now.`;
            executedAction = 'listing_marked_sold';
        } else {
            response = 'I could not find an active listing to mark as sold. I am opening your market dashboard so you can check the current status.';
            executedAction = 'listing_sold_missing';
        }
    }

    const dashboard = await buildDashboard({
        userId,
        cropHint: crop || liveFetcher.normalizeCropName(changedListing?.crop_type || ''),
        stateHint: String(profile?.state || ''),
        districtHint: String(profile?.district || ''),
    });

    if (!response && action === 'contact_buyer') {
        const firstBuyer = dashboard.buyerRequests[0];
        if (firstBuyer?.contactPhone || firstBuyer?.contactEmail) {
            const contactParts = [];
            if (firstBuyer.contactPhone) contactParts.push(`phone ${firstBuyer.contactPhone}`);
            if (firstBuyer.contactEmail) contactParts.push(`email ${firstBuyer.contactEmail}`);
            response = `The first buyer is ${firstBuyer.title}. Their contact is ${contactParts.join(' and ')}. I am opening the market screen so you can review the buyer card.`;
            executedAction = 'buyer_contact_ready';
        } else {
            response = 'I found buyer matches, but direct contact details are not available for the first card yet. I am opening the market screen so you can review the available buyers.';
            executedAction = 'buyer_contact_unavailable';
        }
    }

    if (!response) {
        const activeLabel = dashboard.activeListing
            ? `${capitalizeWords(dashboard.activeListing.cropType)} at Rs ${dashboard.activeListing.pricePerQuintal} per quintal`
            : 'no active listing yet';
        response = `I am showing your market dashboard. You currently have ${activeLabel}, ${dashboard.buyerRequests.length} buyer matches, and ${dashboard.nearbyListings.length} nearby seller listings.`;
    }

    return {
        response,
        provider: 'marketplace-tool',
        route: 'marketplace_tool',
        agent: 'marketplace',
        tool: 'marketplace_tool',
        metadata: {
            domain: 'market',
            intent,
            action: executedAction,
            ui_target: 'Orders',
            entities: {
                ...(entities || {}),
                ...(crop ? { crop } : {}),
            },
            market: dashboard,
        },
    };
}

module.exports = {
    handleMarketplaceRequest,
    detectMarketplaceAction,
    extractCrop,
    extractQuantityKg,
    extractPricePerKg,
    buildDashboard,
};
