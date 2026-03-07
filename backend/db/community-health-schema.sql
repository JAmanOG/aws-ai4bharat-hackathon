-- =====================================================
-- Rural Ecosystem Platform – Community & Health Schema
-- Aurora PostgreSQL (Serverless v2)
-- Features: Community, Business, Government, Livelihood, Health
-- =====================================================

-- ── Users (community identity) ──
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    language VARCHAR(5) DEFAULT 'hi',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- BUSINESS MODULE
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    category_id UUID NOT NULL REFERENCES business_categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(255),
    address VARCHAR(500) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    operating_hours JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    owner_id UUID NOT NULL REFERENCES users(id),
    category_id UUID NOT NULL REFERENCES business_categories(id),
    sub_category_id UUID REFERENCES business_subcategories(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses(is_active);

-- ══════════════════════════════════════
-- GOVERNMENT MODULE
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS government_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    region VARCHAR(100) DEFAULT 'national',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portals_category ON government_portals(category);

CREATE TABLE IF NOT EXISTS scheme_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS government_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    eligibility TEXT,
    application_steps JSONB,
    benefits TEXT,
    url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    category_id UUID NOT NULL REFERENCES scheme_categories(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schemes_category ON government_schemes(category_id);

CREATE TABLE IF NOT EXISTS saved_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_name VARCHAR(200) NOT NULL,
    reference_no VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'filed',
    user_id UUID NOT NULL REFERENCES users(id),
    filed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_user ON saved_complaints(user_id);

-- ══════════════════════════════════════
-- COMMUNITY MODULE
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS knowledge_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    topic VARCHAR(50) NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_topic ON knowledge_posts(topic);
CREATE INDEX IF NOT EXISTS idx_posts_author ON knowledge_posts(author_id);

CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    post_id UUID NOT NULL REFERENCES knowledge_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id),
    following_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reporter_id UUID NOT NULL REFERENCES users(id),
    post_id UUID NOT NULL REFERENCES knowledge_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- LIVELIHOOD MODULE
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS livelihood_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS livelihood_guidance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    steps JSONB,
    helpline_numbers JSONB,
    related_schemes JSONB,
    category_id UUID NOT NULL REFERENCES livelihood_categories(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guidance_category ON livelihood_guidance(category_id);

-- ══════════════════════════════════════
-- HEALTH MODULE
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS health_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    url VARCHAR(500) NOT NULL,
    eligibility_criteria JSONB DEFAULT '{}',
    services_offered TEXT[],
    coverage_regions TEXT[],
    is_free BOOLEAN DEFAULT true,
    contact_info JSONB DEFAULT '{}',
    how_to_access TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_portals_category ON health_portals(category);

CREATE TABLE IF NOT EXISTS health_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'Maharashtra',
    address TEXT,
    phone VARCHAR(20),
    website VARCHAR(500),
    services TEXT[],
    specialties TEXT[],
    is_24x7 BOOLEAN DEFAULT false,
    rating NUMERIC(2,1) DEFAULT 0,
    has_online_booking BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_providers_city ON health_providers(city);
CREATE INDEX IF NOT EXISTS idx_health_providers_type ON health_providers(type);
CREATE INDEX IF NOT EXISTS idx_health_providers_city_type ON health_providers(city, type);

-- ══════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════

-- ── Demo Users ──
INSERT INTO users (id, name, phone, email, is_verified, language) VALUES
('4edbc9c5-ebc5-421f-8ea5-c75ce0904baa', 'Rural User', '9876543210', 'demo@example.com', TRUE, 'hi'),
('550e8400-e29b-41d4-a716-446655440000', 'Farmer Joe', '9123456789', 'joe@example.com', TRUE, 'en')
ON CONFLICT (phone) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name;

-- ── Business Categories ──
INSERT INTO business_categories (name, description, icon, sort_order) VALUES
('Dairy', 'Milk, milk products, and cattle-related businesses', '🥛', 1),
('Poultry & Livestock', 'Poultry farming, goat rearing, fishery, and animal husbandry', '🐔', 2),
('Apiculture & Forest Produce', 'Honey production, beeswax, forest herbs, and non-timber forest products', '🍯', 3),
('Agriculture & Horticulture', 'Vegetable, fruit, spice, and flower cultivation', '🌾', 4),
('Textiles & Handicrafts', 'Handloom weaving, khadi, embroidery, pottery, and craft items', '🧵', 5),
('Food Processing', 'Pickles, flour mills, oil pressing, snacks, and food preservation', '🫙', 6),
('Rural Services', 'Repair, transport, equipment rental, veterinary, and solar services', '🔧', 7),
('Trading & Retail', 'General stores, seed shops, hardware, and market linkage services', '🏪', 8)
ON CONFLICT (name) DO NOTHING;

-- ── Business Subcategories ──
INSERT INTO business_subcategories (name, sort_order, category_id) VALUES
('Milk Production', 1, (SELECT id FROM business_categories WHERE name = 'Dairy')),
('Cheese & Paneer', 2, (SELECT id FROM business_categories WHERE name = 'Dairy')),
('Ghee', 3, (SELECT id FROM business_categories WHERE name = 'Dairy')),
('Curd & Yogurt', 4, (SELECT id FROM business_categories WHERE name = 'Dairy')),
('Cattle Feed', 5, (SELECT id FROM business_categories WHERE name = 'Dairy')),
('Poultry Farming', 1, (SELECT id FROM business_categories WHERE name = 'Poultry & Livestock')),
('Goat Rearing', 2, (SELECT id FROM business_categories WHERE name = 'Poultry & Livestock')),
('Piggery', 3, (SELECT id FROM business_categories WHERE name = 'Poultry & Livestock')),
('Fishery', 4, (SELECT id FROM business_categories WHERE name = 'Poultry & Livestock')),
('Honey Production', 1, (SELECT id FROM business_categories WHERE name = 'Apiculture & Forest Produce')),
('Beeswax', 2, (SELECT id FROM business_categories WHERE name = 'Apiculture & Forest Produce')),
('Royal Jelly', 3, (SELECT id FROM business_categories WHERE name = 'Apiculture & Forest Produce')),
('Forest Herbs & Medicinals', 4, (SELECT id FROM business_categories WHERE name = 'Apiculture & Forest Produce')),
('Lac & Resin', 5, (SELECT id FROM business_categories WHERE name = 'Apiculture & Forest Produce')),
('Vegetables', 1, (SELECT id FROM business_categories WHERE name = 'Agriculture & Horticulture')),
('Fruits', 2, (SELECT id FROM business_categories WHERE name = 'Agriculture & Horticulture')),
('Floriculture', 3, (SELECT id FROM business_categories WHERE name = 'Agriculture & Horticulture')),
('Spices & Condiments', 4, (SELECT id FROM business_categories WHERE name = 'Agriculture & Horticulture')),
('Organic Farming', 5, (SELECT id FROM business_categories WHERE name = 'Agriculture & Horticulture')),
('Handloom Weaving', 1, (SELECT id FROM business_categories WHERE name = 'Textiles & Handicrafts')),
('Khadi', 2, (SELECT id FROM business_categories WHERE name = 'Textiles & Handicrafts')),
('Embroidery & Chikan', 3, (SELECT id FROM business_categories WHERE name = 'Textiles & Handicrafts')),
('Bamboo & Cane Craft', 4, (SELECT id FROM business_categories WHERE name = 'Textiles & Handicrafts')),
('Pottery & Terracotta', 5, (SELECT id FROM business_categories WHERE name = 'Textiles & Handicrafts')),
('Jute Products', 6, (SELECT id FROM business_categories WHERE name = 'Textiles & Handicrafts')),
('Pickles & Preserves', 1, (SELECT id FROM business_categories WHERE name = 'Food Processing')),
('Flour Milling (Atta Chakki)', 2, (SELECT id FROM business_categories WHERE name = 'Food Processing')),
('Oil Pressing (Kachi Ghani)', 3, (SELECT id FROM business_categories WHERE name = 'Food Processing')),
('Snacks & Sweets', 4, (SELECT id FROM business_categories WHERE name = 'Food Processing')),
('Dried & Dehydrated Foods', 5, (SELECT id FROM business_categories WHERE name = 'Food Processing')),
('Repair & Maintenance', 1, (SELECT id FROM business_categories WHERE name = 'Rural Services')),
('Transport Services', 2, (SELECT id FROM business_categories WHERE name = 'Rural Services')),
('Agri-equipment Rental', 3, (SELECT id FROM business_categories WHERE name = 'Rural Services')),
('Veterinary Services', 4, (SELECT id FROM business_categories WHERE name = 'Rural Services')),
('Solar & Renewable Energy', 5, (SELECT id FROM business_categories WHERE name = 'Rural Services')),
('General Store (Kirana)', 1, (SELECT id FROM business_categories WHERE name = 'Trading & Retail')),
('Fertilizer & Seed Shop', 2, (SELECT id FROM business_categories WHERE name = 'Trading & Retail')),
('Hardware & Tools', 3, (SELECT id FROM business_categories WHERE name = 'Trading & Retail')),
('Agri Market Linkage', 4, (SELECT id FROM business_categories WHERE name = 'Trading & Retail'))
ON CONFLICT DO NOTHING;

-- ── Government Portals ──
INSERT INTO government_portals (name, description, url, category, region) VALUES
('CPGRAMS', 'Centralised Public Grievance Redress and Monitoring System', 'https://pgportal.gov.in/', 'general', 'national'),
('PMO Grievance Portal', 'Prime Minister Office citizen grievance portal for escalation', 'https://pgportal.gov.in/', 'general', 'national'),
('Jal Jeevan Mission Dashboard', 'Track drinking water infrastructure projects by state/district', 'https://ejalshakti.gov.in/jjmreport/JJMIndia.aspx', 'water', 'national'),
('PMGSY (Rural Roads)', 'Pradhan Mantri Gram Sadak Yojana – rural road projects monitoring', 'https://pmgsy.dord.gov.in/', 'roads', 'national'),
('PMAY MIS (Housing)', 'Pradhan Mantri Awas Yojana – housing project tracking', 'https://pmaymis.gov.in/', 'infrastructure', 'national'),
('Smart Cities Dashboard', 'Urban infrastructure monitoring – city-wise projects', 'https://dashboard.mohua.gov.in/', 'infrastructure', 'national'),
('NHAI / Bharatmala', 'National highways and corridors program', 'https://morth.nic.in/en/bharatmala', 'roads', 'national'),
('RTI Online Portal', 'File Right to Information applications', 'https://rtionline.gov.in/', 'general', 'national'),
('eGazette', 'Official notifications, amendments, rules and acts', 'https://egazette.gov.in/', 'general', 'national'),
('India Code (Laws)', 'Digital repository of central and state legislation', 'https://www.indiacode.nic.in/', 'general', 'national');

-- ── Scheme Categories ──
INSERT INTO scheme_categories (name, description, icon) VALUES
('Housing', 'Housing and shelter schemes', '🏠'),
('Roads & Transport', 'Road construction and transport infrastructure', '🛣️'),
('Water & Sanitation', 'Drinking water and sanitation schemes', '💧'),
('Electricity & Energy', 'Electrification and renewable energy', '⚡'),
('Agriculture & Irrigation', 'Farming, irrigation, and crop support', '🌱'),
('Rural Development', 'General rural development and employment', '🏘️'),
('Health & Nutrition', 'Healthcare and nutrition programs', '🏥'),
('Education & Skill', 'Education and skill development', '📚')
ON CONFLICT (name) DO NOTHING;

-- ── Government Schemes ──
INSERT INTO government_schemes (name, description, eligibility, application_steps, benefits, url, category_id) VALUES
('Pradhan Mantri Awas Yojana (PMAY)', 'Housing for All – financial assistance for building pucca houses', 'BPL families, SC/ST, minorities, women-headed households without a pucca house', '["Visit CSC or gram panchayat","Fill application with Aadhaar and bank details","Upload documents","Track on pmaymis.gov.in"]', 'Up to ₹1.20 lakh for plains; ₹1.30 lakh for hilly areas', 'https://pmay-urban.gov.in/', (SELECT id FROM scheme_categories WHERE name = 'Housing')),
('Pradhan Mantri Gram Sadak Yojana (PMGSY)', 'All-weather road connectivity to unconnected rural habitations', 'Rural habitations above population thresholds', '["Roads proposed by state governments","Track on omms.nic.in","Report quality issues via grievance mechanism"]', 'All-weather road connectivity', 'https://pmgsy.dord.gov.in/', (SELECT id FROM scheme_categories WHERE name = 'Roads & Transport')),
('Jal Jeevan Mission', 'Har Ghar Jal – functional household tap connections', 'All rural households without tap connections', '["Contact gram panchayat or Jal Samiti","Register for tap connection","Track on ejalshakti.gov.in"]', 'Piped water at 55 litres per capita per day', 'https://jaljeevanmission.gov.in/', (SELECT id FROM scheme_categories WHERE name = 'Water & Sanitation')),
('PM-KISAN', 'Direct income support to farmer families', 'All landholding farmer families with cultivable land', '["Register at pmkisan.gov.in or CSC","Provide Aadhaar, bank, land records","eKYC verification","Amount deposited directly"]', '₹6,000 per year in three installments', 'https://pmkisan.gov.in/', (SELECT id FROM scheme_categories WHERE name = 'Agriculture & Irrigation')),
('MGNREGA', 'Guaranteed 100 days of wage employment', 'Any rural household adult willing to do unskilled manual work', '["Apply for Job Card at gram panchayat","Submit written application","Work provided within 15 days","Track on nrega.nic.in"]', '100 days guaranteed employment at minimum wage', 'https://nrega.nic.in/', (SELECT id FROM scheme_categories WHERE name = 'Rural Development')),
('Saubhagya (Household Electrification)', 'Electricity to all un-electrified households', 'All un-electrified households in rural and urban areas', '["Contact local electricity company","Apply through portal or local office","Free for BPL households"]', 'Free electricity connection and LED bulbs for BPL', 'https://saubhagya.gov.in/', (SELECT id FROM scheme_categories WHERE name = 'Electricity & Energy'));

-- ── Livelihood Categories ──
INSERT INTO livelihood_categories (name, display_name, description, icon) VALUES
('crop_failure', 'Crop Failure', 'Loss due to crop failure, drought, floods, or pest attacks', '🌾'),
('livestock_loss', 'Livestock Loss', 'Loss of livestock due to disease, accidents, or natural calamity', '🐄'),
('business_closure', 'Business Closure', 'Closure of small business or cottage industry', '🏪'),
('natural_disaster', 'Natural Disaster', 'Loss due to floods, cyclones, earthquakes, landslides', '🌊'),
('unemployment', 'Unemployment', 'Loss of employment or income source', '💼')
ON CONFLICT (name) DO NOTHING;

-- ── Livelihood Guidance ──
INSERT INTO livelihood_guidance (title, description, steps, helpline_numbers, category_id) VALUES
('Crop Insurance Claim (PMFBY)', 'File crop insurance claim under Pradhan Mantri Fasal Bima Yojana', '["Report loss to insurance company within 72 hours","Contact bank branch","File on PMFBY portal or call 1800-200-7710","Provide land records and damage evidence"]', '["1800-200-7710","1551"]', (SELECT id FROM livelihood_categories WHERE name = 'crop_failure')),
('Livestock Insurance Scheme', 'Claiming livestock insurance and accessing veterinary support', '["Get death certificate from veterinary hospital","File claim within 15 days","Apply for fresh stock through NABARD","Contact Kisan Call Centre"]', '["1800-180-1551"]', (SELECT id FROM livelihood_categories WHERE name = 'livestock_loss')),
('MGNREGA Employment', 'Get guaranteed employment under MGNREGA during hardship', '["Get or renew Job Card from gram panchayat","Submit written demand","Work provided within 15 days","Wages paid within 15 days"]', '["1800-345-22-44"]', (SELECT id FROM livelihood_categories WHERE name = 'unemployment')),
('Disaster Relief (SDRF/NDRF)', 'Apply for disaster relief funds', '["Report damage to gram panchayat or district collector","Document damage with photos","Apply through state disaster portal","Track relief distribution"]', '["112","1078"]', (SELECT id FROM livelihood_categories WHERE name = 'natural_disaster')),
('MUDRA Loan for Business Restart', 'MUDRA loans for restarting closed small businesses', '["Prepare business plan","Visit nearest bank or NBFC","Apply under Shishu/Kishore/Tarun category","No collateral required"]', '["1800-180-1111"]', (SELECT id FROM livelihood_categories WHERE name = 'business_closure'));

-- ══════════════════════════════════════
-- HEALTH SEED DATA
-- ══════════════════════════════════════

INSERT INTO health_portals (name, description, category, url, eligibility_criteria, services_offered, coverage_regions, is_free, contact_info, how_to_access) VALUES
('eSanjeevani', 'Government telemedicine platform providing free online doctor consultations for citizens across India.', 'telemedicine', 'https://esanjeevani.in', '{"age": "all", "income_limit": null, "documents": ["Aadhaar Card"]}', ARRAY['Video consultation', 'E-prescription', 'Follow-up consultations'], ARRAY['pan-india'], true, '{"helpline": "1800-11-0031", "email": "support@esanjeevani.in"}', '1. Visit esanjeevani.in\n2. Register with mobile number + Aadhaar\n3. Select speciality\n4. Book slot\n5. Join video consultation'),
('Ayushman Bharat (PM-JAY)', 'Provides health cover of ₹5 lakh per family per year for secondary and tertiary care hospitalization to poor and vulnerable families.', 'insurance', 'https://pmjay.gov.in', '{"income_limit": "BPL or SECC listed", "family_size": "any", "documents": ["Aadhaar Card", "Ration Card", "SECC data"]}', ARRAY['Free hospitalization up to ₹5 lakh', 'Cashless treatment', '1500+ procedures covered'], ARRAY['pan-india'], true, '{"helpline": "14555", "website": "https://pmjay.gov.in"}', '1. Check eligibility at mera.pmjay.gov.in\n2. Visit nearest CSC or Ayushman Mitra\n3. Get e-card generated\n4. Visit empanelled hospital\n5. Show e-card for cashless treatment'),
('National Health Mission (NHM)', 'Umbrella program covering maternal health, child health, immunization, and communicable disease control.', 'maternal', 'https://nhm.gov.in', '{"age": "all", "priority": "rural areas"}', ARRAY['Janani Suraksha Yojana', 'Free immunization', 'ASHA worker support', 'Free delivery services'], ARRAY['pan-india', 'rural-priority'], true, '{"helpline": "1800-180-1104"}', '1. Contact nearest ASHA worker\n2. Register at PHC/CHC\n3. Get mother-child card\n4. Avail free services'),
('CoWIN / Aarogya Setu', 'COVID-19 and routine vaccination booking platform with digital health certificates.', 'vaccination', 'https://www.cowin.gov.in', '{"age": "12+", "documents": ["Aadhaar Card", "Voter ID"]}', ARRAY['COVID-19 vaccination', 'Digital certificate', 'Vaccination slot booking'], ARRAY['pan-india'], true, '{"helpline": "1075", "app": "Aarogya Setu"}', '1. Download Aarogya Setu or visit CoWIN\n2. Register with mobile number\n3. Book vaccination slot\n4. Visit center\n5. Download certificate'),
('Pradhan Mantri Bhartiya Jan Aushadhi Pariyojana', 'Affordable generic medicines at Jan Aushadhi Kendras across India.', 'pharmacy', 'https://janaushadhi.gov.in', '{"age": "all", "income_limit": null}', ARRAY['Generic medicines at 50-90% discount', 'Surgical items', 'Nutraceuticals'], ARRAY['pan-india'], true, '{"helpline": "1800-180-8080"}', '1. Find nearest Jan Aushadhi Kendra at janaushadhi.gov.in\n2. Visit with doctor prescription\n3. Buy medicines at subsidized rates'),
('Rashtriya Swasthya Bima Yojana (RSBY)', 'Health insurance scheme for BPL families covering hospitalization expenses.', 'insurance', 'https://www.rsby.gov.in', '{"income_limit": "BPL", "family_size": "up to 5 members", "documents": ["BPL Card", "Aadhaar"]}', ARRAY['Hospitalization cover ₹30,000/year', 'Pre-existing diseases covered', 'Transport allowance ₹1,000'], ARRAY['pan-india'], true, '{"helpline": "1800-111-565"}', '1. Check BPL list inclusion at district office\n2. Visit enrollment center with documents\n3. Get smart card\n4. Visit empanelled hospital with smart card');

INSERT INTO health_providers (name, type, city, state, address, phone, website, services, specialties, is_24x7, rating, has_online_booking) VALUES
('Apollo Hospitals', 'hospital', 'Mumbai', 'Maharashtra', 'Plot 13, Parsik Hill Rd, Belapur CBD', '022-33505000', 'https://www.apollohospitals.com', ARRAY['Emergency', 'OPD', 'Surgery', 'Diagnostics', 'Pharmacy'], ARRAY['Cardiology', 'Neurology', 'Orthopedics', 'Oncology'], true, 4.3, true),
('Practo', 'telemedicine', 'Pan-India', 'Pan-India', 'Online platform', '080-46013200', 'https://www.practo.com', ARRAY['Video consultation', 'In-clinic booking', 'Health records', 'Medicine delivery'], ARRAY['General Medicine', 'Dermatology', 'Gynecology', 'Pediatrics'], false, 4.1, true),
('PharmEasy', 'pharmacy', 'Pan-India', 'Pan-India', 'Online delivery', '022-66483100', 'https://pharmeasy.in', ARRAY['Medicine delivery', 'Lab tests at home', 'Health products', 'Teleconsultation'], ARRAY['Pharmacy', 'Diagnostics'], false, 4.0, true),
('Tata 1mg', 'pharmacy', 'Pan-India', 'Pan-India', 'Online delivery', '0124-4166666', 'https://www.1mg.com', ARRAY['Medicine ordering', 'Lab tests', 'Doctor consultation', 'Health articles'], ARRAY['Pharmacy', 'Diagnostics', 'General medicine'], false, 4.2, true),
('mFine', 'telemedicine', 'Pan-India', 'Pan-India', 'Online platform', '080-47184718', 'https://www.mfine.co', ARRAY['AI symptom checker', 'Video consultation', 'Health checkups', 'Lab tests'], ARRAY['General Medicine', 'Dermatology', 'Mental Health'], false, 4.0, true),
('Fortis Hospital', 'hospital', 'Mumbai', 'Maharashtra', 'Mulund Goregaon Link Road, Mulund', '022-67116711', 'https://www.fortishealthcare.com', ARRAY['Emergency', 'OPD', 'Surgery', 'ICU', 'Pharmacy'], ARRAY['Cardiac Sciences', 'Neurosciences', 'Renal Sciences'], true, 4.2, true),
('Narayana Health', 'hospital', 'Bangalore', 'Karnataka', 'Bommasandra, Hosur Road', '080-71222222', 'https://www.narayanahealth.org', ARRAY['Emergency', 'OPD', 'Surgery', 'Diagnostics'], ARRAY['Heart Care', 'Cancer Care', 'Orthopedics'], true, 4.4, true),
('Dr. Lal PathLabs', 'lab', 'Pan-India', 'Pan-India', 'Multiple locations', '011-39885050', 'https://www.lalpathlabs.com', ARRAY['Blood tests', 'Urine tests', 'Imaging', 'Home collection'], ARRAY['Pathology', 'Radiology', 'Microbiology'], false, 4.1, true),
('SRL Diagnostics', 'lab', 'Pan-India', 'Pan-India', 'Multiple locations', '1800-1101-000', 'https://www.srlworld.com', ARRAY['Blood tests', 'Genetic testing', 'Histopathology', 'Home collection'], ARRAY['Pathology', 'Cytology', 'Biochemistry'], false, 4.0, true),
('Primary Health Centre (PHC)', 'govt-hospital', 'Rural India', 'Pan-India', 'Block/Taluka level', 'N/A', 'https://nhm.gov.in', ARRAY['OPD', 'Emergency', 'Immunization', 'Maternal care', 'Free medicines'], ARRAY['General Medicine', 'Maternal Health'], true, 3.5, false),
('Community Health Centre (CHC)', 'govt-hospital', 'Rural India', 'Pan-India', 'District level', 'N/A', 'https://nhm.gov.in', ARRAY['Surgery', 'Obstetrics', 'Emergency', 'Diagnostics', 'Referral services'], ARRAY['General Surgery', 'Obstetrics', 'Pediatrics'], true, 3.6, false),
('Jan Arogya Clinic', 'clinic', 'Panvel', 'Maharashtra', 'Near ST Stand, Panvel', '022-27451234', NULL, ARRAY['OPD', 'Minor procedures', 'Vaccination', 'Laboratory'], ARRAY['General Medicine', 'Pediatrics'], false, 3.8, false);
