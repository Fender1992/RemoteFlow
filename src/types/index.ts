// Job types
export type JobType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship'
export type ExperienceLevel = 'any' | 'junior' | 'mid' | 'senior' | 'lead'
export type SavedJobStatus = 'saved' | 'applied' | 'rejected' | 'offer'

// Quality system types
export type JobStatus =
  | 'active'
  | 'paused'
  | 'closed_filled'
  | 'closed_expired'
  | 'closed_removed'
  | 'closed_reposted'
  | 'flagged_ghost'
  | 'flagged_spam'

export type SignalType = 'got_hired' | 'got_response' | 'no_response' | 'fake_report' | 'spam_report'

export type GhostFlag =
  | 'open_90_days'
  | 'reposted_4_plus'
  | 'too_many_openings'
  | 'multi_location'
  | 'no_salary_competitive'
  | 'short_description'
  | 'generic_apply'

export interface Job {
  id: string
  title: string
  company: string
  description: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string
  job_type: JobType | null
  timezone: string | null
  tech_stack: string[]
  experience_level: ExperienceLevel
  url: string
  source: string
  company_logo: string | null
  posted_date: string | null
  fetched_at: string
  created_at: string
  is_active: boolean
  // Quality system fields
  health_score?: number
  quality_score?: number
  ghost_score?: number
  ghost_flags?: GhostFlag[]
  description_hash?: string | null
  repost_count?: number
  status?: JobStatus
  status_changed_at?: string | null
  quality_updated_at?: string | null
  company_id?: string | null
  company_data?: Company
}

// Type for inserting new jobs (without auto-generated fields)
export type JobInsert = Omit<Job, 'id' | 'created_at' | 'fetched_at'>

export interface SavedJob {
  id: string
  user_id: string
  job_id: string
  status: SavedJobStatus
  notes: string | null
  applied_date: string | null
  created_at: string
  job?: Job
}

export interface UserPreferences {
  timezone?: string
  roles?: string[]
  job_types?: JobType[]
  experience_levels?: ExperienceLevel[]
  tech_stack?: string[]
  min_salary?: number | null
  currency?: string
  email_digest?: boolean
}

export interface UserProfile {
  id: string
  email: string | null
  name: string | null
  subscription_tier: 'free' | 'pro' | 'enterprise'
  preferences: UserPreferences
  created_at: string
}

export interface JobSource {
  id: string
  name: string
  api_endpoint: string | null
  last_synced: string | null
  is_active: boolean
  sync_interval_minutes: number
}

// API Response types
export interface JobsApiResponse {
  jobs: Job[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface JobFilters {
  search?: string
  job_types?: JobType[]
  experience_levels?: ExperienceLevel[]
  tech_stack?: string[]
  min_salary?: number
  page?: number
  limit?: number
}

// Remotive API types
export interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  company_logo: string | null
  category: string
  tags: string[]
  job_type: string
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
}

export interface RemotiveApiResponse {
  'job-count': number
  jobs: RemotiveJob[]
}

// Company types
export interface Company {
  id: string
  name: string
  name_normalized: string
  logo_url: string | null
  website: string | null
  employee_count: number | null
  is_verified: boolean
  is_blacklisted: boolean
  blacklist_reason: string | null
  created_at: string
}

export interface CompanyReputation {
  company_id: string
  reputation_score: number
  total_jobs_posted: number
  jobs_filled: number
  jobs_expired: number
  jobs_ghosted: number
  total_applications_tracked: number
  applications_with_response: number
  avg_days_to_close: number | null
  avg_reposts_per_job: number
  score_updated_at: string | null
  created_at: string
}

// Job signals (user feedback)
export interface JobSignal {
  id: string
  job_id: string
  user_id: string
  signal_type: SignalType
  details: Record<string, unknown> | null
  created_at: string
}

// Job lineage (repost tracking)
export interface JobLineage {
  id: string
  canonical_job_id: string
  job_id: string
  instance_number: number
  posted_at: string
  closed_at: string | null
  close_reason: string | null
  created_at: string
}

// Review queue (admin)
export type ReviewReason = 'auto_ghost' | 'user_reports' | 'auto_low_score' | 'spam_detected'
export type ReviewStatus = 'pending' | 'reviewed' | 'dismissed'
export type ReviewAction = 'approved' | 'removed' | 'blacklisted' | 'warned'

export interface ReviewQueueItem {
  id: string
  entity_type: 'job' | 'company'
  entity_id: string
  reason: ReviewReason
  priority: number
  status: ReviewStatus
  reviewer_notes: string | null
  action_taken: ReviewAction | null
  created_at: string
  reviewed_at: string | null
}

// Extended job filters with quality options
export interface JobFiltersExtended extends JobFilters {
  sort?: 'quality' | 'date' | 'salary'
  min_quality?: number
  hide_ghosts?: boolean
}

// Company with reputation (joined data)
export interface CompanyWithReputation {
  company: Company
  reputation: CompanyReputation
  active_jobs_count?: number
}
