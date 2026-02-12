import { describe, it, expect } from 'vitest'
import { normalizeCompanyName } from './company-matcher'

describe('normalizeCompanyName', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeCompanyName('')).toBe('')
  })

  it('lowercases name', () => {
    expect(normalizeCompanyName('ACME CORP')).toBe('acme')
  })

  it('removes Inc suffix', () => {
    expect(normalizeCompanyName('Acme Inc.')).toBe('acme')
    expect(normalizeCompanyName('Acme Inc')).toBe('acme')
    expect(normalizeCompanyName('Acme, Inc.')).toBe('acme')
  })

  it('removes LLC suffix', () => {
    expect(normalizeCompanyName('Beta LLC')).toBe('beta')
    expect(normalizeCompanyName('Beta LLC.')).toBe('beta')
  })

  it('removes Ltd suffix', () => {
    expect(normalizeCompanyName('Gamma Ltd')).toBe('gamma')
    expect(normalizeCompanyName('Gamma Ltd.')).toBe('gamma')
    expect(normalizeCompanyName('Gamma Limited')).toBe('gamma')
  })

  it('removes Corp and Corporation', () => {
    expect(normalizeCompanyName('Delta Corp')).toBe('delta')
    expect(normalizeCompanyName('Delta Corporation')).toBe('delta')
  })

  it('removes GmbH', () => {
    expect(normalizeCompanyName('Epsilon GmbH')).toBe('epsilon')
  })

  it('removes parenthetical content', () => {
    expect(normalizeCompanyName('Acme (US Division)')).toBe('acme')
  })

  it('removes special characters', () => {
    // "Acme & Co." -> remove "Co." suffix -> remove "&" -> "acme"
    expect(normalizeCompanyName("Acme & Co.")).toBe('acme')
  })

  it('normalizes whitespace', () => {
    expect(normalizeCompanyName('  Acme   Corp  ')).toBe('acme')
  })

  it('handles hyphenated names', () => {
    expect(normalizeCompanyName('Hewlett-Packard')).toBe('hewlett-packard')
  })

  it('produces same output for equivalent names', () => {
    const variants = [
      'Acme Inc.',
      'Acme, Inc',
      'ACME INC.',
      'acme inc',
      '  Acme  Inc.  ',
    ]
    const normalized = variants.map(normalizeCompanyName)
    expect(new Set(normalized).size).toBe(1)
  })
})
