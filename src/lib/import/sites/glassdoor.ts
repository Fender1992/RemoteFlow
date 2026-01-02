import type { SiteConfig, SitePrompt, SiteConfigWithPrompt, SearchUrlParams } from './types'

export const glassdoorConfig: SiteConfig = {
  id: 'glassdoor',
  name: 'Glassdoor',
  baseUrl: 'https://www.glassdoor.com',
  searchUrlTemplate:
    'https://www.glassdoor.com/Job/jobs.htm?sc.keyword={keywords}&locT=N&locId=1&remoteWorkType=1',
  maxJobsPerSearch: 40,
  rateLimit: {
    requestsPerMinute: 8,
    delayBetweenPagesMs: 4000,
  },
  supportsFilters: ['remote', 'salary', 'rating'],
  notes: 'May encounter signup modals - dismiss them',
}

export const glassdoorPrompt: SitePrompt = {
  systemPrompt: `You are a job search assistant browsing Glassdoor job listings. Your task is to navigate search results and extract job data.

Key behaviors:
- May show signup/login modal - look for X or "Close" button to dismiss
- Company ratings (1-5 stars) are valuable - always extract them
- Salary shows as estimated range
- Job cards are clickable for more details
- Note the company rating and review count`,

  searchInstructions: `
1. Navigate to the provided search URL
2. If a signup/login modal appears, dismiss it by clicking X or Close
3. Wait for job listings to load
4. For each job card:
   - Click to see full details
   - Extract: title, company, location, salary range, company rating
   - Note the company's star rating and review count
   - Copy the job URL
5. Scroll or paginate to load more jobs
6. Stop after extracting {maxJobs} jobs
7. Return all extracted jobs in the specified JSON format`,

  outputFormat: `Return a JSON object with this exact structure:
{
  "jobs": [
    {
      "title": "Software Engineer",
      "company": "Great Company",
      "location": "Remote",
      "salary": "$130,000 - $160,000 (Glassdoor est.)",
      "posted_date": "1 week ago",
      "url": "https://www.glassdoor.com/job-listing/...",
      "description_preview": "Join our team...",
      "remote_type": "fully_remote",
      "company_info": {
        "rating": 4.1,
        "review_count": 523
      }
    }
  ],
  "metadata": {
    "site": "glassdoor",
    "search_url": "https://...",
    "jobs_extracted": 40,
    "pages_visited": 2,
    "extraction_notes": "Dismissed signup modal"
  }
}`,
}

export function buildGlassdoorSearchUrl(params: SearchUrlParams): string {
  const url = new URL('https://www.glassdoor.com/Job/jobs.htm')

  // Keywords
  url.searchParams.set('sc.keyword', params.keywords)

  // Location type: N = Nationwide
  url.searchParams.set('locT', 'N')
  url.searchParams.set('locId', '1') // US

  // Remote filter: 1 = Remote
  if (params.remote) {
    url.searchParams.set('remoteWorkType', '1')
  }

  return url.toString()
}

export const glassdoor: SiteConfigWithPrompt = {
  config: glassdoorConfig,
  prompt: glassdoorPrompt,
}
