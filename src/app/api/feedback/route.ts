import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Valid outcome values for application feedback
 */
const VALID_OUTCOMES = ['no_response', 'rejected', 'interview', 'offer', 'hired'] as const
type Outcome = (typeof VALID_OUTCOMES)[number]

/**
 * Valid rejection stages
 */
const VALID_REJECTION_STAGES = ['resume', 'phone_screen', 'technical', 'onsite', 'offer'] as const
type RejectionStage = (typeof VALID_REJECTION_STAGES)[number]

/**
 * Request body for submitting application outcome
 */
interface SubmitOutcomeRequest {
  saved_job_id: string
  outcome: Outcome
  days_to_response?: number
  interview_rounds?: number
  rejection_stage?: RejectionStage
  experience_rating?: number
  would_recommend?: boolean
  notes?: string
}

/**
 * POST /api/feedback
 *
 * Submit application outcome (authenticated)
 * Creates record in application_outcomes table
 * Updates saved_jobs status if needed
 */
export async function POST(request: NextRequest) {
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
  let body: SubmitOutcomeRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    saved_job_id,
    outcome,
    days_to_response,
    interview_rounds,
    rejection_stage,
    experience_rating,
    would_recommend,
    notes,
  } = body

  // Validate required fields
  if (!saved_job_id) {
    return NextResponse.json({ error: 'saved_job_id is required' }, { status: 400 })
  }

  if (!outcome) {
    return NextResponse.json({ error: 'outcome is required' }, { status: 400 })
  }

  // Validate outcome value
  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate rejection_stage if provided
  if (rejection_stage && !VALID_REJECTION_STAGES.includes(rejection_stage)) {
    return NextResponse.json(
      { error: `Invalid rejection_stage. Must be one of: ${VALID_REJECTION_STAGES.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate experience_rating if provided (1-5)
  if (experience_rating !== undefined && (experience_rating < 1 || experience_rating > 5)) {
    return NextResponse.json(
      { error: 'experience_rating must be between 1 and 5' },
      { status: 400 }
    )
  }

  // Verify saved job exists and belongs to user
  const { data: savedJob, error: savedJobError } = await supabase
    .from('saved_jobs')
    .select('id, job_id, applied_date')
    .eq('id', saved_job_id)
    .eq('user_id', user.id)
    .single()

  if (savedJobError || !savedJob) {
    return NextResponse.json({ error: 'Saved job not found' }, { status: 404 })
  }

  // Get job details for company_id
  const { data: job } = await supabase
    .from('jobs')
    .select('id, company_id')
    .eq('id', savedJob.job_id)
    .single()

  // Use service client to insert outcome (bypasses RLS for full access)
  const serviceClient = createServiceClient()

  // Check if outcome already exists for this saved job
  const { data: existingOutcome } = await serviceClient
    .from('application_outcomes')
    .select('id')
    .eq('saved_job_id', saved_job_id)
    .single()

  if (existingOutcome) {
    return NextResponse.json(
      { error: 'Outcome already submitted for this application' },
      { status: 409 }
    )
  }

  // Create the outcome record
  const { data: outcomeRecord, error: insertError } = await serviceClient
    .from('application_outcomes')
    .insert({
      user_id: user.id,
      saved_job_id,
      job_id: job?.id || null,
      company_id: job?.company_id || null,
      applied_at: savedJob.applied_date,
      outcome,
      days_to_response: days_to_response || null,
      interview_rounds: interview_rounds || null,
      rejection_stage: rejection_stage || null,
      experience_rating: experience_rating || null,
      would_recommend: would_recommend ?? null,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Error inserting application outcome:', insertError)
    return NextResponse.json({ error: 'Failed to submit outcome' }, { status: 500 })
  }

  // Update saved_jobs status based on outcome
  let newStatus: string | null = null
  if (outcome === 'interview') {
    newStatus = 'interviewing'
  } else if (outcome === 'offer' || outcome === 'hired') {
    newStatus = 'offer'
  } else if (outcome === 'rejected') {
    newStatus = 'rejected'
  }

  if (newStatus) {
    await supabase
      .from('saved_jobs')
      .update({ status: newStatus })
      .eq('id', saved_job_id)
      .eq('user_id', user.id)
  }

  // Mark any pending feedback prompts as responded
  await serviceClient
    .from('feedback_prompts')
    .update({ responded_at: new Date().toISOString() })
    .eq('saved_job_id', saved_job_id)
    .eq('user_id', user.id)
    .is('responded_at', null)

  return NextResponse.json(
    {
      success: true,
      outcome_id: outcomeRecord.id,
    },
    { status: 201 }
  )
}

/**
 * GET /api/feedback
 *
 * Get user's pending feedback prompts
 * Returns prompts where responded_at IS NULL and dismissed_at IS NULL
 */
export async function GET() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get pending feedback prompts with job details
  // Using the database function for efficient querying
  const { data: prompts, error: promptsError } = await supabase.rpc('get_pending_feedback_prompts', {
    p_user_id: user.id,
  })

  if (promptsError) {
    console.error('Error fetching feedback prompts:', promptsError)

    // Fallback to direct query if function doesn't exist
    const { data: fallbackPrompts, error: fallbackError } = await supabase
      .from('feedback_prompts')
      .select(
        `
        id,
        saved_job_id,
        prompt_type,
        prompted_at,
        delivery_method,
        saved_job:saved_jobs(
          id,
          applied_date,
          job:jobs(
            title,
            company
          )
        )
      `
      )
      .eq('user_id', user.id)
      .is('responded_at', null)
      .is('dismissed_at', null)
      .order('prompted_at', { ascending: false })

    if (fallbackError) {
      return NextResponse.json({ error: 'Failed to fetch feedback prompts' }, { status: 500 })
    }

    // Transform fallback data to match expected format
    const transformedPrompts = (fallbackPrompts || []).map((prompt) => {
      // Supabase returns relations as arrays
      const savedJobArray = prompt.saved_job as Array<{
        id: string
        applied_date: string | null
        job: Array<{ title: string; company: string }> | null
      }> | null
      const savedJob = savedJobArray?.[0] || null
      const job = savedJob?.job?.[0] || null

      const appliedDate = savedJob?.applied_date
        ? new Date(savedJob.applied_date)
        : null
      const daysSinceApply = appliedDate
        ? Math.floor((Date.now() - appliedDate.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        prompt_id: prompt.id,
        saved_job_id: prompt.saved_job_id,
        job_title: job?.title || 'Unknown',
        company: job?.company || 'Unknown',
        applied_at: savedJob?.applied_date || null,
        days_since_apply: daysSinceApply,
        prompt_type: prompt.prompt_type,
      }
    })

    return NextResponse.json({ prompts: transformedPrompts })
  }

  return NextResponse.json({ prompts: prompts || [] })
}
