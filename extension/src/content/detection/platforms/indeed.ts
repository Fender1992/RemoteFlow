import { BasePlatformDetector } from '../framework/base-detector'
import type { SuccessIndicator } from '../../../types'

/**
 * Indeed Jobs detector
 * URL patterns: indeed.com/viewjob?jk={job_id}
 */
export class IndeedDetector extends BasePlatformDetector {
  readonly platformId = 'indeed'

  readonly formSelectors = [
    '#ia-container form',
    '.icl-Modal--apply form',
    '.indeed-apply-widget form',
    '[data-testid="indeedApply-modal"] form',
  ]

  readonly successIndicators: SuccessIndicator[] = [
    { type: 'text', pattern: 'application has been submitted' },
    { type: 'text', pattern: 'your application was sent' },
    { type: 'text', pattern: 'application submitted' },
    { type: 'text', pattern: "you've already applied" },
    { type: 'selector', pattern: '.ia-success' },
    { type: 'selector', pattern: '[data-testid="application-success"]' },
    { type: 'selector', pattern: '.applied-snippet' },
    { type: 'url', pattern: /\/application\/success/i },
  ]

  readonly submissionEndpoints = [
    /\/apply\/submit/i,
    /\/applystart/i,
    /indeed\.com.*\/ia/i,
    /m5\.apply\.indeed\.com/i,
  ]

  extractJobId(): string | null {
    // URL pattern: ?jk={job_id}
    const urlParams = new URLSearchParams(window.location.search)
    const jk = urlParams.get('jk')
    if (jk) {
      return jk
    }

    // Try from URL path
    const pathMatch = window.location.pathname.match(/\/viewjob\/([a-f0-9]+)/i)
    if (pathMatch) {
      return pathMatch[1]
    }

    // Try data attribute
    const jobElement = this.document.querySelector('[data-jk]')
    if (jobElement) {
      return jobElement.getAttribute('data-jk')
    }

    // Try meta tag
    const metaJobId = this.document.querySelector('meta[name="job-id"]')
    if (metaJobId) {
      return metaJobId.getAttribute('content')
    }

    return null
  }

  extractJobTitle(): string | null {
    const selectors = [
      '.jobsearch-JobInfoHeader-title',
      'h1.icl-u-xs-mb--xs',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      '.jobTitle',
      'h1[data-jk-title]',
      'meta[property="og:title"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.startsWith('meta')) {
          const content = element.getAttribute('content')
          if (content) {
            // Remove " - Indeed" suffix
            return content.replace(/\s*-\s*Indeed$/i, '').trim()
          }
        } else {
          // Indeed sometimes wraps title in a span
          const titleSpan = element.querySelector('span')
          const text = (titleSpan || element).textContent?.trim()
          if (text) return text
        }
      }
    }

    return null
  }

  extractCompany(): string | null {
    const selectors = [
      '[data-testid="inlineHeader-companyName"]',
      '.jobsearch-InlineCompanyRating-companyHeader a',
      '.icl-u-lg-mr--sm a',
      '[data-company-name]',
      '.companyName',
      '.company',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (element.hasAttribute('data-company-name')) {
          const attr = element.getAttribute('data-company-name')
          if (attr) return attr.trim()
        }
        const text = element.textContent?.trim()
        if (text) return text
      }
    }

    return null
  }

  /**
   * Indeed uses an iframe for the apply flow
   * This method detects if we're in the apply iframe
   */
  isInApplyFrame(): boolean {
    return window.location.hostname.includes('apply.indeed.com') ||
           window.location.pathname.includes('/ia/')
  }
}
