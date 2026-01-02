import type { RemotiveJob, Job, JobType, ExperienceLevel } from '@/types'

function normalizeJobType(remotiveType: string): JobType | null {
  const mapping: Record<string, JobType> = {
    'full_time': 'full_time',
    'full-time': 'full_time',
    'part_time': 'part_time',
    'part-time': 'part_time',
    'contract': 'contract',
    'freelance': 'freelance',
    'internship': 'internship',
  }
  return mapping[remotiveType.toLowerCase()] || null
}

function inferExperienceLevel(title: string, description: string): ExperienceLevel {
  const combined = `${title} ${description}`.toLowerCase()

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

function parseSalary(salaryString: string): { min: number | null; max: number | null; currency: string } {
  if (!salaryString || salaryString.trim() === '') {
    return { min: null, max: null, currency: 'USD' }
  }

  const cleanedSalary = salaryString.replace(/,/g, '')

  // Detect currency
  let currency = 'USD'
  if (cleanedSalary.includes('EUR') || cleanedSalary.includes('€')) currency = 'EUR'
  else if (cleanedSalary.includes('GBP') || cleanedSalary.includes('£')) currency = 'GBP'
  else if (cleanedSalary.includes('CAD') || cleanedSalary.includes('C$')) currency = 'CAD'
  else if (cleanedSalary.includes('AUD') || cleanedSalary.includes('A$')) currency = 'AUD'

  // Extract numbers
  const numbers = cleanedSalary.match(/\d+\.?\d*/g)?.map(Number) || []

  if (numbers.length === 0) return { min: null, max: null, currency }

  let min = numbers[0]
  let max = numbers.length > 1 ? numbers[1] : numbers[0]

  // Convert "k" notation (100k -> 100000)
  if (cleanedSalary.toLowerCase().includes('k')) {
    if (min < 1000) min *= 1000
    if (max < 1000) max *= 1000
  }

  // Convert hourly to annual (assuming 2080 hours/year)
  if (cleanedSalary.toLowerCase().includes('hour') || cleanedSalary.includes('/hr') || cleanedSalary.includes('/h')) {
    min *= 2080
    max *= 2080
  }

  // Ensure min <= max
  if (min > max) {
    [min, max] = [max, min]
  }

  return {
    min: Math.round(min),
    max: Math.round(max),
    currency
  }
}

export function normalizeRemotiveJob(job: RemotiveJob): Omit<Job, 'id' | 'created_at' | 'fetched_at'> {
  const salary = parseSalary(job.salary)

  return {
    title: job.title.trim(),
    company: job.company_name.trim(),
    description: job.description || null,
    salary_min: salary.min,
    salary_max: salary.max,
    currency: salary.currency,
    job_type: normalizeJobType(job.job_type),
    timezone: job.candidate_required_location || 'global',
    tech_stack: job.tags || [],
    experience_level: inferExperienceLevel(job.title, job.description || ''),
    url: job.url,
    source: 'remotive',
    company_logo: job.company_logo || null,
    posted_date: job.publication_date || null,
    is_active: true,
  }
}

export function normalizeRemotiveJobs(jobs: RemotiveJob[]): Array<Omit<Job, 'id' | 'created_at' | 'fetched_at'>> {
  return jobs.map(normalizeRemotiveJob)
}
