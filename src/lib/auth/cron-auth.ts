import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify cron job authentication (fail-closed).
 *
 * Rejects requests when CRON_SECRET is unset.
 * Accepts either:
 *   - Authorization: Bearer <CRON_SECRET>
 *   - x-vercel-cron: 1  (set by Vercel's cron scheduler)
 *
 * @returns null if authorized, or a 401 NextResponse to return early
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  // Fail-closed: reject if secret is not configured
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 401 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const vercelCronHeader = request.headers.get('x-vercel-cron')

  if (authHeader === `Bearer ${cronSecret}`) {
    return null // authorized
  }

  if (vercelCronHeader === '1') {
    return null // authorized via Vercel cron
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
