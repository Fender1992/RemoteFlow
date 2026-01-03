import type { RemotiveApiResponse, RemotiveJob } from '@/types'

const REMOTIVE_API_URL = 'https://remotive.com/api/remote-jobs'

export async function fetchRemotiveJobs(): Promise<RemotiveJob[]> {
  const response = await fetch(REMOTIVE_API_URL, {
    headers: {
      'User-Agent': 'JobIQ/1.0 (job aggregator)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Remotive API error: ${response.status}`)
  }

  const data: RemotiveApiResponse = await response.json()
  return data.jobs
}

// Fetch jobs from multiple categories for more comprehensive coverage
export async function fetchAllRemotiveJobs(): Promise<RemotiveJob[]> {
  const categories = [
    'software-dev',
    'customer-support',
    'design',
    'marketing',
    'sales',
    'product',
    'business',
    'data',
    'devops',
    'finance-legal',
    'hr',
    'qa',
    'writing',
    'all-others',
  ]

  const allJobs: RemotiveJob[] = []
  const seenIds = new Set<number>()

  // Fetch main endpoint first (gets all jobs)
  try {
    const mainJobs = await fetchRemotiveJobs()
    mainJobs.forEach(job => {
      if (!seenIds.has(job.id)) {
        seenIds.add(job.id)
        allJobs.push(job)
      }
    })
    console.log(`Fetched ${mainJobs.length} jobs from main endpoint`)
  } catch (error) {
    console.error('Failed to fetch main endpoint:', error)
  }

  // If we got enough jobs from main endpoint, skip categories
  if (allJobs.length >= 200) {
    return allJobs
  }

  // Fetch by category for more jobs
  for (const category of categories) {
    try {
      const response = await fetch(`${REMOTIVE_API_URL}?category=${category}`, {
        headers: { 'User-Agent': 'JobIQ/1.0' },
      })

      if (response.ok) {
        const data: RemotiveApiResponse = await response.json()
        data.jobs.forEach(job => {
          if (!seenIds.has(job.id)) {
            seenIds.add(job.id)
            allJobs.push(job)
          }
        })
      }

      // Rate limit: wait 300ms between requests
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (error) {
      console.error(`Failed to fetch category ${category}:`, error)
    }
  }

  return allJobs
}
