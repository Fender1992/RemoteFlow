import { JOBIQ_API_URL } from './constants'
import { getSessionFromCookies } from './supabase-extension'
import type { AtsType, DetectionMethod } from '../types'

interface TrackEventRequest {
  jobId?: string
  url?: string
  event: 'started' | 'submitted' | 'abandoned'
  atsType?: AtsType
  detectionMethod?: DetectionMethod
  timeSpentSeconds?: number
  metadata?: Record<string, unknown>
}

interface TrackEventResponse {
  success: boolean
  event_id?: string
  matched_job_id?: string | null
  matched_saved_job_id?: string | null
  error?: string
}

interface CheckUrlResponse {
  found: boolean
  url: string
  normalized_url: string
  detected_ats: AtsType | null
  job?: {
    id: string
    title: string
    company: string
    company_logo: string | null
    url: string
    salary_min: number | null
    salary_max: number | null
    currency: string
    application_count: number
    avg_time_to_apply_seconds: number | null
  }
  saved?: {
    id: string
    status: string
    notes: string | null
    applied_date: string | null
    saved_at: string
  }
}

/**
 * JobIQ API client for extension
 */
export class JobIQAPI {
  private async getAccessToken(): Promise<string | null> {
    const session = await getSessionFromCookies()
    return session?.access_token ?? null
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; error: string | null }> {
    const token = await this.getAccessToken()

    if (!token) {
      return { data: null, error: 'Not authenticated' }
    }

    try {
      const response = await fetch(`${JOBIQ_API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        return { data: null, error: errorBody.error || `HTTP ${response.status}` }
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      console.error('[JobIQ API] Request failed:', error)
      return { data: null, error: (error as Error).message }
    }
  }

  /**
   * Track an application event
   */
  async trackEvent(event: TrackEventRequest): Promise<TrackEventResponse> {
    const { data, error } = await this.request<TrackEventResponse>('/applications/track', {
      method: 'POST',
      body: JSON.stringify(event),
    })

    if (error || !data) {
      return { success: false, error: error || 'Unknown error' }
    }

    return data
  }

  /**
   * Check if a URL matches a saved job
   */
  async checkUrl(url: string): Promise<CheckUrlResponse | null> {
    const { data, error } = await this.request<CheckUrlResponse>(
      `/jobs/check-url?url=${encodeURIComponent(url)}`
    )

    if (error) {
      console.error('[JobIQ API] Check URL failed:', error)
      return null
    }

    return data
  }

  /**
   * Get user's saved jobs
   */
  async getSavedJobs(): Promise<Array<{ id: string; job_id: string; status: string }>> {
    const { data, error } = await this.request<{ id: string; job_id: string; status: string }[]>(
      '/saved-jobs'
    )

    if (error || !data) {
      console.error('[JobIQ API] Get saved jobs failed:', error)
      return []
    }

    return data
  }
}

export const api = new JobIQAPI()
