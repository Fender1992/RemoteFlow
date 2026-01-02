import { BasePlatformDetector } from '../framework/base-detector'
import type { SuccessIndicator } from '../../../types'

/**
 * Ashby ATS detector
 * URL patterns: jobs.ashbyhq.com/{company}/job/{job_id}
 */
export class AshbyDetector extends BasePlatformDetector {
  readonly platformId = 'ashby'

  readonly formSelectors = [
    '.application-form',
    'form[data-testid="application-form"]',
    '.ashby-application-form form',
    '[data-ashby-apply-form] form',
  ]

  readonly successIndicators: SuccessIndicator[] = [
    { type: 'text', pattern: 'application submitted' },
    { type: 'text', pattern: 'thank you for applying' },
    { type: 'text', pattern: 'we have received your application' },
    { type: 'text', pattern: 'application has been received' },
    { type: 'selector', pattern: '[data-testid="application-success"]' },
    { type: 'selector', pattern: '.confirmation-page' },
    { type: 'url', pattern: /\/success\/?$/i },
    { type: 'url', pattern: /\/thank-?you\/?$/i },
  ]

  readonly submissionEndpoints = [
    /\/apply$/i,
    /\/applications$/i,
    /jobs\.ashbyhq\.com.*\/apply/i,
    /api\.ashbyhq\.com.*\/application/i,
  ]

  extractJobId(): string | null {
    // URL pattern: /job/{job_id} or /{job_id}
    const urlMatch = window.location.pathname.match(/\/(?:job\/)?([a-f0-9-]{36})/i)
    if (urlMatch) {
      return urlMatch[1]
    }

    // Try data attribute
    const jobElement = this.document.querySelector('[data-job-id], [data-testid="job-id"]')
    if (jobElement) {
      return jobElement.getAttribute('data-job-id') ||
             jobElement.getAttribute('data-testid')?.replace('job-id-', '') ||
             null
    }

    return null
  }

  extractJobTitle(): string | null {
    const selectors = [
      'h1[data-testid="job-title"]',
      '.job-posting-header h1',
      '.posting-title',
      'h1.job-title',
      'meta[property="og:title"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.startsWith('meta')) {
          const content = element.getAttribute('content')
          if (content) {
            // Remove company suffix if present
            return content.split(' at ')[0].split(' - ')[0].trim()
          }
        } else {
          const text = element.textContent?.trim()
          if (text) return text
        }
      }
    }

    return null
  }

  extractCompany(): string | null {
    // URL pattern: jobs.ashbyhq.com/{company}/
    const urlMatch = window.location.pathname.match(/^\/([^/]+)/)
    if (urlMatch && !urlMatch[1].match(/^[a-f0-9-]{36}$/i) && urlMatch[1] !== 'job') {
      return this.formatCompanyName(urlMatch[1])
    }

    const selectors = [
      '[data-testid="company-name"]',
      '.company-name',
      '.job-posting-header .company',
      'meta[property="og:site_name"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.startsWith('meta')) {
          const content = element.getAttribute('content')
          if (content && !content.toLowerCase().includes('ashby')) {
            return content.trim()
          }
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
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
