import type { SiteConfig, SitePrompt, SiteConfigWithPrompt, SearchUrlParams } from './types'

export const linkedInConfig: SiteConfig = {
  id: 'linkedin',
  name: 'LinkedIn',
  baseUrl: 'https://www.linkedin.com',
  searchUrlTemplate:
    'https://www.linkedin.com/jobs/search/?keywords={keywords}&location={location}&f_WT={remote}&f_TPR=r604800',
  maxJobsPerSearch: 50,
  rateLimit: {
    requestsPerMinute: 10,
    delayBetweenPagesMs: 3000,
  },
  supportsFilters: ['remote', 'experience', 'salary', 'date_posted'],
  notes: 'May encounter login modal - can dismiss with X button',
}

export const linkedInPrompt: SitePrompt = {
  systemPrompt: `You are a job search assistant browsing LinkedIn Jobs. Your task is to navigate job search results and extract job listing data.

Key behaviors:
- Wait for pages to fully load before extracting (look for job cards)
- If you see a login/signup modal, look for an X or Close button to dismiss it
- Job cards appear on the left, clicking them loads details on the right
- Scroll down to load more jobs if the page uses infinite scroll
- Look for the "Show more jobs" button at the bottom to load more`,

  searchInstructions: `
1. Navigate to the provided search URL
2. Wait for job listings to load (look for job cards in the left panel)
3. If a login modal appears, dismiss it by clicking the X button
4. For each visible job listing:
   - Click on the job card to load its details
   - Extract: title, company name, location, salary (if shown), posted date
   - Note the job URL from the browser
   - Look for "Easy Apply" badge
5. Scroll down to load more jobs
6. Click "Show more jobs" button if visible
7. Stop after extracting {maxJobs} jobs or when no more are available
8. Return all extracted jobs in the specified JSON format`,

  outputFormat: `Return a JSON object with this exact structure:
{
  "jobs": [
    {
      "title": "Senior React Developer",
      "company": "Acme Corp",
      "location": "Remote, United States",
      "salary": "$150,000 - $180,000/year",
      "posted_date": "2 days ago",
      "url": "https://www.linkedin.com/jobs/view/12345678/",
      "description_preview": "First 500 chars of job description...",
      "remote_type": "fully_remote",
      "employment_type": "full-time",
      "easy_apply": true,
      "applicant_count": 47
    }
  ],
  "metadata": {
    "site": "linkedin",
    "search_url": "https://...",
    "total_results_shown": 127,
    "jobs_extracted": 50,
    "pages_visited": 3,
    "extraction_notes": "Encountered login modal, dismissed it"
  }
}`,
}

export function buildLinkedInSearchUrl(params: SearchUrlParams): string {
  const url = new URL('https://www.linkedin.com/jobs/search/')

  // Keywords (roles)
  url.searchParams.set('keywords', params.keywords)

  // Location
  url.searchParams.set('location', params.location || 'Remote')

  // Remote filter: 2 = Remote
  if (params.remote) {
    url.searchParams.set('f_WT', '2')
  }

  // Date posted: r604800 = past week
  url.searchParams.set('f_TPR', 'r604800')

  // Experience level mapping
  if (params.experienceLevels?.length) {
    const levelMap: Record<string, string> = {
      junior: '1', // Entry level
      mid: '2', // Associate
      senior: '3', // Mid-Senior level
      lead: '4', // Director
    }
    const levels = params.experienceLevels
      .map((l) => levelMap[l])
      .filter(Boolean)
      .join(',')
    if (levels) {
      url.searchParams.set('f_E', levels)
    }
  }

  return url.toString()
}

export const linkedin: SiteConfigWithPrompt = {
  config: linkedInConfig,
  prompt: linkedInPrompt,
}
