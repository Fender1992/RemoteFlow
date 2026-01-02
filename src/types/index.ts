// Job types
export type JobType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship'
export type ExperienceLevel = 'any' | 'junior' | 'mid' | 'senior' | 'lead'
export type SavedJobStatus = 'saved' | 'applied' | 'rejected' | 'offer'

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
