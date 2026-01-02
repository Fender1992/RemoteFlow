import type { JobMetadata, SuccessIndicator, DetectionMethod } from '../../../types'

/**
 * Base class for platform-specific detectors
 */
export abstract class BasePlatformDetector {
  abstract readonly platformId: string
  abstract readonly formSelectors: string[]
  abstract readonly successIndicators: SuccessIndicator[]
  abstract readonly submissionEndpoints: RegExp[]

  protected document: Document

  constructor(document: Document) {
    this.document = document
  }

  /**
   * Extract job metadata from the current page
   */
  extractJobMetadata(): JobMetadata | null {
    const jobTitle = this.extractJobTitle()
    const company = this.extractCompany()

    if (!jobTitle && !company) {
      return null
    }

    return {
      platform: this.platformId,
      jobId: this.extractJobId(),
      jobTitle: jobTitle || 'Unknown Position',
      company: company || 'Unknown Company',
      jobUrl: this.getJobUrl(),
      applicationUrl: window.location.href,
    }
  }

  /**
   * Get the canonical job URL
   */
  getJobUrl(): string {
    // Try canonical link first
    const canonical = this.document.querySelector('link[rel="canonical"]')
    if (canonical) {
      const href = canonical.getAttribute('href')
      if (href) return href
    }
    return window.location.href
  }

  /**
   * Check if we're on a success page
   */
  detectSuccessPage(): { detected: boolean; method: DetectionMethod } | null {
    for (const indicator of this.successIndicators) {
      switch (indicator.type) {
        case 'text': {
          const text = indicator.pattern as string
          if (this.document.body?.textContent?.toLowerCase().includes(text.toLowerCase())) {
            return { detected: true, method: 'success_text' }
          }
          break
        }

        case 'selector': {
          const selector = indicator.pattern as string
          if (this.document.querySelector(selector)) {
            return { detected: true, method: 'success_page' }
          }
          break
        }

        case 'url': {
          const pattern = indicator.pattern as RegExp
          if (pattern.test(window.location.href)) {
            return { detected: true, method: 'url_change' }
          }
          break
        }
      }
    }

    return null
  }

  /**
   * Check if a request URL matches submission endpoints
   */
  isSubmissionRequest(url: string): boolean {
    return this.submissionEndpoints.some((pattern) => pattern.test(url))
  }

  /**
   * Get form elements that might be application forms
   */
  getApplicationForms(): HTMLFormElement[] {
    const forms: HTMLFormElement[] = []

    for (const selector of this.formSelectors) {
      const matches = this.document.querySelectorAll<HTMLFormElement>(selector)
      matches.forEach((form) => forms.push(form))
    }

    return forms
  }

  // Abstract methods to be implemented by platform-specific detectors
  abstract extractJobId(): string | null
  abstract extractJobTitle(): string | null
  abstract extractCompany(): string | null
}
