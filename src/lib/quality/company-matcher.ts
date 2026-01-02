// Company matching and normalization
// Links jobs to canonical company records

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Company {
  id: string
  name: string
  name_normalized: string
  logo_url: string | null
  website: string | null
  employee_count: number | null
  is_verified: boolean
  is_blacklisted: boolean
}

export interface CompanyReputation {
  company_id: string
  reputation_score: number
  total_jobs_posted: number
  jobs_filled: number
  jobs_expired: number
  jobs_ghosted: number
  total_applications_tracked: number
  applications_with_response: number
  avg_days_to_close: number | null
  avg_reposts_per_job: number
}

/**
 * Normalize company name for matching
 * - Lowercase
 * - Remove common suffixes (Inc, LLC, Ltd, etc.)
 * - Remove punctuation
 * - Trim whitespace
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return ''

  return name
    .toLowerCase()
    .trim()
    // Remove common corporate suffixes
    .replace(
      /,?\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|co\.?|limited|incorporated|gmbh|ag|plc|s\.?a\.?|b\.?v\.?)$/i,
      ''
    )
    // Remove parenthetical content
    .replace(/\([^)]*\)/g, '')
    // Remove special characters
    .replace(/[^\w\s-]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Find or create a company record
 */
export async function findOrCreateCompany(
  supabase: SupabaseClient,
  name: string,
  logoUrl?: string | null
): Promise<Company | null> {
  const normalizedName = normalizeCompanyName(name)

  if (!normalizedName) return null

  // Try to find existing company
  const { data: existing } = await supabase
    .from('companies')
    .select('*')
    .eq('name_normalized', normalizedName)
    .single()

  if (existing) {
    // Update logo if we have one and they don't
    if (logoUrl && !existing.logo_url) {
      await supabase
        .from('companies')
        .update({ logo_url: logoUrl })
        .eq('id', existing.id)
      existing.logo_url = logoUrl
    }
    return existing as Company
  }

  // Create new company
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name: name.trim(),
      name_normalized: normalizedName,
      logo_url: logoUrl || null,
    })
    .select()
    .single()

  if (error) {
    // Handle race condition - company may have been created by another process
    if (error.code === '23505') {
      // unique_violation
      const { data: retried } = await supabase
        .from('companies')
        .select('*')
        .eq('name_normalized', normalizedName)
        .single()
      return retried as Company
    }
    console.error('Error creating company:', error)
    return null
  }

  return newCompany as Company
}

/**
 * Link a job to its company
 */
export async function linkJobToCompany(
  supabase: SupabaseClient,
  jobId: string,
  companyId: string
) {
  await supabase.from('jobs').update({ company_id: companyId }).eq('id', jobId)
}

/**
 * Get company reputation, returning default if not found
 */
export async function getCompanyReputation(
  supabase: SupabaseClient,
  companyId: string | null
): Promise<number> {
  if (!companyId) return 0.5 // Default reputation

  const { data } = await supabase
    .from('company_reputation')
    .select('reputation_score')
    .eq('company_id', companyId)
    .single()

  return data?.reputation_score ?? 0.5
}

/**
 * Update company job count statistics
 */
export async function incrementCompanyJobCount(
  supabase: SupabaseClient,
  companyId: string
) {
  // Use RPC or manual increment
  const { data: current } = await supabase
    .from('company_reputation')
    .select('total_jobs_posted')
    .eq('company_id', companyId)
    .single()

  if (current) {
    await supabase
      .from('company_reputation')
      .update({
        total_jobs_posted: (current.total_jobs_posted || 0) + 1,
        score_updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
  }
}

/**
 * Check if company is blacklisted
 */
export async function isCompanyBlacklisted(
  supabase: SupabaseClient,
  companyId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('companies')
    .select('is_blacklisted')
    .eq('id', companyId)
    .single()

  return data?.is_blacklisted ?? false
}

/**
 * Get full company with reputation data
 */
export async function getCompanyWithReputation(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ company: Company; reputation: CompanyReputation } | null> {
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (!company) return null

  const { data: reputation } = await supabase
    .from('company_reputation')
    .select('*')
    .eq('company_id', companyId)
    .single()

  return {
    company: company as Company,
    reputation: reputation as CompanyReputation,
  }
}

/**
 * Search companies by name
 */
export async function searchCompanies(
  supabase: SupabaseClient,
  query: string,
  limit = 10
): Promise<Company[]> {
  const { data } = await supabase
    .from('companies')
    .select('*')
    .ilike('name', `%${query}%`)
    .eq('is_blacklisted', false)
    .order('name')
    .limit(limit)

  return (data as Company[]) || []
}
