-- Migration: Application Tracking
-- Adds tables and columns to support browser extension application tracking

-- ============================================
-- 1. Application Tracking Events Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.application_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saved_job_id UUID REFERENCES public.saved_jobs(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,

    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN ('started', 'submitted', 'abandoned')),

    -- ATS detection
    ats_type TEXT,
    detection_method TEXT CHECK (detection_method IN ('form_submit', 'success_page', 'success_text', 'url_change', 'ajax_intercept', 'button_click', 'manual')),

    -- Timing
    time_spent_seconds INTEGER,

    -- URL context
    source_url TEXT,
    normalized_url TEXT,

    -- Additional metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    event_timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for application_tracking_events
CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON public.application_tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_job ON public.application_tracking_events(job_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_saved_job ON public.application_tracking_events(saved_job_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON public.application_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_timestamp ON public.application_tracking_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_user_time ON public.application_tracking_events(user_id, event_timestamp DESC);

-- ============================================
-- 2. URL Lookup Table for Fast Matching
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_url_lookup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,

    -- URLs
    original_url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    domain TEXT NOT NULL,

    -- Fallback matching
    company_title_hash TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(job_id)
);

-- Indexes for job_url_lookup
CREATE INDEX IF NOT EXISTS idx_url_lookup_normalized ON public.job_url_lookup(normalized_url);
CREATE INDEX IF NOT EXISTS idx_url_lookup_domain ON public.job_url_lookup(domain);
CREATE INDEX IF NOT EXISTS idx_url_lookup_hash ON public.job_url_lookup(company_title_hash) WHERE company_title_hash IS NOT NULL;

-- ============================================
-- 3. Alter saved_jobs Table
-- ============================================
ALTER TABLE public.saved_jobs
    ADD COLUMN IF NOT EXISTS applied_via TEXT;

ALTER TABLE public.saved_jobs
    ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMPTZ;

-- Index for applied_via analysis
CREATE INDEX IF NOT EXISTS idx_saved_jobs_applied_via
    ON public.saved_jobs(applied_via)
    WHERE applied_via IS NOT NULL;

-- ============================================
-- 4. Alter jobs Table
-- ============================================
ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS application_count INTEGER DEFAULT 0;

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS avg_time_to_apply_seconds DECIMAL(10,2);

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS application_stats_updated_at TIMESTAMPTZ;

-- Index for application count
CREATE INDEX IF NOT EXISTS idx_jobs_application_count
    ON public.jobs(application_count DESC)
    WHERE is_active = true AND application_count > 0;

-- ============================================
-- 5. Row Level Security Policies
-- ============================================

-- Enable RLS on application_tracking_events
ALTER TABLE public.application_tracking_events ENABLE ROW LEVEL SECURITY;

-- Users can only SELECT their own tracking events
CREATE POLICY "tracking_events_select_own"
    ON public.application_tracking_events
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can only INSERT their own tracking events
CREATE POLICY "tracking_events_insert_own"
    ON public.application_tracking_events
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Enable RLS on job_url_lookup
ALTER TABLE public.job_url_lookup ENABLE ROW LEVEL SECURITY;

-- Public read for URL lookups (needed for extension URL matching)
CREATE POLICY "url_lookup_public_read"
    ON public.job_url_lookup
    FOR SELECT
    TO public
    USING (true);

-- ============================================
-- 6. Functions for Statistics
-- ============================================

-- Function to recalculate job application statistics
CREATE OR REPLACE FUNCTION public.recalculate_job_application_stats(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
    v_avg_time DECIMAL(10,2);
BEGIN
    -- Count submitted applications
    SELECT COUNT(*)
    INTO v_count
    FROM public.application_tracking_events
    WHERE job_id = p_job_id
    AND event_type = 'submitted';

    -- Calculate average time to apply (only from submitted events with time data)
    SELECT AVG(time_spent_seconds)
    INTO v_avg_time
    FROM public.application_tracking_events
    WHERE job_id = p_job_id
    AND event_type = 'submitted'
    AND time_spent_seconds IS NOT NULL
    AND time_spent_seconds > 0
    AND time_spent_seconds < 7200; -- Exclude outliers > 2 hours

    -- Update job record
    UPDATE public.jobs
    SET
        application_count = v_count,
        avg_time_to_apply_seconds = v_avg_time,
        application_stats_updated_at = NOW()
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-update stats on new tracking events
CREATE OR REPLACE FUNCTION public.on_tracking_event_inserted()
RETURNS TRIGGER AS $$
BEGIN
    -- Only recalculate for submitted events with a job_id
    IF NEW.event_type = 'submitted' AND NEW.job_id IS NOT NULL THEN
        PERFORM public.recalculate_job_application_stats(NEW.job_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_tracking_event_insert ON public.application_tracking_events;
CREATE TRIGGER on_tracking_event_insert
    AFTER INSERT ON public.application_tracking_events
    FOR EACH ROW EXECUTE FUNCTION public.on_tracking_event_inserted();

-- ============================================
-- 7. Function to populate URL lookup on job insert/update
-- ============================================

-- Helper function to normalize URLs
CREATE OR REPLACE FUNCTION public.normalize_job_url(p_url TEXT)
RETURNS TABLE(normalized TEXT, domain TEXT) AS $$
DECLARE
    v_domain TEXT;
    v_path TEXT;
    v_normalized TEXT;
BEGIN
    -- Extract domain (remove protocol and www)
    v_domain := lower(regexp_replace(
        regexp_replace(p_url, '^https?://', ''),
        '^www\.', ''
    ));
    v_domain := split_part(v_domain, '/', 1);
    v_domain := split_part(v_domain, '?', 1);

    -- Extract path (remove query params and fragments)
    v_path := regexp_replace(p_url, '^https?://[^/]+', '');
    v_path := split_part(v_path, '?', 1);
    v_path := split_part(v_path, '#', 1);
    v_path := lower(v_path);
    v_path := regexp_replace(v_path, '/+$', ''); -- Remove trailing slashes

    v_normalized := v_domain || v_path;

    RETURN QUERY SELECT v_normalized, v_domain;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-populate job_url_lookup
CREATE OR REPLACE FUNCTION public.on_job_url_change()
RETURNS TRIGGER AS $$
DECLARE
    v_url_info RECORD;
    v_hash TEXT;
BEGIN
    -- Get normalized URL info
    SELECT * INTO v_url_info FROM public.normalize_job_url(NEW.url);

    -- Generate company + title hash
    v_hash := md5(lower(trim(NEW.company)) || '|' || lower(trim(NEW.title)));

    -- Upsert into job_url_lookup
    INSERT INTO public.job_url_lookup (job_id, original_url, normalized_url, domain, company_title_hash)
    VALUES (NEW.id, NEW.url, v_url_info.normalized, v_url_info.domain, v_hash)
    ON CONFLICT (job_id) DO UPDATE SET
        original_url = EXCLUDED.original_url,
        normalized_url = EXCLUDED.normalized_url,
        domain = EXCLUDED.domain,
        company_title_hash = EXCLUDED.company_title_hash;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for job URL changes
DROP TRIGGER IF EXISTS on_job_url_change ON public.jobs;
CREATE TRIGGER on_job_url_change
    AFTER INSERT OR UPDATE OF url ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.on_job_url_change();

-- ============================================
-- 8. Backfill job_url_lookup for existing jobs
-- ============================================

-- Populate URL lookup for all existing jobs
INSERT INTO public.job_url_lookup (job_id, original_url, normalized_url, domain, company_title_hash)
SELECT
    j.id,
    j.url,
    (SELECT normalized FROM public.normalize_job_url(j.url)),
    (SELECT domain FROM public.normalize_job_url(j.url)),
    md5(lower(trim(j.company)) || '|' || lower(trim(j.title)))
FROM public.jobs j
WHERE NOT EXISTS (SELECT 1 FROM public.job_url_lookup l WHERE l.job_id = j.id)
ON CONFLICT (job_id) DO NOTHING;
