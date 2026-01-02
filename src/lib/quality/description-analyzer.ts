// Description quality analysis and hashing
import crypto from 'crypto'

export interface DescriptionSignals {
  hasSalary: boolean
  hasBenefits: boolean
  hasRequirements: boolean
  hasTeamInfo: boolean
  hasTechStack: boolean
  wordCount: number
  boilerplateScore: number
}

// Common boilerplate phrases that indicate low-quality descriptions
const BOILERPLATE_PATTERNS = [
  /we are looking for a (passionate|talented|motivated|driven)/i,
  /fast[- ]paced environment/i,
  /competitive salary/i,
  /equal opportunity employer/i,
  /rock star|ninja|guru|wizard/i,
  /work hard[,]? play hard/i,
  /dynamic team/i,
  /self[- ]starter/i,
  /excellent communication skills/i,
  /must be able to work (independently|under pressure)/i,
  /wear many hats/i,
  /hit the ground running/i,
]

// Positive signals in descriptions
const POSITIVE_PATTERNS = {
  salary: /\$[\d,]+(?:k|K)?|\d{2,3}(?:k|K)|\bsalary\b.*\d|\bpay\b.*\d/i,
  benefits: /\b(health|dental|vision|401k|pto|vacation|insurance|equity|stock)\b/i,
  requirements: /\b(requirements|qualifications|must have|required|you have|you will)\b/i,
  teamInfo: /\b(team of \d|report to|work with|collaborate|you'?ll join)\b/i,
  techStack: /\b(react|node|python|java|typescript|aws|docker|kubernetes|postgresql|mongodb)\b/i,
}

/**
 * Normalize description text for hashing
 * - Lowercase
 * - Remove extra whitespace
 * - Remove common variable parts (company name mentions, dates)
 * - Take first 500 chars
 */
export function normalizeDescription(text: string): string {
  if (!text) return ''

  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .slice(0, 500)
}

/**
 * Generate a hash of the normalized description
 * Used for detecting duplicate/reposted jobs
 */
export function hashDescription(text: string): string {
  const normalized = normalizeDescription(text)
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32)
}

/**
 * Calculate boilerplate score (0-1, higher = more boilerplate)
 */
export function calculateBoilerplateScore(text: string): number {
  if (!text || text.length < 100) return 0.5

  let matches = 0
  for (const pattern of BOILERPLATE_PATTERNS) {
    if (pattern.test(text)) matches++
  }

  // Normalize to 0-1 range
  return Math.min(matches / 5, 1)
}

/**
 * Extract signals from description text
 */
export function extractSignals(text: string): DescriptionSignals {
  if (!text) {
    return {
      hasSalary: false,
      hasBenefits: false,
      hasRequirements: false,
      hasTeamInfo: false,
      hasTechStack: false,
      wordCount: 0,
      boilerplateScore: 0.5,
    }
  }

  const wordCount = text.split(/\s+/).length

  return {
    hasSalary: POSITIVE_PATTERNS.salary.test(text),
    hasBenefits: POSITIVE_PATTERNS.benefits.test(text),
    hasRequirements: POSITIVE_PATTERNS.requirements.test(text),
    hasTeamInfo: POSITIVE_PATTERNS.teamInfo.test(text),
    hasTechStack: POSITIVE_PATTERNS.techStack.test(text),
    wordCount,
    boilerplateScore: calculateBoilerplateScore(text),
  }
}

/**
 * Calculate description quality score (0-1)
 * Higher score = better quality description
 */
export function scoreDescription(text: string): number {
  if (!text) return 0.1

  const signals = extractSignals(text)
  let score = 0.3 // Base score

  // Length scoring (0-0.25)
  if (signals.wordCount > 1500) score += 0.25
  else if (signals.wordCount > 800) score += 0.20
  else if (signals.wordCount > 400) score += 0.15
  else if (signals.wordCount > 200) score += 0.10
  else if (signals.wordCount < 100) score -= 0.15

  // Positive signals (0-0.25)
  if (signals.hasSalary) score += 0.08
  if (signals.hasBenefits) score += 0.05
  if (signals.hasRequirements) score += 0.05
  if (signals.hasTeamInfo) score += 0.04
  if (signals.hasTechStack) score += 0.03

  // Boilerplate penalty (0-0.20)
  score -= signals.boilerplateScore * 0.20

  // Clamp to 0.1-1.0
  return Math.max(0.1, Math.min(1.0, score))
}
