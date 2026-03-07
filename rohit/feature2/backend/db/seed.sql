-- Seed data for Rural Community Platform

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

-- ── Demo Users ──
INSERT INTO users (id, name, phone, email, is_verified, language) VALUES
('4edbc9c5-ebc5-421f-8ea5-c75ce0904baa', 'Rural User', '9876543210', 'demo@example.com', TRUE, 'hi'),
('550e8400-e29b-41d4-a716-446655440000', 'Farmer Joe', '9123456789', 'joe@example.com', TRUE, 'en')
ON CONFLICT (phone) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name;
