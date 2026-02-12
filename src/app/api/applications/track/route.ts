import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeJobUrl, type AtsType } from '@/lib/tracking'
import { getAllowedOrigin, corsHeaders } from '@/lib/cors'

// Event types
type TrackingEventType = 'started' | 'submitted' | 'abandoned'
type DetectionMethod =
  | 'form_submit'
  | 'success_page'
  | 'success_text'
  | 'url_change'
  | 'ajax_intercept'
  | 'button_click'
  | 'manual'

interface TrackEventRequest {
  jobId?: string
  url?: string
  event: TrackingEventType
  atsType?: AtsType
  detectionMethod?: DetectionMethod
  timeSpentSeconds?: number
  metadata?: Record<string, unknown>
}

interface TrackEventResponse {
  success: boolean
  event_id?: string
  matched_job_id?: string | null
  matched_saved_job_id?: string | null
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<TrackEventResponse>> {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  let body: TrackEventRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event, url, jobId, atsType, detectionMethod, timeSpentSeconds, metadata } = body

  // Validate event type
  const validEvents: TrackingEventType[] = ['started', 'submitted', 'abandoned']
  if (!event || !validEvents.includes(event)) {
    return NextResponse.json({ success: false, error: 'Invalid event type' }, { status: 400 })
  }

  // Must have either jobId or url
  if (!jobId && !url) {
    return NextResponse.json(
      { success: false, error: 'Either jobId or url is required' },
      { status: 400 }
    )
  }

  let matchedJobId: string | null = jobId || null
  let matchedSavedJobId: string | null = null
  let normalizedUrl: string | null = null

  // If we have a URL, try to match it to a saved job
  if (url) {
    const urlInfo = normalizeJobUrl(url)
    normalizedUrl = urlInfo.normalized

    // Look up job by normalized URL
    const { data: urlLookup } = await supabase
      .from('job_url_lookup')
      .select('job_id')
      .eq('normalized_url', urlInfo.normalized)
      .single()

    if (urlLookup) {
      matchedJobId = urlLookup.job_id
    } else if (urlInfo.domain) {
      // Try domain + partial path match
      const { data: domainMatches } = await supabase
        .from('job_url_lookup')
        .select('job_id, normalized_url')
        .eq('domain', urlInfo.domain)
        .limit(20)

      for (const match of domainMatches || []) {
        if (
          urlInfo.normalized.includes(match.normalized_url) ||
          match.normalized_url.includes(urlInfo.normalized)
        ) {
          matchedJobId = match.job_id
          break
        }
      }
    }
  }

  // Find user's saved job for this job_id
  if (matchedJobId) {
    const { data: savedJob } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_id', user.id)
      .eq('job_id', matchedJobId)
      .single()

    if (savedJob) {
      matchedSavedJobId = savedJob.id
    }
  }

  // Insert tracking event
  const { data: trackingEvent, error: insertError } = await supabase
    .from('application_tracking_events')
    .insert({
      user_id: user.id,
      job_id: matchedJobId,
      saved_job_id: matchedSavedJobId,
      event_type: event,
      ats_type: atsType || null,
      detection_method: detectionMethod || null,
      time_spent_seconds: timeSpentSeconds || null,
      source_url: url || null,
      normalized_url: normalizedUrl,
      metadata: metadata || {},
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Tracking event insert error:', insertError)
    return NextResponse.json({ success: false, error: 'Failed to track event' }, { status: 500 })
  }

  // If this is a 'submitted' event, update the saved_job status
  if (event === 'submitted' && matchedSavedJobId) {
    await supabase
      .from('saved_jobs')
      .update({
        status: 'applied',
        applied_via: atsType || null,
        applied_date: new Date().toISOString(),
      })
      .eq('id', matchedSavedJobId)
  }

  // If this is a 'started' event, record when tracking started
  if (event === 'started' && matchedSavedJobId) {
    await supabase
      .from('saved_jobs')
      .update({
        tracking_started_at: new Date().toISOString(),
      })
      .eq('id', matchedSavedJobId)
      .is('tracking_started_at', null) // Only update if not already set
  }

  return NextResponse.json({
    success: true,
    event_id: trackingEvent.id,
    matched_job_id: matchedJobId,
    matched_saved_job_id: matchedSavedJobId,
  })
}

// Allow OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = getAllowedOrigin(request)
  if (!origin) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  })
}
