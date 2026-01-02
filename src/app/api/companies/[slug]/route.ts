import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeCompanyName } from '@/lib/quality/company-matcher'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServiceClient()

  // Normalize the slug to match company name
  const normalizedSlug = normalizeCompanyName(decodeURIComponent(slug))

  // Find company by normalized name
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('name_normalized', normalizedSlug)
    .single()

  if (companyError || !company) {
    // Try partial match
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .ilike('name_normalized', `%${normalizedSlug}%`)
      .limit(1)

    if (!companies || companies.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Use the first match
    const matchedCompany = companies[0]

    return getCompanyProfile(supabase, matchedCompany)
  }

  return getCompanyProfile(supabase, company)
}

async function getCompanyProfile(
  supabase: ReturnType<typeof createServiceClient>,
  company: {
    id: string
    name: string
    name_normalized: string
    logo_url: string | null
    website: string | null
    is_verified: boolean
    is_blacklisted: boolean
    employee_count: number | null
  }
) {
  // Get company reputation
  const { data: reputation } = await supabase
    .from('company_reputation')
    .select('*')
    .eq('company_id', company.id)
    .single()

  // Count active jobs
  const { count: activeJobsCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('is_active', true)

  // Get recent jobs (last 10)
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('id, title, job_type, posted_date, quality_score')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('posted_date', { ascending: false })
    .limit(10)

  // Calculate response rate if we have data
  let responseRate: number | null = null
  if (reputation?.total_applications_tracked && reputation.total_applications_tracked > 0) {
    responseRate =
      (reputation.applications_with_response / reputation.total_applications_tracked) * 100
  }

  return NextResponse.json({
    company: {
      id: company.id,
      name: company.name,
      slug: company.name_normalized,
      logo_url: company.logo_url,
      website: company.website,
      is_verified: company.is_verified,
      employee_count: company.employee_count,
    },
    reputation: reputation
      ? {
          score: reputation.reputation_score,
          total_jobs_posted: reputation.total_jobs_posted,
          jobs_filled: reputation.jobs_filled,
          jobs_expired: reputation.jobs_expired,
          avg_days_to_close: reputation.avg_days_to_close,
          avg_reposts_per_job: reputation.avg_reposts_per_job,
          response_rate: responseRate,
        }
      : {
          score: 0.5,
          total_jobs_posted: 0,
          jobs_filled: 0,
          jobs_expired: 0,
          avg_days_to_close: null,
          avg_reposts_per_job: 1,
          response_rate: null,
        },
    active_jobs_count: activeJobsCount || 0,
    recent_jobs: recentJobs || [],
  })
}
