import { BasePlatformDetector } from '../framework/base-detector'
import type { SuccessIndicator } from '../../../types'

/**
 * Greenhouse ATS detector
 * URL patterns: boards.greenhouse.io/{company}/jobs/{job_id}
 */
export class GreenhouseDetector extends BasePlatformDetector {
  readonly platformId = 'greenhouse'

  readonly formSelectors = [
    '#application_form',
    'form[action*="applications"]',
    'form[data-job-board-application-form]',
    '.application-form form',
  ]

  readonly successIndicators: SuccessIndicator[] = [
    { type: 'text', pattern: 'application has been submitted' },
    { type: 'text', pattern: 'thank you for applying' },
    { type: 'text', pattern: 'thanks for applying' },
    { type: 'text', pattern: 'application received' },
    { type: 'selector', pattern: '.application-confirmation' },
    { type: 'selector', pattern: '[data-application-submitted]' },
    { type: 'url', pattern: /\/confirmation\/?$/i },
    { type: 'url', pattern: /\?applied=true/i },
  ]

  readonly submissionEndpoints = [
    /\/applications\/?$/i,
    /\/jobs\/\d+\/applications/i,
    /boards\.greenhouse\.io\/.*\/applications/i,
  ]

  extractJobId(): string | null {
    // Try URL pattern first: /jobs/{job_id}
    const urlMatch = window.location.pathname.match(/\/jobs\/(\d+)/)
    if (urlMatch) {
      return urlMatch[1]
    }

    // Try data attribute
    const jobElement = this.document.querySelector('[data-job-id]')
    if (jobElement) {
      return jobElement.getAttribute('data-job-id')
    }

    // Try hidden input
    const hiddenInput = this.document.querySelector<HTMLInputElement>(
      'input[name="job_id"], input[name="job_application[job_id]"]'
    )
    if (hiddenInput) {
      return hiddenInput.value
    }

    return null
  }

  extractJobTitle(): string | null {
    // Try specific Greenhouse selectors
    const selectors = [
      '.app-title',
      '.job-title',
      'h1.heading',
      '[data-job-title]',
      '.job-application-header h1',
      'meta[property="og:title"]',
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

    // Try page title
    const pageTitle = this.document.title
    if (pageTitle && !pageTitle.toLowerCase().includes('greenhouse')) {
      // Remove common suffixes
      return pageTitle.replace(/\s*[-|]\s*.*$/, '').trim()
    }

    return null
  }

  extractCompany(): string | null {
    // Try URL: boards.greenhouse.io/{company}/
    const urlMatch = window.location.hostname === 'boards.greenhouse.io'
      ? window.location.pathname.match(/^\/([^/]+)/)
      : null

    if (urlMatch) {
      // Convert slug to company name
      return this.formatCompanyName(urlMatch[1])
    }

    // Try specific selectors
    const selectors = [
      '.company-name',
      '[data-company-name]',
      '.employer-name',
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

  /**
   * Format company slug to readable name
   */
  private formatCompanyName(slug: string): string {
    return slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
