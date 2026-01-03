/**
 * Save prompt UI for detected job listings
 * Shows a floating prompt asking users to save jobs to JobIQ
 */

import type { DetectedJob } from './job-detector'

// Import styles
import './styles/save-prompt.css'

const DISMISSED_URLS_KEY = 'jobiq_dismissed_urls'
const PROMPT_CONTAINER_ID = 'jobiq-save-prompt-container'

// SVG Icons
const ICONS = {
  briefcase: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>`,
}

/**
 * Get list of dismissed URLs from localStorage
 */
function getDismissedUrls(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_URLS_KEY)
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch (e) {
    console.debug('[JobIQ] Failed to read dismissed URLs:', e)
  }
  return new Set()
}

/**
 * Add URL to dismissed list
 */
function addDismissedUrl(url: string): void {
  try {
    const dismissed = getDismissedUrls()
    dismissed.add(normalizeUrl(url))
    // Keep only last 1000 entries to prevent localStorage bloat
    const entries = Array.from(dismissed)
    if (entries.length > 1000) {
      entries.splice(0, entries.length - 1000)
    }
    localStorage.setItem(DISMISSED_URLS_KEY, JSON.stringify(entries))
  } catch (e) {
    console.debug('[JobIQ] Failed to save dismissed URL:', e)
  }
}

/**
 * Check if URL has been dismissed
 */
function isUrlDismissed(url: string): boolean {
  return getDismissedUrls().has(normalizeUrl(url))
}

/**
 * Normalize URL for comparison (remove query params that change)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Keep only the essential parts
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return url
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Show the save prompt for a detected job
 */
export function showSavePrompt(job: DetectedJob): void {
  // Don't show if already dismissed for this URL
  if (isUrlDismissed(job.url)) {
    console.debug('[JobIQ] Prompt dismissed for this URL, not showing')
    return
  }

  // Remove any existing prompt
  hideSavePrompt()

  // Create container
  const container = document.createElement('div')
  container.id = PROMPT_CONTAINER_ID
  container.className = 'jobiq-save-prompt'

  // Build prompt HTML
  container.innerHTML = `
    <div class="jobiq-save-prompt__inner">
      <button class="jobiq-save-prompt__close" aria-label="Close">
        ${ICONS.close}
      </button>

      <div class="jobiq-save-prompt__header">
        <div class="jobiq-save-prompt__icon">
          ${ICONS.briefcase}
        </div>
        <div class="jobiq-save-prompt__title">Save to JobIQ?</div>
      </div>

      <div class="jobiq-save-prompt__job">
        <div class="jobiq-save-prompt__job-title">${escapeHtml(truncateText(job.title, 50))}</div>
        <div class="jobiq-save-prompt__job-company">${escapeHtml(truncateText(job.company, 40))}</div>
      </div>

      <div class="jobiq-save-prompt__actions">
        <button class="jobiq-save-prompt__btn jobiq-save-prompt__btn--dismiss">
          Dismiss
        </button>
        <button class="jobiq-save-prompt__btn jobiq-save-prompt__btn--save">
          Save Job
        </button>
      </div>

      <div class="jobiq-save-prompt__brand">
        <span class="jobiq-save-prompt__brand-text">Powered by JobIQ</span>
      </div>
    </div>
  `

  // Add to page
  document.body.appendChild(container)

  // Setup event handlers
  const closeBtn = container.querySelector('.jobiq-save-prompt__close')
  const dismissBtn = container.querySelector('.jobiq-save-prompt__btn--dismiss')
  const saveBtn = container.querySelector('.jobiq-save-prompt__btn--save')

  closeBtn?.addEventListener('click', () => {
    hideSavePrompt()
  })

  dismissBtn?.addEventListener('click', () => {
    addDismissedUrl(job.url)
    hideSavePrompt()
  })

  saveBtn?.addEventListener('click', () => {
    handleSaveJob(job)
  })

  // Animate in
  requestAnimationFrame(() => {
    container.classList.add('jobiq-save-prompt--visible')
  })
}

/**
 * Hide the save prompt with animation
 */
export function hideSavePrompt(): void {
  const container = document.getElementById(PROMPT_CONTAINER_ID)
  if (!container) return

  container.classList.add('jobiq-save-prompt--hiding')
  container.classList.remove('jobiq-save-prompt--visible')

  // Remove after animation completes
  setTimeout(() => {
    container.remove()
  }, 300)
}

/**
 * Handle save job action
 */
function handleSaveJob(job: DetectedJob): void {
  // Update UI to show saving state
  const container = document.getElementById(PROMPT_CONTAINER_ID)
  const saveBtn = container?.querySelector('.jobiq-save-prompt__btn--save')
  if (saveBtn) {
    saveBtn.textContent = 'Saving...'
    saveBtn.setAttribute('disabled', 'true')
  }

  // Send message to background script to save the job
  chrome.runtime.sendMessage(
    {
      type: 'SAVE_JOB',
      data: {
        url: job.url,
        title: job.title,
        company: job.company,
        platform: job.platform,
      },
    },
    (response) => {
      if (response?.success) {
        // Show success state briefly then hide
        if (saveBtn) {
          saveBtn.textContent = 'Saved!'
          saveBtn.classList.add('jobiq-save-prompt__btn--success')
        }

        // Add to dismissed so we don't prompt again
        addDismissedUrl(job.url)

        setTimeout(() => {
          hideSavePrompt()
        }, 1500)
      } else {
        // Show error state
        if (saveBtn) {
          saveBtn.textContent = 'Failed'
          saveBtn.classList.add('jobiq-save-prompt__btn--error')
          saveBtn.removeAttribute('disabled')

          // Reset after a moment
          setTimeout(() => {
            saveBtn.textContent = 'Save Job'
            saveBtn.classList.remove('jobiq-save-prompt__btn--error')
          }, 2000)
        }

        console.error('[JobIQ] Failed to save job:', response?.error)
      }
    }
  )
}
