import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  sendChatRequest,
  validateApiKey,
  CacheGPTClientConfig,
} from '@/lib/cachegpt/client'
import { safeDecrypt } from '@/lib/crypto/encrypt'
import type { Job, JobChatContext, CompanyReputation } from '@/types'

export const dynamic = 'force-dynamic'

// Rate limits by tier
const RATE_LIMITS: Record<string, number> = {
  free: 10,
  pro: 50,
  max: 100,
  enterprise: 100,
}

/**
 * POST /api/jobs/[id]/chat
 * Send a chat message about a specific job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse request body
  const body = await request.json()
  const { message, history = [] } = body as {
    message: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json(
      { error: 'Message is required' },
      { status: 400 }
    )
  }

  // 3. Get user profile for tier and API key
  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('subscription_tier, cachegpt_api_key')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 }
    )
  }

  const tier = profile?.subscription_tier || 'free'
  const isMaxTier = tier === 'max' || tier === 'enterprise'

  // 4. Determine which API key to use
  let apiKey: string
  if (isMaxTier) {
    // Use platform key for max/enterprise
    apiKey = process.env.CACHEGPT_PLATFORM_API_KEY || ''
    if (!apiKey) {
      console.error('CACHEGPT_PLATFORM_API_KEY not configured')
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }
  } else {
    // Require user's own key for free/pro
    const rawKey = profile?.cachegpt_api_key || ''
    apiKey = rawKey ? safeDecrypt(rawKey) : ''
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'api_key_required',
          message:
            'Please add your CacheGPT API key in Settings to use job chat. Upgrade to Max tier for unlimited access with our platform key.',
        },
        { status: 403 }
      )
    }
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        {
          error: 'invalid_api_key',
          message: 'Your CacheGPT API key appears to be invalid. Please check your Settings.',
        },
        { status: 403 }
      )
    }
  }

  // 5. Check rate limits (per-job)
  const serviceClient = createServiceClient()
  const { data: limitCheck, error: limitError } = await serviceClient.rpc(
    'check_job_chat_limit',
    { p_user_id: user.id, p_job_id: jobId }
  )

  if (limitError) {
    console.error('Failed to check rate limit:', limitError)
    return NextResponse.json(
      { error: 'Failed to check rate limits' },
      { status: 500 }
    )
  }

  const limit = limitCheck?.[0]
  if (!limit?.allowed) {
    return NextResponse.json(
      {
        error: 'rate_limit_exceeded',
        message: `You've used all ${RATE_LIMITS[tier]} questions for this job. Try asking about other jobs!`,
        usage: {
          remaining: 0,
          limit: limit?.limit_value || RATE_LIMITS[tier],
        },
      },
      { status: 429 }
    )
  }

  // 6. Fetch job data with company info
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      *,
      company_data:companies(
        id,
        name,
        is_verified
      )
    `)
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // 7. Fetch company reputation if company exists
  let companyReputation: CompanyReputation | null = null
  if (job.company_id) {
    const { data: reputation } = await supabase
      .from('company_reputation')
      .select('*')
      .eq('company_id', job.company_id)
      .single()

    companyReputation = reputation
  }

  // 8. Build chat context
  const context: JobChatContext = {
    jobId: job.id,
    title: job.title,
    company: job.company,
    description: job.description,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    currency: job.currency || 'USD',
    job_type: job.job_type,
    experience_level: job.experience_level || 'any',
    tech_stack: job.tech_stack || [],
    posted_date: job.posted_date,
    ghost_score: job.ghost_score ?? 0,
    ghost_flags: job.ghost_flags || [],
    quality_score: job.quality_score ?? 0.5,
    health_score: job.health_score ?? 0.5,
    company_verified: job.company_data?.is_verified ?? false,
    company_reputation: companyReputation,
  }

  // 9. Build messages array with history
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: message.trim() },
  ]

  // 10. Call CacheGPT
  const config: CacheGPTClientConfig = { apiKey }
  const startTime = Date.now()

  try {
    const result = await sendChatRequest(config, context, messages)
    const responseTimeMs = Date.now() - startTime

    // 11. Increment usage counter (async, don't await)
    serviceClient
      .rpc('increment_job_chat_usage', {
        p_user_id: user.id,
        p_job_id: jobId,
        p_was_cached: result.cached,
      })
      .then(() => {
        // Also save to history for analytics
        serviceClient
          .from('job_chat_history')
          .insert({
            user_id: user.id,
            job_id: jobId,
            question: message.trim(),
            response: result.response,
            was_cached: result.cached,
            response_time_ms: responseTimeMs,
          })
          .then(() => {})
      })

    // 12. Return response
    return NextResponse.json({
      message: result.response,
      cached: result.cached,
      responseTimeMs,
      usage: {
        remaining: Math.max(0, (limit?.remaining || RATE_LIMITS[tier]) - (result.cached ? 0 : 1)),
        limit: limit?.limit_value || RATE_LIMITS[tier],
      },
    })
  } catch (error) {
    console.error('CacheGPT request failed:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Chat request failed'

    // Handle specific errors
    if (errorMessage.includes('rate limit')) {
      return NextResponse.json(
        { error: 'CacheGPT rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }
    if (errorMessage.includes('Invalid') && errorMessage.includes('key')) {
      return NextResponse.json(
        { error: 'Invalid CacheGPT API key. Please check your Settings.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * GET /api/jobs/[id]/chat
 * Get current usage limits for job chat (per-job)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user profile for tier
  const { data: profile } = await supabase
    .from('users_profile')
    .select('subscription_tier, cachegpt_api_key')
    .eq('id', user.id)
    .single()

  const tier = profile?.subscription_tier || 'free'
  const isMaxTier = tier === 'max' || tier === 'enterprise'
  const hasKey = isMaxTier || !!profile?.cachegpt_api_key

  // Check current usage for this specific job
  const serviceClient = createServiceClient()
  const { data: limitCheck, error: limitError } = await serviceClient.rpc(
    'check_job_chat_limit',
    { p_user_id: user.id, p_job_id: jobId }
  )

  if (limitError) {
    console.error('Failed to check rate limit:', limitError)
    return NextResponse.json(
      { error: 'Failed to check rate limits' },
      { status: 500 }
    )
  }

  const limit = limitCheck?.[0]

  return NextResponse.json({
    hasKey,
    needsKey: !isMaxTier && !profile?.cachegpt_api_key,
    tier,
    usage: {
      remaining: limit?.remaining ?? RATE_LIMITS[tier],
      limit: limit?.limit_value ?? RATE_LIMITS[tier],
    },
  })
}
