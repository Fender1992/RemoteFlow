import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMatch, type UserProfile } from '@/lib/profile/job-matcher'
import type { Job } from '@/types'

export const dynamic = 'force-dynamic'

// Cache duration for match scores (1 day)
const CACHE_DURATION_HOURS = 24

/**
 * GET /api/jobs/[id]/match
 * Get match score for a specific job against user's profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check for cached score
  const { data: cachedScore } = await supabase
    .from('job_match_scores')
    .select('*')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .single()

  // If cached and recent, return it
  if (cachedScore) {
    const cacheAge =
      Date.now() - new Date(cachedScore.calculated_at).getTime()
    const cacheMaxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000

    if (cacheAge < cacheMaxAge) {
      return NextResponse.json({
        overallScore: cachedScore.overall_score,
        breakdown: {
          skills: cachedScore.skills_score,
          experience: cachedScore.experience_score,
          location: cachedScore.location_score,
          salary: cachedScore.salary_score,
        },
        suggestions: cachedScore.suggestions || [],
        cached: true,
      })
    }
  }

  // Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select(`
      skills,
      job_titles,
      years_experience,
      education_level,
      preferred_locations,
      salary_expectation_min,
      salary_expectation_max,
      completeness_score
    `)
    .eq('id', user.id)
    .single()

  if (profileError) {
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 }
    )
  }

  // Check if profile has enough data for matching
  if (!profile.skills?.length && !profile.job_titles?.length) {
    return NextResponse.json(
      {
        error: 'profile_incomplete',
        message: 'Please add skills or upload a resume to see match scores.',
        completenessScore: profile.completeness_score || 0,
      },
      { status: 400 }
    )
  }

  // Fetch job data
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Build user profile for matcher
  const userProfile: UserProfile = {
    skills: profile.skills || [],
    jobTitles: profile.job_titles || [],
    yearsExperience: profile.years_experience,
    educationLevel: profile.education_level,
    preferredLocations: profile.preferred_locations || [],
    salaryExpectationMin: profile.salary_expectation_min,
    salaryExpectationMax: profile.salary_expectation_max,
  }

  // Calculate match
  const matchResult = calculateMatch(userProfile, job as Job)

  // Cache the result
  const { error: cacheError } = await supabase
    .from('job_match_scores')
    .upsert({
      user_id: user.id,
      job_id: jobId,
      overall_score: matchResult.overallScore,
      skills_score: matchResult.breakdown.skills,
      experience_score: matchResult.breakdown.experience,
      location_score: matchResult.breakdown.location,
      salary_score: matchResult.breakdown.salary,
      suggestions: matchResult.suggestions,
      calculated_at: new Date().toISOString(),
    })

  if (cacheError) {
    console.error('Failed to cache match score:', cacheError)
    // Don't fail the request, just log
  }

  return NextResponse.json({
    overallScore: matchResult.overallScore,
    breakdown: matchResult.breakdown,
    suggestions: matchResult.suggestions,
    matchedSkills: matchResult.matchedSkills,
    missingSkills: matchResult.missingSkills,
    cached: false,
  })
}
