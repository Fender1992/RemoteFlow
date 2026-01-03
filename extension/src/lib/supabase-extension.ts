import { createClient, type Session, type User } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PROJECT_REF, JOBIQ_DOMAIN } from './constants'

/**
 * Get session from JobIQ cookies (session sharing)
 */
export async function getSessionFromCookies(): Promise<Session | null> {
  try {
    // Get all cookies from jobiq.careers domain
    const cookies = await chrome.cookies.getAll({
      domain: JOBIQ_DOMAIN,
    })

    // Supabase stores session in chunks: sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, etc.
    // Or as a single cookie: sb-<ref>-auth-token
    const authCookiePrefix = `sb-${SUPABASE_PROJECT_REF}-auth-token`
    const authCookies = cookies
      .filter((c) => c.name.startsWith(authCookiePrefix))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (authCookies.length === 0) {
      return null
    }

    // Reconstruct the session token from cookie chunks
    let sessionData: string
    if (authCookies.length === 1 && authCookies[0].name === authCookiePrefix) {
      // Single cookie
      sessionData = authCookies[0].value
    } else {
      // Chunked cookies
      sessionData = authCookies.map((c) => c.value).join('')
    }

    // Decode and parse
    const decoded = decodeURIComponent(sessionData)
    const session = JSON.parse(decoded) as Session

    // Validate the session is not expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      console.log('[JobIQ] Session expired')
      return null
    }

    return session
  } catch (error) {
    console.error('[JobIQ] Failed to get session from cookies:', error)
    return null
  }
}

/**
 * Validate session with Supabase API
 */
export async function validateSession(session: Session): Promise<User | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      console.log('[JobIQ] Session validation failed:', error?.message)
      return null
    }

    return data.user
  } catch (error) {
    console.error('[JobIQ] Session validation error:', error)
    return null
  }
}

/**
 * Create a Supabase client with the current session
 */
export function createExtensionClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Get current auth state
 */
export async function getAuthState(): Promise<{
  authenticated: boolean
  user: User | null
  session: Session | null
}> {
  const session = await getSessionFromCookies()

  if (!session) {
    return { authenticated: false, user: null, session: null }
  }

  const user = await validateSession(session)

  if (!user) {
    return { authenticated: false, user: null, session: null }
  }

  return { authenticated: true, user, session }
}
