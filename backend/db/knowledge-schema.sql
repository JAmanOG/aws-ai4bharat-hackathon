-- =====================================================
-- Rural Ecosystem Platform – Knowledge Module Schema
-- Aurora PostgreSQL (Serverless v2)
-- =====================================================

-- Courses available for learning
CREATE TABLE IF NOT EXISTS courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    category        VARCHAR(100) NOT NULL,
    language        VARCHAR(10) NOT NULL DEFAULT 'hi',
    difficulty      VARCHAR(20) NOT NULL DEFAULT 'beginner',
    source          VARCHAR(50) NOT NULL DEFAULT 'curated',   -- 'curated' | 'government' | 'community'
    provider_name   VARCHAR(300),
    provider_url    VARCHAR(1000),
    duration_minutes INT DEFAULT 0,
    thumbnail_s3_key VARCHAR(500),
    tags            TEXT[],                                     -- searchable tags
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_courses_language ON courses(language);
CREATE INDEX idx_courses_difficulty ON courses(difficulty);
CREATE INDEX idx_courses_source ON courses(source);

-- Individual modules within a course
CREATE TABLE IF NOT EXISTS course_modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_number   INT NOT NULL,
    title           VARCHAR(500) NOT NULL,
    content_text    TEXT,                                       -- raw text content for TTS
    audio_s3_key    VARCHAR(500),                              -- pre-generated audio file in S3
    language        VARCHAR(10) NOT NULL DEFAULT 'hi',
    duration_minutes INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, module_number)
);

CREATE INDEX idx_modules_course ON course_modules(course_id);

-- User enrollments in courses
CREATE TABLE IF NOT EXISTS enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(128) NOT NULL,                     -- Cognito sub
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',     -- active | completed | paused | dropped
    enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    last_accessed   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);

-- Per-module progress tracking
CREATE TABLE IF NOT EXISTS module_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id   UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    module_id       UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'not_started',
    score           INT DEFAULT 0,                             -- 0-100
    time_spent_secs INT DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    UNIQUE(enrollment_id, module_id)
);

CREATE INDEX idx_progress_enrollment ON module_progress(enrollment_id);

-- Government training courses (synced from external portals)
CREATE TABLE IF NOT EXISTS government_courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_portal   VARCHAR(200) NOT NULL,                     -- e.g. 'PMKVY', 'DDU-GKY', 'Skill India'
    external_id     VARCHAR(200),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    url             VARCHAR(1000),
    language        VARCHAR(10) DEFAULT 'hi',
    category        VARCHAR(100),
    eligibility     TEXT,
    is_active       BOOLEAN DEFAULT true,
    last_synced     TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_govt_courses_portal ON government_courses(source_portal);
CREATE INDEX idx_govt_courses_category ON government_courses(category);
CREATE INDEX idx_govt_courses_language ON government_courses(language);

-- Seed some sample government courses
INSERT INTO government_courses (source_portal, title, description, url, language, category, eligibility) VALUES
    ('PMKVY', 'Pradhan Mantri Kaushal Vikas Yojana - Agriculture', 'Free skill training for agriculture sector under PMKVY scheme', 'https://www.pmkvyofficial.org/', 'hi', 'agriculture', 'Age 15-45, Rural residents'),
    ('DDU-GKY', 'Deen Dayal Upadhyaya Grameen Kaushalya Yojana', 'Skill training for rural youth for employment', 'https://ddugky.gov.in/', 'hi', 'entrepreneurship', 'Age 15-35, Rural BPL families'),
    ('Skill India', 'Digital Literacy - PMGDISHA', 'Pradhan Mantri Gramin Digital Saksharta Abhiyan', 'https://www.pmgdisha.in/', 'hi', 'digital-literacy', 'Rural households with no digital literate member'),
    ('MANAGE', 'Agricultural Extension Management', 'Training for agricultural extension workers and farmers', 'https://www.manage.gov.in/', 'en', 'agriculture', 'Farmers and extension workers'),
    ('ICAR', 'Krishi Vigyan Kendra Training', 'Frontline agricultural training and demonstrations', 'https://kvk.icar.gov.in/', 'hi', 'sustainable-farming', 'Farmers and rural youth');

-- Seed sample curated courses
INSERT INTO courses (title, description, category, language, difficulty, source, duration_minutes, tags) VALUES
    ('जैविक खेती की मूल बातें', 'जैविक खेती के बारे में सीखें - मिट्टी की तैयारी से लेकर फसल कटाई तक', 'sustainable-farming', 'hi', 'beginner', 'curated', 120, ARRAY['organic', 'farming', 'soil']),
    ('Basics of Organic Farming', 'Learn organic farming from soil preparation to harvesting', 'sustainable-farming', 'en', 'beginner', 'curated', 120, ARRAY['organic', 'farming', 'soil']),
    ('डिजिटल भुगतान और UPI', 'UPI, PhonePe, Google Pay जैसे डिजिटल भुगतान ऐप का उपयोग करना सीखें', 'digital-literacy', 'hi', 'beginner', 'curated', 60, ARRAY['upi', 'digital', 'payment']),
    ('पशुपालन और डेयरी प्रबंधन', 'गाय, भैंस पालन और दूध उत्पादन बढ़ाने के तरीके', 'animal-husbandry', 'hi', 'intermediate', 'curated', 180, ARRAY['dairy', 'cattle', 'milk']),
    ('Water Conservation Techniques', 'Learn rainwater harvesting and drip irrigation methods', 'water-management', 'en', 'beginner', 'curated', 90, ARRAY['water', 'irrigation', 'rainwater']),
    ('मधुमक्खी पालन', 'मधुमक्खी पालन शुरू करने और शहद उत्पादन के बारे में जानें', 'animal-husbandry', 'hi', 'beginner', 'curated', 90, ARRAY['beekeeping', 'honey']),
    ('सरकारी योजनाओं को समझें', 'किसानों के लिए उपलब्ध प्रमुख सरकारी योजनाओं की जानकारी', 'government-schemes', 'hi', 'beginner', 'curated', 60, ARRAY['schemes', 'government', 'subsidy']),
    ('Financial Literacy for Farmers', 'Understanding savings, loans, insurance and financial planning', 'financial-literacy', 'en', 'beginner', 'curated', 90, ARRAY['finance', 'savings', 'loan']);
