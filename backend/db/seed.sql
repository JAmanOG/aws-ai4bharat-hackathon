-- ═══════════════════════════════════════
-- Health Services — Seed Data
-- ═══════════════════════════════════════

-- ── Government Health Portals ──
INSERT INTO health_portals (name, description, category, url, eligibility_criteria, services_offered, coverage_regions, is_free, contact_info, how_to_access) VALUES
(
  'eSanjeevani',
  'Government telemedicine platform providing free online doctor consultations for citizens across India.',
  'telemedicine',
  'https://esanjeevani.in',
  '{"age": "all", "income_limit": null, "documents": ["Aadhaar Card"]}',
  ARRAY['Video consultation', 'E-prescription', 'Follow-up consultations'],
  ARRAY['pan-india'],
  true,
  '{"helpline": "1800-11-0031", "email": "support@esanjeevani.in"}',
  '1. Visit esanjeevani.in\n2. Register with mobile number + Aadhaar\n3. Select speciality\n4. Book slot\n5. Join video consultation'
),
(
  'Ayushman Bharat (PM-JAY)',
  'Provides health cover of ₹5 lakh per family per year for secondary and tertiary care hospitalization to poor and vulnerable families.',
  'insurance',
  'https://pmjay.gov.in',
  '{"income_limit": "BPL or SECC listed", "family_size": "any", "documents": ["Aadhaar Card", "Ration Card", "SECC data"]}',
  ARRAY['Free hospitalization up to ₹5 lakh', 'Cashless treatment', '1500+ procedures covered'],
  ARRAY['pan-india'],
  true,
  '{"helpline": "14555", "website": "https://pmjay.gov.in"}',
  '1. Check eligibility at mera.pmjay.gov.in\n2. Visit nearest CSC or Ayushman Mitra\n3. Get e-card generated\n4. Visit empanelled hospital\n5. Show e-card for cashless treatment'
),
(
  'National Health Mission (NHM)',
  'Umbrella program covering maternal health, child health, immunization, and communicable disease control.',
  'maternal',
  'https://nhm.gov.in',
  '{"age": "all", "priority": "rural areas"}',
  ARRAY['Janani Suraksha Yojana', 'Free immunization', 'ASHA worker support', 'Free delivery services'],
  ARRAY['pan-india', 'rural-priority'],
  true,
  '{"helpline": "1800-180-1104"}',
  '1. Contact nearest ASHA worker\n2. Register at PHC/CHC\n3. Get mother-child card\n4. Avail free services'
),
(
  'CoWIN / Aarogya Setu',
  'COVID-19 and routine vaccination booking platform with digital health certificates.',
  'vaccination',
  'https://www.cowin.gov.in',
  '{"age": "12+", "documents": ["Aadhaar Card", "Voter ID"]}',
  ARRAY['COVID-19 vaccination', 'Digital certificate', 'Vaccination slot booking'],
  ARRAY['pan-india'],
  true,
  '{"helpline": "1075", "app": "Aarogya Setu"}',
  '1. Download Aarogya Setu or visit CoWIN\n2. Register with mobile number\n3. Book vaccination slot\n4. Visit center\n5. Download certificate'
),
(
  'Pradhan Mantri Bhartiya Jan Aushadhi Pariyojana',
  'Affordable generic medicines at Jan Aushadhi Kendras across India.',
  'pharmacy',
  'https://janaushadhi.gov.in',
  '{"age": "all", "income_limit": null}',
  ARRAY['Generic medicines at 50-90% discount', 'Surgical items', 'Nutraceuticals'],
  ARRAY['pan-india'],
  true,
  '{"helpline": "1800-180-8080"}',
  '1. Find nearest Jan Aushadhi Kendra at janaushadhi.gov.in\n2. Visit with doctor prescription\n3. Buy medicines at subsidized rates'
),
(
  'Rashtriya Swasthya Bima Yojana (RSBY)',
  'Health insurance scheme for BPL families covering hospitalization expenses.',
  'insurance',
  'https://www.rsby.gov.in',
  '{"income_limit": "BPL", "family_size": "up to 5 members", "documents": ["BPL Card", "Aadhaar"]}',
  ARRAY['Hospitalization cover ₹30,000/year', 'Pre-existing diseases covered', 'Transport allowance ₹1,000'],
  ARRAY['pan-india'],
  true,
  '{"helpline": "1800-111-565"}',
  '1. Check BPL list inclusion at district office\n2. Visit enrollment center with documents\n3. Get smart card\n4. Visit empanelled hospital with smart card'
);

-- ── Private Healthcare Providers ──
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
