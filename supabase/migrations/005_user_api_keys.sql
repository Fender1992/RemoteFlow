-- Migration: Add user API keys for import worker
-- Users on free/pro tiers must provide their own Anthropic API key
-- Enterprise (max) tier users can use the platform's built-in key

-- Add encrypted API key column to users_profile
ALTER TABLE public.users_profile
ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.users_profile.anthropic_api_key IS
  'User-provided Anthropic API key for job imports. Required for free/pro tiers. Enterprise tier uses platform key.';

-- Update subscription_tier check to include 'max' as alias for enterprise
-- (keeping backward compatibility)
ALTER TABLE public.users_profile
DROP CONSTRAINT IF EXISTS users_profile_subscription_tier_check;

ALTER TABLE public.users_profile
ADD CONSTRAINT users_profile_subscription_tier_check
CHECK (subscription_tier IN ('free', 'pro', 'enterprise', 'max'));
