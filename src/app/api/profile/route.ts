import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/profile
 * Get current user's profile data
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
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
      preferences
    `)
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Failed to fetch profile:', profileError)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }

  return NextResponse.json(profile)
}

/**
 * PUT /api/profile
 * Update user's profile data
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Only allow updating specific fields
  const allowedFields = [
    'name',
    'skills',
    'job_titles',
    'years_experience',
    'education_level',
    'preferred_locations',
    'salary_expectation_min',
    'salary_expectation_max',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  const { data: profile, error: updateError } = await supabase
    .from('users_profile')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    console.error('Failed to update profile:', updateError)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }

  return NextResponse.json(profile)
}
