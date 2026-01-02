/**
 * CacheGPT Client for Job Chat
 *
 * Handles communication with CacheGPT API for job analysis chat.
 * Uses context-aware caching to provide instant responses for repeated questions.
 */

import type { JobChatContext, CompanyReputation } from '@/types'

const CACHEGPT_ENDPOINT =
  process.env.CACHEGPT_API_URL || 'https://cachegpt.app/api/v2/unified-chat'

export interface CacheGPTClientConfig {
  apiKey: string
}

export interface CacheGPTResponse {
  response: string
  cached: boolean
  metadata?: {
    responseTime?: number
    similarity?: number
    contextHash?: string
  }
}

/**
 * Generate a stable hash for job context to enable caching.
 * The hash changes when important job metrics change, invalidating stale cached responses.
 */
export function generateContextHash(context: JobChatContext): string {
  // Include fields that would change the answer if updated
  const hashInput = [
    context.jobId,
    context.ghost_score,
    Math.round((context.quality_score ?? 0.5) * 100),
    Math.round((context.health_score ?? 0.5) * 100),
    context.company_verified ? 'verified' : 'unverified',
    context.company_reputation?.reputation_score
      ? Math.round(context.company_reputation.reputation_score * 100)
      : 'none',
  ].join('|')

  // Simple hash function
  let hash = 0
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return `job_${context.jobId}_${Math.abs(hash).toString(36)}`
}

/**
 * Format salary range for display
 */
function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string
): string {
  if (!min && !max) return 'Not disclosed'
  if (min && max)
    return `${currency} ${min.toLocaleString()} - ${max.toLocaleString()}`
  if (min) return `${currency} ${min.toLocaleString()}+`
  return `Up to ${currency} ${max!.toLocaleString()}`
}

/**
 * Format ghost flags for readability
 */
function formatGhostFlags(flags: string[]): string {
  if (flags.length === 0) return 'None detected'

  const flagDescriptions: Record<string, string> = {
    open_90_days: 'Open for 90+ days',
    reposted_4_plus: 'Reposted 4+ times',
    too_many_openings: 'Excessive open positions',
    multi_location: 'Same role in many locations',
    no_salary_competitive: '"Competitive salary" without details',
    short_description: 'Very short job description',
    generic_apply: 'Generic application process',
  }

  return flags.map((f) => flagDescriptions[f] || f).join(', ')
}

/**
 * Build the system prompt with comprehensive job context
 */
export function buildSystemPrompt(context: JobChatContext): string {
  const reputation = context.company_reputation

  let companySection = ''
  if (reputation) {
    const responseRate =
      reputation.total_applications_tracked > 0
        ? Math.round(
            (reputation.applications_with_response /
              reputation.total_applications_tracked) *
              100
          )
        : null

    companySection = `
Company Reputation:
- Reputation Score: ${Math.round(reputation.reputation_score * 100)}%
- Total Jobs Posted: ${reputation.total_jobs_posted}
- Jobs Filled: ${reputation.jobs_filled}
- Jobs Expired/Ghosted: ${reputation.jobs_expired + reputation.jobs_ghosted}
- Response Rate: ${responseRate !== null ? `${responseRate}%` : 'Unknown'}
- Average Days to Close: ${reputation.avg_days_to_close ?? 'Unknown'}
`
  }

  return `You are a helpful job search assistant analyzing a specific job listing. Your role is to help job seekers make informed decisions about whether to apply.

## Job Details
- Title: ${context.title}
- Company: ${context.company}
- Type: ${context.job_type || 'Not specified'}
- Experience Level: ${context.experience_level}
- Salary: ${formatSalaryRange(context.salary_min, context.salary_max, context.currency)}
- Tech Stack: ${context.tech_stack.length > 0 ? context.tech_stack.join(', ') : 'Not specified'}
- Posted: ${context.posted_date || 'Unknown'}

## Quality Metrics
- Quality Score: ${Math.round((context.quality_score ?? 0.5) * 100)}%
- Health Score: ${Math.round((context.health_score ?? 0.5) * 100)}%
- Ghost Score: ${context.ghost_score}/10 ${context.ghost_score >= 5 ? '(HIGH - potential ghost job)' : context.ghost_score >= 3 ? '(MEDIUM)' : '(LOW)'}
- Ghost Indicators: ${formatGhostFlags(context.ghost_flags)}
- Company Verified: ${context.company_verified ? 'Yes' : 'No'}
${companySection}
## Job Description
${context.description || 'No description available'}

## Your Guidelines
1. Be direct and honest about red flags - users appreciate candor
2. If ghost_score >= 5, explain the concerns clearly
3. Reference specific metrics when analyzing the job
4. Keep responses concise but informative (2-3 paragraphs max)
5. If data is missing, acknowledge it rather than guessing
6. Offer actionable advice when appropriate`
}

/**
 * Send a chat request to CacheGPT
 */
export async function sendChatRequest(
  config: CacheGPTClientConfig,
  context: JobChatContext,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<CacheGPTResponse> {
  const contextHash = generateContextHash(context)
  const systemPrompt = buildSystemPrompt(context)

  const requestBody = {
    messages: messages,
    systemPrompt: systemPrompt,
    contextHash: contextHash,
    contextData: {
      jobId: context.jobId,
      title: context.title,
      company: context.company,
      ghostScore: context.ghost_score,
      qualityScore: context.quality_score,
      healthScore: context.health_score,
      companyVerified: context.company_verified,
    },
    contextType: 'job',
    maxTokens: 1000,
    temperature: 0.3,
  }

  const response = await fetch(CACHEGPT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))

    if (response.status === 429) {
      throw new Error('CacheGPT rate limit exceeded. Please try again later.')
    }
    if (response.status === 401) {
      throw new Error('Invalid CacheGPT API key.')
    }

    throw new Error(
      errorData.error ||
        errorData.message ||
        `CacheGPT request failed: ${response.status}`
    )
  }

  const data = await response.json()

  return {
    response: data.response || data.content || data.message,
    cached: data.cached === true || data.metadata?.cached === true,
    metadata: {
      responseTime: data.metadata?.responseTime,
      similarity: data.metadata?.similarity,
      contextHash: contextHash,
    },
  }
}

/**
 * Validate CacheGPT API key format
 */
export function validateApiKey(apiKey: string): boolean {
  return apiKey.startsWith('cgpt_sk_') && apiKey.length > 20
}
