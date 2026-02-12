import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkJobExists } from '@/lib/lifecycle/check-job-exists'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 5000

interface SnapshotStats {
  jobs_checked: number
  removed_count: number
  reposted_count: number
  errors: number
}

interface RemovalReason {
  reason: 'filled' | 'expired' | 'unknown'
  confidence: number
}

/**
 * Determine why a job was likely removed based on signals
 */
async function determineRemovalReason(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
  daysActive: number | null
): Promise<RemovalReason> {
  // Check for user signals (got_hired, got_offer, interview)
  const { data: signals } = await supabase
    .from('job_signals')
    .select('signal_type')
    .eq('job_id', jobId)

  if (signals && signals.length > 0) {
    const signalTypes = signals.map(s => s.signal_type)

    // User reported getting hired or offer - high confidence it was filled
    if (signalTypes.includes('got_hired') || signalTypes.includes('got_offer')) {
      return { reason: 'filled', confidence: 0.95 }
    }

    // Interview signals suggest the job was actively being filled
    if (signalTypes.includes('interview') || signalTypes.includes('got_response')) {
      return { reason: 'filled', confidence: 0.80 }
    }
  }

  // Check if job had applications (saved jobs with 'applied' status)
  const { count: applicationCount } = await supabase
    .from('saved_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'applied')

  const days = daysActive || 0

  // Job was active 14-60 days with applications - likely filled
  if (days >= 14 && days <= 60 && applicationCount && applicationCount > 0) {
    return { reason: 'filled', confidence: 0.70 }
  }

  // Job was active for 90+ days - likely expired rather than filled
  if (days >= 90) {
    return { reason: 'expired', confidence: 0.60 }
  }

  // Can't determine reason
  return { reason: 'unknown', confidence: 0.50 }
}

/**
 * Process a batch of jobs
 */
async function processBatch(
  supabase: ReturnType<typeof createServiceClient>,
  jobs: Array<{
    id: string
    url: string
    source: string
    days_active: number | null
    lifecycle_status: string | null
  }>,
  today: string
): Promise<{ removed: number; reposted: number; errors: number }> {
  let removed = 0
  let reposted = 0
  let errors = 0

  for (const job of jobs) {
    try {
      // Check if job still exists on source platform
      // Returns: true (exists), false (removed), null (unknown/error)
      const existsResult = await checkJobExists(job.url, job.source)

      // If we can't determine status (null), skip this job to avoid false positives
      if (existsResult === null) {
        console.warn(`Could not determine status for job ${job.id}, skipping snapshot`)
        continue
      }

      const isActive = existsResult

      // Record snapshot
      const { error: snapshotError } = await supabase
        .from('job_snapshots')
        .upsert(
          {
            job_id: job.id,
            source: job.source,
            snapshot_date: today,
            is_active: isActive,
          },
          { onConflict: 'job_id,source,snapshot_date' }
        )

      if (snapshotError) {
        console.error(`Failed to record snapshot for job ${job.id}:`, snapshotError)
        errors++
        continue
      }

      // Check yesterday's snapshot to detect changes
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const { data: yesterdaySnapshot } = await supabase
        .from('job_snapshots')
        .select('is_active')
        .eq('job_id', job.id)
        .eq('snapshot_date', yesterdayStr)
        .single()

      // Detect removal: active yesterday, not active today
      if (yesterdaySnapshot?.is_active && !isActive) {
        const removalInfo = await determineRemovalReason(
          supabase,
          job.id,
          job.days_active
        )

        await supabase
          .from('jobs')
          .update({
            is_active: false,
            lifecycle_status: removalInfo.reason,
            removed_at: new Date().toISOString(),
            last_seen_at: yesterday.toISOString(),
          })
          .eq('id', job.id)

        removed++
        console.log(
          `Job ${job.id} removed - reason: ${removalInfo.reason} (${Math.round(removalInfo.confidence * 100)}% confidence)`
        )
      }

      // Detect repost: was inactive (removed), now active again
      if (
        !yesterdaySnapshot?.is_active &&
        isActive &&
        job.lifecycle_status &&
        ['filled', 'expired', 'unknown'].includes(job.lifecycle_status)
      ) {
        const { data: previousJob } = await supabase
          .from('jobs')
          .select('repost_count')
          .eq('id', job.id)
          .single()

        await supabase
          .from('jobs')
          .update({
            is_active: true,
            lifecycle_status: 'reposted',
            removed_at: null,
            last_seen_at: new Date().toISOString(),
            repost_count: (previousJob?.repost_count || 0) + 1,
          })
          .eq('id', job.id)

        reposted++
        console.log(`Job ${job.id} reposted`)
      }

      // Update last_seen_at for active jobs
      if (isActive && job.lifecycle_status === 'active') {
        await supabase
          .from('jobs')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', job.id)
      }
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error)
      errors++
    }
  }

  return { removed, reposted, errors }
}

/**
 * Update days_active for all jobs based on first_seen_at and last_seen_at
 */
async function updateDaysActive(
  supabase: ReturnType<typeof createServiceClient>
): Promise<number> {
  // Use a raw query to update all jobs at once
  const { data, error } = await supabase.rpc('update_jobs_days_active')

  if (error) {
    // If RPC doesn't exist, do it in batches
    console.log('RPC not available, updating days_active in batches...')

    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, first_seen_at, last_seen_at, is_active')
      .not('first_seen_at', 'is', null)

    if (!jobs) return 0

    let updated = 0
    for (const job of jobs) {
      const firstSeen = new Date(job.first_seen_at)
      const lastSeen = job.is_active
        ? new Date()
        : job.last_seen_at
          ? new Date(job.last_seen_at)
          : new Date()

      const daysActive = Math.floor(
        (lastSeen.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24)
      )

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ days_active: daysActive })
        .eq('id', job.id)

      if (!updateError) updated++
    }

    return updated
  }

  return data || 0
}

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startTime = Date.now()
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const stats: SnapshotStats = {
    jobs_checked: 0,
    removed_count: 0,
    reposted_count: 0,
    errors: 0,
  }

  try {
    console.log('=== Collecting Job Snapshots ===')
    console.log(`Date: ${today}`)

    // Get all active jobs (including recently removed that might be reposted)
    const { data: allJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('id, url, source, days_active, lifecycle_status')
      .or('is_active.eq.true,removed_at.gte.' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (fetchError) {
      throw new Error(`Failed to fetch jobs: ${fetchError.message}`)
    }

    if (!allJobs || allJobs.length === 0) {
      console.log('No jobs to process')
      return NextResponse.json({
        success: true,
        stats,
        message: 'No jobs to process',
      })
    }

    console.log(`Found ${allJobs.length} jobs to check`)

    // Process in batches
    for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
      const batch = allJobs.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(allJobs.length / BATCH_SIZE)

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} jobs)`)

      const batchResult = await processBatch(supabase, batch, today)

      stats.jobs_checked += batch.length
      stats.removed_count += batchResult.removed
      stats.reposted_count += batchResult.reposted
      stats.errors += batchResult.errors

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < allJobs.length) {
        console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    // Update days_active for all jobs
    console.log('=== Updating days_active ===')
    const daysActiveUpdated = await updateDaysActive(supabase)
    console.log(`Updated days_active for ${daysActiveUpdated} jobs`)

    // Mark evergreen jobs (active 90+ days or reposted 3+ times)
    const { error: evergreenError } = await supabase
      .from('jobs')
      .update({ is_evergreen: true })
      .or('days_active.gte.90,repost_count.gte.3')
      .eq('is_active', true)
      .eq('is_evergreen', false)

    if (evergreenError) {
      console.error('Failed to mark evergreen jobs:', evergreenError)
    }

    const durationMs = Date.now() - startTime

    console.log('=== Snapshot Collection Complete ===')
    console.log(`Duration: ${durationMs}ms`)
    console.log(`Jobs checked: ${stats.jobs_checked}`)
    console.log(`Removed: ${stats.removed_count}`)
    console.log(`Reposted: ${stats.reposted_count}`)
    console.log(`Errors: ${stats.errors}`)

    return NextResponse.json({
      success: true,
      stats,
      days_active_updated: daysActiveUpdated,
      duration_ms: durationMs,
    })
  } catch (error) {
    console.error('Snapshot collection error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      },
      { status: 500 }
    )
  }
}

