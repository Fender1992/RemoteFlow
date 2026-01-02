import type { JobInsert, ExperienceLevel, JobType } from '@/types'
import type { RawExtractedJob, ClaudeExtractionResult } from './sites/types'

/**
 * Parse Claude's JSON output to extract jobs
 */
export function parseClaudeOutput(text: string): ClaudeExtractionResult | null {
  // Try to find JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*"jobs"[\s\S]*"metadata"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Try to fix common JSON issues
      const fixed = fixCommonJsonIssues(jsonMatch[0])
      try {
        return JSON.parse(fixed)
      } catch {
        // Fall through to array extraction
      }
    }
  }

  // Try to find just the jobs array
  const arrayMatch = text.match(/\[\s*\{[\s\S]*"title"[\s\S]*\}\s*\]/)
  if (arrayMatch) {
    try {
      const jobs = JSON.parse(arrayMatch[0])
      return {
        jobs,
        metadata: {
          site: 'unknown',
          search_url: '',
          jobs_extracted: jobs.length,
          pages_visited: 1,
        },
      }
    } catch {
      // Fall through to manual extraction
    }
  }

  // Last resort: try to extract jobs manually
  const jobs = extractJobsManually(text)
  if (jobs.length > 0) {
    return {
      jobs,
      metadata: {
        site: 'unknown',
        search_url: '',
        jobs_extracted: jobs.length,
        pages_visited: 1,
        extraction_notes: 'Extracted via fallback regex parsing',
      },
    }
  }

  return null
}

/**
 * Fix common JSON formatting issues
 */
function fixCommonJsonIssues(json: string): string {
  return json
    .replace(/,\s*}/g, '}') // Remove trailing commas in objects
    .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
    .replace(/'/g, '"') // Replace single quotes with double quotes
    .replace(/\n/g, ' ') // Remove newlines
    .replace(/\t/g, ' ') // Remove tabs
}

/**
 * Manually extract jobs from text using regex patterns
 */
function extractJobsManually(text: string): RawExtractedJob[] {
  const jobs: RawExtractedJob[] = []

  // Pattern to find job-like structures
  const titlePattern = /"title"\s*:\s*"([^"]+)"/g
  const companyPattern = /"company"\s*:\s*"([^"]+)"/g
  const urlPattern = /"url"\s*:\s*"([^"]+)"/g

  const titles = [...text.matchAll(titlePattern)].map((m) => m[1])
  const companies = [...text.matchAll(companyPattern)].map((m) => m[1])
  const urls = [...text.matchAll(urlPattern)].map((m) => m[1])

  // Match by position
  const count = Math.min(titles.length, companies.length, urls.length)
  for (let i = 0; i < count; i++) {
    jobs.push({
      title: titles[i],
      company: companies[i],
      url: urls[i],
    })
  }

  return jobs
}

/**
 * Parse salary string into min/max/currency
 */
export function parseSalary(salaryStr: string | undefined): {
  min: number | null
  max: number | null
  currency: string
  isEstimate: boolean
} {
  if (!salaryStr) {
    return { min: null, max: null, currency: 'USD', isEstimate: false }
  }

  const isEstimate = salaryStr.toLowerCase().includes('est') || salaryStr.includes('~')

  // Detect currency
  let currency = 'USD'
  if (salaryStr.includes('€') || salaryStr.toLowerCase().includes('eur')) {
    currency = 'EUR'
  } else if (salaryStr.includes('£') || salaryStr.toLowerCase().includes('gbp')) {
    currency = 'GBP'
  }

  // Extract numbers
  const numbers = salaryStr.match(/[\d,]+/g)?.map((n) => parseInt(n.replace(/,/g, ''), 10)) || []

  // Handle "K" notation (e.g., "$150K")
  const kMatch = salaryStr.match(/\$?([\d,]+)k/gi)
  if (kMatch) {
    const kNumbers = kMatch.map((m) => {
      const num = parseInt(m.replace(/[$k,]/gi, ''), 10)
      return num * 1000
    })
    return {
      min: kNumbers[0] || null,
      max: kNumbers[1] || kNumbers[0] || null,
      currency,
      isEstimate,
    }
  }

  // Check if hourly rate and convert to annual
  const isHourly = salaryStr.toLowerCase().includes('hour') || salaryStr.toLowerCase().includes('/hr')
  const multiplier = isHourly ? 2080 : 1 // 40 hrs/week * 52 weeks

  if (numbers.length >= 2) {
    return {
      min: numbers[0] * multiplier,
      max: numbers[1] * multiplier,
      currency,
      isEstimate,
    }
  } else if (numbers.length === 1) {
    return {
      min: numbers[0] * multiplier,
      max: numbers[0] * multiplier,
      currency,
      isEstimate,
    }
  }

  return { min: null, max: null, currency, isEstimate }
}

/**
 * Infer experience level from job title and description
 */
export function inferExperienceLevel(title: string, description: string = ''): ExperienceLevel {
  const text = `${title} ${description}`.toLowerCase()

  if (text.includes('senior') || text.includes('sr.') || text.includes('sr ')) {
    return 'senior'
  }
  if (
    text.includes('lead') ||
    text.includes('principal') ||
    text.includes('staff') ||
    text.includes('architect')
  ) {
    return 'lead'
  }
  if (text.includes('junior') || text.includes('jr.') || text.includes('jr ') || text.includes('entry')) {
    return 'junior'
  }
  if (text.includes('mid') || text.includes('intermediate')) {
    return 'mid'
  }

  // Default to mid for unspecified
  return 'any'
}

/**
 * Infer job type from text
 */
export function inferJobType(text: string): JobType {
  const lower = text.toLowerCase()

  if (lower.includes('contract') || lower.includes('contractor')) {
    return 'contract'
  }
  if (lower.includes('part-time') || lower.includes('part time')) {
    return 'part_time'
  }
  if (lower.includes('freelance')) {
    return 'freelance'
  }
  if (lower.includes('intern')) {
    return 'internship'
  }

  return 'full_time'
}

/**
 * Parse relative date string to ISO date
 */
export function parseRelativeDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return new Date().toISOString()
  }

  const lower = dateStr.toLowerCase()
  const now = new Date()

  // "Just posted", "Today", etc.
  if (lower.includes('just') || lower.includes('today') || lower.includes('now')) {
    return now.toISOString()
  }

  // "X days ago"
  const daysMatch = lower.match(/(\d+)\s*day/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10)
    now.setDate(now.getDate() - days)
    return now.toISOString()
  }

  // "X weeks ago"
  const weeksMatch = lower.match(/(\d+)\s*week/i)
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10)
    now.setDate(now.getDate() - weeks * 7)
    return now.toISOString()
  }

  // "X months ago"
  const monthsMatch = lower.match(/(\d+)\s*month/i)
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10)
    now.setMonth(now.getMonth() - months)
    return now.toISOString()
  }

  // Yesterday
  if (lower.includes('yesterday')) {
    now.setDate(now.getDate() - 1)
    return now.toISOString()
  }

  // Default to now
  return new Date().toISOString()
}

/**
 * Normalize a raw extracted job to JobInsert format
 */
export function normalizeExtractedJob(
  raw: RawExtractedJob,
  siteId: string
): Omit<JobInsert, 'fetched_at'> {
  const salary = parseSalary(raw.salary)

  return {
    title: raw.title.trim(),
    company: raw.company.trim(),
    description: raw.description_preview || null,
    salary_min: salary.min,
    salary_max: salary.max,
    currency: salary.currency,
    job_type: raw.employment_type
      ? inferJobType(raw.employment_type)
      : inferJobType(raw.title),
    timezone: raw.location || 'remote',
    tech_stack: raw.skills_tags || [],
    experience_level: inferExperienceLevel(raw.title, raw.description_preview || ''),
    url: raw.url,
    source: `import_${siteId}`,
    company_logo: null,
    posted_date: parseRelativeDate(raw.posted_date),
    is_active: true,
  }
}

/**
 * Normalize all jobs from a Claude extraction result
 */
export function normalizeExtractedJobs(
  result: ClaudeExtractionResult,
  siteId: string
): Array<Omit<JobInsert, 'fetched_at'>> {
  return result.jobs
    .filter((job) => job.title && job.company && job.url)
    .map((job) => normalizeExtractedJob(job, siteId))
}
