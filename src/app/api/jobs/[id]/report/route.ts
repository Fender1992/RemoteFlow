import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ReportReason = 'fake' | 'spam' | 'expired' | 'misleading' | 'other'

const VALID_REASONS: ReportReason[] = ['fake', 'spam', 'expired', 'misleading', 'other']

// Map report reasons to signal types
const REASON_TO_SIGNAL: Record<ReportReason, string> = {
  fake: 'fake_report',
  spam: 'spam_report',
  expired: 'fake_report', // Treat expired as fake
  misleading: 'spam_report', // Treat misleading as spam
  other: 'spam_report',
}

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
  let body: { reason: string; details?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { reason, details } = body

  // Validate reason
  if (!reason || !VALID_REASONS.includes(reason as ReportReason)) {
    return NextResponse.json(
      {
        error: 'Invalid reason',
        valid_reasons: VALID_REASONS,
      },
      { status: 400 }
    )
  }

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title, company')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Insert signal for the report
  const signalType = REASON_TO_SIGNAL[reason as ReportReason]
  const { error: insertError } = await supabase.from('job_signals').upsert(
    {
      job_id: jobId,
      user_id: user.id,
      signal_type: signalType,
      details: {
        reason,
        user_details: details || null,
        reported_at: new Date().toISOString(),
      },
    },
    {
      onConflict: 'job_id,user_id,signal_type',
    }
  )

  if (insertError) {
    console.error('Report insert error:', insertError)
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    )
  }

  // Check if job should be auto-queued for review
  const { count } = await supabase
    .from('job_signals')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('signal_type', ['fake_report', 'spam_report'])

  // If 3+ reports, queue for review
  if (count && count >= 3) {
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
        priority: 3,
      })
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Report submitted. Thank you for helping keep RemoteFlow clean.',
  })
}
