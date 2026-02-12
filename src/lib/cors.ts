import { NextRequest } from 'next/server'

/**
 * Get the allowed CORS origin for extension/API requests.
 * Returns the origin if it's on the allowlist, otherwise null.
 */
export function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin')
  if (!origin) return null

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    // Chrome extension origins start with chrome-extension://
    ...(origin.startsWith('chrome-extension://') ? [origin] : []),
  ].filter(Boolean) as string[]

  if (allowedOrigins.includes(origin)) {
    return origin
  }

  // In development, allow localhost
  if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost')) {
    return origin
  }

  return null
}

/**
 * Build CORS headers for an allowed origin.
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}
