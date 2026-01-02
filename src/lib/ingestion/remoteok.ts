// Remote OK API integration
import type { JobType, ExperienceLevel, JobInsert } from '@/types'

export interface RemoteOKJob {
  id: string
  slug: string
  position: string
  company: string
  company_logo?: string
  logo?: string
  location: string
  date: string
  epoch: number
  description: string
  tags: string[]
  apply_url?: string
  url: string
  salary_min?: number
  salary_max?: number
}

interface RemoteOKApiResponse extends Array<RemoteOKJob | { legal?: string }> {}

const REMOTEOK_API_URL = 'https://remoteok.com/api'

export async function fetchRemoteOKJobs(): Promise<RemoteOKJob[]> {
  const response = await fetch(REMOTEOK_API_URL, {
    headers: {
      'User-Agent': 'RemoteFlow/1.0 (job aggregator)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Remote OK API error: ${response.status}`)
  }

  const data: RemoteOKApiResponse = await response.json()

  // Filter out the first item which is metadata/legal notice
  const jobs = data.filter((item): item is RemoteOKJob =>
    'position' in item && 'company' in item
  )

  console.log(`Fetched ${jobs.length} jobs from Remote OK`)
  return jobs
}

function inferExperienceLevel(position: string, tags: string[]): ExperienceLevel {
  const combined = `${position} ${tags.join(' ')}`.toLowerCase()

  if (combined.includes('principal') || combined.includes('staff') || combined.includes('architect') || combined.includes('director')) {
    return 'lead'
  }
  if (combined.includes('senior') || combined.includes('sr.') || combined.includes('sr ')) {
    return 'senior'
  }
  if (combined.includes('mid-level') || combined.includes('mid level') || combined.includes('intermediate')) {
    return 'mid'
  }
  if (combined.includes('junior') || combined.includes('jr.') || combined.includes('jr ') || combined.includes('entry') || combined.includes('associate')) {
    return 'junior'
  }
  return 'any'
}

function inferJobType(tags: string[]): JobType {
  const tagsLower = tags.map(t => t.toLowerCase())

  if (tagsLower.some(t => t.includes('part-time') || t.includes('part time'))) {
    return 'part_time'
  }
  if (tagsLower.some(t => t.includes('contract') || t.includes('contractor'))) {
    return 'contract'
  }
  if (tagsLower.some(t => t.includes('freelance'))) {
    return 'freelance'
  }
  if (tagsLower.some(t => t.includes('internship') || t.includes('intern'))) {
    return 'internship'
  }
  return 'full_time'
}

export function normalizeRemoteOKJob(job: RemoteOKJob): JobInsert {
  // Handle salary
  let salaryMin = job.salary_min && job.salary_min > 0 ? job.salary_min : null
  let salaryMax = job.salary_max && job.salary_max > 0 ? job.salary_max : null

  if (salaryMin && salaryMax && salaryMin > salaryMax) {
    ;[salaryMin, salaryMax] = [salaryMax, salaryMin]
  }

  // Use first 10 tags as tech stack
  const techStack = (job.tags || []).slice(0, 10)

  return {
    title: job.position,
    company: job.company,
    description: job.description,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: 'USD',
    job_type: inferJobType(job.tags || []),
    timezone: 'global',
    tech_stack: techStack,
    experience_level: inferExperienceLevel(job.position, job.tags || []),
    url: job.url || job.apply_url || `https://remoteok.com/${job.slug}`,
    source: 'remoteok',
    company_logo: job.company_logo || job.logo || null,
    posted_date: job.date || new Date(job.epoch * 1000).toISOString(),
    is_active: true,
  }
}

export function normalizeRemoteOKJobs(jobs: RemoteOKJob[]): JobInsert[] {
  return jobs.map(normalizeRemoteOKJob)
}
