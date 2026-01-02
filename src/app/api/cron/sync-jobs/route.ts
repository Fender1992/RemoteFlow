import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllRemotiveJobs } from '@/lib/ingestion/remotive'
import { normalizeRemotiveJobs } from '@/lib/ingestion/normalize'
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

  try {
    // Get source info for Remotive
    const { data: source, error: sourceError } = await supabase
      .from('job_sources')
      .select('id, name')
      .eq('name', 'remotive')
      .single()

    if (sourceError || !source) {
      throw new Error('Remotive source not found in database')
    }

    // Fetch jobs from Remotive
    console.log('Fetching jobs from Remotive...')
    const remotiveJobs = await fetchAllRemotiveJobs()
    console.log(`Fetched ${remotiveJobs.length} jobs from Remotive`)

    // Normalize jobs to our schema
    const normalizedJobs = normalizeRemotiveJobs(remotiveJobs)
    console.log(`Normalized ${normalizedJobs.length} jobs`)

    // Upsert jobs (deduplicate by URL)
    const { inserted, errors } = await dedupeAndUpsertJobs(supabase, normalizedJobs)
    console.log(`Upserted: ${inserted}, Errors: ${errors}`)

    // Mark old jobs as inactive (not fetched in last 7 days)
    const staleCount = await markStaleJobsInactive(supabase, 'remotive', 7)
    console.log(`Marked ${staleCount} stale jobs as inactive`)

    // Update last_synced timestamp
    await supabase
      .from('job_sources')
      .update({ last_synced: new Date().toISOString() })
      .eq('id', source.id)

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      stats: {
        fetched: remotiveJobs.length,
        processed: inserted,
        errors,
        staleMarked: staleCount,
        durationMs: duration,
      },
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
