import { describe, it, expect, vi, afterEach } from 'vitest'
import { corsHeaders } from './cors'

describe('corsHeaders', () => {
  it('returns headers with the given origin', () => {
    const headers = corsHeaders('https://example.com')
    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com')
    expect(headers['Access-Control-Allow-Methods']).toContain('GET')
    expect(headers['Access-Control-Allow-Methods']).toContain('POST')
    expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type')
    expect(headers['Access-Control-Allow-Credentials']).toBe('true')
  })
})

// Note: getAllowedOrigin requires NextRequest which is hard to mock in unit tests.
// Integration testing via API route tests is more appropriate.
