-- Rural Community Platform – Aurora PostgreSQL Schema
-- Relational data: users, businesses, government, community, livelihood

-- ── Users ──
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

-- ── Business Categories ──
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

-- ── Businesses ──
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

CREATE INDEX idx_businesses_category ON businesses(category_id);
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_active ON businesses(is_active);

-- ── Government Portals ──
CREATE TABLE IF NOT EXISTS government_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    region VARCHAR(100) DEFAULT 'national',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portals_category ON government_portals(category);

-- ── Scheme Categories ──
CREATE TABLE IF NOT EXISTS scheme_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(10)
);

-- ── Government Schemes ──
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

CREATE INDEX idx_schemes_category ON government_schemes(category_id);

-- ── Saved Complaints ──
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

CREATE INDEX idx_complaints_user ON saved_complaints(user_id);

-- ── Knowledge Posts ──
CREATE TABLE IF NOT EXISTS knowledge_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    topic VARCHAR(50) NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_topic ON knowledge_posts(topic);
CREATE INDEX idx_posts_author ON knowledge_posts(author_id);

-- ── Bookmarks ──
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    post_id UUID NOT NULL REFERENCES knowledge_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- ── Follows ──
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id),
    following_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- ── Content Reports ──
CREATE TABLE IF NOT EXISTS content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reporter_id UUID NOT NULL REFERENCES users(id),
    post_id UUID NOT NULL REFERENCES knowledge_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Livelihood Categories ──
CREATE TABLE IF NOT EXISTS livelihood_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10)
);

-- ── Livelihood Guidance ──
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

CREATE INDEX idx_guidance_category ON livelihood_guidance(category_id);
