-- ====================================================================
-- COREATHLETE OUTREACH CRM — SUPABASE / POSTGRESQL SCHEMA
-- ====================================================================

CREATE TABLE IF NOT EXISTS outreach_leads (
    id SERIAL PRIMARY KEY,
    person_name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    role VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    area VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    mobile VARCHAR(50) NOT NULL,
    phone_normalized VARCHAR(20) NOT NULL,
    whatsapp_link TEXT,
    email VARCHAR(255),
    instagram VARCHAR(255),
    website TEXT,
    maps_url TEXT,
    source VARCHAR(100) DEFAULT 'Google Maps',
    campaign VARCHAR(150) DEFAULT 'Founder Outreach',
    online_coaching BOOLEAN DEFAULT FALSE,
    client_count VARCHAR(50) DEFAULT 'Unknown',
    athlete_types JSONB DEFAULT '[]'::jsonb,
    current_system VARCHAR(100) DEFAULT 'Unknown',
    pain_points JSONB DEFAULT '[]'::jsonb,
    lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 5),
    score_reasons JSONB DEFAULT '[]'::jsonb,
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('HOT', 'HIGH', 'MEDIUM', 'LOW', 'SKIP')),
    why_good TEXT,
    qualification_notes TEXT,
    qualified VARCHAR(30) DEFAULT 'Needs Research' CHECK (qualified IN ('Qualified', 'Unqualified', 'Needs Research')),
    unqualified_reason TEXT,
    outreach_status VARCHAR(50) DEFAULT '⏳ Not Contacted',
    last_contact_date TIMESTAMPTZ,
    next_follow_up_date TIMESTAMPTZ,
    follow_up_notes TEXT,
    call_outcome VARCHAR(50),
    call_notes TEXT,
    general_notes TEXT,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_leads_phone_norm ON outreach_leads(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_leads_status ON outreach_leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON outreach_leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_score ON outreach_leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_city ON outreach_leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_role ON outreach_leads(role);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON outreach_leads(next_follow_up_date);

-- Settings Table
CREATE TABLE IF NOT EXISTS outreach_settings (
    id VARCHAR(50) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
