// Repost detection for jobs
// Identifies when a job is a repost of a previous listing

import type { SupabaseClient } from '@supabase/supabase-js'
import { hashDescription, normalizeDescription } from './description-analyzer'

export interface RepostResult {
  isRepost: boolean
  canonicalJobId: string | null
  instanceNumber: number
  matchType: 'exact' | 'fuzzy' | 'content' | null
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy title matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate title similarity (0-100%)
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const t1 = title1.toLowerCase().trim()
  const t2 = title2.toLowerCase().trim()

  if (t1 === t2) return 100

  const maxLen = Math.max(t1.length, t2.length)
  if (maxLen === 0) return 100

  const distance = levenshteinDistance(t1, t2)
  return Math.round((1 - distance / maxLen) * 100)
}

/**
 * Normalize company name for matching
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/,?\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|limited|incorporated)$/i, '')
    .replace(/[^\w\s]/g, '')
    .trim()
}

/**
 * Detect if a job is a repost of an existing job
 *
 * Checks in order:
 * 1. Exact match: same company + title + source (URL deduplication already handles this)
 * 2. Fuzzy match: same company + title similarity >85%
 * 3. Content match: same company + description hash match
 */
export async function detectRepost(
  supabase: SupabaseClient,
  job: {
    company: string
    title: string
    description: string | null
    url: string
    source: string
  }
): Promise<RepostResult> {
  const normalizedCompany = normalizeCompanyName(job.company)
  const descHash = hashDescription(job.description || '')

  // Check for existing jobs from this company
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('id, title, description_hash, repost_count, posted_date')
    .ilike('company', `%${normalizedCompany}%`)
    .eq('is_active', true)
    .neq('url', job.url) // Exclude same URL
    .order('posted_date', { ascending: false })
    .limit(50)

  if (!existingJobs || existingJobs.length === 0) {
    return {
      isRepost: false,
      canonicalJobId: null,
      instanceNumber: 1,
      matchType: null,
    }
  }

  // Check for fuzzy title match
  for (const existing of existingJobs) {
    const similarity = calculateTitleSimilarity(job.title, existing.title)

    if (similarity >= 85) {
      // Found a fuzzy match
      const newInstanceNumber = (existing.repost_count || 1) + 1
      return {
        isRepost: true,
        canonicalJobId: existing.id,
        instanceNumber: newInstanceNumber,
        matchType: similarity === 100 ? 'exact' : 'fuzzy',
      }
    }
  }

  // Check for content hash match (same description, different title)
  for (const existing of existingJobs) {
    if (existing.description_hash && existing.description_hash === descHash) {
      const newInstanceNumber = (existing.repost_count || 1) + 1
      return {
        isRepost: true,
        canonicalJobId: existing.id,
        instanceNumber: newInstanceNumber,
        matchType: 'content',
      }
    }
  }

  return {
    isRepost: false,
    canonicalJobId: null,
    instanceNumber: 1,
    matchType: null,
  }
}

/**
 * Record job lineage for repost tracking
 */
export async function recordJobLineage(
  supabase: SupabaseClient,
  jobId: string,
  canonicalJobId: string | null,
  instanceNumber: number,
  closeReason?: string
) {
  await supabase.from('job_lineage').upsert(
    {
      job_id: jobId,
      canonical_job_id: canonicalJobId || jobId,
      instance_number: instanceNumber,
      posted_at: new Date().toISOString(),
      close_reason: closeReason || null,
    },
    { onConflict: 'job_id' }
  )
}

/**
 * Update repost count on the canonical job
 */
export async function updateRepostCount(
  supabase: SupabaseClient,
  canonicalJobId: string,
  newCount: number
) {
  await supabase.from('jobs').update({ repost_count: newCount }).eq('id', canonicalJobId)
}
