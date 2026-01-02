-- RemoteFlow - Job Quality & Reputation System Schema
-- Run this in Supabase SQL Editor after 002_rls_policies.sql

-- =============================================================================
-- 1. Add Quality Columns to Jobs Table
-- =============================================================================

-- Health and quality scores
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS health_score DECIMAL(3,2) DEFAULT 0.50;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT 0.50;

-- Ghost job detection
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS ghost_score INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS ghost_flags JSONB DEFAULT '[]';

-- Description hashing for duplicate/boilerplate detection
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description_hash TEXT;

-- Repost tracking
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 1;

-- Job status lifecycle
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Quality timestamp
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS quality_updated_at TIMESTAMPTZ;

-- Company linking (will be set after companies table exists)
-- ALTER TABLE public.jobs ADD COLUMN company_id UUID; -- added below after companies table

-- Indexes for quality filtering
CREATE INDEX IF NOT EXISTS idx_jobs_quality ON public.jobs(quality_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_health ON public.jobs(health_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_description_hash ON public.jobs(description_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_ghost_score ON public.jobs(ghost_score);

-- =============================================================================
-- 2. Companies Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    logo_url TEXT,
    website TEXT,
    employee_count INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name_normalized);
CREATE INDEX IF NOT EXISTS idx_companies_verified ON public.companies(is_verified) WHERE is_verified = true;

-- =============================================================================
-- 3. Company Reputation Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.company_reputation (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    reputation_score DECIMAL(3,2) DEFAULT 0.50,
    total_jobs_posted INTEGER DEFAULT 0,
    jobs_filled INTEGER DEFAULT 0,
    jobs_expired INTEGER DEFAULT 0,
    jobs_ghosted INTEGER DEFAULT 0,
    total_applications_tracked INTEGER DEFAULT 0,
    applications_with_response INTEGER DEFAULT 0,
    avg_days_to_close DECIMAL(5,1),
    avg_reposts_per_job DECIMAL(3,1) DEFAULT 1.0,
    score_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. Link Jobs to Companies
-- =============================================================================

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON public.jobs(company_id);

-- =============================================================================
-- 5. Job Lineage Table (Repost Tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    instance_number INTEGER DEFAULT 1,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    close_reason TEXT, -- filled, expired, removed, reposted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lineage_canonical ON public.job_lineage(canonical_job_id);
CREATE INDEX IF NOT EXISTS idx_lineage_job ON public.job_lineage(job_id);

-- =============================================================================
-- 6. Job Signals Table (User Feedback)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL, -- got_hired, got_response, no_response, fake_report, spam_report
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, user_id, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_signals_job ON public.job_signals(job_id);
CREATE INDEX IF NOT EXISTS idx_signals_user ON public.job_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON public.job_signals(signal_type);

-- =============================================================================
-- 7. Review Queue Table (Admin)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- job, company
    entity_id UUID NOT NULL,
    reason TEXT NOT NULL, -- auto_ghost, user_reports, auto_low_score, spam_detected
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending', -- pending, reviewed, dismissed
    reviewer_notes TEXT,
    action_taken TEXT, -- approved, removed, blacklisted, warned
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_status ON public.review_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_review_entity ON public.review_queue(entity_type, entity_id);

-- =============================================================================
-- 8. Admin Users Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'reviewer', -- reviewer, admin, super_admin
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. Row Level Security Policies
-- =============================================================================

-- Companies: public read
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_public_read"
    ON public.companies
    FOR SELECT
    TO public
    USING (true);

-- Company reputation: public read
ALTER TABLE public.company_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reputation_public_read"
    ON public.company_reputation
    FOR SELECT
    TO public
    USING (true);

-- Job signals: users can submit and view their own
ALTER TABLE public.job_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signals_insert_own"
    ON public.job_signals
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "signals_select_own"
    ON public.job_signals
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Job lineage: public read
ALTER TABLE public.job_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineage_public_read"
    ON public.job_lineage
    FOR SELECT
    TO public
    USING (true);

-- Review queue: admin only (handled by service role)
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

-- Admin users: no public access
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 10. Helper Functions
-- =============================================================================

-- Function to update job status and timestamp
CREATE OR REPLACE FUNCTION public.update_job_status(
    p_job_id UUID,
    p_status TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.jobs
    SET status = p_status,
        status_changed_at = NOW()
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create company reputation record
CREATE OR REPLACE FUNCTION public.create_company_reputation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.company_reputation (company_id)
    VALUES (NEW.id)
    ON CONFLICT (company_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_company_created
    AFTER INSERT ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.create_company_reputation();

-- Function to count user reports for a job
CREATE OR REPLACE FUNCTION public.count_job_reports(p_job_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM public.job_signals
    WHERE job_id = p_job_id
    AND signal_type IN ('fake_report', 'spam_report');
$$ LANGUAGE sql STABLE;

-- =============================================================================
-- 11. Seed Additional Job Sources
-- =============================================================================

INSERT INTO public.job_sources (name, api_endpoint, is_active)
VALUES
    ('jobicy', 'https://jobicy.com/api/v2/remote-jobs', true),
    ('remoteok', 'https://remoteok.com/api', true),
    ('himalayas', 'https://himalayas.app/jobs/api', true),
    ('weworkremotely', 'https://weworkremotely.com/remote-jobs.rss', true)
ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active;
