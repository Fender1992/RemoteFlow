import { describe, it, expect } from 'vitest'
import {
  normalizeDescription,
  hashDescription,
  calculateBoilerplateScore,
  extractSignals,
  scoreDescription,
} from './description-analyzer'

describe('normalizeDescription', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeDescription('')).toBe('')
  })

  it('lowercases text', () => {
    expect(normalizeDescription('HELLO WORLD')).toBe('hello world')
  })

  it('collapses whitespace', () => {
    expect(normalizeDescription('hello   world')).toBe('hello world')
  })

  it('removes date-like strings', () => {
    const text = 'Posted on 01/15/2025 and updated 2025-03-01'
    const result = normalizeDescription(text)
    expect(result).not.toContain('01/15/2025')
  })

  it('removes day names', () => {
    const result = normalizeDescription('Available Monday through Friday')
    expect(result).not.toMatch(/monday/i)
    expect(result).not.toMatch(/friday/i)
  })

  it('truncates to 500 chars', () => {
    const long = 'a '.repeat(500)
    expect(normalizeDescription(long).length).toBeLessThanOrEqual(500)
  })
})

describe('hashDescription', () => {
  it('produces consistent hashes', () => {
    const a = hashDescription('Test description text')
    const b = hashDescription('Test description text')
    expect(a).toBe(b)
  })

  it('produces 32-char hex strings', () => {
    const hash = hashDescription('Some job description')
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is case-insensitive', () => {
    expect(hashDescription('Hello World')).toBe(hashDescription('hello world'))
  })
})

describe('calculateBoilerplateScore', () => {
  it('returns 0.5 for short text', () => {
    expect(calculateBoilerplateScore('short')).toBe(0.5)
  })

  it('returns 0 for clean description', () => {
    const clean = 'We are building a product that helps teams collaborate. ' +
      'You will work on backend services using Node.js and PostgreSQL. ' +
      'This role involves designing APIs and database schemas. ' + 'x'.repeat(100)
    expect(calculateBoilerplateScore(clean)).toBe(0)
  })

  it('returns high score for boilerplate-heavy text', () => {
    const boilerplate = 'We are looking for a passionate developer in a fast-paced environment. ' +
      'Must be a rock star who can hit the ground running. ' +
      'Competitive salary offered. Self-starter preferred. ' +
      'Must be able to work under pressure in our dynamic team. ' + 'x'.repeat(100)
    expect(calculateBoilerplateScore(boilerplate)).toBeGreaterThan(0.5)
  })

  it('caps at 1.0', () => {
    const allBoilerplate = BOILERPLATE_TEXT()
    expect(calculateBoilerplateScore(allBoilerplate)).toBeLessThanOrEqual(1)
  })
})

function BOILERPLATE_TEXT() {
  return 'We are looking for a passionate developer. Fast-paced environment. ' +
    'Competitive salary. Equal opportunity employer. Rock star ninja guru. ' +
    'Work hard play hard. Dynamic team. Self-starter. ' +
    'Excellent communication skills. Must be able to work independently. ' +
    'Wear many hats. Hit the ground running. ' + 'x'.repeat(100)
}

describe('extractSignals', () => {
  it('returns defaults for empty text', () => {
    const signals = extractSignals('')
    expect(signals.hasSalary).toBe(false)
    expect(signals.hasBenefits).toBe(false)
    expect(signals.hasRequirements).toBe(false)
    expect(signals.hasTeamInfo).toBe(false)
    expect(signals.hasTechStack).toBe(false)
    expect(signals.wordCount).toBe(0)
  })

  it('detects salary mentions', () => {
    expect(extractSignals('We offer $120,000 per year').hasSalary).toBe(true)
    expect(extractSignals('salary range 80k-120k').hasSalary).toBe(true)
  })

  it('detects benefits', () => {
    expect(extractSignals('We offer health insurance and 401k').hasBenefits).toBe(true)
    expect(extractSignals('Includes dental and vision coverage').hasBenefits).toBe(true)
  })

  it('detects requirements', () => {
    expect(extractSignals('Requirements: 5 years of experience').hasRequirements).toBe(true)
  })

  it('detects tech stack', () => {
    expect(extractSignals('Working with React and TypeScript').hasTechStack).toBe(true)
  })

  it('detects team info', () => {
    expect(extractSignals("You'll join a team of 10 engineers").hasTeamInfo).toBe(true)
  })

  it('counts words', () => {
    expect(extractSignals('one two three four').wordCount).toBe(4)
  })
})

describe('scoreDescription', () => {
  it('returns 0.1 for empty text', () => {
    expect(scoreDescription('')).toBe(0.1)
  })

  it('returns higher score for detailed description', () => {
    const detailed = 'Requirements: 3+ years with React and TypeScript. ' +
      'You will work on our platform serving millions of users. ' +
      'We offer $120,000 - $160,000 plus health insurance and equity. ' +
      "You'll join a team of 8 engineers. " +
      'Stack: React, Node.js, PostgreSQL, AWS. ' +
      'Additional details: '.padEnd(1200, 'x')
    const short = 'We need a developer.'
    expect(scoreDescription(detailed)).toBeGreaterThan(scoreDescription(short))
  })

  it('penalizes boilerplate', () => {
    const clean = 'Build backend APIs with Node.js and PostgreSQL. ' +
      'Design scalable microservices architecture. ' + 'x'.repeat(500)
    const boilerplate = 'Looking for a passionate rock star in a fast-paced environment. ' +
      'Self-starter who can hit the ground running. ' + 'x'.repeat(500)
    expect(scoreDescription(clean)).toBeGreaterThan(scoreDescription(boilerplate))
  })

  it('clamps between 0.1 and 1.0', () => {
    const score = scoreDescription('test')
    expect(score).toBeGreaterThanOrEqual(0.1)
    expect(score).toBeLessThanOrEqual(1.0)
  })
})
