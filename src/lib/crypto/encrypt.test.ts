import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { encrypt, decrypt, isEncrypted, safeDecrypt, safeEncrypt } from './encrypt'

// 32-byte key in hex (64 chars)
const TEST_KEY = 'a'.repeat(64)

describe('encrypt / decrypt', () => {
  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trips a plaintext string', () => {
    const plaintext = 'sk-test-api-key-12345'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    const plaintext = 'same-key'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
    // Both should decrypt to the same value
    expect(decrypt(a)).toBe(plaintext)
    expect(decrypt(b)).toBe(plaintext)
  })

  it('handles empty string', () => {
    const encrypted = encrypt('')
    expect(decrypt(encrypted)).toBe('')
  })

  it('handles unicode', () => {
    const plaintext = 'key-with-émojis-🔑'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    vi.stubEnv('ENCRYPTION_KEY', '')
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY')
  })
})

describe('isEncrypted', () => {
  it('returns false for short strings', () => {
    expect(isEncrypted('sk-test123')).toBe(false)
  })

  it('returns false for non-hex strings', () => {
    expect(isEncrypted('not-hex-' + 'x'.repeat(60))).toBe(false)
  })

  it('returns true for valid-looking encrypted strings', () => {
    // iv (32 hex) + authTag (32 hex) + at least some ciphertext
    const fakeEncrypted = 'a'.repeat(66)
    expect(isEncrypted(fakeEncrypted)).toBe(true)
  })
})

describe('safeDecrypt', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns value as-is when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY
    expect(safeDecrypt('plaintext-key')).toBe('plaintext-key')
  })

  it('returns plaintext value as-is when not encrypted', () => {
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
    expect(safeDecrypt('sk-short-key')).toBe('sk-short-key')
  })

  it('decrypts encrypted values', () => {
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
    const encrypted = encrypt('my-secret')
    expect(safeDecrypt(encrypted)).toBe('my-secret')
  })

  it('returns value as-is when decryption fails (wrong key)', () => {
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
    const encrypted = encrypt('test')
    // Change key
    vi.stubEnv('ENCRYPTION_KEY', 'b'.repeat(64))
    // Should not throw, returns the original hex string
    const result = safeDecrypt(encrypted)
    expect(typeof result).toBe('string')
  })
})

describe('safeEncrypt', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns value as-is when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY
    expect(safeEncrypt('my-key')).toBe('my-key')
  })

  it('encrypts when ENCRYPTION_KEY is set', () => {
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
    const result = safeEncrypt('my-key')
    expect(result).not.toBe('my-key')
    expect(decrypt(result)).toBe('my-key')
  })
})
