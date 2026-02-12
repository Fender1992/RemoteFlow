import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  timestamps: number[]
}

// In-memory sliding window store
const store = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

interface RateLimitConfig {
  /** Maximum requests in the window */
  limit: number
  /** Window size in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  retryAfterMs?: number
}

/**
 * Check rate limit for a given key.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const cutoff = now - config.windowMs

  cleanup(config.windowMs)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= config.limit) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + config.windowMs - now
    return {
      allowed: false,
      remaining: 0,
      limit: config.limit,
      retryAfterMs: Math.max(0, retryAfterMs),
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    limit: config.limit,
  }
}

/**
 * Extract a rate-limit key from a request (IP + optional user ID).
 */
function getRateLimitKey(request: NextRequest, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `${prefix}:${ip}`
}

// Preset configurations
export const RATE_LIMIT_PRESETS = {
  auth: { limit: 10, windowMs: 60 * 1000 },          // 10/min
  sensitive: { limit: 5, windowMs: 60 * 1000 },       // 5/min
  reporting: { limit: 5, windowMs: 5 * 60 * 1000 },   // 5/5min
  general: { limit: 60, windowMs: 60 * 1000 },        // 60/min
} as const

/**
 * Rate-limit middleware helper for API routes.
 * Returns null if allowed, or a 429 response if rate-limited.
 */
export function rateLimit(
  request: NextRequest,
  prefix: string,
  config: RateLimitConfig
): NextResponse | null {
  const key = getRateLimitKey(request, prefix)
  const result = checkRateLimit(key, config)

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfterMs: result.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.retryAfterMs || 0) / 1000)),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null
}
