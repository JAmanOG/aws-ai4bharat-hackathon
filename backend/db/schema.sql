-- ═══════════════════════════════════════
-- Health Services — Aurora PostgreSQL Schema
-- ═══════════════════════════════════════

-- Government Health Portals
CREATE TABLE IF NOT EXISTS health_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- telemedicine, insurance, maternal, vaccination, etc.
  url VARCHAR(500) NOT NULL,
  eligibility_criteria JSONB DEFAULT '{}',
  services_offered TEXT[],
  coverage_regions TEXT[], -- pan-india, state-level, etc.
  is_free BOOLEAN DEFAULT true,
  contact_info JSONB DEFAULT '{}',
  how_to_access TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_health_portals_category ON health_portals(category);

-- Private Healthcare Providers
CREATE TABLE IF NOT EXISTS health_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL, -- hospital, pharmacy, telemedicine, lab, clinic
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
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_health_providers_city ON health_providers(city);
CREATE INDEX idx_health_providers_type ON health_providers(type);
CREATE INDEX idx_health_providers_city_type ON health_providers(city, type);
