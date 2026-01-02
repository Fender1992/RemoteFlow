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
  subscription_tier: 'free' | 'pro' | 'enterprise' | 'max'
  preferences: UserPreferences
  anthropic_api_key: string | null
  cachegpt_api_key: string | null
  cachegpt_user_id: string | null
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

// ============================================================================
// One-Click Import System Types
// ============================================================================

export type ImportSiteId = 'linkedin' | 'indeed' | 'glassdoor' | 'dice' | 'wellfound'
export type ImportSessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ImportSiteStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

// Extended user preferences with search settings
export interface UserPreferencesExtended extends UserPreferences {
  // Search preferences for one-click import
  search_roles?: string[]                    // ["React Developer", "Frontend Engineer"]
  location_preference?: 'remote' | 'hybrid' | 'onsite' | 'any'
  preferred_cities?: string[]                // ["San Francisco", "New York"]
  salary_range?: {
    min: number
    max: number
    currency: string
  }
  enabled_sites?: ImportSiteId[]             // ["linkedin", "indeed", "glassdoor"]
}

// Import session (master record per user import request)
export interface ImportSession {
  id: string
  user_id: string
  status: ImportSessionStatus
  search_params: ImportSearchParams
  total_jobs_found: number
  total_jobs_imported: number
  total_duplicates_skipped: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
  site_results?: ImportSiteResult[]
}

// Search parameters stored with each import session
export interface ImportSearchParams {
  roles: string[]
  location: 'remote' | 'hybrid' | 'onsite' | 'any'
  cities: string[]
  salary?: {
    min: number
    max: number
    currency: string
  }
  sites: ImportSiteId[]
}

// Per-site results within an import session
export interface ImportSiteResult {
  id: string
  session_id: string
  site_id: ImportSiteId
  status: ImportSiteStatus
  jobs_found: number
  jobs_imported: number
  duplicates_skipped: number
  pages_scraped: number
  search_url: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

// Rate limiting info
export interface ImportRateLimits {
  user_id: string
  hourly_count: number
  daily_count: number
  hourly_reset_at: string
  daily_reset_at: string
  updated_at: string
}

// API response types for import
export interface ImportSessionResponse {
  session_id: string
  status: ImportSessionStatus
  message: string
}

export interface ImportProgressResponse {
  id: string
  status: ImportSessionStatus
  search_params: ImportSearchParams
  progress: {
    total_jobs_found: number
    total_jobs_imported: number
    duplicates_skipped: number
  }
  sites: Array<{
    site_id: ImportSiteId
    status: ImportSiteStatus
    jobs_found: number
    jobs_imported: number
    error?: string
  }>
  started_at: string | null
  completed_at: string | null
}

// ============================================================================
// CacheGPT Job Chat Types
// ============================================================================

export interface JobChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  cached?: boolean
  responseTimeMs?: number
}

export interface JobChatContext {
  jobId: string
  title: string
  company: string
  description: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string
  job_type: JobType | null
  experience_level: ExperienceLevel
  tech_stack: string[]
  posted_date: string | null
  ghost_score: number
  ghost_flags: GhostFlag[]
  quality_score: number
  health_score: number
  company_verified?: boolean
  company_reputation?: CompanyReputation | null
}

export interface JobChatUsage {
  dailyCount: number
  dailyLimit: number
  remaining: number
  resetAt: string | null
}

export interface JobChatResponse {
  message: string
  cached: boolean
  responseTimeMs: number
  usage?: {
    remaining: number
    limit: number
  }
}

export const SUGGESTED_QUESTIONS = [
  'Is this a ghost job?',
  "What's the company's reputation?",
  'What are the red flags in this listing?',
  'Is the salary competitive for this role?',
  'What skills should I highlight in my application?',
  'How does this compare to similar jobs?',
] as const

export type SuggestedQuestion = (typeof SUGGESTED_QUESTIONS)[number]
