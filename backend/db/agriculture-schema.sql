-- =====================================================
-- Rural Ecosystem Platform – Agriculture Supply Chain Schema
-- Aurora PostgreSQL (Serverless v2)
-- Requirement 5: Agriculture Supply Chain Management
-- =====================================================

-- ── Farmer Produce Listings ──
-- When a farmer wants to sell, they create a listing
CREATE TABLE IF NOT EXISTS produce_listings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id       VARCHAR(128) NOT NULL,               -- Cognito sub
    crop_type       VARCHAR(100) NOT NULL,                -- wheat, rice, tomato, etc.
    variety         VARCHAR(200),                         -- basmati, IR-64, desi, etc.
    quantity_kg     DECIMAL(12,2) NOT NULL,
    price_per_kg    DECIMAL(10,2),                        -- farmer's asking price (nullable = open)
    quality_grade   VARCHAR(20) DEFAULT 'standard',       -- premium, standard, economy
    harvest_date    DATE,
    available_from  DATE DEFAULT CURRENT_DATE,
    available_until DATE,
    location_state  VARCHAR(100),
    location_district VARCHAR(100),
    location_pincode VARCHAR(10),
    location_lat    DECIMAL(10,7),
    location_lng    DECIMAL(10,7),
    description     TEXT,
    images_s3_keys  TEXT[],                               -- produce photos in S3
    status          VARCHAR(20) DEFAULT 'active',         -- active, sold, expired, cancelled
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_farmer ON produce_listings(farmer_id);
CREATE INDEX idx_listings_crop ON produce_listings(crop_type);
CREATE INDEX idx_listings_status ON produce_listings(status);
CREATE INDEX idx_listings_location ON produce_listings(location_state, location_district);
CREATE INDEX idx_listings_available ON produce_listings(available_from, available_until);

-- ── Verified Buyers ──
CREATE TABLE IF NOT EXISTS buyers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(128) NOT NULL,                -- Cognito sub
    business_name   VARCHAR(500) NOT NULL,
    business_type   VARCHAR(100) NOT NULL,                -- wholesaler, retailer, processor, exporter, FPO
    registration_no VARCHAR(200),                         -- GSTIN, FSSAI, etc.
    contact_phone   VARCHAR(20),
    contact_email   VARCHAR(200),
    location_state  VARCHAR(100),
    location_district VARCHAR(100),
    location_pincode VARCHAR(10),
    crops_interested TEXT[],                               -- crops they want to buy
    is_verified     BOOLEAN DEFAULT false,
    verification_method VARCHAR(50),                      -- digilocker, manual, govt-portal
    trust_score     INT DEFAULT 0,                        -- 0-100
    avg_rating      DECIMAL(3,2) DEFAULT 0,
    total_transactions INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    registered_via  VARCHAR(20) DEFAULT 'app',            -- app, voice, web
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buyers_user ON buyers(user_id);
CREATE INDEX idx_buyers_location ON buyers(location_state, location_district);
CREATE INDEX idx_buyers_crops ON buyers USING GIN(crops_interested);
CREATE INDEX idx_buyers_type ON buyers(business_type);

-- ── Trade Orders (buyer ↔ farmer transactions) ──
CREATE TABLE IF NOT EXISTS trade_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      UUID NOT NULL REFERENCES produce_listings(id),
    farmer_id       VARCHAR(128) NOT NULL,
    buyer_id        UUID NOT NULL REFERENCES buyers(id),
    quantity_kg     DECIMAL(12,2) NOT NULL,
    agreed_price_per_kg DECIMAL(10,2) NOT NULL,
    total_amount    DECIMAL(14,2) NOT NULL,
    status          VARCHAR(30) DEFAULT 'pending',        -- pending, accepted, in_transit, delivered, completed, cancelled, disputed
    payment_status  VARCHAR(30) DEFAULT 'unpaid',         -- unpaid, partial, paid, refunded
    logistics_id    UUID,                                 -- reference to logistics_requests
    notes           TEXT,
    farmer_rating   INT,                                  -- 1-5 rating given by farmer to buyer
    buyer_rating    INT,                                  -- 1-5 rating given by buyer to farmer
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_farmer ON trade_orders(farmer_id);
CREATE INDEX idx_orders_buyer ON trade_orders(buyer_id);
CREATE INDEX idx_orders_listing ON trade_orders(listing_id);
CREATE INDEX idx_orders_status ON trade_orders(status);

-- ── Market Prices (historical and current) ──
CREATE TABLE IF NOT EXISTS market_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_type       VARCHAR(100) NOT NULL,
    variety         VARCHAR(200),
    mandi_name      VARCHAR(300) NOT NULL,                -- APMC mandi name
    mandi_code      VARCHAR(50),                          -- e-NAM mandi code
    state           VARCHAR(100) NOT NULL,
    district        VARCHAR(100),
    min_price       DECIMAL(10,2),                        -- ₹/quintal
    max_price       DECIMAL(10,2),
    modal_price     DECIMAL(10,2),                        -- most common trading price
    price_unit      VARCHAR(20) DEFAULT 'quintal',        -- quintal, kg, tonne
    arrival_qty     DECIMAL(12,2),                        -- tonnes arrived at mandi
    trade_date      DATE NOT NULL,
    source          VARCHAR(50) DEFAULT 'e-NAM',          -- e-NAM, agmarknet, manual
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prices_crop ON market_prices(crop_type, trade_date);
CREATE INDEX idx_prices_mandi ON market_prices(mandi_name);
CREATE INDEX idx_prices_state ON market_prices(state, district);
CREATE INDEX idx_prices_date ON market_prices(trade_date DESC);
CREATE UNIQUE INDEX idx_prices_unique ON market_prices(crop_type, mandi_code, trade_date) WHERE mandi_code IS NOT NULL;

-- ── Logistics Requests ──
CREATE TABLE IF NOT EXISTS logistics_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_order_id  UUID REFERENCES trade_orders(id),
    requester_id    VARCHAR(128) NOT NULL,                -- farmer or buyer Cognito sub
    pickup_state    VARCHAR(100),
    pickup_district VARCHAR(100),
    pickup_pincode  VARCHAR(10),
    pickup_lat      DECIMAL(10,7),
    pickup_lng      DECIMAL(10,7),
    delivery_state  VARCHAR(100),
    delivery_district VARCHAR(100),
    delivery_pincode VARCHAR(10),
    delivery_lat    DECIMAL(10,7),
    delivery_lng    DECIMAL(10,7),
    cargo_type      VARCHAR(100),                         -- crop name
    weight_kg       DECIMAL(12,2),
    vehicle_type    VARCHAR(50),                          -- tractor, pickup, truck, mini-truck
    preferred_date  DATE,
    estimated_cost  DECIMAL(10,2),
    status          VARCHAR(30) DEFAULT 'requested',      -- requested, assigned, in_transit, delivered, cancelled
    transporter_name VARCHAR(300),
    transporter_phone VARCHAR(20),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logistics_order ON logistics_requests(trade_order_id);
CREATE INDEX idx_logistics_requester ON logistics_requests(requester_id);
CREATE INDEX idx_logistics_status ON logistics_requests(status);

-- ── Collective Bargaining Groups ──
CREATE TABLE IF NOT EXISTS bargaining_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(500) NOT NULL,
    crop_type       VARCHAR(100) NOT NULL,
    variety         VARCHAR(200),
    total_quantity_kg DECIMAL(14,2) DEFAULT 0,
    target_price_per_kg DECIMAL(10,2),
    min_price_per_kg DECIMAL(10,2),
    location_state  VARCHAR(100),
    location_district VARCHAR(100),
    member_count    INT DEFAULT 0,
    status          VARCHAR(30) DEFAULT 'forming',        -- forming, active, negotiating, sold, dissolved
    ai_created      BOOLEAN DEFAULT false,                -- was this created by AI clustering?
    created_by      VARCHAR(128),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bargaining_crop ON bargaining_groups(crop_type);
CREATE INDEX idx_bargaining_status ON bargaining_groups(status);
CREATE INDEX idx_bargaining_location ON bargaining_groups(location_state, location_district);

-- ── Bargaining Group Members ──
CREATE TABLE IF NOT EXISTS bargaining_group_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES bargaining_groups(id) ON DELETE CASCADE,
    farmer_id       VARCHAR(128) NOT NULL,
    listing_id      UUID REFERENCES produce_listings(id),
    quantity_kg     DECIMAL(12,2) NOT NULL,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, farmer_id)
);

CREATE INDEX idx_bgm_group ON bargaining_group_members(group_id);
CREATE INDEX idx_bgm_farmer ON bargaining_group_members(farmer_id);

-- ══════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════

-- Seed market prices (recent data for common crops across major mandis)
INSERT INTO market_prices (crop_type, variety, mandi_name, mandi_code, state, district, min_price, max_price, modal_price, arrival_qty, trade_date, source) VALUES
    ('wheat', 'Sharbati', 'Indore Mandi', 'MP001', 'Madhya Pradesh', 'Indore', 2200, 2650, 2400, 1500, CURRENT_DATE, 'e-NAM'),
    ('wheat', 'Lok-1', 'Delhi Azadpur', 'DL001', 'Delhi', 'Central Delhi', 2100, 2500, 2300, 2000, CURRENT_DATE, 'e-NAM'),
    ('rice', 'Basmati', 'Karnal Mandi', 'HR001', 'Haryana', 'Karnal', 3500, 4200, 3800, 800, CURRENT_DATE, 'e-NAM'),
    ('rice', 'IR-64', 'Lucknow Mandi', 'UP001', 'Uttar Pradesh', 'Lucknow', 1800, 2200, 2000, 1200, CURRENT_DATE, 'e-NAM'),
    ('tomato', 'Hybrid', 'Nashik Mandi', 'MH001', 'Maharashtra', 'Nashik', 800, 1500, 1100, 3000, CURRENT_DATE, 'agmarknet'),
    ('tomato', 'Desi', 'Kolar Mandi', 'KA001', 'Karnataka', 'Kolar', 600, 1200, 900, 2500, CURRENT_DATE, 'agmarknet'),
    ('onion', 'Red', 'Lasalgaon Mandi', 'MH002', 'Maharashtra', 'Nashik', 1000, 1800, 1400, 5000, CURRENT_DATE, 'e-NAM'),
    ('onion', 'White', 'Pimpalgaon', 'MH003', 'Maharashtra', 'Nashik', 1200, 2000, 1600, 3000, CURRENT_DATE, 'e-NAM'),
    ('potato', 'Jyoti', 'Agra Mandi', 'UP002', 'Uttar Pradesh', 'Agra', 500, 900, 700, 4000, CURRENT_DATE, 'agmarknet'),
    ('soybean', 'JS-335', 'Ujjain Mandi', 'MP002', 'Madhya Pradesh', 'Ujjain', 4200, 4800, 4500, 2000, CURRENT_DATE, 'e-NAM'),
    ('cotton', 'DCH-32', 'Rajkot Mandi', 'GJ001', 'Gujarat', 'Rajkot', 5500, 6200, 5800, 1000, CURRENT_DATE, 'e-NAM'),
    ('sugarcane', 'CO-0238', 'Muzaffarnagar', 'UP003', 'Uttar Pradesh', 'Muzaffarnagar', 350, 400, 380, 8000, CURRENT_DATE, 'manual'),
    ('mustard', 'Pusa Bold', 'Jaipur Mandi', 'RJ001', 'Rajasthan', 'Jaipur', 4800, 5500, 5200, 1500, CURRENT_DATE, 'e-NAM'),
    ('chana', 'Kabuli', 'Latur Mandi', 'MH004', 'Maharashtra', 'Latur', 4500, 5200, 4800, 900, CURRENT_DATE, 'e-NAM'),
    ('maize', 'Hybrid', 'Davangere Mandi', 'KA002', 'Karnataka', 'Davangere', 1600, 2100, 1850, 1800, CURRENT_DATE, 'agmarknet');

-- Seed some buyers
INSERT INTO buyers (user_id, business_name, business_type, location_state, location_district, crops_interested, is_verified, trust_score, registered_via) VALUES
    ('buyer-001', 'Sharma Agro Traders', 'wholesaler', 'Madhya Pradesh', 'Indore', ARRAY['wheat','soybean','chana'], true, 85, 'app'),
    ('buyer-002', 'Fresh Farm Direct', 'retailer', 'Maharashtra', 'Mumbai', ARRAY['tomato','onion','potato'], true, 90, 'app'),
    ('buyer-003', 'GreenLeaf Exports', 'exporter', 'Gujarat', 'Ahmedabad', ARRAY['cotton','rice','maize'], true, 92, 'web'),
    ('buyer-004', 'Kisaan FPO Collective', 'FPO', 'Uttar Pradesh', 'Lucknow', ARRAY['wheat','rice','sugarcane','potato'], true, 88, 'app'),
    ('buyer-005', 'Organic Valley Foods', 'processor', 'Karnataka', 'Bangalore', ARRAY['tomato','onion','maize','soybean'], false, 60, 'voice');
