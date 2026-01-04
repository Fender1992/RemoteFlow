import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * PATCH /api/feedback/[id]
 *
 * Dismiss a feedback prompt
 * Sets dismissed_at = NOW()
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the feedback prompt exists and belongs to user
  const { data: prompt, error: promptError } = await supabase
    .from('feedback_prompts')
    .select('id, responded_at, dismissed_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (promptError || !prompt) {
    return NextResponse.json({ error: 'Feedback prompt not found' }, { status: 404 })
  }

  // Check if already responded or dismissed
  if (prompt.responded_at) {
    return NextResponse.json(
      { error: 'Prompt has already been responded to' },
      { status: 400 }
    )
  }

  if (prompt.dismissed_at) {
    return NextResponse.json(
      { error: 'Prompt has already been dismissed' },
      { status: 400 }
    )
  }

  // Dismiss the prompt
  const { error: updateError } = await supabase
    .from('feedback_prompts')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Error dismissing feedback prompt:', updateError)
    return NextResponse.json({ error: 'Failed to dismiss prompt' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * GET /api/feedback/[id]
 *
 * Get specific application outcome by id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the outcome with related data
  const { data: outcome, error: outcomeError } = await supabase
    .from('application_outcomes')
    .select(
      `
      id,
      saved_job_id,
      job_id,
      company_id,
      applied_at,
      outcome_reported_at,
      outcome,
      days_to_response,
      interview_rounds,
      rejection_stage,
      experience_rating,
      would_recommend,
      notes,
      created_at,
      saved_job:saved_jobs(
        id,
        status,
        applied_date,
        job:jobs(
          id,
          title,
          company,
          location
        )
      )
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (outcomeError || !outcome) {
    // Check if it's a "not found" error
    if (outcomeError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Outcome not found' }, { status: 404 })
    }
    console.error('Error fetching outcome:', outcomeError)
    return NextResponse.json({ error: 'Failed to fetch outcome' }, { status: 500 })
  }

  return NextResponse.json(outcome)
}
