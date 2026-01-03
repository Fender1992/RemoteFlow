import type { ShowToastPayload } from '../types'

const ICONS = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>`,
}

/**
 * Show a toast notification
 */
export function showToast(options: ShowToastPayload): void {
  const { message, type, action } = options
  const duration = 5000

  // Get or create container
  let container = document.getElementById('jobiq-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'jobiq-toast-container'
    document.body.appendChild(container)
  }

  // Create toast element
  const toast = document.createElement('div')
  toast.className = `jobiq-toast jobiq-toast--${type}`

  toast.innerHTML = `
    <div class="jobiq-toast__icon">${ICONS[type]}</div>
    <div class="jobiq-toast__content">
      <p class="jobiq-toast__message">${escapeHtml(message)}</p>
      ${action ? `<a href="${action.url}" target="_blank" class="jobiq-toast__action">${escapeHtml(action.label)}</a>` : ''}
    </div>
    <button class="jobiq-toast__close" aria-label="Close">&times;</button>
  `

  container.appendChild(toast)

  // Add close handler
  const closeBtn = toast.querySelector('.jobiq-toast__close')
  closeBtn?.addEventListener('click', () => hideToast(toast))

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('jobiq-toast--visible')
  })

  // Auto dismiss
  setTimeout(() => {
    hideToast(toast)
  }, duration)
}

/**
 * Hide a toast with animation
 */
function hideToast(toast: HTMLElement): void {
  toast.classList.add('jobiq-toast--hiding')
  toast.classList.remove('jobiq-toast--visible')

  setTimeout(() => {
    toast.remove()

    // Remove container if empty
    const container = document.getElementById('jobiq-toast-container')
    if (container && container.children.length === 0) {
      container.remove()
    }
  }, 300)
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Listen for toast messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SHOW_TOAST') {
    showToast(message.payload as ShowToastPayload)
  }
})
