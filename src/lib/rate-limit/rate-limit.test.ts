import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, RATE_LIMIT_PRESETS } from './index'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', () => {
    const config = { limit: 3, windowMs: 60_000 }
    const result = checkRateLimit('test:ip1', config)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('tracks remaining count correctly', () => {
    const config = { limit: 3, windowMs: 60_000 }
    const key = 'test:ip2'
    expect(checkRateLimit(key, config).remaining).toBe(2)
    expect(checkRateLimit(key, config).remaining).toBe(1)
    expect(checkRateLimit(key, config).remaining).toBe(0)
  })

  it('blocks requests over the limit', () => {
    const config = { limit: 2, windowMs: 60_000 }
    const key = 'test:ip3'
    checkRateLimit(key, config)
    checkRateLimit(key, config)
    const result = checkRateLimit(key, config)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeDefined()
  })

  it('resets after the window expires', () => {
    const config = { limit: 1, windowMs: 60_000 }
    const key = 'test:ip4'
    checkRateLimit(key, config)
    const blocked = checkRateLimit(key, config)
    expect(blocked.allowed).toBe(false)

    // Advance past window
    vi.advanceTimersByTime(61_000)
    const allowed = checkRateLimit(key, config)
    expect(allowed.allowed).toBe(true)
  })

  it('uses separate keys for different prefixes', () => {
    const config = { limit: 1, windowMs: 60_000 }
    checkRateLimit('route-a:ip5', config)
    const result = checkRateLimit('route-b:ip5', config)
    expect(result.allowed).toBe(true)
  })
})

describe('RATE_LIMIT_PRESETS', () => {
  it('has expected presets', () => {
    expect(RATE_LIMIT_PRESETS.auth).toEqual({ limit: 10, windowMs: 60_000 })
    expect(RATE_LIMIT_PRESETS.sensitive).toEqual({ limit: 5, windowMs: 60_000 })
    expect(RATE_LIMIT_PRESETS.reporting).toEqual({ limit: 5, windowMs: 300_000 })
    expect(RATE_LIMIT_PRESETS.general).toEqual({ limit: 60, windowMs: 60_000 })
  })
})
