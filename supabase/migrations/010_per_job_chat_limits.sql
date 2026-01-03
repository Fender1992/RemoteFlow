-- Migration: Per-Job Chat Rate Limiting
-- Changes from daily per-user limits to per-job limits
-- Free: 10 per job, Pro: 50 per job, Max/Enterprise: 100 per job, CacheGPT: Unlimited

-- ============================================================================
-- Backup and Drop Old Table
-- ============================================================================
-- Create backup of old usage data for reference
CREATE TABLE IF NOT EXISTS public.job_chat_usage_backup AS
SELECT * FROM public.job_chat_usage;

-- Drop old table and its policies
DROP POLICY IF EXISTS "job_chat_usage_select_own" ON public.job_chat_usage;
DROP POLICY IF EXISTS "job_chat_usage_insert_own" ON public.job_chat_usage;
DROP POLICY IF EXISTS "job_chat_usage_update_own" ON public.job_chat_usage;
DROP TABLE IF EXISTS public.job_chat_usage;

-- ============================================================================
-- New Per-Job Chat Usage Table
-- ============================================================================
CREATE TABLE public.job_chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  question_count INTEGER DEFAULT 0,
  last_question_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_chat_usage_user_job ON public.job_chat_usage(user_id, job_id);
CREATE INDEX idx_chat_usage_user ON public.job_chat_usage(user_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE public.job_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_chat_usage_select_own" ON public.job_chat_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "job_chat_usage_insert_own" ON public.job_chat_usage
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "job_chat_usage_update_own" ON public.job_chat_usage
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Updated RPC: Check Per-Job Chat Limit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_job_chat_limit(
  p_user_id UUID,
  p_job_id TEXT
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, limit_value INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_current INTEGER;
  v_has_cachegpt BOOLEAN;
BEGIN
  -- Check if user has CacheGPT API key (unlimited)
  SELECT EXISTS(
    SELECT 1 FROM public.users_profile
    WHERE id = p_user_id
    AND cachegpt_api_key IS NOT NULL
    AND cachegpt_api_key != ''
  ) INTO v_has_cachegpt;

  IF v_has_cachegpt THEN
    RETURN QUERY SELECT TRUE::BOOLEAN, 999::INTEGER, 999::INTEGER;
    RETURN;
  END IF;

  -- Get user tier
  SELECT COALESCE(subscription_tier, 'free') INTO v_tier
  FROM public.users_profile
  WHERE id = p_user_id;

  -- Per-job limits by tier
  v_limit := CASE
    WHEN v_tier IN ('max', 'enterprise') THEN 100
    WHEN v_tier = 'pro' THEN 50
    ELSE 10
  END;

  -- Get current count for this specific job
  SELECT COALESCE(question_count, 0) INTO v_current
  FROM public.job_chat_usage
  WHERE user_id = p_user_id AND job_id = p_job_id;

  -- Handle no existing record
  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  RETURN QUERY SELECT
    (v_current < v_limit)::BOOLEAN AS allowed,
    GREATEST(0, v_limit - v_current)::INTEGER AS remaining,
    v_limit::INTEGER AS limit_value;
END;
$$;

-- ============================================================================
-- Updated RPC: Increment Per-Job Chat Usage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_job_chat_usage(
  p_user_id UUID,
  p_job_id TEXT,
  p_was_cached BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, limit_value INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_has_cachegpt BOOLEAN;
BEGIN
  -- Check if user has CacheGPT API key (unlimited, don't track)
  SELECT EXISTS(
    SELECT 1 FROM public.users_profile
    WHERE id = p_user_id
    AND cachegpt_api_key IS NOT NULL
    AND cachegpt_api_key != ''
  ) INTO v_has_cachegpt;

  IF v_has_cachegpt THEN
    -- Still log to history but don't limit
    RETURN QUERY SELECT TRUE::BOOLEAN, 999::INTEGER, 999::INTEGER;
    RETURN;
  END IF;

  -- Don't count cached responses against limit
  IF p_was_cached THEN
    -- Return current state without incrementing
    RETURN QUERY SELECT * FROM public.check_job_chat_limit(p_user_id, p_job_id);
    RETURN;
  END IF;

  -- Get user tier
  SELECT COALESCE(subscription_tier, 'free') INTO v_tier
  FROM public.users_profile
  WHERE id = p_user_id;

  -- Per-job limits by tier
  v_limit := CASE
    WHEN v_tier IN ('max', 'enterprise') THEN 100
    WHEN v_tier = 'pro' THEN 50
    ELSE 10
  END;

  -- Upsert and increment
  INSERT INTO public.job_chat_usage (user_id, job_id, question_count, last_question_at)
  VALUES (p_user_id, p_job_id, 1, NOW())
  ON CONFLICT (user_id, job_id)
  DO UPDATE SET
    question_count = job_chat_usage.question_count + 1,
    last_question_at = NOW();

  -- Return updated limits
  RETURN QUERY
  SELECT
    (jcu.question_count <= v_limit)::BOOLEAN AS allowed,
    GREATEST(0, v_limit - jcu.question_count)::INTEGER AS remaining,
    v_limit::INTEGER AS limit_value
  FROM public.job_chat_usage jcu
  WHERE jcu.user_id = p_user_id AND jcu.job_id = p_job_id;
END;
$$;

-- ============================================================================
-- Helper: Get User's Chat Usage Summary
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_chat_usage_summary(p_user_id UUID)
RETURNS TABLE(
  total_jobs_chatted INTEGER,
  total_questions INTEGER,
  avg_questions_per_job NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_jobs_chatted,
    COALESCE(SUM(question_count), 0)::INTEGER AS total_questions,
    COALESCE(AVG(question_count), 0)::NUMERIC AS avg_questions_per_job
  FROM public.job_chat_usage
  WHERE user_id = p_user_id;
END;
$$;
