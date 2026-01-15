import type { SupabaseClient } from '@supabase/supabase-js'
import { analyzeCredibility } from './credibility'
import { detectGhostWithContext } from './ghost-detector'

/**
 * Verify if a recruiter is legitimate based on their email domain
 */
export async function verifyRecruiter(
  supabase: SupabaseClient,
  user_id: string,
  company_id: string
): Promise<{ success: boolean; message: string }> {
  // Get user email
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(user_id)
  if (userError || !user?.email) {
    return { success: false, message: 'User not found or email missing' }
  }

  // Get company website
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('website_url')
    .eq('id', company_id)
    .single()

  if (companyError || !company?.website_url) {
    return { success: false, message: 'Company website not found' }
  }

  // Extract domains
  const emailDomain = user.email.split('@')[1].toLowerCase()
  let companyDomain: string
  try {
    const url = new URL(company.website_url)
    companyDomain = url.hostname.replace('www.', '').toLowerCase()
  } catch {
    return { success: false, message: 'Invalid company website URL' }
  }

  // Check for common public email providers (gmail, outlook, etc.)
  const publicProviders = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com']
  if (publicProviders.includes(emailDomain)) {
    return { success: false, message: 'Public email providers cannot be used for recruiter verification' }
  }

  if (emailDomain === companyDomain) {
    // Update profile
    await supabase
      .from('users_profile')
      .update({
        is_verified_recruiter: true,
        recruiter_company_id: company_id,
        verification_data: {
          verified_at: new Date().toISOString(),
          method: 'email_domain_match',
          domain: emailDomain
        }
      })
      .eq('id', user_id)

    return { success: true, message: 'Recruiter verified successfully' }
  }

  return { success: false, message: `Email domain ${emailDomain} does not match company domain ${companyDomain}` }
}

/**
 * Perform a rigorous verification of a job listing
 */
export async function verifyJob(
  supabase: SupabaseClient,
  job_id: string
): Promise<{ isVerified: boolean; reason?: string }> {
  // Fetch job with company and recruiter context
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      company_id,
      companies (
        id,
        name,
        website_url,
        is_verified
      ),
      users_profile!inner (
        is_verified_recruiter
      )
    `)
    .eq('id', job_id)
    .single()

  if (error || !job) return { isVerified: false, reason: 'Job not found' }

  // 1. Check if posted by verified recruiter
  if (!job.users_profile?.is_verified_recruiter) {
    return { isVerified: false, reason: 'Not posted by a verified recruiter' }
  }

  // 2. Analyze credibility
  // We'll need to fetch company metrics - assuming a helper exists or calculating here
  // For now, using placeholders for the analysis call
  const metrics = await fetchCompanyMetrics(supabase, job.company_id)
  const credibility = analyzeCredibility(metrics)

  if (credibility.score < 0.8) {
    return { isVerified: false, reason: `Low company credibility score: ${credibility.grade}` }
  }

  // 3. Detect Ghost Job indicators
  const ghostResult = await detectGhostWithContext(supabase, job)
  if (ghostResult.ghostScore > 3) {
    return { isVerified: false, reason: 'Potential ghost job indicators detected' }
  }

  // Mark as verified if all checks pass
  await supabase
    .from('jobs')
    .update({ is_verified_job: true })
    .eq('id', job_id)

  return { isVerified: true }
}

async function fetchCompanyMetrics(supabase: SupabaseClient, company_id: string) {
  const { data } = await supabase
    .from('company_reputation')
    .select('*')
    .eq('company_id', company_id)
    .single()

  return data || {}
}

/**
 * Calculate the overall trust score for a user profile
 */
export async function calculateTrustScore(
  supabase: SupabaseClient,
  user_id: string
): Promise<{ score: number; breakdown: Record<string, number> }> {
  // Fetch profile and auth data
  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', user_id)
    .single()

  if (profileError || !profile) {
    return { score: 0, breakdown: {} }
  }

  const breakdown: Record<string, number> = {}
  let totalScore = 0

  // 1. Profile Completeness (Max 40)
  const completeness = profile.completeness_score || 0
  const profileWeight = (completeness / 100) * 40
  breakdown['profile_completeness'] = Math.round(profileWeight)
  totalScore += breakdown['profile_completeness']

  // 2. Email Verification (Max 20)
  // Check auth user status
  const { data: { user } } = await supabase.auth.admin.getUserById(user_id)
  if (user?.email_confirmed_at) {
    breakdown['email_verified'] = 20
    totalScore += 20
  }

  // 3. Social Connections (Max 30 - 15 per connection)
  // Assuming verification_data contains social connections for now
  const verData = profile.verification_data || {}
  if (verData.linkedin_connected) {
    breakdown['linkedin_connection'] = 15
    totalScore += 15
  }
  if (verData.github_connected) {
    breakdown['github_connection'] = 15
    totalScore += 15
  }

  // 4. Professional Status (Max 10)
  if (profile.is_verified_recruiter) {
    breakdown['professional_verification'] = 10
    totalScore += 10
  }

  // Update the trust_score in DB
  await supabase
    .from('users_profile')
    .update({ trust_score: totalScore })
    .eq('id', user_id)

  return { score: totalScore, breakdown }
}
