import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SignalType } from '@/types'

export const dynamic = 'force-dynamic'

const VALID_SIGNAL_TYPES: SignalType[] = [
  'got_hired',
  'got_response',
  'no_response',
  'fake_report',
  'spam_report',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  let body: { signal_type: string; details?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { signal_type, details } = body

  // Validate signal type
  if (!signal_type || !VALID_SIGNAL_TYPES.includes(signal_type as SignalType)) {
    return NextResponse.json(
      {
        error: 'Invalid signal_type',
        valid_types: VALID_SIGNAL_TYPES,
      },
      { status: 400 }
    )
  }

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Insert signal (upsert to handle duplicates)
  const { error: insertError } = await supabase.from('job_signals').upsert(
    {
      job_id: jobId,
      user_id: user.id,
      signal_type,
      details: details || null,
    },
    {
      onConflict: 'job_id,user_id,signal_type',
    }
  )

  if (insertError) {
    console.error('Signal insert error:', insertError)
    return NextResponse.json(
      { error: 'Failed to submit signal' },
      { status: 500 }
    )
  }

  // If this is a report type, check if we should auto-queue for review
  if (signal_type === 'fake_report' || signal_type === 'spam_report') {
    await checkAndQueueForReview(supabase, jobId)
  }

  return NextResponse.json({
    success: true,
    message: 'Signal submitted successfully',
  })
}

/**
 * Check if job has enough reports to be auto-queued for review
 */
async function checkAndQueueForReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string
) {
  // Count reports for this job
  const { count } = await supabase
    .from('job_signals')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('signal_type', ['fake_report', 'spam_report'])

  // If 3+ reports, queue for review
  if (count && count >= 3) {
    // Check if already in queue
    const { data: existing } = await supabase
      .from('review_queue')
      .select('id')
      .eq('entity_type', 'job')
      .eq('entity_id', jobId)
      .eq('status', 'pending')
      .single()

    if (!existing) {
      await supabase.from('review_queue').insert({
        entity_type: 'job',
        entity_id: jobId,
        reason: 'user_reports',
        priority: 3, // Higher priority than auto-detected issues
      })
    }
  }
}

// Get user's signals for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's signals for this job
  const { data: signals, error } = await supabase
    .from('job_signals')
    .select('signal_type, details, created_at')
    .eq('job_id', jobId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 })
  }

  return NextResponse.json({ signals })
}
