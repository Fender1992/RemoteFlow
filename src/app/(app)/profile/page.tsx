import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './profile-client'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users_profile')
    .select(`
      id,
      email,
      name,
      subscription_tier,
      resume_text,
      resume_filename,
      resume_uploaded_at,
      skills,
      job_titles,
      years_experience,
      education_level,
      preferred_locations,
      salary_expectation_min,
      salary_expectation_max,
      completeness_score,
      cachegpt_api_key
    `)
    .single()

  return (
    <ProfileClient
      initialProfile={{
        name: profile?.name || '',
        email: profile?.email || '',
        subscriptionTier: profile?.subscription_tier || 'free',
        resumeFilename: profile?.resume_filename || null,
        resumeUploadedAt: profile?.resume_uploaded_at || null,
        skills: profile?.skills || [],
        jobTitles: profile?.job_titles || [],
        yearsExperience: profile?.years_experience || null,
        educationLevel: profile?.education_level || null,
        preferredLocations: profile?.preferred_locations || [],
        salaryExpectationMin: profile?.salary_expectation_min || null,
        salaryExpectationMax: profile?.salary_expectation_max || null,
        completenessScore: profile?.completeness_score || 0,
        hasApiKey: !!profile?.cachegpt_api_key,
      }}
    />
  )
}
