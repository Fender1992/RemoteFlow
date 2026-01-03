-- Migration: User Profiles, Job Matching, and Job Views
-- Adds resume/profile data, job match scoring, and passive view tracking

-- ============================================================================
-- Add Resume/Profile Columns to users_profile
-- ============================================================================
ALTER TABLE public.users_profile
ADD COLUMN IF NOT EXISTS resume_text TEXT,
ADD COLUMN IF NOT EXISTS resume_filename TEXT,
ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS job_titles TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS years_experience INTEGER,
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS preferred_locations TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS salary_expectation_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_expectation_max INTEGER,
ADD COLUMN IF NOT EXISTS completeness_score INTEGER DEFAULT 0;

COMMENT ON COLUMN public.users_profile.resume_text IS 'Raw text extracted from uploaded resume';
COMMENT ON COLUMN public.users_profile.skills IS 'AI-extracted skills from resume';
COMMENT ON COLUMN public.users_profile.job_titles IS 'AI-extracted job titles/roles from resume';
COMMENT ON COLUMN public.users_profile.years_experience IS 'Total years of experience';
COMMENT ON COLUMN public.users_profile.education_level IS 'high_school, bachelors, masters, phd, other';
COMMENT ON COLUMN public.users_profile.completeness_score IS 'Profile completeness percentage (0-100)';

-- ============================================================================
-- Job Match Scores Table (cached per user-job pair)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,

  -- Match breakdown (0-100 each)
  overall_score INTEGER NOT NULL,
  skills_score INTEGER,
  experience_score INTEGER,
  location_score INTEGER,
  salary_score INTEGER,

  -- AI suggestions for improving match
  suggestions TEXT[] DEFAULT '{}',

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_match_user ON public.job_match_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_job_match_job ON public.job_match_scores(job_id);
CREATE INDEX IF NOT EXISTS idx_job_match_score ON public.job_match_scores(user_id, overall_score DESC);

-- ============================================================================
-- Job Views Table (passive view tracking from extension)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job identification
  url TEXT NOT NULL,
  job_id TEXT,  -- Null if not matched to our DB

  -- Extracted metadata
  title TEXT,
  company TEXT,
  platform TEXT,  -- 'linkedin', 'indeed', 'glassdoor', 'greenhouse', 'lever', etc.

  -- Tracking
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  prompted_to_save BOOLEAN DEFAULT FALSE,
  saved BOOLEAN DEFAULT FALSE,

  UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_job_views_user ON public.job_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_views_platform ON public.job_views(platform);
CREATE INDEX IF NOT EXISTS idx_job_views_saved ON public.job_views(user_id, saved);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Job match scores: users can only see/manage their own
ALTER TABLE public.job_match_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_match_scores_select_own" ON public.job_match_scores;
CREATE POLICY "job_match_scores_select_own" ON public.job_match_scores
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_match_scores_insert_own" ON public.job_match_scores;
CREATE POLICY "job_match_scores_insert_own" ON public.job_match_scores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_match_scores_update_own" ON public.job_match_scores;
CREATE POLICY "job_match_scores_update_own" ON public.job_match_scores
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_match_scores_delete_own" ON public.job_match_scores;
CREATE POLICY "job_match_scores_delete_own" ON public.job_match_scores
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Job views: users can only see/manage their own
ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_views_select_own" ON public.job_views;
CREATE POLICY "job_views_select_own" ON public.job_views
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_views_insert_own" ON public.job_views;
CREATE POLICY "job_views_insert_own" ON public.job_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_views_update_own" ON public.job_views;
CREATE POLICY "job_views_update_own" ON public.job_views
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_views_delete_own" ON public.job_views;
CREATE POLICY "job_views_delete_own" ON public.job_views
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Helper Function: Calculate Profile Completeness
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_profile_completeness(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score INTEGER := 0;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_profile
  FROM public.users_profile
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Resume uploaded: 25 points
  IF v_profile.resume_text IS NOT NULL THEN
    v_score := v_score + 25;
  END IF;

  -- Skills extracted: 20 points
  IF array_length(v_profile.skills, 1) > 0 THEN
    v_score := v_score + 20;
  END IF;

  -- Job titles: 15 points
  IF array_length(v_profile.job_titles, 1) > 0 THEN
    v_score := v_score + 15;
  END IF;

  -- Years experience: 10 points
  IF v_profile.years_experience IS NOT NULL THEN
    v_score := v_score + 10;
  END IF;

  -- Education level: 10 points
  IF v_profile.education_level IS NOT NULL THEN
    v_score := v_score + 10;
  END IF;

  -- Preferred locations: 10 points
  IF array_length(v_profile.preferred_locations, 1) > 0 THEN
    v_score := v_score + 10;
  END IF;

  -- Salary expectations: 10 points
  IF v_profile.salary_expectation_min IS NOT NULL OR v_profile.salary_expectation_max IS NOT NULL THEN
    v_score := v_score + 10;
  END IF;

  RETURN v_score;
END;
$$;

-- ============================================================================
-- Trigger: Auto-update completeness score
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_profile_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.completeness_score := public.calculate_profile_completeness(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_update_completeness ON public.users_profile;
CREATE TRIGGER on_profile_update_completeness
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_completeness();

-- ============================================================================
-- Helper Function: Upsert Job View
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_job_view(
  p_user_id UUID,
  p_url TEXT,
  p_title TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_job_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.job_views (user_id, url, title, company, platform, job_id, viewed_at)
  VALUES (p_user_id, p_url, p_title, p_company, p_platform, p_job_id, NOW())
  ON CONFLICT (user_id, url)
  DO UPDATE SET
    title = COALESCE(EXCLUDED.title, job_views.title),
    company = COALESCE(EXCLUDED.company, job_views.company),
    platform = COALESCE(EXCLUDED.platform, job_views.platform),
    job_id = COALESCE(EXCLUDED.job_id, job_views.job_id),
    viewed_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
