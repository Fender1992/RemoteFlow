import { createClient } from '@/lib/supabase/server'
import { JobsClient } from './jobs-client'

interface SearchParams {
  search?: string
  job_types?: string
  experience_levels?: string
  page?: string
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('posted_date', { ascending: false, nullsFirst: false })

  // Apply filters
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,company.ilike.%${params.search}%`)
  }

  if (params.job_types) {
    const types = params.job_types.split(',').filter(Boolean)
    if (types.length > 0) {
      query = query.in('job_type', types)
    }
  }

  if (params.experience_levels) {
    const levels = params.experience_levels.split(',').filter(Boolean)
    if (levels.length > 0) {
      query = query.in('experience_level', levels)
    }
  }

  // Pagination
  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: jobs, count } = await query

  // Get user's saved jobs
  const { data: { user } } = await supabase.auth.getUser()
  let savedJobs: { job_id: string; status: string }[] = []

  if (user) {
    const { data } = await supabase
      .from('saved_jobs')
      .select('job_id, status')
      .eq('user_id', user.id)

    savedJobs = data || []
  }

  return (
    <JobsClient
      initialJobs={jobs || []}
      savedJobs={savedJobs}
      totalJobs={count || 0}
      currentPage={page}
      pageSize={limit}
    />
  )
}
