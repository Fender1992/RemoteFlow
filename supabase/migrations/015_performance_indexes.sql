-- Performance indexes for common query patterns

-- Jobs table: company queries with status and ghost score filtering
CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_company_ghost ON jobs(company_id, ghost_score);
CREATE INDEX IF NOT EXISTS idx_jobs_company_active ON jobs(company_id, is_active);

-- Application outcomes: company-level aggregation
CREATE INDEX IF NOT EXISTS idx_outcomes_company ON application_outcomes(company_id, outcome);

-- Job signals: company-level aggregation
CREATE INDEX IF NOT EXISTS idx_signals_company ON job_signals(company_id);

-- Saved jobs: applied date for feedback prompt queries
CREATE INDEX IF NOT EXISTS idx_saved_jobs_applied ON saved_jobs(applied_date) WHERE status = 'applied';

-- Feedback prompts: lookup by saved_job_id and prompt_type
CREATE INDEX IF NOT EXISTS idx_feedback_prompts_saved_job ON feedback_prompts(saved_job_id, prompt_type);

-- Job snapshots: lookup by job and date
CREATE INDEX IF NOT EXISTS idx_job_snapshots_job_date ON job_snapshots(job_id, snapshot_date);

-- Jobs: quality score sorting (used in default job listing)
CREATE INDEX IF NOT EXISTS idx_jobs_quality_active ON jobs(quality_score DESC) WHERE is_active = true;

-- Jobs: posted date sorting
CREATE INDEX IF NOT EXISTS idx_jobs_posted_active ON jobs(posted_date DESC) WHERE is_active = true;

-- Jobs: created_at for hiring trend calculations
CREATE INDEX IF NOT EXISTS idx_jobs_company_created ON jobs(company_id, created_at);
