import type { ImportSiteId } from '@/types'

/**
 * Configuration for a job board site
 */
export interface SiteConfig {
  id: ImportSiteId
  name: string
  baseUrl: string
  searchUrlTemplate: string
  maxJobsPerSearch: number
  rateLimit: {
    requestsPerMinute: number
    delayBetweenPagesMs: number
  }
  supportsFilters: string[]
  notes?: string
}

/**
 * Prompt configuration for Claude Computer Use
 */
export interface SitePrompt {
  systemPrompt: string
  searchInstructions: string
  outputFormat: string
}

/**
 * Combined site configuration with prompts
 */
export interface SiteConfigWithPrompt {
  config: SiteConfig
  prompt: SitePrompt
}

/**
 * Search parameters for building URLs
 */
export interface SearchUrlParams {
  keywords: string
  location: string
  remote: boolean
  salaryMin?: number
  salaryMax?: number
  experienceLevels?: string[]
}

/**
 * Raw job extracted by Claude
 */
export interface RawExtractedJob {
  title: string
  company: string
  location?: string
  salary?: string
  posted_date?: string
  url: string
  description_preview?: string
  remote_type?: 'fully_remote' | 'hybrid' | 'onsite' | 'unknown'
  employment_type?: string
  experience_level?: string
  skills_tags?: string[]
  easy_apply?: boolean
  applicant_count?: number
  company_info?: {
    size?: string
    rating?: number
    funding_stage?: string
  }
}

/**
 * Claude extraction output format
 */
export interface ClaudeExtractionResult {
  jobs: RawExtractedJob[]
  metadata: {
    site: string
    search_url: string
    total_results_shown?: number
    jobs_extracted: number
    pages_visited: number
    extraction_notes?: string
  }
}
