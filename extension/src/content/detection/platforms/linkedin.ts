import { BasePlatformDetector } from '../framework/base-detector'
import type { SuccessIndicator } from '../../../types'

/**
 * LinkedIn Jobs detector
 * URL patterns: linkedin.com/jobs/view/{job_id}
 */
export class LinkedInDetector extends BasePlatformDetector {
  readonly platformId = 'linkedin'

  readonly formSelectors = [
    '.jobs-apply-form',
    '.jobs-easy-apply-form',
    '[data-test="jobs-apply-button"]',
    '.jobs-apply-button',
  ]

  readonly successIndicators: SuccessIndicator[] = [
    { type: 'text', pattern: 'application submitted' },
    { type: 'text', pattern: 'your application was sent' },
    { type: 'text', pattern: 'application sent' },
    { type: 'text', pattern: 'done! your application was sent' },
    { type: 'selector', pattern: '.jobs-apply-success' },
    { type: 'selector', pattern: '[data-test="application-success"]' },
    { type: 'selector', pattern: '.artdeco-toast-item--success' },
  ]

  readonly submissionEndpoints = [
    /\/voyager\/api\/jobs\/jobPostings\/.*\/apply/i,
    /\/jobs\/.*\/apply/i,
    /linkedin\.com.*\/easy-apply/i,
  ]

  extractJobId(): string | null {
    // URL pattern: /jobs/view/{job_id}
    const urlMatch = window.location.pathname.match(/\/jobs\/view\/(\d+)/)
    if (urlMatch) {
      return urlMatch[1]
    }

    // Try currentJobId from URL params
    const urlParams = new URLSearchParams(window.location.search)
    const currentJobId = urlParams.get('currentJobId')
    if (currentJobId) {
      return currentJobId
    }

    // Try data attribute
    const jobElement = this.document.querySelector('[data-job-id]')
    if (jobElement) {
      return jobElement.getAttribute('data-job-id')
    }

    // Try job card with active class
    const activeJob = this.document.querySelector('.jobs-search-results-list__list-item--active [data-job-id]')
    if (activeJob) {
      return activeJob.getAttribute('data-job-id')
    }

    return null
  }

  extractJobTitle(): string | null {
    const selectors = [
      '.jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1.jobs-top-card__job-title',
      '.topcard__title',
      'h1[data-test="job-title"]',
      'meta[property="og:title"]',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        if (selector.startsWith('meta')) {
          const content = element.getAttribute('content')
          if (content) {
            // Remove " | LinkedIn" suffix
            return content.replace(/\s*\|\s*LinkedIn$/i, '').trim()
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
    const selectors = [
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-top-card__company-url',
      '.topcard__org-name-link',
      'a[data-test="company-name"]',
      '.jobs-company__box a',
    ]

    for (const selector of selectors) {
      const element = this.document.querySelector(selector)
      if (element) {
        const text = element.textContent?.trim()
        if (text) return text
      }
    }

    return null
  }

  /**
   * LinkedIn Easy Apply uses a modal dialog
   * Override to detect the modal form
   */
  override getApplicationForms(): HTMLFormElement[] {
    const forms = super.getApplicationForms()

    // Also check for Easy Apply modal
    const easyApplyModal = this.document.querySelector('.jobs-easy-apply-modal')
    if (easyApplyModal) {
      const modalForms = easyApplyModal.querySelectorAll<HTMLFormElement>('form')
      modalForms.forEach((form) => {
        if (!forms.includes(form)) {
          forms.push(form)
        }
      })
    }

    return forms
  }
}
