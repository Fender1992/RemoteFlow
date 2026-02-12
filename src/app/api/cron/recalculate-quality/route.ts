import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  calculateHealthScore,
  calculateQualityScore,
  calculateFreshness,
  detectGhostIndicators,
  getCompanyReputation,
} from '@/lib/quality'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

interface RecalculationStats {
  totalJobsProcessed: number
  scoresUpdated: number
  jobsFlaggedForReview: number
  jobsMarkedExpired: number
  errors: number
  durationMs: number
}

/**
 * Cron job to recalculate quality scores for all active jobs daily
 *
 * Runs the following operations:
 * 1. Recalculates health_score, quality_score, and ghost_score for all active jobs
 * 2. Auto-flags jobs with ghost_score >= 5 for review
 * 3. Marks jobs older than 90 days as status='closed_expired'
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startTime = Date.now()
  const supabase = createServiceClient()

  const stats: RecalculationStats = {
    totalJobsProcessed: 0,
    scoresUpdated: 0,
    jobsFlaggedForReview: 0,
    jobsMarkedExpired: 0,
    errors: 0,
    durationMs: 0,
  }

  try {
    // Get all active jobs
    console.log('=== Fetching active jobs ===')
    const { data: activeJobs, error: fetchError } = await supabase
      .from('jobs')
      .select(`
        id,
        company_id,
        posted_date,
        repost_count,
        salary_min,
        salary_max,
        description,
        url,
        status
      `)
      .eq('is_active', true)

    if (fetchError) {
      throw new Error(`Failed to fetch jobs: ${fetchError.message}`)
    }

    if (!activeJobs || activeJobs.length === 0) {
      console.log('No active jobs found')
      return NextResponse.json({
        success: true,
        message: 'No active jobs to process',
        stats,
      })
    }

    console.log(`Processing ${activeJobs.length} active jobs`)
    stats.totalJobsProcessed = activeJobs.length

    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    // Process jobs in batches to avoid timeout
    const BATCH_SIZE = 50
    const jobsToUpdate: Array<{
      id: string
      health_score: number
      quality_score: number
      ghost_score: number
      ghost_flags: string[]
      quality_updated_at: string
    }> = []
    const jobsToExpire: string[] = []
    const jobsToFlag: Array<{
      job_id: string
      reason: string
      ghost_score: number
    }> = []

    // Cache company reputation lookups to avoid repeated queries for the same company
    const companyRepCache = new Map<string, Awaited<ReturnType<typeof getCompanyReputation>>>()

    for (const job of activeJobs) {
      try {
        // Check if job should be marked as expired (older than 90 days)
        if (job.posted_date) {
          const postedDate = new Date(job.posted_date)
          if (postedDate < ninetyDaysAgo && job.status !== 'closed_expired') {
            jobsToExpire.push(job.id)
          }
        }

        // Get company reputation (cached)
        let companyRep = companyRepCache.get(job.company_id)
        if (companyRep === undefined) {
          companyRep = await getCompanyReputation(supabase, job.company_id)
          companyRepCache.set(job.company_id, companyRep)
        }

        // Calculate health score
        const { healthScore } = calculateHealthScore(
          {
            posted_date: job.posted_date,
            repost_count: job.repost_count || 1,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            description: job.description,
            url: job.url,
          },
          companyRep
        )

        // Detect ghost indicators
        const { ghostScore, ghostFlags } = detectGhostIndicators({
          posted_date: job.posted_date,
          repost_count: job.repost_count || 1,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          description: job.description,
          url: job.url,
        })

        // Calculate final quality score
        const freshness = calculateFreshness(job.posted_date)
        const qualityScore = calculateQualityScore(healthScore, freshness, companyRep, ghostScore)

        // Queue update
        jobsToUpdate.push({
          id: job.id,
          health_score: healthScore,
          quality_score: qualityScore,
          ghost_score: ghostScore,
          ghost_flags: ghostFlags,
          quality_updated_at: now.toISOString(),
        })

        // Flag jobs with high ghost score for review
        if (ghostScore >= 5) {
          jobsToFlag.push({
            job_id: job.id,
            reason: `High ghost score (${ghostScore}): ${ghostFlags.join(', ')}`,
            ghost_score: ghostScore,
          })
        }
      } catch (err) {
        console.error(`Error processing job ${job.id}:`, err)
        stats.errors++
      }
    }

    // Batch update jobs with new scores using Promise.all for parallelism
    console.log(`=== Updating ${jobsToUpdate.length} job scores ===`)
    for (let i = 0; i < jobsToUpdate.length; i += BATCH_SIZE) {
      const batch = jobsToUpdate.slice(i, i + BATCH_SIZE)

      const results = await Promise.all(
        batch.map((update) =>
          supabase
            .from('jobs')
            .update({
              health_score: update.health_score,
              quality_score: update.quality_score,
              ghost_score: update.ghost_score,
              ghost_flags: update.ghost_flags,
              quality_updated_at: update.quality_updated_at,
            })
            .eq('id', update.id)
        )
      )

      for (let j = 0; j < results.length; j++) {
        if (results[j].error) {
          console.error(`Error updating job ${batch[j].id}:`, results[j].error)
          stats.errors++
        } else {
          stats.scoresUpdated++
        }
      }
    }

    // Mark expired jobs
    if (jobsToExpire.length > 0) {
      console.log(`=== Marking ${jobsToExpire.length} jobs as expired ===`)
      const { error: expireError } = await supabase
        .from('jobs')
        .update({
          status: 'closed_expired',
          is_active: false,
          updated_at: now.toISOString(),
        })
        .in('id', jobsToExpire)

      if (expireError) {
        console.error('Error marking jobs expired:', expireError)
        stats.errors++
      } else {
        stats.jobsMarkedExpired = jobsToExpire.length
      }
    }

    // Add flagged jobs to review queue
    if (jobsToFlag.length > 0) {
      console.log(`=== Flagging ${jobsToFlag.length} jobs for review ===`)

      for (const flag of jobsToFlag) {
        const { error: insertError } = await supabase
          .from('review_queue')
          .insert({
            job_id: flag.job_id,
            reason: flag.reason,
            type: 'ghost_job',
            priority: flag.ghost_score >= 7 ? 'high' : 'medium',
            status: 'pending',
            created_at: now.toISOString(),
          })

        if (insertError) {
          // Ignore duplicate key errors
          if (insertError.code !== '23505') {
            console.error(`Error flagging job ${flag.job_id}:`, insertError)
            stats.errors++
          }
        } else {
          stats.jobsFlaggedForReview++
        }
      }
    }

    stats.durationMs = Date.now() - startTime

    console.log('=== Quality recalculation complete ===')
    console.log(`Processed: ${stats.totalJobsProcessed}`)
    console.log(`Updated: ${stats.scoresUpdated}`)
    console.log(`Flagged: ${stats.jobsFlaggedForReview}`)
    console.log(`Expired: ${stats.jobsMarkedExpired}`)
    console.log(`Errors: ${stats.errors}`)
    console.log(`Duration: ${stats.durationMs}ms`)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Quality recalculation error:', error)
    stats.durationMs = Date.now() - startTime

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

