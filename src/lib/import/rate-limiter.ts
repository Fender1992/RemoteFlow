import type { SupabaseClient } from '@supabase/supabase-js'

// Rate limits
const HOURLY_LIMIT_FREE = 3
const DAILY_LIMIT_FREE = 10
const HOURLY_LIMIT_PREMIUM = 6
const DAILY_LIMIT_PREMIUM = 20

export interface RateLimitResult {
  allowed: boolean
  reason?: 'hourly_limit' | 'daily_limit'
  remainingHourly: number
  remainingDaily: number
  resetAt?: string
}

/**
 * Check if user can perform an import based on rate limits
 */
export async function checkRateLimits(
  supabase: SupabaseClient,
  userId: string,
  isPremium: boolean = false
): Promise<RateLimitResult> {
  const now = new Date()
  const hourlyLimit = isPremium ? HOURLY_LIMIT_PREMIUM : HOURLY_LIMIT_FREE
  const dailyLimit = isPremium ? DAILY_LIMIT_PREMIUM : DAILY_LIMIT_FREE

  // Get or create rate limit record
  let { data: limits } = await supabase
    .from('import_rate_limits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!limits) {
    // Create new record with zero counts
    const { data } = await supabase
      .from('import_rate_limits')
      .insert({
        user_id: userId,
        hourly_count: 0,
        daily_count: 0,
        hourly_reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        daily_reset_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    limits = data
  }

  if (!limits) {
    // If still no limits, allow (fail open)
    return {
      allowed: true,
      remainingHourly: hourlyLimit,
      remainingDaily: dailyLimit,
    }
  }

  // Reset counters if windows expired
  let hourlyCount = limits.hourly_count
  let dailyCount = limits.daily_count

  if (new Date(limits.hourly_reset_at) <= now) {
    hourlyCount = 0
  }
  if (new Date(limits.daily_reset_at) <= now) {
    dailyCount = 0
  }

  const remainingHourly = Math.max(0, hourlyLimit - hourlyCount)
  const remainingDaily = Math.max(0, dailyLimit - dailyCount)

  // Check hourly limit
  if (remainingHourly <= 0) {
    return {
      allowed: false,
      reason: 'hourly_limit',
      remainingHourly: 0,
      remainingDaily,
      resetAt: limits.hourly_reset_at,
    }
  }

  // Check daily limit
  if (remainingDaily <= 0) {
    return {
      allowed: false,
      reason: 'daily_limit',
      remainingHourly,
      remainingDaily: 0,
      resetAt: limits.daily_reset_at,
    }
  }

  return {
    allowed: true,
    remainingHourly,
    remainingDaily,
  }
}

/**
 * Increment rate limit counters after a successful import start
 */
export async function incrementRateLimits(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const now = new Date()
  const hourlyReset = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  const dailyReset = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  // Use the database function for atomic increment
  await supabase.rpc('increment_import_rate_limits', {
    p_user_id: userId,
    p_hourly_reset: hourlyReset,
    p_daily_reset: dailyReset,
  })
}

/**
 * Get current rate limit status for display
 */
export async function getRateLimitStatus(
  supabase: SupabaseClient,
  userId: string,
  isPremium: boolean = false
): Promise<{
  hourlyUsed: number
  hourlyLimit: number
  dailyUsed: number
  dailyLimit: number
  hourlyResetAt: string | null
  dailyResetAt: string | null
}> {
  const hourlyLimit = isPremium ? HOURLY_LIMIT_PREMIUM : HOURLY_LIMIT_FREE
  const dailyLimit = isPremium ? DAILY_LIMIT_PREMIUM : DAILY_LIMIT_FREE

  const { data: limits } = await supabase
    .from('import_rate_limits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!limits) {
    return {
      hourlyUsed: 0,
      hourlyLimit,
      dailyUsed: 0,
      dailyLimit,
      hourlyResetAt: null,
      dailyResetAt: null,
    }
  }

  const now = new Date()
  const hourlyExpired = new Date(limits.hourly_reset_at) <= now
  const dailyExpired = new Date(limits.daily_reset_at) <= now

  return {
    hourlyUsed: hourlyExpired ? 0 : limits.hourly_count,
    hourlyLimit,
    dailyUsed: dailyExpired ? 0 : limits.daily_count,
    dailyLimit,
    hourlyResetAt: hourlyExpired ? null : limits.hourly_reset_at,
    dailyResetAt: dailyExpired ? null : limits.daily_reset_at,
  }
}
