// Himalayas API integration
import type { JobType, ExperienceLevel, JobInsert } from '@/types'

export interface HimalayasJob {
  guid: string
  title: string
  excerpt: string
  description: string
  companyName: string
  companyLogo?: string
  employmentType: string
  seniority: string[]
  minSalary?: number | null
  maxSalary?: number | null
  currency?: string
  locationRestrictions?: string[]
  timezoneRestrictions?: number[]
  categories: string[]
  parentCategories?: string[]
  pubDate: number // Unix timestamp
  expiryDate?: number
  applicationLink: string
}

interface HimalayasApiResponse {
  jobs: HimalayasJob[]
  totalCount: number
  offset: number
  limit: number
}

const HIMALAYAS_API_URL = 'https://himalayas.app/jobs/api'

export async function fetchHimalayasJobs(offset = 0, limit = 100): Promise<HimalayasJob[]> {
  const url = `${HIMALAYAS_API_URL}?offset=${offset}&limit=${limit}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'JobIQ/1.0 (job aggregator)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Himalayas API error: ${response.status}`)
  }

  const data: HimalayasApiResponse = await response.json()
  return data.jobs || []
}

export async function fetchAllHimalayasJobs(maxJobs = 500): Promise<HimalayasJob[]> {
  const allJobs: HimalayasJob[] = []
  let offset = 0
  const limit = 100

  while (allJobs.length < maxJobs) {
    try {
      const jobs = await fetchHimalayasJobs(offset, limit)
      if (jobs.length === 0) break

      allJobs.push(...jobs)
      offset += limit

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500))

      if (jobs.length < limit) break // No more pages
    } catch (error) {
      console.error(`Himalayas fetch error at offset ${offset}:`, error)
      break
    }
  }

  console.log(`Fetched ${allJobs.length} jobs from Himalayas`)
  return allJobs.slice(0, maxJobs)
}

function mapJobType(employmentType: string): JobType {
  const type = employmentType.toLowerCase()

  if (type.includes('part')) return 'part_time'
  if (type.includes('contract')) return 'contract'
  if (type.includes('freelance')) return 'freelance'
  if (type.includes('intern')) return 'internship'
  return 'full_time'
}

function mapSeniority(seniority: string[]): ExperienceLevel {
  const levels = seniority.map(s => s.toLowerCase())

  if (levels.some(l => l.includes('executive') || l.includes('director') || l.includes('lead') || l.includes('principal'))) {
    return 'lead'
  }
  if (levels.some(l => l.includes('senior') || l.includes('sr'))) {
    return 'senior'
  }
  if (levels.some(l => l.includes('mid') || l.includes('intermediate'))) {
    return 'mid'
  }
  if (levels.some(l => l.includes('junior') || l.includes('entry') || l.includes('associate'))) {
    return 'junior'
  }
  return 'any'
}

export function normalizeHimalayasJob(job: HimalayasJob): JobInsert {
  // Handle salary
  let salaryMin = job.minSalary || null
  let salaryMax = job.maxSalary || null

  if (salaryMin && salaryMax && salaryMin > salaryMax) {
    ;[salaryMin, salaryMax] = [salaryMax, salaryMin]
  }

  // Use categories as tech stack
  const techStack = [...(job.categories || []), ...(job.parentCategories || [])].slice(0, 10)

  return {
    title: job.title,
    company: job.companyName,
    description: job.description || job.excerpt,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: job.currency || 'USD',
    job_type: mapJobType(job.employmentType || 'Full Time'),
    timezone: 'global',
    tech_stack: techStack,
    experience_level: mapSeniority(job.seniority || []),
    url: job.applicationLink,
    source: 'himalayas',
    company_logo: job.companyLogo || null,
    posted_date: job.pubDate ? new Date(job.pubDate * 1000).toISOString() : null,
    is_active: true,
  }
}

export function normalizeHimalayasJobs(jobs: HimalayasJob[]): JobInsert[] {
  return jobs.map(normalizeHimalayasJob)
}
