import { BasePlatformDetector } from '../framework/base-detector'
import type { SuccessIndicator } from '../../../types'

/**
 * Workday ATS detector
 * URL patterns: *.myworkdayjobs.com/{company}/job/{job_id}
 */
export class WorkdayDetector extends BasePlatformDetector {
  readonly platformId = 'workday'

  readonly formSelectors = [
    '[data-automation-id="applyContainer"] form',
    '.WDEI form',
    '[data-automation-id="applicationForm"]',
    'form[data-automation-id]',
  ]

  readonly successIndicators: SuccessIndicator[] = [
    { type: 'text', pattern: 'application has been submitted' },
    { type: 'text', pattern: 'thank you for your application' },
    { type: 'text', pattern: 'application submitted successfully' },
    { type: 'text', pattern: 'your application is complete' },
    { type: 'selector', pattern: '[data-automation-id="applicationSuccessMessage"]' },
    { type: 'selector', pattern: '.application-success' },
    { type: 'url', pattern: /\/submitted\/?$/i },
    { type: 'url', pattern: /\/confirmation\/?$/i },
  ]

  readonly submissionEndpoints = [
    /\/apply$/i,
    /\/submitApplication/i,
    /myworkdayjobs\.com.*\/application/i,
    /workdayjobs\.com.*\/apply/i,
  ]

  extractJobId(): string | null {
    // URL pattern: /job/{job_id}
    const urlMatch = window.location.pathname.match(/\/job\/([^/]+)/i)
    if (urlMatch) {
      return urlMatch[1]
    }

    // Try data attribute
    const jobElement = this.document.querySelector('[data-automation-id="jobReqId"]')
    if (jobElement) {
      return jobElement.textContent?.trim() || null
    }

    // Try breadcrumb or job ID element
    const jobIdElement = this.document.querySelector('.job-id, [data-job-id]')
    if (jobIdElement) {
      const text = jobIdElement.textContent?.trim()
      const match = text?.match(/(?:Job\s*(?:ID|#)?:?\s*)?([\w-]+)/i)
      if (match) return match[1]
    }

    return null
  }

  extractJobTitle(): string | null {
    const selectors = [
      '[data-automation-id="jobPostingHeader"]',
      '.job-title',
      'h1[data-automation-id="jobTitle"]',
      '.WDEO h1',
      'meta[property="og:title"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.startsWith('meta')) {
          const content = element.getAttribute('content')
          if (content) return content.split('|')[0].trim()
        } else {
          const text = element.textContent?.trim()
          if (text) return text
        }
      }
    }

    return null
  }

  extractCompany(): string | null {
    // URL pattern: {company}.myworkdayjobs.com or *.myworkdayjobs.com/{company}/
    const hostname = window.location.hostname
    if (hostname.includes('myworkdayjobs.com')) {
      const subdomain = hostname.split('.')[0]
      if (subdomain && subdomain !== 'www') {
        return this.formatCompanyName(subdomain)
      }
    }

    const pathMatch = window.location.pathname.match(/^\/([^/]+)/)
    if (pathMatch) {
      return this.formatCompanyName(pathMatch[1])
    }

    const selectors = [
      '[data-automation-id="companyName"]',
      '.company-name',
      'meta[property="og:site_name"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.startsWith('meta')) {
          const content = element.getAttribute('content')
          if (content) return content.trim()
        } else {
          const text = element.textContent?.trim()
          if (text) return text
        }
      }
    }

    return null
  }

  private formatCompanyName(slug: string): string {
    return slug
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
