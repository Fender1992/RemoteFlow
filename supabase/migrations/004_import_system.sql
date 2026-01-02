-- Migration: One-Click Job Import System
-- Creates tables for import sessions, site results, and rate limiting

-- ============================================================================
-- Import Sessions (master record per user import request)
-- ============================================================================
CREATE TABLE import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Search parameters (snapshot of preferences at time of import)
  search_params JSONB NOT NULL,

  -- Results summary
  total_jobs_found INTEGER DEFAULT 0,
  total_jobs_imported INTEGER DEFAULT 0,
  total_duplicates_skipped INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Error handling
  error_message TEXT
);

CREATE INDEX idx_import_sessions_user ON import_sessions(user_id);
CREATE INDEX idx_import_sessions_status ON import_sessions(status);
CREATE INDEX idx_import_sessions_created ON import_sessions(created_at DESC);

-- ============================================================================
-- Import Site Results (per-site results within a session)
-- ============================================================================
CREATE TABLE import_site_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL CHECK (site_id IN ('linkedin', 'indeed', 'glassdoor', 'dice', 'wellfound')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),

  -- Results
  jobs_found INTEGER DEFAULT 0,
  jobs_imported INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  pages_scraped INTEGER DEFAULT 0,

  -- Search metadata
  search_url TEXT,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Error info
  error_message TEXT,

  UNIQUE(session_id, site_id)
);

CREATE INDEX idx_import_site_results_session ON import_site_results(session_id);
CREATE INDEX idx_import_site_results_status ON import_site_results(status);

-- ============================================================================
-- Import Rate Limits (per-user rate limiting)
-- ============================================================================
CREATE TABLE import_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hourly_count INTEGER DEFAULT 0,
  daily_count INTEGER DEFAULT 0,
  hourly_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  daily_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Import sessions: users can only see/manage their own
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_sessions_select_own" ON import_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "import_sessions_insert_own" ON import_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "import_sessions_update_own" ON import_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Import site results: users can only view results from their sessions
ALTER TABLE import_site_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_site_results_select_own" ON import_site_results
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM import_sessions WHERE user_id = auth.uid()));

-- Rate limits: users can only see/manage their own
ALTER TABLE import_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_rate_limits_select_own" ON import_rate_limits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "import_rate_limits_insert_own" ON import_rate_limits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "import_rate_limits_update_own" ON import_rate_limits
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Helper function for rate limit management
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_import_rate_limits(
  p_user_id UUID,
  p_hourly_reset TIMESTAMPTZ,
  p_daily_reset TIMESTAMPTZ
) RETURNS void AS $$
BEGIN
  INSERT INTO import_rate_limits (user_id, hourly_count, daily_count, hourly_reset_at, daily_reset_at, updated_at)
  VALUES (p_user_id, 1, 1, p_hourly_reset, p_daily_reset, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    hourly_count = CASE
      WHEN import_rate_limits.hourly_reset_at <= NOW() THEN 1
      ELSE import_rate_limits.hourly_count + 1
    END,
    daily_count = CASE
      WHEN import_rate_limits.daily_reset_at <= NOW() THEN 1
      ELSE import_rate_limits.daily_count + 1
    END,
    hourly_reset_at = CASE
      WHEN import_rate_limits.hourly_reset_at <= NOW() THEN p_hourly_reset
      ELSE import_rate_limits.hourly_reset_at
    END,
    daily_reset_at = CASE
      WHEN import_rate_limits.daily_reset_at <= NOW() THEN p_daily_reset
      ELSE import_rate_limits.daily_reset_at
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
