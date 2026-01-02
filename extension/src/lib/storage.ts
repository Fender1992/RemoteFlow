import type { ApplicationSession } from '../types'
import { MAX_STORED_SESSIONS } from './constants'

/**
 * Chrome storage wrapper for extension data
 */
export class Storage {
  /**
   * Get a value from local storage
   */
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  }

  /**
   * Set a value in local storage
   */
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  }

  /**
   * Remove a key from local storage
   */
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  }

  /**
   * Get all stored sessions
   */
  async getSessions(): Promise<ApplicationSession[]> {
    return (await this.get<ApplicationSession[]>('sessions')) ?? []
  }

  /**
   * Save a session (add or update)
   */
  async saveSession(session: ApplicationSession): Promise<void> {
    const sessions = await this.getSessions()
    const index = sessions.findIndex((s) => s.id === session.id)

    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.push(session)
    }

    // Keep only the most recent sessions
    const trimmed = sessions.slice(-MAX_STORED_SESSIONS)
    await this.set('sessions', trimmed)
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<ApplicationSession | null> {
    const sessions = await this.getSessions()
    return sessions.find((s) => s.id === sessionId) ?? null
  }

  /**
   * Remove a session by ID
   */
  async removeSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions()
    const filtered = sessions.filter((s) => s.id !== sessionId)
    await this.set('sessions', filtered)
  }

  /**
   * Get recent sessions (for popup display)
   */
  async getRecentSessions(limit = 10): Promise<ApplicationSession[]> {
    const sessions = await this.getSessions()
    return sessions
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit)
  }

  /**
   * Get pending sessions (not yet synced)
   */
  async getPendingSessions(): Promise<ApplicationSession[]> {
    const sessions = await this.getSessions()
    return sessions.filter((s) => !s.syncedToServer)
  }

  /**
   * Mark a session as synced
   */
  async markSessionSynced(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId)
    if (session) {
      session.syncedToServer = true
      await this.saveSession(session)
    }
  }

  /**
   * Clear all sessions
   */
  async clearSessions(): Promise<void> {
    await this.remove('sessions')
  }

  /**
   * Get saved jobs cache
   */
  async getSavedJobs(): Promise<Array<{ id: string; job_id: string; status: string }>> {
    return (await this.get<Array<{ id: string; job_id: string; status: string }>>('savedJobs')) ?? []
  }

  /**
   * Update saved jobs cache
   */
  async setSavedJobs(jobs: Array<{ id: string; job_id: string; status: string }>): Promise<void> {
    await this.set('savedJobs', jobs)
  }
}

export const storage = new Storage()
