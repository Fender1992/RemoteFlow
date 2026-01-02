import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllRemotiveJobs } from '@/lib/ingestion/remotive'
import { normalizeRemotiveJobs } from '@/lib/ingestion/normalize'
import { fetchAllJobicyJobs, normalizeJobicyJobs } from '@/lib/ingestion/jobicy'
import { dedupeAndUpsertJobs, markStaleJobsInactive } from '@/lib/ingestion/dedupe'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

export async function POST(request: NextRequest) {
  // Verify cron secret (for Vercel Cron or manual triggers)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createServiceClient()

  const stats = {
    remotive: { fetched: 0, processed: 0, errors: 0 },
    jobicy: { fetched: 0, processed: 0, errors: 0 },
    staleMarked: 0,
    durationMs: 0,
  }

  try {
    // Sync Remotive
    console.log('Fetching jobs from Remotive...')
    try {
      const remotiveJobs = await fetchAllRemotiveJobs()
      stats.remotive.fetched = remotiveJobs.length
      console.log(`Fetched ${remotiveJobs.length} jobs from Remotive`)

      const normalizedRemotive = normalizeRemotiveJobs(remotiveJobs)
      const remotiveResult = await dedupeAndUpsertJobs(supabase, normalizedRemotive)
      stats.remotive.processed = remotiveResult.inserted
      stats.remotive.errors = remotiveResult.errors

      await supabase
        .from('job_sources')
        .update({ last_synced: new Date().toISOString() })
        .eq('name', 'remotive')
    } catch (err) {
      console.error('Remotive sync failed:', err)
    }

    // Sync Jobicy
    console.log('Fetching jobs from Jobicy...')
    try {
      const jobicyJobs = await fetchAllJobicyJobs()
      stats.jobicy.fetched = jobicyJobs.length
      console.log(`Fetched ${jobicyJobs.length} jobs from Jobicy`)

      const normalizedJobicy = normalizeJobicyJobs(jobicyJobs)
      const jobicyResult = await dedupeAndUpsertJobs(supabase, normalizedJobicy)
      stats.jobicy.processed = jobicyResult.inserted
      stats.jobicy.errors = jobicyResult.errors

      // Ensure jobicy source exists
      await supabase
        .from('job_sources')
        .upsert({
          name: 'jobicy',
          api_endpoint: 'https://jobicy.com/api/v2/remote-jobs',
          is_active: true,
          last_synced: new Date().toISOString(),
        }, { onConflict: 'name' })
    } catch (err) {
      console.error('Jobicy sync failed:', err)
    }

    // Mark stale jobs
    const staleRemotive = await markStaleJobsInactive(supabase, 'remotive', 7)
    const staleJobicy = await markStaleJobsInactive(supabase, 'jobicy', 7)
    stats.staleMarked = staleRemotive + staleJobicy

    stats.durationMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Allow GET for manual testing (not for production cron)
export async function GET(request: NextRequest) {
  return POST(request)
}
