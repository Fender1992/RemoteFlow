import { sessionManager } from './session-manager'
import { getAuthState } from '../lib/supabase-extension'
import { api } from '../lib/api-client'
import type {
  Message,
  SessionStartedPayload,
  SessionSubmittedPayload,
  CheckUrlPayload,
  ShowToastPayload,
} from '../types'

console.log('[RemoteFlow] Background service worker started')

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[RemoteFlow] Message handler error:', error)
      sendResponse({ success: false, error: error.message })
    })

  // Return true to indicate we'll respond asynchronously
  return true
})

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id

  switch (message.type) {
    case 'SESSION_STARTED': {
      const payload = message.payload as SessionStartedPayload
      if (!tabId) {
        return { success: false, error: 'No tab ID' }
      }

      const sessionId = await sessionManager.startSession(tabId, {
        platform: payload.platform,
        jobId: null,
        jobTitle: payload.jobTitle,
        company: payload.company,
        jobUrl: payload.jobUrl,
        applicationUrl: payload.applicationUrl,
      })

      console.log('[RemoteFlow] Session started:', sessionId)
      return { success: true, sessionId }
    }

    case 'SESSION_SUBMITTED': {
      const payload = message.payload as SessionSubmittedPayload
      const result = await sessionManager.markSubmitted(payload.sessionId, payload.method)

      if (result.success && tabId) {
        // Show success toast
        chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_TOAST',
          payload: {
            message: '✓ Application tracked in RemoteFlow!',
            type: 'success',
            action: {
              label: 'View',
              url: 'https://remoteflow.io/saved',
            },
          } as ShowToastPayload,
        })
      }

      console.log('[RemoteFlow] Session submitted:', payload.sessionId, result)
      return result
    }

    case 'SESSION_ACTIVITY': {
      const payload = message.payload as { sessionId: string }
      await sessionManager.updateActivity(payload.sessionId)
      return { success: true }
    }

    case 'CHECK_URL': {
      const payload = message.payload as CheckUrlPayload
      const result = await api.checkUrl(payload.url)
      return result
    }

    case 'CHECK_AUTH': {
      const authState = await getAuthState()
      return {
        authenticated: authState.authenticated,
        user: authState.user
          ? {
              id: authState.user.id,
              email: authState.user.email,
            }
          : null,
      }
    }

    case 'GET_SAVED_JOBS': {
      const jobs = await api.getSavedJobs()
      return { success: true, jobs }
    }

    default:
      console.warn('[RemoteFlow] Unknown message type:', message.type)
      return { success: false, error: 'Unknown message type' }
  }
}

// Handle extension icon click when popup is disabled
chrome.action.onClicked.addListener((tab) => {
  // Open RemoteFlow in a new tab
  chrome.tabs.create({ url: 'https://remoteflow.io/saved' })
})

// Log when extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[RemoteFlow] Extension installed:', details.reason)

  if (details.reason === 'install') {
    // Open onboarding page on first install
    chrome.tabs.create({ url: 'https://remoteflow.io/extension-welcome' })
  }
})
