-- =============================================================================
-- Migration 013: Verification System for LinkedIn Competitor Pivot
-- =============================================================================

-- =============================================================================
-- 1. Extend companies table with verification status
-- =============================================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS verification_source TEXT; -- 'email_domain', 'manual_review', etc.

CREATE INDEX IF NOT EXISTS idx_companies_verified ON companies(is_verified) WHERE is_verified = TRUE;

-- =============================================================================
-- 2. Extend users_profile with recruiter and verification data
-- =============================================================================
ALTER TABLE public.users_profile 
ADD COLUMN IF NOT EXISTS is_verified_recruiter BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recruiter_company_id UUID REFERENCES companies(id),
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS verification_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users_profile.is_verified_recruiter IS 'Whether the user is a verified recruiter';
COMMENT ON COLUMN public.users_profile.trust_score IS 'Aggregation of profile completeness and verification steps (0-100)';

-- =============================================================================
-- 3. Extend jobs table with verification flag
-- =============================================================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_verified_job BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_jobs_verified ON jobs(is_verified_job) WHERE is_verified_job = TRUE;

-- =============================================================================
-- 4. Update Profile Completeness to include trust/verification factors
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_user_trust_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score INTEGER := 0;
  v_profile RECORD;
  v_completeness INTEGER;
BEGIN
  -- Start with base completeness score (max 50 points in trust score)
  v_completeness := public.calculate_profile_completeness(p_user_id);
  v_score := (v_completeness / 2); -- Scale 0-100 to 0-50

  SELECT * INTO v_profile
  FROM public.users_profile
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Email domain match (for recruiters): 30 points
  IF v_profile.is_verified_recruiter THEN
    v_score := v_score + 30;
  END IF;

  -- External verification (GitHub/LinkedIn data): 20 points
  IF v_profile.verification_data ? 'external_verified' THEN
    v_score := v_score + 20;
  END IF;

  RETURN LEAST(v_score, 100);
END;
$$;

-- Trigger to update trust_score on profile changes
CREATE OR REPLACE FUNCTION public.update_user_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.trust_score := public.calculate_user_trust_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_update_trust ON public.users_profile;
CREATE TRIGGER on_profile_update_trust
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_trust_score();
