import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Check if user is admin
async function isAdmin(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .single()

  return !!data
}

// GET - Fetch review queue items
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') || 'pending'
  const entityType = searchParams.get('entity_type')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const serviceClient = createServiceClient()

  let query = serviceClient
    .from('review_queue')
    .select('*', { count: 'exact' })
    .eq('status', status)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  const { data: items, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich items with job/company data
  const enrichedItems = await Promise.all(
    (items || []).map(async (item) => {
      if (item.entity_type === 'job') {
        const { data: job } = await serviceClient
          .from('jobs')
          .select('id, title, company, url, ghost_score, quality_score')
          .eq('id', item.entity_id)
          .single()
        return { ...item, job }
      } else if (item.entity_type === 'company') {
        const { data: company } = await serviceClient
          .from('companies')
          .select('id, name, is_verified, is_blacklisted')
          .eq('id', item.entity_id)
          .single()
        return { ...item, company }
      }
      return item
    })
  )

  return NextResponse.json({
    items: enrichedItems,
    total: count,
    limit,
    offset,
  })
}

// PATCH - Take action on a review item
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    id: string
    action: 'approve' | 'remove' | 'blacklist' | 'dismiss'
    notes?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, action, notes } = body

  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Get the review item
  const { data: item, error: fetchError } = await serviceClient
    .from('review_queue')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Take action based on entity type
  if (item.entity_type === 'job') {
    switch (action) {
      case 'approve':
        // Mark as reviewed, keep job active
        break
      case 'remove':
        await serviceClient
          .from('jobs')
          .update({ is_active: false, status: 'closed_removed' })
          .eq('id', item.entity_id)
        break
      case 'dismiss':
        // Just dismiss the review item
        break
    }
  } else if (item.entity_type === 'company') {
    switch (action) {
      case 'approve':
        // Mark company as verified
        await serviceClient
          .from('companies')
          .update({ is_verified: true })
          .eq('id', item.entity_id)
        break
      case 'blacklist':
        await serviceClient
          .from('companies')
          .update({ is_blacklisted: true, blacklist_reason: notes || 'Manual review' })
          .eq('id', item.entity_id)
        // Also deactivate all jobs from this company
        await serviceClient
          .from('jobs')
          .update({ is_active: false, status: 'closed_removed' })
          .eq('company_id', item.entity_id)
        break
      case 'dismiss':
        // Just dismiss the review item
        break
    }
  }

  // Update the review item
  const { error: updateError } = await serviceClient
    .from('review_queue')
    .update({
      status: action === 'dismiss' ? 'dismissed' : 'reviewed',
      action_taken: action,
      reviewer_notes: notes || null,
      reviewed_at: now,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, action })
}
