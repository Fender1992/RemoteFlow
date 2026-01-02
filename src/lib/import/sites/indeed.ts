import type { SiteConfig, SitePrompt, SiteConfigWithPrompt, SearchUrlParams } from './types'

export const indeedConfig: SiteConfig = {
  id: 'indeed',
  name: 'Indeed',
  baseUrl: 'https://www.indeed.com',
  searchUrlTemplate:
    'https://www.indeed.com/jobs?q={keywords}&l={location}&sc=0kf%3Aattr(DSQF7)%3B&fromage=3',
  maxJobsPerSearch: 50,
  rateLimit: {
    requestsPerMinute: 15,
    delayBetweenPagesMs: 2000,
  },
  supportsFilters: ['remote', 'salary', 'date_posted', 'job_type'],
}

export const indeedPrompt: SitePrompt = {
  systemPrompt: `You are a job search assistant browsing Indeed job listings. Your task is to navigate search results and extract job data.

Key behaviors:
- Jobs are listed in cards that can be clicked for more details
- Indeed often shows salary estimates even when not provided by employer
- Note whether salary is "Estimated" or "Employer provided"
- Look for badges: "Urgently hiring", "Responsive employer", "Many applicants"
- Job ID is in the URL parameter "jk"
- Use the "Next" button at the bottom for pagination`,

  searchInstructions: `
1. Navigate to the provided search URL
2. Wait for job listings to load
3. For each job card visible:
   - Click on the job card to expand details
   - Extract: title, company, location, salary, posted date, job type
   - Note any badges (Urgently hiring, etc.)
   - Copy the job URL
4. Use the "Next" button to go to the next page
5. Stop after extracting {maxJobs} jobs or when no more pages
6. Return all extracted jobs in the specified JSON format`,

  outputFormat: `Return a JSON object with this exact structure:
{
  "jobs": [
    {
      "title": "Frontend Developer",
      "company": "Tech Company Inc",
      "location": "Remote",
      "salary": "$120,000 - $150,000 a year",
      "posted_date": "3 days ago",
      "url": "https://www.indeed.com/viewjob?jk=abc123",
      "description_preview": "We are looking for a talented...",
      "remote_type": "fully_remote",
      "employment_type": "full-time",
      "company_info": {
        "rating": 4.2
      }
    }
  ],
  "metadata": {
    "site": "indeed",
    "search_url": "https://...",
    "jobs_extracted": 50,
    "pages_visited": 3
  }
}`,
}

export function buildIndeedSearchUrl(params: SearchUrlParams): string {
  const url = new URL('https://www.indeed.com/jobs')

  // Keywords
  url.searchParams.set('q', params.keywords)

  // Location
  url.searchParams.set('l', params.remote ? 'Remote' : params.location || '')

  // Remote filter
  if (params.remote) {
    url.searchParams.set('sc', '0kf:attr(DSQF7);')
  }

  // Date posted: fromage=3 = last 3 days
  url.searchParams.set('fromage', '3')

  // Salary filter
  if (params.salaryMin) {
    url.searchParams.set('salary', params.salaryMin.toString())
  }

  return url.toString()
}

export const indeed: SiteConfigWithPrompt = {
  config: indeedConfig,
  prompt: indeedPrompt,
}
