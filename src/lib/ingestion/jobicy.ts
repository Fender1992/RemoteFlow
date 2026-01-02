// Jobicy API integration
import type { JobType, ExperienceLevel, JobInsert } from '@/types'

export interface JobicyJob {
  id: number
  url: string
  jobSlug: string
  jobTitle: string
  companyName: string
  companyLogo: string | null
  jobIndustry: string[]
  jobType: string[]
  jobGeo: string
  jobLevel: string
  jobExcerpt: string
  jobDescription: string
  pubDate: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryPeriod?: string
}

interface JobicyApiResponse {
  apiVersion: string
  jobCount: number
  jobs: JobicyJob[]
}

const JOBICY_API_URL = 'https://jobicy.com/api/v2/remote-jobs'

const INDUSTRIES = [
  'engineering',
  'marketing',
  'hr',
  'data-science',
]

export async function fetchJobicyJobs(industry?: string): Promise<JobicyJob[]> {
  const url = industry
    ? `${JOBICY_API_URL}?industry=${industry}&count=100`
    : `${JOBICY_API_URL}?count=100`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'RemoteFlow/1.0' },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Jobicy API error: ${response.status}`)
  }

  const data: JobicyApiResponse = await response.json()
  return data.jobs || []
}

export async function fetchAllJobicyJobs(): Promise<JobicyJob[]> {
  const allJobs = new Map<number, JobicyJob>()

  // Fetch from multiple industries
  for (const industry of INDUSTRIES) {
    try {
      const jobs = await fetchJobicyJobs(industry)
      jobs.forEach(job => {
        if (!allJobs.has(job.id)) {
          allJobs.set(job.id, job)
        }
      })
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Failed to fetch industry ${industry}:`, error)
    }
  }

  console.log(`Fetched ${allJobs.size} unique jobs from Jobicy`)
  return Array.from(allJobs.values())
}

export function normalizeJobicyJob(job: JobicyJob): JobInsert {
  // Map job type
  const jobTypes = job.jobType || []
  let jobType: JobType = 'full_time'
  if (jobTypes.some(t => t.toLowerCase().includes('part'))) {
    jobType = 'part_time'
  } else if (jobTypes.some(t => t.toLowerCase().includes('contract'))) {
    jobType = 'contract'
  } else if (jobTypes.some(t => t.toLowerCase().includes('freelance'))) {
    jobType = 'freelance'
  } else if (jobTypes.some(t => t.toLowerCase().includes('internship'))) {
    jobType = 'internship'
  }

  // Map experience level (ExperienceLevel = 'any' | 'junior' | 'mid' | 'senior' | 'lead')
  const levelMap: Record<string, ExperienceLevel> = {
    entry: 'junior',
    junior: 'junior',
    midweight: 'mid',
    mid: 'mid',
    senior: 'senior',
    executive: 'lead',
    lead: 'lead',
  }
  const expLevel: ExperienceLevel = levelMap[job.jobLevel?.toLowerCase() || ''] || 'any'

  // Tech stack from industries
  const techStack = (job.jobIndustry || []).slice(0, 10)

  // Handle salary
  let salaryMin = job.salaryMin || null
  let salaryMax = job.salaryMax || null
  if (salaryMin && salaryMax && salaryMin > salaryMax) {
    ;[salaryMin, salaryMax] = [salaryMax, salaryMin]
  }

  return {
    title: job.jobTitle,
    company: job.companyName,
    description: job.jobDescription || job.jobExcerpt,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: job.salaryCurrency || 'USD',
    job_type: jobType,
    timezone: 'global',
    tech_stack: techStack,
    experience_level: expLevel,
    url: job.url,
    source: 'jobicy',
    company_logo: job.companyLogo || null,
    posted_date: job.pubDate ? new Date(job.pubDate).toISOString() : null,
    is_active: true,
  }
}

export function normalizeJobicyJobs(jobs: JobicyJob[]): JobInsert[] {
  return jobs.map(normalizeJobicyJob)
}
