import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateApiKey } from '@/lib/cachegpt/client'

export const dynamic = 'force-dynamic'

const CACHEGPT_API_URL = 'https://cachegpt.app'

interface CacheGPTUserInfo {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
  preferred_username?: string
  auth_method?: string
}

/**
 * POST /api/auth/cachegpt
 * Authenticate user with their CacheGPT API key
 *
 * This endpoint:
 * 1. Validates the CacheGPT API key against CacheGPT's API
 * 2. Gets user info from CacheGPT
 * 3. Creates or links a RemoteFlow account
 * 4. Stores the API key for future chat requests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { api_key } = body as { api_key: string }

    if (!api_key) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Validate API key format
    if (!validateApiKey(api_key)) {
      return NextResponse.json(
        { error: 'Invalid API key format. CacheGPT keys start with cgpt_sk_' },
        { status: 400 }
      )
    }

    // Verify the API key with CacheGPT's /api/me endpoint
    const cacheGptResponse = await fetch(`${CACHEGPT_API_URL}/api/me`, {
      method: 'GET',
      headers: {
        'x-api-key': api_key,
      },
    })

    if (!cacheGptResponse.ok) {
      if (cacheGptResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid or expired CacheGPT API key' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to verify CacheGPT credentials' },
        { status: 502 }
      )
    }

    const cacheGptUser: CacheGPTUserInfo = await cacheGptResponse.json()

    if (!cacheGptUser.email) {
      return NextResponse.json(
        { error: 'CacheGPT account does not have an email address' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const serviceClient = createServiceClient()

    // Check if user is already authenticated with RemoteFlow
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (currentUser) {
      // User is already logged in - just link their CacheGPT API key
      const { error: updateError } = await supabase
        .from('users_profile')
        .update({
          cachegpt_api_key: api_key,
          cachegpt_user_id: cacheGptUser.sub,
        })
        .eq('id', currentUser.id)

      if (updateError) {
        console.error('Failed to update profile:', updateError)
        return NextResponse.json(
          { error: 'Failed to link CacheGPT account' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'CacheGPT account linked successfully',
        user: {
          id: currentUser.id,
          email: currentUser.email,
          cachegpt_linked: true,
        },
      })
    }

    // User is not logged in - check if they have an existing account
    const { data: existingProfile } = await serviceClient
      .from('users_profile')
      .select('id, cachegpt_user_id')
      .or(`cachegpt_user_id.eq.${cacheGptUser.sub}`)
      .single()

    if (existingProfile) {
      // User has previously authenticated with this CacheGPT account
      // Update their API key and create a magic link session
      await serviceClient
        .from('users_profile')
        .update({ cachegpt_api_key: api_key })
        .eq('id', existingProfile.id)

      // Generate a magic link for the user
      const { data: magicLinkData, error: magicLinkError } =
        await serviceClient.auth.admin.generateLink({
          type: 'magiclink',
          email: cacheGptUser.email,
        })

      if (magicLinkError) {
        console.error('Failed to generate magic link:', magicLinkError)
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'CacheGPT authentication successful',
        action: 'verify_email',
        email: cacheGptUser.email,
        verification_url: magicLinkData.properties?.action_link,
      })
    }

    // New user - check if email exists in Supabase auth
    const { data: authUsers } = await serviceClient.auth.admin.listUsers()
    const existingAuthUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === cacheGptUser.email.toLowerCase()
    )

    if (existingAuthUser) {
      // Email exists but not linked to CacheGPT - link it
      await serviceClient
        .from('users_profile')
        .update({
          cachegpt_api_key: api_key,
          cachegpt_user_id: cacheGptUser.sub,
        })
        .eq('id', existingAuthUser.id)

      // Generate magic link
      const { data: magicLinkData, error: magicLinkError } =
        await serviceClient.auth.admin.generateLink({
          type: 'magiclink',
          email: cacheGptUser.email,
        })

      if (magicLinkError) {
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Existing account linked to CacheGPT',
        action: 'verify_email',
        email: cacheGptUser.email,
        verification_url: magicLinkData.properties?.action_link,
      })
    }

    // Completely new user - create account
    const { data: newUser, error: createError } =
      await serviceClient.auth.admin.createUser({
        email: cacheGptUser.email,
        email_confirm: cacheGptUser.email_verified ?? false,
        user_metadata: {
          name: cacheGptUser.name,
          avatar_url: cacheGptUser.picture,
          cachegpt_user_id: cacheGptUser.sub,
        },
      })

    if (createError) {
      console.error('Failed to create user:', createError)
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      )
    }

    // Create user profile with CacheGPT info
    const { error: profileError } = await serviceClient
      .from('users_profile')
      .insert({
        id: newUser.user.id,
        email: cacheGptUser.email,
        name: cacheGptUser.name || cacheGptUser.preferred_username,
        cachegpt_api_key: api_key,
        cachegpt_user_id: cacheGptUser.sub,
        subscription_tier: 'free',
        preferences: {},
      })

    if (profileError) {
      console.error('Failed to create profile:', profileError)
      // User was created but profile failed - still continue
    }

    // Generate magic link for new user
    const { data: magicLinkData, error: magicLinkError } =
      await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email: cacheGptUser.email,
      })

    if (magicLinkError) {
      return NextResponse.json(
        { error: 'Account created but failed to generate login link' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      action: 'verify_email',
      email: cacheGptUser.email,
      verification_url: magicLinkData.properties?.action_link,
      is_new_user: true,
    })
  } catch (error) {
    console.error('CacheGPT auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/cachegpt
 * Check if current user has CacheGPT linked
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ linked: false, authenticated: false })
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('cachegpt_api_key, cachegpt_user_id')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    authenticated: true,
    linked: !!profile?.cachegpt_api_key,
    cachegpt_user_id: profile?.cachegpt_user_id || null,
  })
}

/**
 * DELETE /api/auth/cachegpt
 * Unlink CacheGPT from current user
 */
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
    .update({
      cachegpt_api_key: null,
      cachegpt_user_id: null,
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to unlink CacheGPT account' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'CacheGPT account unlinked',
  })
}
