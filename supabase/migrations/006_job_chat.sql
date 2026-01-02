-- Migration: CacheGPT Job Chat Integration
-- Tracks chat usage per user for rate limiting and analytics

-- ============================================================================
-- Job Chat Usage Table (per-user rate limiting, daily reset)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_chat_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_count INTEGER DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
  total_count INTEGER DEFAULT 0,
  cached_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_chat_usage_reset ON public.job_chat_usage(daily_reset_at);

-- ============================================================================
-- Job Chat History Table (for analytics/debugging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  was_cached BOOLEAN DEFAULT FALSE,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_chat_history_user ON public.job_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_job_chat_history_job ON public.job_chat_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_chat_history_created ON public.job_chat_history(created_at DESC);

-- ============================================================================
-- Add CacheGPT API key column to users_profile
-- ============================================================================
ALTER TABLE public.users_profile
ADD COLUMN IF NOT EXISTS cachegpt_api_key TEXT;

COMMENT ON COLUMN public.users_profile.cachegpt_api_key IS
  'User-provided CacheGPT API key for job chat. Required for free/pro tiers. Max/enterprise use platform key.';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Job chat usage: users can only see/manage their own
ALTER TABLE public.job_chat_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_chat_usage_select_own" ON public.job_chat_usage;
CREATE POLICY "job_chat_usage_select_own" ON public.job_chat_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_chat_usage_insert_own" ON public.job_chat_usage;
CREATE POLICY "job_chat_usage_insert_own" ON public.job_chat_usage
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_chat_usage_update_own" ON public.job_chat_usage;
CREATE POLICY "job_chat_usage_update_own" ON public.job_chat_usage
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Job chat history: users can only see their own
ALTER TABLE public.job_chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_chat_history_select_own" ON public.job_chat_history;
CREATE POLICY "job_chat_history_select_own" ON public.job_chat_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_chat_history_insert_own" ON public.job_chat_history;
CREATE POLICY "job_chat_history_insert_own" ON public.job_chat_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Check rate limit without incrementing
CREATE OR REPLACE FUNCTION public.check_job_chat_limit(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, limit_amount INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_daily_limit INTEGER;
  v_current_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Get user tier
  SELECT subscription_tier INTO v_tier
  FROM public.users_profile
  WHERE id = p_user_id;

  -- Set limit based on tier
  -- free: 10, pro: 50, max/enterprise: 100
  v_daily_limit := CASE
    WHEN v_tier IN ('max', 'enterprise') THEN 100
    WHEN v_tier = 'pro' THEN 50
    ELSE 10
  END;

  -- Get current usage (reset if past reset time)
  SELECT
    CASE WHEN u.daily_reset_at <= NOW() THEN 0 ELSE u.daily_count END,
    CASE WHEN u.daily_reset_at <= NOW() THEN NOW() + INTERVAL '1 day' ELSE u.daily_reset_at END
  INTO v_current_count, v_reset_at
  FROM public.job_chat_usage u
  WHERE u.user_id = p_user_id;

  -- Handle no existing record
  IF v_current_count IS NULL THEN
    v_current_count := 0;
    v_reset_at := NOW() + INTERVAL '1 day';
  END IF;

  RETURN QUERY SELECT
    (v_current_count < v_daily_limit) AS allowed,
    GREATEST(0, v_daily_limit - v_current_count)::INTEGER AS remaining,
    v_daily_limit AS limit_amount,
    v_reset_at AS reset_at;
END;
$$;

-- Atomic increment for chat usage with daily reset
CREATE OR REPLACE FUNCTION public.increment_job_chat_usage(
  p_user_id UUID,
  p_was_cached BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, limit_amount INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_daily_limit INTEGER;
BEGIN
  -- Get user tier
  SELECT subscription_tier INTO v_tier
  FROM public.users_profile
  WHERE id = p_user_id;

  -- Set limit based on tier
  v_daily_limit := CASE
    WHEN v_tier IN ('max', 'enterprise') THEN 100
    WHEN v_tier = 'pro' THEN 50
    ELSE 10
  END;

  -- Upsert and get current count
  INSERT INTO public.job_chat_usage (user_id, daily_count, daily_reset_at, total_count, cached_count, updated_at)
  VALUES (
    p_user_id,
    1,
    NOW() + INTERVAL '1 day',
    1,
    CASE WHEN p_was_cached THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    daily_count = CASE
      WHEN public.job_chat_usage.daily_reset_at <= NOW() THEN 1
      ELSE public.job_chat_usage.daily_count + 1
    END,
    daily_reset_at = CASE
      WHEN public.job_chat_usage.daily_reset_at <= NOW() THEN NOW() + INTERVAL '1 day'
      ELSE public.job_chat_usage.daily_reset_at
    END,
    total_count = public.job_chat_usage.total_count + 1,
    cached_count = public.job_chat_usage.cached_count + CASE WHEN p_was_cached THEN 1 ELSE 0 END,
    updated_at = NOW();

  -- Return updated limits
  RETURN QUERY
  SELECT
    (jcu.daily_count <= v_daily_limit) AS allowed,
    GREATEST(0, v_daily_limit - jcu.daily_count)::INTEGER AS remaining,
    v_daily_limit AS limit_amount
  FROM public.job_chat_usage jcu
  WHERE jcu.user_id = p_user_id;
END;
$$;
