import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/import/sessions
 * List user's import sessions with pagination
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
  const offset = parseInt(searchParams.get('offset') || '0')
  const status = searchParams.get('status') // Optional filter

  // Build query
  let query = supabase
    .from('import_sessions')
    .select(
      `
      *,
      site_results:import_site_results(*)
    `,
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: sessions, count, error } = await query

  if (error) {
    console.error('Failed to fetch import sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  return NextResponse.json({
    sessions: sessions || [],
    total: count || 0,
    limit,
    offset,
    hasMore: (count || 0) > offset + limit,
  })
}
