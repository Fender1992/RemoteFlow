/**
 * Job existence checker utility for JobIQ
 * Verifies if jobs are still active on their source platforms
 */

// Supported job sources
export type JobSource =
  | 'remotive'
  | 'jobicy'
  | 'remoteok'
  | 'himalayas'
  | 'weworkremotely'

// Rate limiting: max 100 checks per minute
const RATE_LIMIT_MAX_REQUESTS = 100
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const REQUEST_TIMEOUT_MS = 5000

// Rate limiter state
interface RateLimiterState {
  timestamps: number[]
}

const rateLimiter: RateLimiterState = {
  timestamps: [],
}

/**
 * Check if we can make a request within rate limits
 * Returns true if allowed, false if rate limited
 */
function canMakeRequest(): boolean {
  const now = Date.now()

  // Remove timestamps outside the window
  rateLimiter.timestamps = rateLimiter.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  )

  return rateLimiter.timestamps.length < RATE_LIMIT_MAX_REQUESTS
}

/**
 * Record a request timestamp for rate limiting
 */
function recordRequest(): void {
  rateLimiter.timestamps.push(Date.now())
}

/**
 * Wait until rate limit allows another request
 */
async function waitForRateLimit(): Promise<void> {
  while (!canMakeRequest()) {
    const now = Date.now()
    const oldestTimestamp = rateLimiter.timestamps[0]
    const waitTime = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp) + 10
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 1000)))
  }
}

/**
 * Create a fetch request with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Get appropriate headers for a source platform
 */
function getHeadersForSource(source: string): HeadersInit {
  const baseHeaders: HeadersInit = {
    'User-Agent': 'JobIQ/1.0 (job verification service)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }

  // Some platforms may require specific headers
  switch (source) {
    case 'remotive':
      return { ...baseHeaders, 'User-Agent': 'JobIQ/1.0 (job aggregator)' }
    case 'remoteok':
      return { ...baseHeaders, Accept: 'text/html' }
    default:
      return baseHeaders
  }
}

/**
 * Validate that the URL matches the expected source platform
 */
function validateUrlForSource(url: string, source: string): boolean {
  const sourceDomains: Record<string, string[]> = {
    remotive: ['remotive.com', 'remotive.io'],
    jobicy: ['jobicy.com'],
    remoteok: ['remoteok.com', 'remoteok.io'],
    himalayas: ['himalayas.app'],
    weworkremotely: ['weworkremotely.com'],
  }

  const domains = sourceDomains[source.toLowerCase()]
  if (!domains) return false

  try {
    const urlObj = new URL(url)
    return domains.some((domain) => urlObj.hostname.includes(domain))
  } catch {
    return false
  }
}

/**
 * Check if a single job still exists on its source platform
 *
 * @param jobUrl - The URL of the job posting
 * @param source - The source platform (remotive, jobicy, remoteok, himalayas, weworkremotely)
 * @returns true if job exists, false if removed, null if unknown (error/timeout)
 */
export async function checkJobExists(
  jobUrl: string,
  source: string
): Promise<boolean | null> {
  // Validate inputs
  if (!jobUrl || !source) {
    console.warn('checkJobExists: Missing jobUrl or source')
    return null
  }

  // Validate URL format
  try {
    new URL(jobUrl)
  } catch {
    console.warn(`checkJobExists: Invalid URL format: ${jobUrl}`)
    return null
  }

  // Validate source is supported
  const normalizedSource = source.toLowerCase()
  const supportedSources: JobSource[] = [
    'remotive',
    'jobicy',
    'remoteok',
    'himalayas',
    'weworkremotely',
  ]

  if (!supportedSources.includes(normalizedSource as JobSource)) {
    console.warn(`checkJobExists: Unsupported source: ${source}`)
    return null
  }

  // Optionally validate URL matches source (warn but don't fail)
  if (!validateUrlForSource(jobUrl, normalizedSource)) {
    console.warn(
      `checkJobExists: URL ${jobUrl} may not match source ${source}`
    )
  }

  // Wait for rate limit
  await waitForRateLimit()
  recordRequest()

  try {
    const headers = getHeadersForSource(normalizedSource)

    // Use HEAD request first (lighter weight)
    const response = await fetchWithTimeout(
      jobUrl,
      {
        method: 'HEAD',
        headers,
        redirect: 'follow', // Follow redirects automatically
      },
      REQUEST_TIMEOUT_MS
    )

    // Handle response status codes
    const status = response.status

    // 200 OK - Job exists
    if (status === 200) {
      return true
    }

    // 404 Not Found - Job removed
    if (status === 404) {
      return false
    }

    // 410 Gone - Job explicitly removed
    if (status === 410) {
      return false
    }

    // 301/302/307/308 Redirects - Already followed by fetch
    // If we get here with a redirect status, the final destination returned non-200
    if ([301, 302, 307, 308].includes(status)) {
      // Check final URL after redirect
      const finalUrl = response.url
      if (finalUrl !== jobUrl) {
        // Redirected to a different page - might be careers page = job removed
        // Or might be the canonical job URL
        // Use heuristics: if redirected to homepage/careers, likely removed
        const isGenericRedirect =
          finalUrl.endsWith('/') ||
          finalUrl.includes('/careers') ||
          finalUrl.includes('/jobs') ||
          finalUrl.includes('/404')
        return isGenericRedirect ? false : true
      }
      return null
    }

    // 403 Forbidden / 401 Unauthorized - Can't determine
    if (status === 401 || status === 403) {
      console.warn(
        `checkJobExists: Access denied for ${jobUrl} (status: ${status})`
      )
      return null
    }

    // 429 Too Many Requests - Rate limited by platform
    if (status === 429) {
      console.warn(`checkJobExists: Rate limited by platform for ${jobUrl}`)
      return null
    }

    // 5xx Server errors - Can't determine
    if (status >= 500) {
      console.warn(`checkJobExists: Server error for ${jobUrl} (status: ${status})`)
      return null
    }

    // HEAD request might not be supported, try GET
    if (status === 405) {
      const getResponse = await fetchWithTimeout(
        jobUrl,
        {
          method: 'GET',
          headers,
          redirect: 'follow',
        },
        REQUEST_TIMEOUT_MS
      )

      if (getResponse.status === 200) return true
      if (getResponse.status === 404 || getResponse.status === 410) return false
      return null
    }

    // Unknown status - return null
    console.warn(`checkJobExists: Unexpected status ${status} for ${jobUrl}`)
    return null
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // Timeout errors
      if (error.name === 'AbortError') {
        console.warn(`checkJobExists: Timeout for ${jobUrl}`)
        return null
      }

      // Network errors
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')
      ) {
        console.warn(`checkJobExists: Network error for ${jobUrl}: ${error.message}`)
        return null
      }
    }

    // Unknown errors
    console.error(`checkJobExists: Unexpected error for ${jobUrl}:`, error)
    return null
  }
}

/**
 * Check multiple jobs in batch with rate limiting
 *
 * @param jobs - Array of jobs to check
 * @returns Map of job ID to existence status (true/false/null)
 */
export async function checkJobsBatch(
  jobs: { id: string; url: string; source: string }[]
): Promise<Map<string, boolean | null>> {
  const results = new Map<string, boolean | null>()

  if (!jobs || jobs.length === 0) {
    return results
  }

  // Process jobs sequentially to respect rate limits
  // Could be optimized with concurrent batches if needed
  for (const job of jobs) {
    const exists = await checkJobExists(job.url, job.source)
    results.set(job.id, exists)
  }

  return results
}

/**
 * Check multiple jobs with configurable concurrency
 * More efficient for large batches while still respecting rate limits
 *
 * @param jobs - Array of jobs to check
 * @param concurrency - Number of concurrent requests (default: 5)
 * @returns Map of job ID to existence status
 */
export async function checkJobsBatchConcurrent(
  jobs: { id: string; url: string; source: string }[],
  concurrency: number = 5
): Promise<Map<string, boolean | null>> {
  const results = new Map<string, boolean | null>()

  if (!jobs || jobs.length === 0) {
    return results
  }

  // Limit concurrency to reasonable bounds
  const effectiveConcurrency = Math.min(Math.max(1, concurrency), 10)

  // Process in chunks
  for (let i = 0; i < jobs.length; i += effectiveConcurrency) {
    const chunk = jobs.slice(i, i + effectiveConcurrency)

    const chunkPromises = chunk.map(async (job) => {
      const exists = await checkJobExists(job.url, job.source)
      return { id: job.id, exists }
    })

    const chunkResults = await Promise.all(chunkPromises)

    for (const result of chunkResults) {
      results.set(result.id, result.exists)
    }

    // Small delay between chunks to smooth out rate limiting
    if (i + effectiveConcurrency < jobs.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return results
}

/**
 * Get rate limiter status for monitoring
 */
export function getRateLimiterStatus(): {
  requestsInWindow: number
  maxRequests: number
  windowMs: number
} {
  const now = Date.now()
  const recentRequests = rateLimiter.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  )

  return {
    requestsInWindow: recentRequests.length,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  }
}

/**
 * Reset rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  rateLimiter.timestamps = []
}
