import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  // Key must be 32 bytes for AES-256. Accept hex-encoded (64 chars) or base64 (44 chars).
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  const buf = Buffer.from(key, 'base64')
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)')
  }
  return buf
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Concatenate: iv (32 hex) + authTag (32 hex) + ciphertext
  return iv.toString('hex') + authTag.toString('hex') + encrypted
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input is hex-encoded: iv + authTag + ciphertext
 */
export function decrypt(encryptedHex: string): string {
  const key = getEncryptionKey()

  const ivHex = encryptedHex.slice(0, IV_LENGTH * 2)
  const authTagHex = encryptedHex.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2)
  const ciphertext = encryptedHex.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2)

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Check if a value looks like it's already encrypted (hex string of proper length).
 * Used to handle migration: old plaintext keys vs new encrypted keys.
 */
export function isEncrypted(value: string): boolean {
  // Encrypted values are hex-encoded and at least iv + authTag long (64 hex chars minimum)
  const minLength = (IV_LENGTH + AUTH_TAG_LENGTH) * 2
  if (value.length < minLength) return false
  return /^[0-9a-f]+$/i.test(value)
}

/**
 * Safely decrypt a value that might be plaintext (migration support).
 * If ENCRYPTION_KEY is not set, returns the value as-is.
 * If the value doesn't look encrypted, returns it as-is.
 */
export function safeDecrypt(value: string): string {
  if (!process.env.ENCRYPTION_KEY) return value
  if (!isEncrypted(value)) return value
  try {
    return decrypt(value)
  } catch {
    // If decryption fails, it's likely a plaintext value
    return value
  }
}

/**
 * Encrypt a value only if ENCRYPTION_KEY is set.
 * Falls back to storing plaintext if key is not configured.
 */
export function safeEncrypt(value: string): string {
  if (!process.env.ENCRYPTION_KEY) return value
  return encrypt(value)
}
