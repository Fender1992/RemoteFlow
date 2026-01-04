import { createHmac, randomBytes } from 'crypto'

/**
 * Token payload structure
 */
interface FeedbackTokenPayload {
  savedJobId: string
  userId: string
  iat: number // issued at timestamp
  exp: number // expiration timestamp
}

/**
 * Token expiration time (7 days in seconds)
 */
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60

/**
 * Get the secret key for signing tokens
 */
function getSecret(): string {
  const secret = process.env.FEEDBACK_TOKEN_SECRET || process.env.CRON_SECRET
  if (!secret) {
    throw new Error('FEEDBACK_TOKEN_SECRET or CRON_SECRET must be set')
  }
  return secret
}

/**
 * Encode data to base64url (URL-safe base64)
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Decode base64url to string
 */
function base64UrlDecode(data: string): string {
  // Add back padding if needed
  let padded = data.replace(/-/g, '+').replace(/_/g, '/')
  const padding = padded.length % 4
  if (padding) {
    padded += '='.repeat(4 - padding)
  }
  return Buffer.from(padded, 'base64').toString('utf8')
}

/**
 * Create HMAC signature for the payload
 */
function createSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)
  return base64UrlEncode(hmac.digest('hex'))
}

/**
 * Create a signed JWT-like token for one-click feedback from emails
 *
 * Token format: base64url(payload).signature
 *
 * @param savedJobId - The ID of the saved job
 * @param userId - The ID of the user
 * @returns A signed token string
 */
export function createFeedbackToken(savedJobId: string, userId: string): string {
  const secret = getSecret()

  const now = Math.floor(Date.now() / 1000)
  const payload: FeedbackTokenPayload = {
    savedJobId,
    userId,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  }

  const payloadString = base64UrlEncode(JSON.stringify(payload))
  const signature = createSignature(payloadString, secret)

  return `${payloadString}.${signature}`
}

/**
 * Verify and decode a feedback token
 *
 * @param token - The token to verify
 * @returns The decoded payload if valid, null if invalid or expired
 */
export function verifyFeedbackToken(token: string): { savedJobId: string; userId: string } | null {
  try {
    const secret = getSecret()

    const parts = token.split('.')
    if (parts.length !== 2) {
      return null
    }

    const [payloadString, signature] = parts

    // Verify signature
    const expectedSignature = createSignature(payloadString, secret)
    if (signature !== expectedSignature) {
      return null
    }

    // Decode and parse payload
    const payloadJson = base64UrlDecode(payloadString)
    const payload: FeedbackTokenPayload = JSON.parse(payloadJson)

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return null
    }

    // Validate required fields
    if (!payload.savedJobId || !payload.userId) {
      return null
    }

    return {
      savedJobId: payload.savedJobId,
      userId: payload.userId,
    }
  } catch {
    return null
  }
}

/**
 * Generate a random token for feedback links (alternative to JWT for simpler cases)
 *
 * @returns A random 32-character hex string
 */
export function generateFeedbackLinkToken(): string {
  return randomBytes(16).toString('hex')
}
