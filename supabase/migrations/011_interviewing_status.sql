-- Migration: Add interviewing status to saved_jobs
-- This adds a new status for tracking jobs in the interview stage

-- Update the status CHECK constraint to include 'interviewing'
ALTER TABLE public.saved_jobs
DROP CONSTRAINT IF EXISTS saved_jobs_status_check;

ALTER TABLE public.saved_jobs
ADD CONSTRAINT saved_jobs_status_check
CHECK (status IN ('saved', 'applied', 'interviewing', 'rejected', 'offer'));

-- Add index for interviewing status queries
CREATE INDEX IF NOT EXISTS idx_saved_jobs_interviewing
ON public.saved_jobs(user_id, status)
WHERE status = 'interviewing';
