// Message types for communication between content scripts and background worker
export type MessageType =
  | 'SESSION_STARTED'
  | 'SESSION_SUBMITTED'
  | 'SESSION_ABANDONED'
  | 'SESSION_ACTIVITY'
  | 'CHECK_URL'
  | 'CHECK_AUTH'
  | 'AUTH_STATUS'
  | 'SYNC_SESSION'
  | 'SHOW_TOAST'
  | 'GET_SAVED_JOBS'
  | 'LOG_JOB_VIEW'
  | 'SAVE_VIEWED_JOB'

export interface Message<T = unknown> {
  type: MessageType
  payload: T
  timestamp: number
  tabId?: number
}

// Session types
export type SessionStatus = 'in_progress' | 'submitted' | 'abandoned'

export interface ApplicationSession {
  id: string
  platform: string
  jobId: string | null
  jobTitle: string
  company: string
  jobUrl: string
  applicationUrl: string
  status: SessionStatus
  startedAt: string
  lastActivityAt: string
  submittedAt: string | null
  timeSpentSeconds: number
  syncedToServer: boolean
}

// Job metadata extracted from page
export interface JobMetadata {
  platform: string
  jobId: string | null
  jobTitle: string
  company: string
  jobUrl: string
  applicationUrl: string
}

// Detection types
export type DetectionMethod =
  | 'form_submit'
  | 'success_page'
  | 'success_text'
  | 'url_change'
  | 'ajax_intercept'
  | 'button_click'
  | 'manual'

export interface SuccessIndicator {
  type: 'text' | 'selector' | 'url'
  pattern: string | RegExp
}

export interface SubmissionEvent {
  type: 'form' | 'ajax'
  method: DetectionMethod
  url: string
  timestamp: number
  metadata: JobMetadata
}

// Auth types
export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  user: {
    id: string
    email: string | null
  } | null
}

// Message payloads
export interface SessionStartedPayload {
  sessionId: string
  platform: string
  jobUrl: string
  jobTitle: string
  company: string
  applicationUrl: string
}

export interface SessionSubmittedPayload extends SessionStartedPayload {
  submittedAt: string
  method: DetectionMethod
  timeSpentSeconds: number
}

export interface CheckUrlPayload {
  url: string
}

export interface CheckUrlResponse {
  found: boolean
  job?: {
    id: string
    title: string
    company: string
    company_logo: string | null
  }
  saved?: {
    id: string
    status: string
  }
  detected_ats: string | null
}

export interface ShowToastPayload {
  message: string
  type: 'success' | 'info' | 'error'
  action?: {
    label: string
    url: string
  }
}

// ATS types
export type AtsType =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'taleo'
  | 'icims'
  | 'linkedin'
  | 'indeed'
  | 'glassdoor'
  | 'unknown'

// Job view tracking payloads
export interface LogJobViewPayload {
  url: string
  title: string
  company: string
  platform: string
  jobId?: string
}

export interface SaveViewedJobPayload {
  url: string
  title: string
  company: string
  platform: string
}

// Detected job from page
export interface DetectedJob {
  url: string
  title: string
  company: string
  platform: 'linkedin' | 'indeed' | 'glassdoor' | 'greenhouse' | 'lever' | 'workday'
}
