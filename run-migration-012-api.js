const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'tzwvagdjmtxsxkyceqoj';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function runSQL(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function runMigration() {
  if (!ACCESS_TOKEN) {
    console.error('Error: SUPABASE_ACCESS_TOKEN is not set');
    console.log('\nTo get your access token:');
    console.log('1. Go to https://supabase.com/dashboard/account/tokens');
    console.log('2. Create a new access token');
    console.log('3. Run: export SUPABASE_ACCESS_TOKEN="your-token"');
    process.exit(1);
  }

  console.log('Running migration 012_company_credibility.sql via Management API...\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, 'supabase/migrations/012_company_credibility.sql');
  const fullSql = fs.readFileSync(migrationPath, 'utf8');

  // Split into major sections to avoid timeout
  const sections = [
    // Section 1: Extend jobs table
    `
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS days_active INT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_evergreen BOOLEAN DEFAULT FALSE;
    `,

    // Section 2: Create job_snapshots table
    `
    CREATE TABLE IF NOT EXISTS job_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        snapshot_date DATE NOT NULL,
        is_active BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(job_id, source, snapshot_date)
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_job_date ON job_snapshots(job_id, snapshot_date DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_date_active ON job_snapshots(snapshot_date, is_active);
    CREATE INDEX IF NOT EXISTS idx_snapshots_source ON job_snapshots(source, snapshot_date);
    ALTER TABLE job_snapshots ENABLE ROW LEVEL SECURITY;
    `,

    // Section 3: Extend company_reputation
    `
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS credibility_score DECIMAL(3,2) DEFAULT 0.50;
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS credibility_grade TEXT DEFAULT 'C';
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS avg_time_to_fill_days INT;
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS median_time_to_fill_days INT;
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS response_rate DECIMAL(3,2);
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS interview_rate DECIMAL(3,2);
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS offer_rate DECIMAL(3,2);
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS evergreen_job_count INT DEFAULT 0;
    ALTER TABLE company_reputation ADD COLUMN IF NOT EXISTS hiring_trend TEXT DEFAULT 'stable';
    `,

    // Section 4: Create application_outcomes table
    `
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
    CREATE INDEX IF NOT EXISTS idx_outcomes_job ON application_outcomes(job_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_company ON application_outcomes(company_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_user ON application_outcomes(user_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_outcome ON application_outcomes(outcome);
    ALTER TABLE application_outcomes ENABLE ROW LEVEL SECURITY;
    `,

    // Section 5: Create feedback_prompts table
    `
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
    CREATE INDEX IF NOT EXISTS idx_prompts_user ON feedback_prompts(user_id, prompted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_prompts_saved_job ON feedback_prompts(saved_job_id);
    ALTER TABLE feedback_prompts ENABLE ROW LEVEL SECURITY;
    `,

    // Section 6: RLS Policies for job_snapshots
    `
    DROP POLICY IF EXISTS "Anyone can read job snapshots" ON job_snapshots;
    CREATE POLICY "Anyone can read job snapshots"
        ON job_snapshots FOR SELECT
        TO authenticated
        USING (true);
    DROP POLICY IF EXISTS "Service role can manage snapshots" ON job_snapshots;
    CREATE POLICY "Service role can manage snapshots"
        ON job_snapshots FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    `,

    // Section 7: RLS Policies for application_outcomes
    `
    DROP POLICY IF EXISTS "Users can read own outcomes" ON application_outcomes;
    CREATE POLICY "Users can read own outcomes"
        ON application_outcomes FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users can insert own outcomes" ON application_outcomes;
    CREATE POLICY "Users can insert own outcomes"
        ON application_outcomes FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users can update own outcomes" ON application_outcomes;
    CREATE POLICY "Users can update own outcomes"
        ON application_outcomes FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS "Service role full access to outcomes" ON application_outcomes;
    CREATE POLICY "Service role full access to outcomes"
        ON application_outcomes FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    `,

    // Section 8: RLS Policies for feedback_prompts
    `
    DROP POLICY IF EXISTS "Users can read own prompts" ON feedback_prompts;
    CREATE POLICY "Users can read own prompts"
        ON feedback_prompts FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users can update own prompts" ON feedback_prompts;
    CREATE POLICY "Users can update own prompts"
        ON feedback_prompts FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS "Service role full access to prompts" ON feedback_prompts;
    CREATE POLICY "Service role full access to prompts"
        ON feedback_prompts FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    `,

    // Section 9: Helper function - score_to_grade
    `
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
    `,

    // Section 10: Initialize existing jobs
    `
    UPDATE jobs
    SET
        first_seen_at = COALESCE(first_seen_at, posted_date, created_at),
        last_seen_at = COALESCE(last_seen_at, CASE WHEN is_active THEN NOW() ELSE fetched_at END, created_at),
        lifecycle_status = COALESCE(lifecycle_status, CASE
            WHEN is_active THEN 'active'
            WHEN status = 'closed_filled' THEN 'filled'
            WHEN status = 'closed_expired' THEN 'expired'
            ELSE 'unknown'
        END)
    WHERE first_seen_at IS NULL OR lifecycle_status IS NULL;
    `,

    // Section 11: Calculate days_active and evergreen
    `
    UPDATE jobs
    SET days_active = EXTRACT(DAY FROM (COALESCE(last_seen_at, NOW()) - first_seen_at))::INT
    WHERE days_active IS NULL AND first_seen_at IS NOT NULL;

    UPDATE jobs
    SET is_evergreen = true
    WHERE (days_active > 90 OR repost_count >= 3)
    AND is_active = true
    AND is_evergreen = false;
    `,

    // Section 12: Grant permissions
    `
    GRANT SELECT ON job_snapshots TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON application_outcomes TO authenticated;
    GRANT SELECT, UPDATE ON feedback_prompts TO authenticated;
    GRANT ALL ON job_snapshots TO service_role;
    GRANT ALL ON application_outcomes TO service_role;
    GRANT ALL ON feedback_prompts TO service_role;
    `
  ];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    console.log(`[${i + 1}/${sections.length}] Running section...`);

    try {
      const result = await runSQL(section);
      console.log(`  OK`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  (already exists)`);
      } else {
        console.error(`  ERROR: ${err.message}`);
      }
    }

    // Small delay between sections
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nMigration complete!');

  // Verify tables exist
  console.log('\nVerifying tables...');
  try {
    await runSQL('SELECT COUNT(*) FROM job_snapshots');
    console.log('  job_snapshots: OK');
  } catch (e) {
    console.log('  job_snapshots: MISSING');
  }

  try {
    await runSQL('SELECT COUNT(*) FROM application_outcomes');
    console.log('  application_outcomes: OK');
  } catch (e) {
    console.log('  application_outcomes: MISSING');
  }

  try {
    await runSQL('SELECT COUNT(*) FROM feedback_prompts');
    console.log('  feedback_prompts: OK');
  } catch (e) {
    console.log('  feedback_prompts: MISSING');
  }
}

runMigration().catch(console.error);
