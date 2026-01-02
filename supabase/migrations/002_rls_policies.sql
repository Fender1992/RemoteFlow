-- RemoteFlow MVP - Row Level Security Policies
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;

-- Jobs: public read (anyone can view active jobs)
CREATE POLICY "jobs_public_read"
    ON public.jobs
    FOR SELECT
    TO public
    USING (is_active = true);

-- Users profile: users can only access their own data
CREATE POLICY "profile_select_own"
    ON public.users_profile
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "profile_update_own"
    ON public.users_profile
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profile_insert_own"
    ON public.users_profile
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Saved jobs: users can only CRUD their own saved jobs
CREATE POLICY "saved_select_own"
    ON public.saved_jobs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "saved_insert_own"
    ON public.saved_jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_update_own"
    ON public.saved_jobs
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_delete_own"
    ON public.saved_jobs
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Job sources: no public access (service role only)
-- Service role bypasses RLS, so no policies needed
