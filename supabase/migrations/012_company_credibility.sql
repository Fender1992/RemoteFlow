-- =============================================================================
-- Migration 012: Company Credibility & Time-to-Fill Tracking
-- =============================================================================
-- Adds job lifecycle tracking, company credibility scores, and feedback collection
-- =============================================================================

-- =============================================================================
-- 1. Extend jobs table with lifecycle tracking
-- =============================================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS days_active INT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_evergreen BOOLEAN DEFAULT FALSE;

-- Add check constraint for lifecycle_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'jobs_lifecycle_status_check'
    ) THEN
        ALTER TABLE jobs ADD CONSTRAINT jobs_lifecycle_status_check
        CHECK (lifecycle_status IN ('active', 'filled', 'expired', 'reposted', 'unknown'));
    END IF;
END $$;

-- Index for lifecycle queries
CREATE INDEX IF NOT EXISTS idx_jobs_lifecycle_status ON jobs(lifecycle_status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_days_active ON jobs(days_active) WHERE is_active = true;

-- =============================================================================
-- 2. Create job_snapshots table for daily tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS job_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(job_id, source, snapshot_date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_snapshots_job_date ON job_snapshots(job_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_date_active ON job_snapshots(snapshot_date, is_active);
CREATE INDEX IF NOT EXISTS idx_snapshots_source ON job_snapshots(source, snapshot_date);

-- RLS for job_snapshots
ALTER TABLE job_snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can read snapshots (public data for transparency)
CREATE POLICY "Anyone can read job snapshots"
    ON job_snapshots FOR SELECT
    TO authenticated
    USING (true);

-- Only service role can insert/update snapshots
CREATE POLICY "Service role can manage snapshots"
    ON job_snapshots FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- 3. Extend company_reputation table with credibility metrics
-- =============================================================================

ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS credibility_score DECIMAL(3,2) DEFAULT 0.50;
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS credibility_grade TEXT DEFAULT 'C';
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS avg_time_to_fill_days INT;
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS median_time_to_fill_days INT;
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS response_rate DECIMAL(3,2);
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS interview_rate DECIMAL(3,2);
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS offer_rate DECIMAL(3,2);
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS evergreen_job_count INT DEFAULT 0;
ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS hiring_trend TEXT DEFAULT 'stable';

-- Add check constraint for credibility_grade
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'company_reputation_grade_check'
    ) THEN
        ALTER TABLE company_reputation ADD CONSTRAINT company_reputation_grade_check
        CHECK (credibility_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'));
    END IF;
END $$;

-- Add check constraint for hiring_trend
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'company_reputation_trend_check'
    ) THEN
        ALTER TABLE company_reputation ADD CONSTRAINT company_reputation_trend_check
        CHECK (hiring_trend IN ('growing', 'stable', 'declining'));
    END IF;
END $$;

-- Index for credibility queries
CREATE INDEX IF NOT EXISTS idx_company_reputation_credibility ON company_reputation(credibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_company_reputation_grade ON company_reputation(credibility_grade);

-- =============================================================================
-- 4. Create application_outcomes table for feedback tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saved_job_id UUID REFERENCES saved_jobs(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

    applied_at TIMESTAMPTZ,
    outcome_reported_at TIMESTAMPTZ DEFAULT NOW(),

    outcome TEXT NOT NULL,
    days_to_response INT,
    interview_rounds INT,
    rejection_stage TEXT,

    experience_rating INT,
    would_recommend BOOLEAN,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(saved_job_id)
);

-- Add check constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'application_outcomes_outcome_check'
    ) THEN
        ALTER TABLE application_outcomes ADD CONSTRAINT application_outcomes_outcome_check
        CHECK (outcome IN ('no_response', 'rejected', 'interview', 'offer', 'hired'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'application_outcomes_rejection_stage_check'
    ) THEN
        ALTER TABLE application_outcomes ADD CONSTRAINT application_outcomes_rejection_stage_check
        CHECK (rejection_stage IS NULL OR rejection_stage IN ('resume', 'phone_screen', 'technical', 'onsite', 'offer'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'application_outcomes_rating_check'
    ) THEN
        ALTER TABLE application_outcomes ADD CONSTRAINT application_outcomes_rating_check
        CHECK (experience_rating IS NULL OR (experience_rating >= 1 AND experience_rating <= 5));
    END IF;
END $$;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_outcomes_job ON application_outcomes(job_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_company ON application_outcomes(company_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_user ON application_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_outcome ON application_outcomes(outcome);

-- RLS for application_outcomes
ALTER TABLE application_outcomes ENABLE ROW LEVEL SECURITY;

-- Users can read their own outcomes
CREATE POLICY "Users can read own outcomes"
    ON application_outcomes FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can insert their own outcomes
CREATE POLICY "Users can insert own outcomes"
    ON application_outcomes FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own outcomes
CREATE POLICY "Users can update own outcomes"
    ON application_outcomes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role full access to outcomes"
    ON application_outcomes FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- 5. Create feedback_prompts table
-- =============================================================================

CREATE TABLE IF NOT EXISTS feedback_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saved_job_id UUID NOT NULL REFERENCES saved_jobs(id) ON DELETE CASCADE,

    prompt_type TEXT NOT NULL,
    prompted_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,

    delivery_method TEXT DEFAULT 'in_app',
    email_sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedback_prompts_type_check'
    ) THEN
        ALTER TABLE feedback_prompts ADD CONSTRAINT feedback_prompts_type_check
        CHECK (prompt_type IN ('followup_7d', 'followup_14d', 'followup_30d'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedback_prompts_delivery_check'
    ) THEN
        ALTER TABLE feedback_prompts ADD CONSTRAINT feedback_prompts_delivery_check
        CHECK (delivery_method IN ('in_app', 'email'));
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompts_user ON feedback_prompts(user_id, prompted_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_pending ON feedback_prompts(user_id)
    WHERE responded_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_saved_job ON feedback_prompts(saved_job_id);

-- RLS for feedback_prompts
ALTER TABLE feedback_prompts ENABLE ROW LEVEL SECURITY;

-- Users can read their own prompts
CREATE POLICY "Users can read own prompts"
    ON feedback_prompts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can update their own prompts (to mark as responded/dismissed)
CREATE POLICY "Users can update own prompts"
    ON feedback_prompts FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role full access to prompts"
    ON feedback_prompts FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- 6. Helper Functions
-- =============================================================================

-- Function to calculate days active for a job
CREATE OR REPLACE FUNCTION calculate_job_days_active(job_id UUID)
RETURNS INT AS $$
DECLARE
    first_seen DATE;
    last_seen DATE;
BEGIN
    SELECT
        MIN(snapshot_date),
        MAX(snapshot_date) FILTER (WHERE is_active = true)
    INTO first_seen, last_seen
    FROM job_snapshots
    WHERE job_snapshots.job_id = calculate_job_days_active.job_id;

    IF first_seen IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN COALESCE(last_seen, CURRENT_DATE) - first_seen;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to convert credibility score to grade
CREATE OR REPLACE FUNCTION score_to_grade(score DECIMAL)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE
        WHEN score >= 0.95 THEN 'A+'
        WHEN score >= 0.90 THEN 'A'
        WHEN score >= 0.85 THEN 'A-'
        WHEN score >= 0.80 THEN 'B+'
        WHEN score >= 0.75 THEN 'B'
        WHEN score >= 0.70 THEN 'B-'
        WHEN score >= 0.65 THEN 'C+'
        WHEN score >= 0.60 THEN 'C'
        WHEN score >= 0.50 THEN 'C-'
        WHEN score >= 0.40 THEN 'D'
        ELSE 'F'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get pending feedback prompts for a user
CREATE OR REPLACE FUNCTION get_pending_feedback_prompts(p_user_id UUID)
RETURNS TABLE (
    prompt_id UUID,
    saved_job_id UUID,
    job_title TEXT,
    company TEXT,
    applied_at TIMESTAMPTZ,
    days_since_apply INT,
    prompt_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fp.id as prompt_id,
        fp.saved_job_id,
        j.title as job_title,
        j.company,
        sj.applied_date as applied_at,
        EXTRACT(DAY FROM NOW() - sj.applied_date)::INT as days_since_apply,
        fp.prompt_type
    FROM feedback_prompts fp
    JOIN saved_jobs sj ON sj.id = fp.saved_job_id
    JOIN jobs j ON j.id = sj.job_id
    WHERE fp.user_id = p_user_id
    AND fp.responded_at IS NULL
    AND fp.dismissed_at IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM application_outcomes ao
        WHERE ao.saved_job_id = fp.saved_job_id
    )
    ORDER BY fp.prompted_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 7. Initialize existing jobs with lifecycle data
-- =============================================================================

-- Set first_seen_at and last_seen_at for existing jobs based on created_at
UPDATE jobs
SET
    first_seen_at = COALESCE(posted_date, created_at),
    last_seen_at = CASE WHEN is_active THEN NOW() ELSE COALESCE(fetched_at, created_at) END,
    lifecycle_status = CASE
        WHEN is_active THEN 'active'
        WHEN status = 'closed_filled' THEN 'filled'
        WHEN status = 'closed_expired' THEN 'expired'
        ELSE 'unknown'
    END
WHERE first_seen_at IS NULL;

-- Calculate initial days_active
UPDATE jobs
SET days_active = EXTRACT(DAY FROM (COALESCE(last_seen_at, NOW()) - first_seen_at))::INT
WHERE days_active IS NULL AND first_seen_at IS NOT NULL;

-- Mark evergreen jobs (active for 90+ days or reposted 3+ times)
UPDATE jobs
SET is_evergreen = true
WHERE (days_active > 90 OR repost_count >= 3)
AND is_active = true;

-- =============================================================================
-- 8. Grant permissions
-- =============================================================================

GRANT SELECT ON job_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON application_outcomes TO authenticated;
GRANT SELECT, UPDATE ON feedback_prompts TO authenticated;
GRANT ALL ON job_snapshots TO service_role;
GRANT ALL ON application_outcomes TO service_role;
GRANT ALL ON feedback_prompts TO service_role;
