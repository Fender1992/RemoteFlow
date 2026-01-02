-- RemoteFlow MVP - Initial Database Schema
-- Run this in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Job sources table
CREATE TABLE public.job_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    api_endpoint TEXT,
    last_synced TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    sync_interval_minutes INTEGER DEFAULT 360
);

-- Jobs table
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    currency TEXT DEFAULT 'USD',
    job_type TEXT,
    timezone TEXT DEFAULT 'global',
    tech_stack TEXT[] DEFAULT '{}',
    experience_level TEXT DEFAULT 'any',
    url TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    company_logo TEXT,
    posted_date TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT valid_salary_range CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min)
);

-- Users profile table (extends auth.users)
CREATE TABLE public.users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved jobs table
CREATE TABLE public.saved_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'rejected', 'offer')),
    notes TEXT,
    applied_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

-- Indexes for performance
CREATE INDEX idx_jobs_source ON public.jobs(source);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX idx_jobs_posted_date ON public.jobs(posted_date DESC NULLS LAST);
CREATE INDEX idx_jobs_job_type ON public.jobs(job_type) WHERE job_type IS NOT NULL;
CREATE INDEX idx_jobs_experience_level ON public.jobs(experience_level);
CREATE INDEX idx_jobs_tech_stack ON public.jobs USING GIN(tech_stack);
CREATE INDEX idx_saved_jobs_user_id ON public.saved_jobs(user_id);
CREATE INDEX idx_saved_jobs_status ON public.saved_jobs(status);
CREATE INDEX idx_saved_jobs_user_status ON public.saved_jobs(user_id, status);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users_profile (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-set applied_date when status changes to 'applied'
CREATE OR REPLACE FUNCTION public.handle_saved_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'applied' AND (OLD IS NULL OR OLD.status != 'applied') THEN
        NEW.applied_date = COALESCE(NEW.applied_date, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_saved_job_status_change
    BEFORE INSERT OR UPDATE ON public.saved_jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_saved_job_status_change();

-- Seed Remotive source
INSERT INTO public.job_sources (name, api_endpoint, is_active)
VALUES ('remotive', 'https://remotive.com/api/remote-jobs', true);
