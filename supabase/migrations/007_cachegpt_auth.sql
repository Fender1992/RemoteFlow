-- Migration: CacheGPT Authentication Integration
-- Adds cachegpt_user_id column for linking RemoteFlow accounts to CacheGPT accounts

-- ============================================================================
-- Add CacheGPT user ID column to users_profile
-- ============================================================================
ALTER TABLE public.users_profile
ADD COLUMN IF NOT EXISTS cachegpt_user_id TEXT;

-- Index for quick lookups by CacheGPT user ID
CREATE INDEX IF NOT EXISTS idx_users_profile_cachegpt_user_id
ON public.users_profile(cachegpt_user_id)
WHERE cachegpt_user_id IS NOT NULL;

COMMENT ON COLUMN public.users_profile.cachegpt_user_id IS
  'CacheGPT user ID (sub claim) for users who authenticated via CacheGPT';

-- ============================================================================
-- Update insert policy to allow new fields
-- ============================================================================
-- The existing RLS policies should allow users to update their own profiles
-- No additional policies needed since cachegpt_user_id follows the same pattern
