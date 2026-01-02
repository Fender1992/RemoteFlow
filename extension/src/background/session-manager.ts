import type { ApplicationSession, JobMetadata, SessionStatus, DetectionMethod } from '../types'
import { storage } from '../lib/storage'
import { api } from '../lib/api-client'
import { SESSION_TIMEOUT_MS, SYNC_INTERVAL_MINUTES } from '../lib/constants'

interface ActiveSession {
  session: ApplicationSession
  lastActivity: number
  tabId: number
}

/**
 * Manages active application sessions across browser tabs
 */
class SessionManager {
  private activeSessions: Map<string, ActiveSession> = new Map()

  constructor() {
    this.init()
  }

  private async init() {
    // Set up session timeout checker
    chrome.alarms.create('session-cleanup', { periodInMinutes: 5 })

    // Set up saved jobs sync
    chrome.alarms.create('sync-saved-jobs', { periodInMinutes: SYNC_INTERVAL_MINUTES })

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'session-cleanup') {
        this.cleanupStaleSessions()
      } else if (alarm.name === 'sync-saved-jobs') {
        this.syncSavedJobs()
      }
    })

    // Listen for tab closes
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabClosed(tabId)
    })

    // Initial sync
    this.syncSavedJobs()
  }

  /**
   * Start a new application session
   */
  async startSession(tabId: number, metadata: JobMetadata): Promise<string> {
    const sessionId = crypto.randomUUID()
    const now = new Date().toISOString()

    const session: ApplicationSession = {
      id: sessionId,
      platform: metadata.platform,
      jobId: metadata.jobId,
      jobTitle: metadata.jobTitle,
      company: metadata.company,
      jobUrl: metadata.jobUrl,
      applicationUrl: metadata.applicationUrl,
      status: 'in_progress',
      startedAt: now,
      lastActivityAt: now,
      submittedAt: null,
      timeSpentSeconds: 0,
      syncedToServer: false,
    }

    this.activeSessions.set(sessionId, {
      session,
      lastActivity: Date.now(),
      tabId,
    })

    // Persist to storage
    await storage.saveSession(session)

    // Track start event on server
    try {
      await api.trackEvent({
        url: metadata.applicationUrl,
        event: 'started',
        atsType: metadata.platform as any,
        metadata: {
          jobUrl: metadata.jobUrl,
          jobTitle: metadata.jobTitle,
          company: metadata.company,
        },
      })
    } catch (error) {
      console.error('[RemoteFlow] Failed to track session start:', error)
    }

    return sessionId
  }

  /**
   * Mark a session as submitted
   */
  async markSubmitted(
    sessionId: string,
    method: DetectionMethod
  ): Promise<{ success: boolean; error?: string }> {
    const activeSession = this.activeSessions.get(sessionId)

    if (!activeSession) {
      // Try to get from storage
      const storedSession = await storage.getSession(sessionId)
      if (!storedSession) {
        return { success: false, error: 'Session not found' }
      }

      // Update stored session
      storedSession.status = 'submitted'
      storedSession.submittedAt = new Date().toISOString()
      await storage.saveSession(storedSession)

      // Sync to server
      return this.syncSessionToServer(storedSession, method)
    }

    const now = Date.now()
    const { session } = activeSession

    session.status = 'submitted'
    session.submittedAt = new Date().toISOString()
    session.timeSpentSeconds = Math.round((now - new Date(session.startedAt).getTime()) / 1000)
    session.lastActivityAt = new Date().toISOString()

    // Save to storage
    await storage.saveSession(session)

    // Remove from active sessions
    this.activeSessions.delete(sessionId)

    // Sync to server
    return this.syncSessionToServer(session, method)
  }

  /**
   * Update session activity (keeps session alive)
   */
  async updateActivity(sessionId: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId)
    if (!activeSession) return

    activeSession.lastActivity = Date.now()
    activeSession.session.lastActivityAt = new Date().toISOString()
  }

  /**
   * Get session by tab ID
   */
  getSessionByTabId(tabId: number): ApplicationSession | null {
    for (const activeSession of this.activeSessions.values()) {
      if (activeSession.tabId === tabId) {
        return activeSession.session
      }
    }
    return null
  }

  /**
   * Handle tab closed - mark session as abandoned if in progress
   */
  private async handleTabClosed(tabId: number): Promise<void> {
    for (const [sessionId, activeSession] of this.activeSessions) {
      if (activeSession.tabId === tabId && activeSession.session.status === 'in_progress') {
        await this.markAbandoned(sessionId, 'tab_closed')
      }
    }
  }

  /**
   * Mark a session as abandoned
   */
  private async markAbandoned(sessionId: string, reason: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId)
    if (!activeSession) return

    const { session } = activeSession
    const now = Date.now()
    const timeSpent = Math.round((now - new Date(session.startedAt).getTime()) / 1000)

    session.status = 'abandoned'
    session.timeSpentSeconds = timeSpent

    // Only sync if they spent meaningful time (>30 seconds)
    if (timeSpent > 30) {
      await storage.saveSession(session)

      try {
        await api.trackEvent({
          url: session.applicationUrl,
          event: 'abandoned',
          atsType: session.platform as any,
          timeSpentSeconds: timeSpent,
          metadata: { reason },
        })
      } catch (error) {
        console.error('[RemoteFlow] Failed to track abandonment:', error)
      }
    }

    this.activeSessions.delete(sessionId)
  }

  /**
   * Cleanup stale sessions (no activity for SESSION_TIMEOUT_MS)
   */
  private async cleanupStaleSessions(): Promise<void> {
    const now = Date.now()

    for (const [sessionId, activeSession] of this.activeSessions) {
      if (now - activeSession.lastActivity > SESSION_TIMEOUT_MS) {
        if (activeSession.session.status === 'in_progress') {
          await this.markAbandoned(sessionId, 'timeout')
        } else {
          this.activeSessions.delete(sessionId)
        }
      }
    }
  }

  /**
   * Sync session to server
   */
  private async syncSessionToServer(
    session: ApplicationSession,
    method: DetectionMethod
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await api.trackEvent({
        url: session.applicationUrl,
        event: 'submitted',
        atsType: session.platform as any,
        detectionMethod: method,
        timeSpentSeconds: session.timeSpentSeconds,
        metadata: {
          jobUrl: session.jobUrl,
          jobTitle: session.jobTitle,
          company: session.company,
        },
      })

      if (result.success) {
        await storage.markSessionSynced(session.id)
        return { success: true }
      }

      return { success: false, error: result.error }
    } catch (error) {
      console.error('[RemoteFlow] Failed to sync session:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Sync saved jobs from server to local cache
   */
  private async syncSavedJobs(): Promise<void> {
    try {
      const jobs = await api.getSavedJobs()
      await storage.setSavedJobs(jobs)
    } catch (error) {
      console.error('[RemoteFlow] Failed to sync saved jobs:', error)
    }
  }

  /**
   * Get recent sessions for popup display
   */
  async getRecentSessions(limit = 10): Promise<ApplicationSession[]> {
    return storage.getRecentSessions(limit)
  }
}

export const sessionManager = new SessionManager()
