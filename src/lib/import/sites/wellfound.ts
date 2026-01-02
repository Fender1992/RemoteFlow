import type { SiteConfig, SitePrompt, SiteConfigWithPrompt, SearchUrlParams } from './types'

export const wellfoundConfig: SiteConfig = {
  id: 'wellfound',
  name: 'Wellfound (AngelList)',
  baseUrl: 'https://wellfound.com',
  searchUrlTemplate: 'https://wellfound.com/role/{role_slug}?remote=true',
  maxJobsPerSearch: 40,
  rateLimit: {
    requestsPerMinute: 12,
    delayBetweenPagesMs: 2500,
  },
  supportsFilters: ['remote', 'salary', 'company_size', 'equity'],
  notes: 'Startup-focused. Uses role slugs instead of free-text search.',
}

export const wellfoundPrompt: SitePrompt = {
  systemPrompt: `You are a job search assistant browsing Wellfound (formerly AngelList Talent), a startup-focused job board. Your task is to navigate job listings and extract data.

Key behaviors:
- Startup-focused - jobs often include equity information
- Company cards show funding stage and size
- Salary ranges are usually displayed
- Look for: remote policy, equity range, company stage
- The site is generally clean and modern`,

  searchInstructions: `
1. Navigate to the provided search URL
2. Wait for job listings to load
3. For each job card:
   - Click to see full details
   - Extract: title, company, location, salary, equity (if shown)
   - Note the company's funding stage and size
   - Copy the job URL
4. Scroll to load more jobs (infinite scroll)
5. Stop after extracting {maxJobs} jobs
6. Return all extracted jobs in the specified JSON format`,

  outputFormat: `Return a JSON object with this exact structure:
{
  "jobs": [
    {
      "title": "Senior Full Stack Engineer",
      "company": "Startup Inc",
      "location": "Remote",
      "salary": "$140,000 - $180,000",
      "posted_date": "2 weeks ago",
      "url": "https://wellfound.com/company/startup-inc/jobs/123",
      "description_preview": "Join our growing team...",
      "remote_type": "fully_remote",
      "company_info": {
        "size": "11-50 employees",
        "funding_stage": "Series A"
      },
      "equity": "0.1% - 0.5%"
    }
  ],
  "metadata": {
    "site": "wellfound",
    "search_url": "https://...",
    "jobs_extracted": 40,
    "pages_visited": 1
  }
}`,
}

// Role slug mapping for Wellfound's URL structure
const ROLE_SLUGS: Record<string, string> = {
  'software engineer': 'software-engineer',
  'frontend developer': 'frontend-developer',
  'backend developer': 'backend-developer',
  'full stack developer': 'full-stack-developer',
  'react developer': 'react-developer',
  'python developer': 'python-developer',
  'data scientist': 'data-scientist',
  'product manager': 'product-manager',
  'designer': 'designer',
  'devops engineer': 'devops-engineer',
  developer: 'developer',
  engineer: 'engineer',
}

export function buildWellfoundSearchUrl(params: SearchUrlParams): string {
  // Find best matching role slug
  const keywordsLower = params.keywords.toLowerCase()
  let roleSlug = 'developer' // default

  for (const [keyword, slug] of Object.entries(ROLE_SLUGS)) {
    if (keywordsLower.includes(keyword)) {
      roleSlug = slug
      break
    }
  }

  const url = new URL(`https://wellfound.com/role/${roleSlug}`)

  // Remote filter
  if (params.remote) {
    url.searchParams.set('remote', 'true')
  }

  return url.toString()
}

export const wellfound: SiteConfigWithPrompt = {
  config: wellfoundConfig,
  prompt: wellfoundPrompt,
}
