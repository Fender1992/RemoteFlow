import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeJobUrl, type AtsType } from '@/lib/tracking'

export const dynamic = 'force-dynamic'

interface CheckUrlResponse {
  found: boolean
  url: string
  normalized_url: string
  detected_ats: AtsType | null
  job?: {
    id: string
    title: string
    company: string
    company_logo: string | null
    url: string
    salary_min: number | null
    salary_max: number | null
    currency: string
    application_count: number
    avg_time_to_apply_seconds: number | null
  }
  saved?: {
    id: string
    status: string
    notes: string | null
    applied_date: string | null
    saved_at: string
  }
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<CheckUrlResponse>> {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      {
        found: false,
        url: '',
        normalized_url: '',
        detected_ats: null,
        error: 'Unauthorized',
      },
      { status: 401 }
    )
  }

  // Get URL from query params
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json(
      {
        found: false,
        url: '',
        normalized_url: '',
        detected_ats: null,
        error: 'url parameter is required',
      },
      { status: 400 }
    )
  }

  const urlInfo = normalizeJobUrl(url)

  // Strategy 1: Exact normalized URL match
  let jobId: string | null = null

  const { data: exactMatch } = await supabase
    .from('job_url_lookup')
    .select('job_id')
    .eq('normalized_url', urlInfo.normalized)
    .single()

  if (exactMatch) {
    jobId = exactMatch.job_id
  }

  // Strategy 2: Domain + partial path match (for ATS redirects)
  if (!jobId && urlInfo.domain) {
    const { data: domainMatches } = await supabase
      .from('job_url_lookup')
      .select('job_id, normalized_url')
      .eq('domain', urlInfo.domain)
      .limit(20)

    // Find best match by path similarity
    for (const match of domainMatches || []) {
      if (
        urlInfo.normalized.includes(match.normalized_url) ||
        match.normalized_url.includes(urlInfo.normalized)
      ) {
        jobId = match.job_id
        break
      }
    }
  }

  // If no job found, return early
  if (!jobId) {
    return NextResponse.json({
      found: false,
      url: url,
      normalized_url: urlInfo.normalized,
      detected_ats: urlInfo.atsType,
    })
  }

  // Check if user has this job saved
  const { data: savedJob } = await supabase
    .from('saved_jobs')
    .select('id, status, notes, applied_date, created_at')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .single()

  // Get job details
  const { data: job } = await supabase
    .from('jobs')
    .select(`
      id, title, company, company_logo, url,
      salary_min, salary_max, currency,
      application_count, avg_time_to_apply_seconds
    `)
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({
      found: false,
      url: url,
      normalized_url: urlInfo.normalized,
      detected_ats: urlInfo.atsType,
    })
  }

  return NextResponse.json({
    found: true,
    url: url,
    normalized_url: urlInfo.normalized,
    detected_ats: urlInfo.atsType,
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      company_logo: job.company_logo,
      url: job.url,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      currency: job.currency,
      application_count: job.application_count || 0,
      avg_time_to_apply_seconds: job.avg_time_to_apply_seconds,
    },
    saved: savedJob
      ? {
          id: savedJob.id,
          status: savedJob.status,
          notes: savedJob.notes,
          applied_date: savedJob.applied_date,
          saved_at: savedJob.created_at,
        }
      : undefined,
  })
}

// Allow OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
