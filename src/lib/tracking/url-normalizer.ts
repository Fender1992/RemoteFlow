/**
 * URL Normalization utilities for matching job URLs from browser extension
 * to saved jobs in the database.
 */

export type AtsType =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'taleo'
  | 'icims'
  | 'bamboohr'
  | 'smartrecruiters'
  | 'linkedin'
  | 'indeed'
  | 'unknown'

export interface NormalizedUrl {
  normalized: string
  domain: string
  atsType: AtsType | null
}

/**
 * ATS domain patterns for detection
 */
const ATS_PATTERNS: Record<AtsType, RegExp[]> = {
  greenhouse: [
    /boards\.greenhouse\.io/i,
    /jobs\.greenhouse\.io/i,
    /\.greenhouse\.io/i,
  ],
  lever: [
    /jobs\.lever\.co/i,
    /\.lever\.co/i,
  ],
  workday: [
    /\.myworkdayjobs\.com/i,
    /\.wd\d+\.myworkdaysite\.com/i,
    /\.myworkday\.com/i,
  ],
  ashby: [
    /jobs\.ashbyhq\.com/i,
    /\.ashbyhq\.com/i,
  ],
  taleo: [
    /\.taleo\.net/i,
    /chp\.tbe\.taleo\.net/i,
  ],
  icims: [
    /\.icims\.com/i,
    /careers-.*\.icims\.com/i,
  ],
  bamboohr: [
    /\.bamboohr\.com\/careers/i,
  ],
  smartrecruiters: [
    /jobs\.smartrecruiters\.com/i,
  ],
  linkedin: [
    /linkedin\.com\/jobs/i,
  ],
  indeed: [
    /indeed\.com\/viewjob/i,
    /indeed\.com\/apply/i,
    /indeed\.com\/jobs/i,
  ],
  unknown: [],
}

/**
 * Query parameters to preserve for certain ATS systems
 */
const PRESERVE_PARAMS: Record<string, string[]> = {
  workday: ['jobRequisitionId'],
  icims: ['job', 'jobId'],
  indeed: ['jk', 'vjk'],
}

/**
 * Detect ATS type from domain and path
 */
export function detectAtsType(domain: string, pathname: string = ''): AtsType | null {
  const fullUrl = domain + pathname

  for (const [atsType, patterns] of Object.entries(ATS_PATTERNS)) {
    if (atsType === 'unknown') continue

    for (const pattern of patterns) {
      if (pattern.test(fullUrl)) {
        return atsType as AtsType
      }
    }
  }

  return null
}

/**
 * Normalize a URL for matching purposes
 * - Lowercase
 * - Remove most query parameters (except essential ones like job IDs)
 * - Remove fragments
 * - Remove trailing slashes
 * - Handle common ATS URL patterns
 */
export function normalizeJobUrl(url: string): NormalizedUrl {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const atsType = detectAtsType(domain, parsed.pathname)

    // Normalize pathname
    let pathname = parsed.pathname.toLowerCase()
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/\/+/g, '/') // Normalize multiple slashes

    // For some ATS systems, preserve essential query params
    let preservedParams = ''
    if (atsType && PRESERVE_PARAMS[atsType]) {
      const paramsToKeep = PRESERVE_PARAMS[atsType]
      const preserved: string[] = []

      for (const param of paramsToKeep) {
        const value = parsed.searchParams.get(param)
        if (value) {
          preserved.push(`${param}=${value}`)
        }
      }

      if (preserved.length > 0) {
        preservedParams = '?' + preserved.sort().join('&')
      }
    }

    return {
      normalized: `${domain}${pathname}${preservedParams}`,
      domain,
      atsType,
    }
  } catch {
    // If URL parsing fails, return as-is in lowercase
    return {
      normalized: url.toLowerCase().trim(),
      domain: '',
      atsType: null,
    }
  }
}

/**
 * Generate a hash for company + title matching
 * Used as a fallback when URL matching fails
 */
export function generateCompanyTitleHash(company: string, title: string): string {
  // Normalize: lowercase, remove special chars, collapse whitespace
  const normalizedCompany = company
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')

  const normalizedTitle = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')

  const combined = `${normalizedCompany}|${normalizedTitle}`

  // Simple hash function (MD5-like behavior for consistency with DB)
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Check if two URLs likely point to the same job
 */
export function urlsMatch(url1: string, url2: string): boolean {
  const normalized1 = normalizeJobUrl(url1)
  const normalized2 = normalizeJobUrl(url2)

  // Exact match
  if (normalized1.normalized === normalized2.normalized) {
    return true
  }

  // Same domain and one contains the other (for redirect handling)
  if (normalized1.domain === normalized2.domain) {
    if (
      normalized1.normalized.includes(normalized2.normalized) ||
      normalized2.normalized.includes(normalized1.normalized)
    ) {
      return true
    }
  }

  return false
}

/**
 * Extract job ID from URL if possible (ATS-specific)
 */
export function extractJobId(url: string): string | null {
  const { atsType } = normalizeJobUrl(url)

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname

    switch (atsType) {
      case 'greenhouse': {
        // Pattern: /jobs/123456
        const match = pathname.match(/\/jobs\/(\d+)/)
        return match ? match[1] : null
      }

      case 'lever': {
        // Pattern: /company/job-uuid
        const match = pathname.match(/\/[^\/]+\/([a-f0-9-]{36})/)
        return match ? match[1] : null
      }

      case 'workday': {
        // Pattern: ?jobRequisitionId=...
        return parsed.searchParams.get('jobRequisitionId')
      }

      case 'ashby': {
        // Pattern: /jobs/uuid
        const match = pathname.match(/\/jobs?\/([a-f0-9-]+)/i)
        return match ? match[1] : null
      }

      case 'linkedin': {
        // Pattern: /jobs/view/123456789
        const match = pathname.match(/\/jobs\/view\/(\d+)/)
        return match ? match[1] : null
      }

      case 'indeed': {
        // Pattern: ?jk=... or ?vjk=...
        return parsed.searchParams.get('jk') || parsed.searchParams.get('vjk')
      }

      default:
        return null
    }
  } catch {
    return null
  }
}
