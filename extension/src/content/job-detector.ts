/**
 * Job page detector for browser extension
 * Detects job listing pages across multiple platforms and extracts job information
 */

export interface DetectedJob {
  url: string
  title: string
  company: string
  platform: 'linkedin' | 'indeed' | 'glassdoor' | 'greenhouse' | 'lever' | 'workday'
}

/**
 * Platform-specific selectors for job detection
 */
const PLATFORM_SELECTORS = {
  linkedin: {
    title: [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.jobs-top-card__job-title',
      '.topcard__title',
      'h1[data-test="job-title"]',
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.jobs-top-card__company-url',
      '.topcard__org-name-link',
      'a[data-test="company-name"]',
    ],
    urlPattern: /linkedin\.com\/jobs\/(view|search)/,
  },
  indeed: {
    title: [
      'h1.jobsearch-JobInfoHeader-title',
      '.jobsearch-JobInfoHeader-title',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      '.jobTitle',
      'h1[data-jk-title]',
    ],
    company: [
      '.jobsearch-InlineCompanyRating-companyHeader',
      '[data-testid="inlineHeader-companyName"]',
      '.icl-u-lg-mr--sm a',
      '.companyName',
      '.company',
    ],
    urlPattern: /indeed\.com\/(viewjob|jobs)/,
  },
  glassdoor: {
    title: [
      '.JobDetails_jobTitle',
      '[data-test="job-title"]',
      '.job-title',
      'h1.heading',
      '.e1tk4kwz4',
    ],
    company: [
      '.JobDetails_companyName',
      '[data-test="employer-name"]',
      '.employer-name',
      '.e1tk4kwz1',
      '.css-16nw49e',
    ],
    urlPattern: /glassdoor\.com\/(job-listing|Job)/,
  },
  greenhouse: {
    title: [
      '.app-title',
      '.job-title',
      'h1.heading',
      '[data-job-title]',
      '.job-application-header h1',
    ],
    company: [
      '.company-name',
      '[data-company-name]',
      '.employer-name',
    ],
    urlPattern: /(boards\.greenhouse\.io|greenhouse\.io).*\/jobs/,
  },
  lever: {
    title: [
      '.posting-headline h2',
      '.posting-title',
      'h1.posting-headline',
      '[data-qa="posting-name"]',
      '.posting-page h2',
    ],
    company: [
      '.posting-header .main-header-logo img',
      '[data-qa="company-name"]',
    ],
    urlPattern: /jobs\.lever\.co/,
  },
  workday: {
    title: [
      '[data-automation-id="jobPostingHeader"]',
      '.job-title',
      'h1[data-automation-id="jobTitle"]',
      '.WDEO h1',
    ],
    company: [
      '[data-automation-id="companyName"]',
      '.company-name',
    ],
    urlPattern: /(myworkdayjobs\.com|workdayjobs\.com).*\/job/,
  },
} as const

type Platform = keyof typeof PLATFORM_SELECTORS

/**
 * Detect which platform we're on based on URL
 */
function detectPlatform(): Platform | null {
  const url = window.location.href

  for (const [platform, config] of Object.entries(PLATFORM_SELECTORS)) {
    if (config.urlPattern.test(url)) {
      return platform as Platform
    }
  }

  return null
}

/**
 * Extract text from first matching selector
 */
function extractFromSelectors(selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      // Handle img elements (for company logos with alt text)
      if (element.tagName === 'IMG') {
        const alt = element.getAttribute('alt')
        if (alt) return alt.trim()
      }
      // Handle regular elements
      const text = element.textContent?.trim()
      if (text) return text
    }
  }
  return null
}

/**
 * Extract company name from URL for certain platforms
 */
function extractCompanyFromUrl(platform: Platform): string | null {
  const hostname = window.location.hostname
  const pathname = window.location.pathname

  switch (platform) {
    case 'greenhouse': {
      // boards.greenhouse.io/{company}/jobs/{id}
      if (hostname === 'boards.greenhouse.io') {
        const match = pathname.match(/^\/([^/]+)/)
        if (match) {
          return formatCompanySlug(match[1])
        }
      }
      break
    }
    case 'lever': {
      // jobs.lever.co/{company}/{id}
      const match = pathname.match(/^\/([^/]+)/)
      if (match && !match[1].match(/^[a-f0-9-]{36}$/i)) {
        return formatCompanySlug(match[1])
      }
      break
    }
    case 'workday': {
      // {company}.myworkdayjobs.com
      if (hostname.includes('myworkdayjobs.com')) {
        const subdomain = hostname.split('.')[0]
        if (subdomain && subdomain !== 'www') {
          return formatCompanySlug(subdomain)
        }
      }
      break
    }
  }

  return null
}

/**
 * Format company slug to readable name
 */
function formatCompanySlug(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Try to extract company from meta tags
 */
function extractCompanyFromMeta(): string | null {
  const selectors = [
    'meta[property="og:site_name"]',
    'meta[name="author"]',
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      const content = element.getAttribute('content')
      if (content) return content.trim()
    }
  }

  return null
}

/**
 * Try to extract title from meta tags
 */
function extractTitleFromMeta(): string | null {
  const metaTitle = document.querySelector('meta[property="og:title"]')
  if (metaTitle) {
    const content = metaTitle.getAttribute('content')
    if (content) {
      // Remove common suffixes like " | LinkedIn", " - Indeed", etc.
      return content
        .replace(/\s*[-|]\s*(LinkedIn|Indeed|Glassdoor|Greenhouse|Lever|Workday).*$/i, '')
        .trim()
    }
  }

  return null
}

/**
 * Check if current page is a job listing page
 */
export function isJobListingPage(): boolean {
  return detectPlatform() !== null
}

/**
 * Detect job information from the current page
 * Returns null if not on a recognized job listing page
 */
export function detectJobPage(): DetectedJob | null {
  const platform = detectPlatform()
  if (!platform) {
    return null
  }

  const config = PLATFORM_SELECTORS[platform]

  // Extract job title
  let title = extractFromSelectors(config.title)
  if (!title) {
    title = extractTitleFromMeta()
  }

  // Extract company name
  let company = extractFromSelectors(config.company)
  if (!company) {
    company = extractCompanyFromUrl(platform)
  }
  if (!company) {
    company = extractCompanyFromMeta()
  }

  // If we couldn't find essential information, return null
  if (!title && !company) {
    return null
  }

  return {
    url: window.location.href,
    title: title || 'Unknown Position',
    company: company || 'Unknown Company',
    platform,
  }
}
