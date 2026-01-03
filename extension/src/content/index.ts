import { DetectionOrchestrator } from './detector'
import { showToast } from './toast'
import type { AtsType, DetectionMethod } from '../types'

// Import toast styles
import './styles/toast.css'

/**
 * Content script entry point
 * Runs on ATS job pages to detect application submissions
 */
class ContentScript {
  private orchestrator: DetectionOrchestrator
  private atsType: AtsType | null = null
  private sessionId: string | null = null
  private sessionStartTime: number | null = null

  constructor() {
    this.orchestrator = new DetectionOrchestrator()
  }

  /**
   * Initialize the content script
   */
  async initialize(): Promise<void> {
    // Detect which ATS we're on
    this.atsType = this.orchestrator.initialize()

    if (!this.atsType) {
      console.debug('[JobIQ] Not on a recognized ATS page')
      return
    }

    console.debug(`[JobIQ] Detected ATS: ${this.atsType}`)

    // Check if user is authenticated
    const authStatus = await this.checkAuth()
    if (!authStatus.authenticated) {
      console.debug('[JobIQ] User not authenticated')
      return
    }

    // Check if this URL matches a saved job
    const urlCheck = await this.checkUrl(window.location.href)
    if (!urlCheck.found) {
      console.debug('[JobIQ] URL does not match any saved jobs')
      return
    }

    console.debug('[JobIQ] Found saved job:', urlCheck.job?.jobTitle)

    // Start tracking session
    await this.startSession()

    // Start monitoring for submission
    this.orchestrator.startMonitoring((result) => {
      this.handleSubmissionDetected(result)
    })
  }

  /**
   * Check authentication status
   */
  private async checkAuth(): Promise<{ authenticated: boolean }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
        resolve(response || { authenticated: false })
      })
    })
  }

  /**
   * Check if URL matches a saved job
   */
  private async checkUrl(url: string): Promise<{
    found: boolean
    job?: { jobId: string; jobTitle: string; company: string }
    saved?: boolean
  }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_URL', url }, (response) => {
        resolve(response || { found: false })
      })
    })
  }

  /**
   * Start tracking session
   */
  private async startSession(): Promise<void> {
    this.sessionStartTime = Date.now()

    const metadata = this.orchestrator.getJobMetadata()

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'SESSION_STARTED',
          data: {
            url: window.location.href,
            atsType: this.atsType,
            metadata,
          },
        },
        (response) => {
          this.sessionId = response?.sessionId || null
          resolve()
        }
      )
    })
  }

  /**
   * Handle submission detected
   */
  private async handleSubmissionDetected(result: {
    detected: boolean
    method: DetectionMethod
    metadata?: {
      platform: string
      jobId?: string | null
      jobTitle: string
      company: string
      jobUrl: string
      applicationUrl: string
    }
    atsType: AtsType
  }): Promise<void> {
    console.debug('[JobIQ] Submission detected:', result)

    const timeSpentSeconds = this.sessionStartTime
      ? Math.round((Date.now() - this.sessionStartTime) / 1000)
      : undefined

    // Notify background script
    chrome.runtime.sendMessage(
      {
        type: 'SESSION_SUBMITTED',
        data: {
          sessionId: this.sessionId,
          method: result.method,
          atsType: result.atsType,
          metadata: result.metadata,
          timeSpentSeconds,
        },
      },
      (response) => {
        if (response?.success) {
          // Show success toast
          showToast({
            message: 'Application tracked in JobIQ!',
            type: 'success',
            action: {
              label: 'View saved jobs',
              url: 'https://jobiq.careers/saved',
            },
          })
        } else if (response?.error) {
          console.error('[JobIQ] Failed to track submission:', response.error)
          showToast({
            message: 'Failed to track application',
            type: 'error',
          })
        }
      }
    )
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const contentScript = new ContentScript()
    contentScript.initialize()
  })
} else {
  const contentScript = new ContentScript()
  contentScript.initialize()
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SHOW_TOAST') {
    showToast(message.payload)
    sendResponse({ success: true })
  }
  return true
})
