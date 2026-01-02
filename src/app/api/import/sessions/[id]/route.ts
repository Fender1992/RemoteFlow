import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { cancelWorker } from '@/lib/import/worker/trigger'
import type { ImportProgressResponse } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/import/sessions/[id]
 * Get detailed progress for a specific import session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch session with site results
  const { data: session, error } = await supabase
    .from('import_sessions')
    .select(
      `
      *,
      site_results:import_site_results(*)
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Format response
  const response: ImportProgressResponse = {
    id: session.id,
    status: session.status,
    search_params: session.search_params,
    progress: {
      total_jobs_found: session.total_jobs_found,
      total_jobs_imported: session.total_jobs_imported,
      duplicates_skipped: session.total_duplicates_skipped,
    },
    sites: (session.site_results || []).map((sr: Record<string, unknown>) => ({
      site_id: sr.site_id as string,
      status: sr.status as string,
      jobs_found: sr.jobs_found as number,
      jobs_imported: sr.jobs_imported as number,
      error: sr.error_message as string | undefined,
    })),
    started_at: session.started_at,
    completed_at: session.completed_at,
  }

  return NextResponse.json(response)
}

/**
 * DELETE /api/import/sessions/[id]
 * Cancel a running import session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify session belongs to user and is cancellable
  const { data: session, error: fetchError } = await supabase
    .from('import_sessions')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.status !== 'pending' && session.status !== 'running') {
    return NextResponse.json(
      { error: 'Session cannot be cancelled', status: session.status },
      { status: 400 }
    )
  }

  // Try to cancel the worker
  await cancelWorker(id)

  // Update session status
  const serviceClient = createServiceClient()
  const { error: updateError } = await serviceClient
    .from('import_sessions')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 })
  }

  // Update any pending site results
  await serviceClient
    .from('import_site_results')
    .update({
      status: 'skipped',
      completed_at: new Date().toISOString(),
    })
    .eq('session_id', id)
    .in('status', ['pending', 'running'])

  return NextResponse.json({ success: true, message: 'Import cancelled' })
}
