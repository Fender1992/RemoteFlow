import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max

type PromptType = 'followup_7d' | 'followup_14d' | 'followup_30d'

interface PromptRange {
  type: PromptType
  minDays: number
  maxDays: number
}

// Define the prompt windows (inclusive ranges)
const PROMPT_RANGES: PromptRange[] = [
  { type: 'followup_7d', minDays: 7, maxDays: 10 },
  { type: 'followup_14d', minDays: 14, maxDays: 17 },
  { type: 'followup_30d', minDays: 30, maxDays: 33 },
]

interface SavedJobCandidate {
  id: string
  user_id: string
  applied_date: string
}

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startTime = Date.now()
  const supabase = createServiceClient()

  const stats = {
    prompts_created: 0,
    users_notified: new Set<string>(),
    by_prompt_type: {
      followup_7d: 0,
      followup_14d: 0,
      followup_30d: 0,
    } as Record<PromptType, number>,
    errors: 0,
  }

  try {
    const now = new Date()

    // Process each prompt type
    for (const range of PROMPT_RANGES) {
      console.log(`=== Processing ${range.type} (${range.minDays}-${range.maxDays} days) ===`)

      // Calculate the date range for this prompt type
      const minDate = new Date(now)
      minDate.setDate(minDate.getDate() - range.maxDays)
      minDate.setHours(0, 0, 0, 0)

      const maxDate = new Date(now)
      maxDate.setDate(maxDate.getDate() - range.minDays)
      maxDate.setHours(23, 59, 59, 999)

      // Find saved_jobs that:
      // 1. status = 'applied'
      // 2. applied_date is within the range for this prompt type
      // 3. No existing application_outcome for this saved_job
      // 4. No existing unanswered feedback_prompt for this saved_job at this prompt_type
      const { data: candidates, error: fetchError } = await supabase
        .from('saved_jobs')
        .select('id, user_id, applied_date')
        .eq('status', 'applied')
        .not('applied_date', 'is', null)
        .gte('applied_date', minDate.toISOString())
        .lte('applied_date', maxDate.toISOString())

      if (fetchError) {
        console.error(`Error fetching candidates for ${range.type}:`, fetchError)
        stats.errors++
        continue
      }

      if (!candidates || candidates.length === 0) {
        console.log(`No candidates found for ${range.type}`)
        continue
      }

      console.log(`Found ${candidates.length} potential candidates for ${range.type}`)

      // Filter out candidates that already have an application_outcome
      const savedJobIds = candidates.map((c) => c.id)

      const { data: existingOutcomes, error: outcomesError } = await supabase
        .from('application_outcomes')
        .select('saved_job_id')
        .in('saved_job_id', savedJobIds)

      if (outcomesError) {
        console.error(`Error fetching existing outcomes:`, outcomesError)
        stats.errors++
        continue
      }

      const outcomeJobIds = new Set(existingOutcomes?.map((o) => o.saved_job_id) || [])

      // Filter out candidates that already have an unanswered prompt for this type
      const { data: existingPrompts, error: promptsError } = await supabase
        .from('feedback_prompts')
        .select('saved_job_id')
        .in('saved_job_id', savedJobIds)
        .eq('prompt_type', range.type)
        .is('responded_at', null)
        .is('dismissed_at', null)

      if (promptsError) {
        console.error(`Error fetching existing prompts:`, promptsError)
        stats.errors++
        continue
      }

      const existingPromptJobIds = new Set(existingPrompts?.map((p) => p.saved_job_id) || [])

      // Filter candidates
      const eligibleCandidates = (candidates as SavedJobCandidate[]).filter(
        (c) => !outcomeJobIds.has(c.id) && !existingPromptJobIds.has(c.id)
      )

      console.log(`${eligibleCandidates.length} eligible after filtering for ${range.type}`)

      if (eligibleCandidates.length === 0) {
        continue
      }

      // Create feedback_prompts for eligible candidates
      const promptsToInsert = eligibleCandidates.map((candidate) => ({
        user_id: candidate.user_id,
        saved_job_id: candidate.id,
        prompt_type: range.type,
        delivery_method: 'in_app',
        prompted_at: now.toISOString(),
      }))

      const { data: insertedPrompts, error: insertError } = await supabase
        .from('feedback_prompts')
        .insert(promptsToInsert)
        .select('id, user_id')

      if (insertError) {
        console.error(`Error inserting prompts for ${range.type}:`, insertError)
        stats.errors++
        continue
      }

      const inserted = insertedPrompts?.length || 0
      stats.prompts_created += inserted
      stats.by_prompt_type[range.type] = inserted

      // Track unique users
      insertedPrompts?.forEach((p) => {
        stats.users_notified.add(p.user_id)
      })

      console.log(`Created ${inserted} prompts for ${range.type}`)
    }

    const durationMs = Date.now() - startTime

    console.log(`=== Feedback prompts cron complete in ${durationMs}ms ===`)
    console.log(`Total prompts created: ${stats.prompts_created}`)
    console.log(`Unique users notified: ${stats.users_notified.size}`)

    return NextResponse.json({
      success: true,
      stats: {
        prompts_created: stats.prompts_created,
        users_notified: stats.users_notified.size,
        by_prompt_type: stats.by_prompt_type,
        errors: stats.errors,
        durationMs,
      },
    })
  } catch (error) {
    console.error('Feedback prompts cron error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: {
          prompts_created: stats.prompts_created,
          users_notified: stats.users_notified.size,
          by_prompt_type: stats.by_prompt_type,
          errors: stats.errors,
        },
      },
      { status: 500 }
    )
  }
}

