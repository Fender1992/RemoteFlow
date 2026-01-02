import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllRemotiveJobs } from '@/lib/ingestion/remotive'
import { normalizeRemotiveJobs } from '@/lib/ingestion/normalize'
import { fetchAllJobicyJobs, normalizeJobicyJobs } from '@/lib/ingestion/jobicy'
import { fetchRemoteOKJobs, normalizeRemoteOKJobs } from '@/lib/ingestion/remoteok'
import { fetchAllHimalayasJobs, normalizeHimalayasJobs } from '@/lib/ingestion/himalayas'
import { fetchWWRJobs, normalizeWWRJobs } from '@/lib/ingestion/weworkremotely'
import { dedupeAndUpsertJobs, markStaleJobsInactive } from '@/lib/ingestion/dedupe'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

interface SourceStats {
  fetched: number
  processed: number
  qualityCalculated: number
  errors: number
}

export async function POST(request: NextRequest) {
  // Verify cron secret (for Vercel Cron or manual triggers)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Also allow Vercel's cron header
  const vercelCronHeader = request.headers.get('x-vercel-cron')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createServiceClient()

  const stats: Record<string, SourceStats> = {
    remotive: { fetched: 0, processed: 0, qualityCalculated: 0, errors: 0 },
    jobicy: { fetched: 0, processed: 0, qualityCalculated: 0, errors: 0 },
    remoteok: { fetched: 0, processed: 0, qualityCalculated: 0, errors: 0 },
    himalayas: { fetched: 0, processed: 0, qualityCalculated: 0, errors: 0 },
    weworkremotely: { fetched: 0, processed: 0, qualityCalculated: 0, errors: 0 },
  }

  let totalStaleMarked = 0

  try {
    // 1. Sync Remotive
    console.log('=== Syncing Remotive ===')
    try {
      const remotiveJobs = await fetchAllRemotiveJobs()
      stats.remotive.fetched = remotiveJobs.length

      const normalizedRemotive = normalizeRemotiveJobs(remotiveJobs)
      const remotiveResult = await dedupeAndUpsertJobs(supabase, normalizedRemotive)
      stats.remotive.processed = remotiveResult.inserted
      stats.remotive.qualityCalculated = remotiveResult.qualityCalculated
      stats.remotive.errors = remotiveResult.errors

      await supabase
        .from('job_sources')
        .upsert({
          name: 'remotive',
          api_endpoint: 'https://remotive.com/api/remote-jobs',
          is_active: true,
          last_synced: new Date().toISOString(),
        }, { onConflict: 'name' })

      console.log(`Remotive: ${stats.remotive.processed} jobs synced`)
    } catch (err) {
      console.error('Remotive sync failed:', err)
    }

    // 2. Sync Jobicy
    console.log('=== Syncing Jobicy ===')
    try {
      const jobicyJobs = await fetchAllJobicyJobs()
      stats.jobicy.fetched = jobicyJobs.length

      const normalizedJobicy = normalizeJobicyJobs(jobicyJobs)
      const jobicyResult = await dedupeAndUpsertJobs(supabase, normalizedJobicy)
      stats.jobicy.processed = jobicyResult.inserted
      stats.jobicy.qualityCalculated = jobicyResult.qualityCalculated
      stats.jobicy.errors = jobicyResult.errors

      await supabase
        .from('job_sources')
        .upsert({
          name: 'jobicy',
          api_endpoint: 'https://jobicy.com/api/v2/remote-jobs',
          is_active: true,
          last_synced: new Date().toISOString(),
        }, { onConflict: 'name' })

      console.log(`Jobicy: ${stats.jobicy.processed} jobs synced`)
    } catch (err) {
      console.error('Jobicy sync failed:', err)
    }

    // 3. Sync Remote OK
    console.log('=== Syncing Remote OK ===')
    try {
      const remoteOKJobs = await fetchRemoteOKJobs()
      stats.remoteok.fetched = remoteOKJobs.length

      const normalizedRemoteOK = normalizeRemoteOKJobs(remoteOKJobs)
      const remoteOKResult = await dedupeAndUpsertJobs(supabase, normalizedRemoteOK)
      stats.remoteok.processed = remoteOKResult.inserted
      stats.remoteok.qualityCalculated = remoteOKResult.qualityCalculated
      stats.remoteok.errors = remoteOKResult.errors

      await supabase
        .from('job_sources')
        .upsert({
          name: 'remoteok',
          api_endpoint: 'https://remoteok.com/api',
          is_active: true,
          last_synced: new Date().toISOString(),
        }, { onConflict: 'name' })

      console.log(`Remote OK: ${stats.remoteok.processed} jobs synced`)
    } catch (err) {
      console.error('Remote OK sync failed:', err)
    }

    // 4. Sync Himalayas
    console.log('=== Syncing Himalayas ===')
    try {
      const himalayasJobs = await fetchAllHimalayasJobs(300) // Limit to 300 jobs
      stats.himalayas.fetched = himalayasJobs.length

      const normalizedHimalayas = normalizeHimalayasJobs(himalayasJobs)
      const himalayasResult = await dedupeAndUpsertJobs(supabase, normalizedHimalayas)
      stats.himalayas.processed = himalayasResult.inserted
      stats.himalayas.qualityCalculated = himalayasResult.qualityCalculated
      stats.himalayas.errors = himalayasResult.errors

      await supabase
        .from('job_sources')
        .upsert({
          name: 'himalayas',
          api_endpoint: 'https://himalayas.app/jobs/api',
          is_active: true,
          last_synced: new Date().toISOString(),
        }, { onConflict: 'name' })

      console.log(`Himalayas: ${stats.himalayas.processed} jobs synced`)
    } catch (err) {
      console.error('Himalayas sync failed:', err)
    }

    // 5. Sync We Work Remotely
    console.log('=== Syncing We Work Remotely ===')
    try {
      const wwrJobs = await fetchWWRJobs()
      stats.weworkremotely.fetched = wwrJobs.length

      const normalizedWWR = normalizeWWRJobs(wwrJobs)
      const wwrResult = await dedupeAndUpsertJobs(supabase, normalizedWWR)
      stats.weworkremotely.processed = wwrResult.inserted
      stats.weworkremotely.qualityCalculated = wwrResult.qualityCalculated
      stats.weworkremotely.errors = wwrResult.errors

      await supabase
        .from('job_sources')
        .upsert({
          name: 'weworkremotely',
          api_endpoint: 'https://weworkremotely.com/remote-jobs.rss',
          is_active: true,
          last_synced: new Date().toISOString(),
        }, { onConflict: 'name' })

      console.log(`We Work Remotely: ${stats.weworkremotely.processed} jobs synced`)
    } catch (err) {
      console.error('We Work Remotely sync failed:', err)
    }

    // Mark stale jobs for all sources
    console.log('=== Marking stale jobs ===')
    for (const source of Object.keys(stats)) {
      try {
        const staleCount = await markStaleJobsInactive(supabase, source, 7)
        totalStaleMarked += staleCount
      } catch (err) {
        console.error(`Failed to mark stale jobs for ${source}:`, err)
      }
    }

    const durationMs = Date.now() - startTime

    // Get total job count
    const { count } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    console.log(`=== Sync complete in ${durationMs}ms ===`)
    console.log(`Total active jobs: ${count}`)

    return NextResponse.json({
      success: true,
      stats,
      summary: {
        totalFetched: Object.values(stats).reduce((sum, s) => sum + s.fetched, 0),
        totalProcessed: Object.values(stats).reduce((sum, s) => sum + s.processed, 0),
        totalQualityCalculated: Object.values(stats).reduce((sum, s) => sum + s.qualityCalculated, 0),
        totalErrors: Object.values(stats).reduce((sum, s) => sum + s.errors, 0),
        staleMarked: totalStaleMarked,
        activeJobs: count,
        durationMs,
      },
    })
  } catch (error) {
    console.error('Sync error:', error)
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

// Allow GET for manual testing (not for production cron)
export async function GET(request: NextRequest) {
  return POST(request)
}
