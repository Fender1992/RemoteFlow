import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseResume, calculateParseCompleteness } from '@/lib/profile/resume-parser'

export const dynamic = 'force-dynamic'

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * POST /api/profile/resume
 * Upload and parse a resume file
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's API key for parsing
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

  // Determine API key
  const tier = profile?.subscription_tier || 'free'
  const isMaxTier = tier === 'max' || tier === 'enterprise'

  let apiKey: string
  if (isMaxTier) {
    apiKey = process.env.CACHEGPT_PLATFORM_API_KEY || ''
    if (!apiKey) {
      console.error('CACHEGPT_PLATFORM_API_KEY not configured')
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }
  } else {
    apiKey = profile?.cachegpt_api_key || ''
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'api_key_required',
          message: 'Please add your CacheGPT API key in Settings to parse resumes.',
        },
        { status: 403 }
      )
    }
  }

  // Parse form data
  const formData = await request.formData()
  const file = formData.get('resume') as File | null
  const text = formData.get('text') as string | null

  let resumeText: string
  let filename: string

  if (file) {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    filename = file.name

    // Get file extension
    const ext = filename.split('.').pop()?.toLowerCase()

    if (ext === 'txt') {
      resumeText = await file.text()
    } else if (ext === 'pdf') {
      // For PDF files, we'd need a PDF parser library
      // For now, return an error suggesting text paste
      return NextResponse.json(
        {
          error: 'pdf_not_supported',
          message: 'PDF parsing requires additional setup. Please paste your resume text directly.',
        },
        { status: 400 }
      )
    } else if (ext === 'docx' || ext === 'doc') {
      // For DOCX files, we'd need a DOCX parser library
      return NextResponse.json(
        {
          error: 'docx_not_supported',
          message: 'DOCX parsing requires additional setup. Please paste your resume text directly.',
        },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a TXT file or paste text.' },
        { status: 400 }
      )
    }
  } else if (text) {
    resumeText = text
    filename = 'pasted_resume.txt'
  } else {
    return NextResponse.json(
      { error: 'No resume file or text provided' },
      { status: 400 }
    )
  }

  // Validate text length
  if (resumeText.trim().length < 100) {
    return NextResponse.json(
      { error: 'Resume text is too short. Please provide more content.' },
      { status: 400 }
    )
  }

  try {
    // Parse the resume using AI
    const parsed = await parseResume({ apiKey }, resumeText)
    const completenessFromParse = calculateParseCompleteness(parsed)

    // Update the user's profile with parsed data
    const { error: updateError } = await supabase
      .from('users_profile')
      .update({
        resume_text: resumeText.slice(0, 50000), // Limit stored text
        resume_filename: filename,
        resume_uploaded_at: new Date().toISOString(),
        skills: parsed.skills,
        job_titles: parsed.jobTitles,
        years_experience: parsed.yearsExperience,
        education_level: parsed.educationLevel,
        preferred_locations: parsed.locations,
        salary_expectation_min: parsed.salaryRange?.min || null,
        salary_expectation_max: parsed.salaryRange?.max || null,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update profile with resume:', updateError)
      return NextResponse.json(
        { error: 'Failed to save resume data' },
        { status: 500 }
      )
    }

    // Fetch updated profile
    const { data: updatedProfile } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      parsed: {
        skills: parsed.skills,
        jobTitles: parsed.jobTitles,
        yearsExperience: parsed.yearsExperience,
        educationLevel: parsed.educationLevel,
        locations: parsed.locations,
        salaryRange: parsed.salaryRange,
        summary: parsed.summary,
      },
      completenessScore: completenessFromParse,
      profile: updatedProfile,
    })
  } catch (error) {
    console.error('Resume parsing failed:', error)

    const message =
      error instanceof Error ? error.message : 'Failed to parse resume'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
