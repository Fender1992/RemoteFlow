import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updates = await request.json()
  const { status, notes, applied_date } = updates

  // Validate status
  const validStatuses = ['saved', 'applied', 'rejected', 'offer']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (notes !== undefined) updateData.notes = notes
  if (applied_date !== undefined) updateData.applied_date = applied_date

  const { data, error } = await supabase
    .from('saved_jobs')
    .update(updateData)
    .eq('job_id', job_id)
    .eq('user_id', user.id)
    .select(`
      *,
      job:jobs(*)
    `)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Saved job not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('job_id', job_id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
