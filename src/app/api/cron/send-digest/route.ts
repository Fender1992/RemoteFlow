import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/auth/cron-auth'
import { sendWeeklyDigest } from '@/lib/email/send'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const supabase = createServiceClient()
  const stats = {
    usersProcessed: 0,
    emailsSent: 0,
    errors: 0,
  }

  try {
    // Find users who have enabled weekly digest notifications
    const { data: users, error: usersError } = await supabase
      .from('users_profile')
      .select('id, name, email, preferences')
      .not('email', 'is', null)

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users to process',
        stats,
      })
    }

    // Get jobs from the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    for (const user of users) {
      try {
        // Check if user has digest enabled
        const prefs = user.preferences as Record<string, unknown> | null
        if (!prefs?.weekly_digest) continue

        stats.usersProcessed++

        // Fetch top quality jobs from last week, matching user preferences if available
        let query = supabase
          .from('jobs')
          .select('*')
          .eq('is_active', true)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('quality_score', { ascending: false })
          .limit(10)

        // Apply user preference filters if they have them
        const jobTypes = prefs.job_types as string[] | undefined
        if (jobTypes?.length) {
          query = query.in('job_type', jobTypes)
        }

        const { data: jobs, error: jobsError } = await query

        if (jobsError || !jobs || jobs.length === 0) continue

        await sendWeeklyDigest(user.email, user.name, jobs)
        stats.emailsSent++
      } catch (err) {
        console.error(`Failed to send digest to user ${user.id}:`, err)
        stats.errors++
      }
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('Weekly digest cron error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      },
      { status: 500 }
    )
  }
}
