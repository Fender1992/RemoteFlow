import type { BasePlatformDetector } from './detection/framework/base-detector'
import type { DetectionMethod, JobMetadata, AtsType } from '../types'
import { FormObserver, SubmitButtonObserver } from './detection/framework/form-observer'
import { NetworkInterceptor } from './detection/framework/network-interceptor'
import {
  GreenhouseDetector,
  LeverDetector,
  WorkdayDetector,
  AshbyDetector,
  LinkedInDetector,
  IndeedDetector,
} from './detection/platforms'

interface DetectionResult {
  detected: boolean
  method: DetectionMethod
  metadata?: JobMetadata
  atsType: AtsType
}

/**
 * Platform detection orchestrator
 * Coordinates detection across multiple ATS platforms
 */
export class DetectionOrchestrator {
  private detector: BasePlatformDetector | null = null
  private formObserver: FormObserver | null = null
  private buttonObserver: SubmitButtonObserver | null = null
  private networkInterceptor: NetworkInterceptor | null = null
  private successCheckInterval: ReturnType<typeof setInterval> | null = null
  private onSubmissionDetected: ((result: DetectionResult) => void) | null = null
  private submissionInProgress = false
  private sessionActive = false

  /**
   * Initialize detection for the current page
   */
  initialize(): AtsType | null {
    const atsType = this.detectPlatform()

    if (!atsType || atsType === 'unknown') {
      return null
    }

    this.detector = this.createDetector(atsType)
    return atsType
  }

  /**
   * Detect which ATS platform we're on
   */
  private detectPlatform(): AtsType | null {
    const hostname = window.location.hostname
    const pathname = window.location.pathname

    // Greenhouse
    if (hostname === 'boards.greenhouse.io' || hostname.includes('greenhouse')) {
      return 'greenhouse'
    }

    // Lever
    if (hostname === 'jobs.lever.co' || hostname.includes('lever.co')) {
      return 'lever'
    }

    // Workday
    if (hostname.includes('myworkdayjobs.com') || hostname.includes('workdayjobs.com')) {
      return 'workday'
    }

    // Ashby
    if (hostname === 'jobs.ashbyhq.com' || hostname.includes('ashbyhq.com')) {
      return 'ashby'
    }

    // LinkedIn
    if (hostname.includes('linkedin.com') && pathname.includes('/jobs')) {
      return 'linkedin'
    }

    // Indeed
    if (hostname.includes('indeed.com') && (pathname.includes('/viewjob') || pathname.includes('/jobs'))) {
      return 'indeed'
    }

    return 'unknown'
  }

  /**
   * Create platform-specific detector
   */
  private createDetector(atsType: AtsType): BasePlatformDetector | null {
    switch (atsType) {
      case 'greenhouse':
        return new GreenhouseDetector(document)
      case 'lever':
        return new LeverDetector(document)
      case 'workday':
        return new WorkdayDetector(document)
      case 'ashby':
        return new AshbyDetector(document)
      case 'linkedin':
        return new LinkedInDetector(document)
      case 'indeed':
        return new IndeedDetector(document)
      default:
        return null
    }
  }

  /**
   * Extract job metadata from the current page
   */
  getJobMetadata(): JobMetadata | null {
    return this.detector?.extractJobMetadata() || null
  }

  /**
   * Start monitoring for application submission
   */
  startMonitoring(onSubmissionDetected: (result: DetectionResult) => void): void {
    if (!this.detector) return

    this.onSubmissionDetected = onSubmissionDetected
    this.sessionActive = true

    // 1. Monitor form submissions
    this.formObserver = new FormObserver((data) => {
      this.handlePotentialSubmission(data.method)
    })
    this.formObserver.observe(this.detector.formSelectors)

    // 2. Monitor submit button clicks
    this.buttonObserver = new SubmitButtonObserver((data) => {
      this.handlePotentialSubmission(data.method)
    })
    this.buttonObserver.observe()

    // 3. Monitor network requests for AJAX submissions
    this.networkInterceptor = new NetworkInterceptor(
      (url, method) => {
        // Request started
        if (method === 'POST' && this.detector?.isSubmissionRequest(url)) {
          this.submissionInProgress = true
        }
      },
      (url, status, ok) => {
        // Response received
        if (this.submissionInProgress && ok && this.detector?.isSubmissionRequest(url)) {
          this.handlePotentialSubmission('ajax_intercept')
          this.submissionInProgress = false
        }
      }
    )
    this.networkInterceptor.install()

    // 4. Periodically check for success page/text
    this.successCheckInterval = setInterval(() => {
      this.checkForSuccessPage()
    }, 1000)

    // 5. Monitor URL changes (SPA navigation)
    this.setupUrlMonitoring()
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.sessionActive = false
    this.formObserver?.disconnect()
    this.buttonObserver?.disconnect()
    this.networkInterceptor?.uninstall()

    if (this.successCheckInterval) {
      clearInterval(this.successCheckInterval)
      this.successCheckInterval = null
    }

    this.formObserver = null
    this.buttonObserver = null
    this.networkInterceptor = null
  }

  /**
   * Handle potential submission detection
   */
  private handlePotentialSubmission(method: DetectionMethod): void {
    if (!this.sessionActive || !this.detector) return

    // Wait a moment for the page to update
    setTimeout(() => {
      // Check if we're now on a success page
      const successCheck = this.detector?.detectSuccessPage()

      if (successCheck?.detected) {
        this.triggerSubmissionDetected(successCheck.method)
      } else {
        // Still trigger with the form/button method
        // The success page check will run periodically
        this.triggerSubmissionDetected(method)
      }
    }, 500)
  }

  /**
   * Check if we're on a success page
   */
  private checkForSuccessPage(): void {
    if (!this.sessionActive || !this.detector) return

    const result = this.detector.detectSuccessPage()
    if (result?.detected) {
      this.triggerSubmissionDetected(result.method)
    }
  }

  /**
   * Setup URL change monitoring for SPAs
   */
  private setupUrlMonitoring(): void {
    let lastUrl = window.location.href

    // Use history API override for pushState/replaceState
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    const checkUrlChange = () => {
      const currentUrl = window.location.href
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl
        this.checkForSuccessPage()
      }
    }

    history.pushState = function (...args) {
      originalPushState.apply(this, args)
      checkUrlChange()
    }

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args)
      checkUrlChange()
    }

    // Also listen for popstate
    window.addEventListener('popstate', checkUrlChange)
  }

  /**
   * Trigger submission detected callback
   */
  private triggerSubmissionDetected(method: DetectionMethod): void {
    if (!this.onSubmissionDetected || !this.detector) return

    // Prevent duplicate detections
    this.stopMonitoring()

    const result: DetectionResult = {
      detected: true,
      method,
      metadata: this.detector.extractJobMetadata() || undefined,
      atsType: this.detector.platformId as AtsType,
    }

    this.onSubmissionDetected(result)
  }
}
