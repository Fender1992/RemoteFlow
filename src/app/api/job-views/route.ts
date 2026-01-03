import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/job-views
 * List user's viewed jobs with pagination and optional platform filter
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const platform = searchParams.get('platform') || undefined

  // Build query
  let query = supabase
    .from('job_views')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('viewed_at', { ascending: false })

  // Apply platform filter if provided
  if (platform && platform !== 'all') {
    query = query.eq('platform', platform)
  }

  // Pagination
  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: views, count, error } = await query

  if (error) {
    console.error('Job views query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    views: views || [],
    total: count || 0,
    page,
    limit,
    hasMore: (count || 0) > offset + (views?.length || 0),
  })
}

/**
 * POST /api/job-views
 * Log a job view from the browser extension
 * Uses upsert to update existing view or create new one
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, title, company, platform, job_id } = body

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  // Use the database function to upsert the job view
  const { data, error } = await supabase.rpc('upsert_job_view', {
    p_user_id: user.id,
    p_url: url,
    p_title: title || null,
    p_company: company || null,
    p_platform: platform || null,
    p_job_id: job_id || null,
  })

  if (error) {
    console.error('Job view upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    view_id: data,
  }, { status: 201 })
}
