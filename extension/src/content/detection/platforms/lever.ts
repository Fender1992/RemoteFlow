import { BasePlatformDetector } from '../framework/base-detector'
import type { SuccessIndicator } from '../../../types'

/**
 * Lever ATS detector
 * URL patterns: jobs.lever.co/{company}/{job_id}
 */
export class LeverDetector extends BasePlatformDetector {
  readonly platformId = 'lever'

  readonly formSelectors = [
    '.application-form',
    'form[action*="apply"]',
    '.posting-apply form',
    '#application-form',
  ]

  readonly successIndicators: SuccessIndicator[] = [
    { type: 'text', pattern: 'application submitted' },
    { type: 'text', pattern: 'thank you for your interest' },
    { type: 'text', pattern: 'thanks for applying' },
    { type: 'text', pattern: 'we have received your application' },
    { type: 'selector', pattern: '.application-success' },
    { type: 'selector', pattern: '.confirmation-message' },
    { type: 'url', pattern: /\/apply\/.*\/thanks/i },
    { type: 'url', pattern: /\/thankyou\/?$/i },
  ]

  readonly submissionEndpoints = [
    /\/apply$/i,
    /\/applications$/i,
    /jobs\.lever\.co\/.*\/apply/i,
    /api\.lever\.co\/.*\/applications/i,
  ]

  extractJobId(): string | null {
    // URL pattern: jobs.lever.co/{company}/{job_id}
    const urlMatch = window.location.pathname.match(/\/([a-f0-9-]{36})/i)
    if (urlMatch) {
      return urlMatch[1]
    }

    // Try data attribute
    const jobElement = this.document.querySelector('[data-posting-id]')
    if (jobElement) {
      return jobElement.getAttribute('data-posting-id')
    }

    // Try canonical link
    const canonical = this.document.querySelector('link[rel="canonical"]')
    if (canonical) {
      const href = canonical.getAttribute('href')
      const match = href?.match(/\/([a-f0-9-]{36})/i)
      if (match) return match[1]
    }

    return null
  }

  extractJobTitle(): string | null {
    const selectors = [
      '.posting-headline h2',
      '.posting-title',
      'h1.posting-headline',
      '[data-qa="posting-name"]',
      '.posting-page h2',
      'meta[property="og:title"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.startsWith('meta')) {
          const content = element.getAttribute('content')
          if (content) {
            // Remove company name if present (format: "Job Title - Company")
            return content.split(' - ')[0].trim()
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
    // URL pattern: jobs.lever.co/{company}/
    const urlMatch = window.location.pathname.match(/^\/([^/]+)/)
    if (urlMatch && !urlMatch[1].match(/^[a-f0-9-]{36}$/i)) {
      return this.formatCompanyName(urlMatch[1])
    }

    const selectors = [
      '.posting-header .main-header-logo img',
      '.posting-page .logo img',
      '[data-qa="company-name"]',
      'meta[property="og:site_name"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.includes('img')) {
          // Try alt text from logo
          const alt = element.getAttribute('alt')
          if (alt) return alt.trim()
        } else if (selector.startsWith('meta')) {
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
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
