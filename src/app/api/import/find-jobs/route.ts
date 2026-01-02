import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimits, incrementRateLimits } from '@/lib/import/rate-limiter'
import { triggerWorker } from '@/lib/import/worker/trigger'
import type { UserPreferencesExtended, ImportSearchParams, ImportSiteId } from '@/types'

export const dynamic = 'force-dynamic'

const DEFAULT_SITES: ImportSiteId[] = ['linkedin', 'indeed', 'glassdoor', 'dice', 'wellfound']

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user profile to check subscription tier and preferences
  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('preferences, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }

  const preferences = profile?.preferences as UserPreferencesExtended | null
  const isPremium = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'enterprise'

  // 3. Validate required search preferences
  if (!preferences?.search_roles?.length) {
    return NextResponse.json(
      {
        error: 'preferences_required',
        message: 'Please configure search roles in your preferences before importing jobs.',
      },
      { status: 400 }
    )
  }

  // 4. Check rate limits
  const serviceClient = createServiceClient()
  const rateLimitResult = await checkRateLimits(serviceClient, user.id, isPremium)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'rate_limit_exceeded',
        message: `Import limit reached. ${rateLimitResult.reason === 'hourly_limit' ? 'Hourly' : 'Daily'} limit exceeded.`,
        limits: {
          remainingHourly: rateLimitResult.remainingHourly,
          remainingDaily: rateLimitResult.remainingDaily,
        },
        reset_at: rateLimitResult.resetAt,
      },
      { status: 429 }
    )
  }

  // 5. Build search parameters from preferences
  const searchParams: ImportSearchParams = {
    roles: preferences.search_roles,
    location: preferences.location_preference || 'remote',
    cities: preferences.preferred_cities || [],
    salary: preferences.salary_range,
    sites: preferences.enabled_sites?.length ? preferences.enabled_sites : DEFAULT_SITES,
  }

  // 6. Create import session
  const { data: session, error: sessionError } = await serviceClient
    .from('import_sessions')
    .insert({
      user_id: user.id,
      status: 'pending',
      search_params: searchParams,
    })
    .select()
    .single()

  if (sessionError || !session) {
    console.error('Failed to create import session:', sessionError)
    return NextResponse.json({ error: 'Failed to create import session' }, { status: 500 })
  }

  // 7. Create site result records for each enabled site
  const siteResults = searchParams.sites.map((siteId) => ({
    session_id: session.id,
    site_id: siteId,
    status: 'pending' as const,
  }))

  const { error: siteResultsError } = await serviceClient
    .from('import_site_results')
    .insert(siteResults)

  if (siteResultsError) {
    console.error('Failed to create site results:', siteResultsError)
    // Don't fail the whole request, but log it
  }

  // 8. Trigger external worker
  const triggerResult = await triggerWorker(session.id)

  if (!triggerResult.success) {
    // Update session status to indicate worker trigger failed
    await serviceClient
      .from('import_sessions')
      .update({
        status: 'failed',
        error_message: `Failed to start import: ${triggerResult.message}`,
      })
      .eq('id', session.id)

    return NextResponse.json(
      {
        error: 'worker_trigger_failed',
        message: triggerResult.message,
        session_id: session.id,
      },
      { status: 500 }
    )
  }

  // 9. Increment rate limit counters
  await incrementRateLimits(serviceClient, user.id)

  // 10. Return session ID for polling
  return NextResponse.json({
    session_id: session.id,
    status: 'pending',
    message: `Import started. Searching ${searchParams.sites.length} sites for "${searchParams.roles.join(', ')}" roles.`,
    sites: searchParams.sites,
    poll_url: `/api/import/sessions/${session.id}`,
  })
}
