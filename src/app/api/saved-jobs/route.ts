import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: savedJobs, error } = await supabase
    .from('saved_jobs')
    .select(`
      *,
      job:jobs(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(savedJobs)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { job_id, status = 'saved', notes } = await request.json()

  if (!job_id) {
    return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
  }

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', job_id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('saved_jobs')
    .insert({
      user_id: user.id,
      job_id,
      status,
      notes,
    })
    .select(`
      *,
      job:jobs(*)
    `)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Job already saved' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
