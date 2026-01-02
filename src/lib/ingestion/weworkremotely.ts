// We Work Remotely RSS integration
import type { JobType, ExperienceLevel, JobInsert } from '@/types'

export interface WWRJob {
  title: string
  link: string
  guid: string
  pubDate: string
  description: string
  category?: string
  type?: string
  region?: string
  skills?: string
  companyLogo?: string
}

const WWR_RSS_URL = 'https://weworkremotely.com/remote-jobs.rss'

// Simple XML parser for RSS
function parseRSSItem(itemXml: string): WWRJob | null {
  const getTagContent = (tag: string): string => {
    // Handle CDATA sections
    const cdataMatch = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
    if (cdataMatch) return cdataMatch[1].trim()

    const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    return match ? match[1].trim() : ''
  }

  const getAttrValue = (tag: string, attr: string): string => {
    const match = itemXml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'))
    return match ? match[1] : ''
  }

  const title = getTagContent('title')
  const link = getTagContent('link')
  const guid = getTagContent('guid')
  const pubDate = getTagContent('pubDate')
  const description = getTagContent('description')
  const category = getTagContent('category')
  const type = getTagContent('type')
  const region = getTagContent('region')
  const skills = getTagContent('skills')
  const companyLogo = getAttrValue('media:content', 'url')

  if (!title || !link) return null

  return {
    title,
    link,
    guid: guid || link,
    pubDate,
    description,
    category,
    type,
    region,
    skills,
    companyLogo,
  }
}

export async function fetchWWRJobs(): Promise<WWRJob[]> {
  const response = await fetch(WWR_RSS_URL, {
    headers: {
      'User-Agent': 'RemoteFlow/1.0 (job aggregator)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`WWR RSS error: ${response.status}`)
  }

  const xml = await response.text()

  // Extract all <item> elements
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || []

  const jobs: WWRJob[] = []
  for (const itemXml of itemMatches) {
    const job = parseRSSItem(itemXml)
    if (job) {
      jobs.push(job)
    }
  }

  console.log(`Fetched ${jobs.length} jobs from We Work Remotely`)
  return jobs
}

function extractCompanyFromTitle(title: string): { company: string; position: string } {
  // WWR format is typically "Company: Position"
  const colonIndex = title.indexOf(':')
  if (colonIndex > 0) {
    return {
      company: title.substring(0, colonIndex).trim(),
      position: title.substring(colonIndex + 1).trim(),
    }
  }
  return {
    company: 'Unknown',
    position: title,
  }
}

function mapJobType(type?: string): JobType {
  if (!type) return 'full_time'
  const t = type.toLowerCase()

  if (t.includes('part')) return 'part_time'
  if (t.includes('contract')) return 'contract'
  if (t.includes('freelance')) return 'freelance'
  if (t.includes('intern')) return 'internship'
  return 'full_time'
}

function inferExperienceLevel(title: string, description: string): ExperienceLevel {
  const combined = `${title} ${description}`.toLowerCase()

  if (combined.includes('principal') || combined.includes('staff') || combined.includes('architect') || combined.includes('director') || combined.includes('vp ') || combined.includes('head of')) {
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

export function normalizeWWRJob(job: WWRJob): JobInsert {
  const { company, position } = extractCompanyFromTitle(job.title)

  // Parse skills into tech stack
  const techStack = job.skills
    ? job.skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10)
    : job.category ? [job.category] : []

  return {
    title: position,
    company: company,
    description: job.description,
    salary_min: null,
    salary_max: null,
    currency: 'USD',
    job_type: mapJobType(job.type),
    timezone: 'global',
    tech_stack: techStack,
    experience_level: inferExperienceLevel(position, job.description || ''),
    url: job.link,
    source: 'weworkremotely',
    company_logo: job.companyLogo || null,
    posted_date: job.pubDate ? new Date(job.pubDate).toISOString() : null,
    is_active: true,
  }
}

export function normalizeWWRJobs(jobs: WWRJob[]): JobInsert[] {
  return jobs.map(normalizeWWRJob)
}
