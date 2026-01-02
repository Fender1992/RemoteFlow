import type { SiteConfig, SitePrompt, SiteConfigWithPrompt, SearchUrlParams } from './types'

export const diceConfig: SiteConfig = {
  id: 'dice',
  name: 'Dice',
  baseUrl: 'https://www.dice.com',
  searchUrlTemplate:
    'https://www.dice.com/jobs?q={keywords}&location={location}&filters.isRemote=true',
  maxJobsPerSearch: 50,
  rateLimit: {
    requestsPerMinute: 20,
    delayBetweenPagesMs: 1500,
  },
  supportsFilters: ['remote', 'job_type', 'posted_date'],
}

export const dicePrompt: SitePrompt = {
  systemPrompt: `You are a job search assistant browsing Dice, a tech-focused job board. Your task is to navigate search results and extract job data.

Key behaviors:
- Dice is tech-focused - most jobs have detailed skill requirements
- Jobs are listed in cards with key details visible
- Click into jobs for full descriptions
- Skills/technologies are usually tagged - extract these
- The site is generally clean with minimal pop-ups`,

  searchInstructions: `
1. Navigate to the provided search URL
2. Wait for job listings to load
3. For each job card:
   - Click to see full details
   - Extract: title, company, location, salary, posted date
   - Pay special attention to skills/technologies listed
   - Copy the job URL
4. Scroll or paginate to load more jobs
5. Stop after extracting {maxJobs} jobs
6. Return all extracted jobs in the specified JSON format`,

  outputFormat: `Return a JSON object with this exact structure:
{
  "jobs": [
    {
      "title": "React Native Developer",
      "company": "Tech Staffing Inc",
      "location": "Remote",
      "salary": "$140,000 - $170,000",
      "posted_date": "Today",
      "url": "https://www.dice.com/job-detail/...",
      "description_preview": "Looking for an experienced...",
      "remote_type": "fully_remote",
      "employment_type": "full-time",
      "skills_tags": ["React Native", "TypeScript", "Redux", "iOS", "Android"]
    }
  ],
  "metadata": {
    "site": "dice",
    "search_url": "https://...",
    "jobs_extracted": 50,
    "pages_visited": 2
  }
}`,
}

export function buildDiceSearchUrl(params: SearchUrlParams): string {
  const url = new URL('https://www.dice.com/jobs')

  // Keywords
  url.searchParams.set('q', params.keywords)

  // Location
  url.searchParams.set('location', params.remote ? 'Remote' : params.location || '')

  // Remote filter
  if (params.remote) {
    url.searchParams.set('filters.isRemote', 'true')
  }

  return url.toString()
}

export const dice: SiteConfigWithPrompt = {
  config: diceConfig,
  prompt: dicePrompt,
}
