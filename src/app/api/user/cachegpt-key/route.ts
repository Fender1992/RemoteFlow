import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Get user's CacheGPT API key status (not the actual key for security)
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('users_profile')
    .select('cachegpt_api_key, subscription_tier')
    .eq('id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tier = profile?.subscription_tier || 'free'
  const hasKey = !!profile?.cachegpt_api_key
  const needsKey = tier !== 'max' && tier !== 'enterprise'

  return NextResponse.json({
    hasKey,
    needsKey,
    tier,
    // Show masked key if exists
    maskedKey: hasKey ? maskApiKey(profile.cachegpt_api_key!) : null,
  })
}

// Set or update the CacheGPT API key
export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { api_key } = await request.json()

  // Validate API key format (CacheGPT keys start with cgpt_sk_)
  if (api_key && !api_key.startsWith('cgpt_sk_')) {
    return NextResponse.json(
      { error: 'Invalid API key format. CacheGPT API keys start with cgpt_sk_' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('users_profile')
    .update({ cachegpt_api_key: api_key || null })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    hasKey: !!api_key,
    maskedKey: api_key ? maskApiKey(api_key) : null,
  })
}

// Delete the CacheGPT API key
export async function DELETE() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('users_profile')
    .update({ cachegpt_api_key: null })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, hasKey: false })
}

function maskApiKey(key: string): string {
  if (key.length <= 16) return '***'
  return key.slice(0, 12) + '...' + key.slice(-4)
}
