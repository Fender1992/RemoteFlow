import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { JobFilters, JobsApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const filters: JobFilters = {
    search: searchParams.get('search') || undefined,
    job_types: searchParams.get('job_types')?.split(',').filter(Boolean) as JobFilters['job_types'],
    experience_levels: searchParams.get('experience_levels')?.split(',').filter(Boolean) as JobFilters['experience_levels'],
    tech_stack: searchParams.get('tech_stack')?.split(',').filter(Boolean),
    min_salary: searchParams.get('min_salary') ? parseInt(searchParams.get('min_salary')!) : undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
  }

  const supabase = await createClient()

  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('posted_date', { ascending: false, nullsFirst: false })

  // Apply search filter (title, company, description)
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
  }

  // Apply job_types filter
  if (filters.job_types?.length) {
    query = query.in('job_type', filters.job_types)
  }

  // Apply experience_levels filter
  if (filters.experience_levels?.length) {
    query = query.in('experience_level', filters.experience_levels)
  }

  // Apply tech_stack filter (overlaps)
  if (filters.tech_stack?.length) {
    query = query.overlaps('tech_stack', filters.tech_stack)
  }

  // Apply min_salary filter
  if (filters.min_salary) {
    query = query.or(`salary_max.gte.${filters.min_salary},salary_max.is.null`)
  }

  // Pagination
  const offset = ((filters.page || 1) - 1) * (filters.limit || 20)
  query = query.range(offset, offset + (filters.limit || 20) - 1)

  const { data: jobs, count, error } = await query

  if (error) {
    console.error('Jobs query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response: JobsApiResponse = {
    jobs: jobs || [],
    total: count || 0,
    page: filters.page || 1,
    limit: filters.limit || 20,
    hasMore: (count || 0) > offset + (jobs?.length || 0),
  }

  return NextResponse.json(response)
}
