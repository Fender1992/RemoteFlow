import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserPreferences } from '@/types'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('users_profile')
    .select('preferences')
    .eq('id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(profile?.preferences || {})
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const preferences: UserPreferences = await request.json()

  // Basic validation
  const validJobTypes = ['full_time', 'part_time', 'contract', 'freelance', 'internship']
  const validExperienceLevels = ['any', 'junior', 'mid', 'senior', 'lead']

  if (preferences.job_types?.some(t => !validJobTypes.includes(t))) {
    return NextResponse.json({ error: 'Invalid job type' }, { status: 400 })
  }

  if (preferences.experience_levels?.some(l => !validExperienceLevels.includes(l))) {
    return NextResponse.json({ error: 'Invalid experience level' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users_profile')
    .update({ preferences })
    .eq('id', user.id)
    .select('preferences')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data?.preferences)
}
