/**
 * Job Matcher Service
 *
 * Calculates match scores between user profiles and job listings.
 * Uses weighted scoring across multiple dimensions.
 */

import type { Job } from '@/types'

export interface UserProfile {
  skills: string[]
  jobTitles: string[]
  yearsExperience: number | null
  educationLevel: string | null
  preferredLocations: string[]
  salaryExpectationMin: number | null
  salaryExpectationMax: number | null
}

export interface MatchBreakdown {
  skills: number
  experience: number
  location: number
  salary: number
}

export interface MatchResult {
  overallScore: number
  breakdown: MatchBreakdown
  suggestions: string[]
  matchedSkills: string[]
  missingSkills: string[]
}

// Weights for different match dimensions
const WEIGHTS = {
  skills: 0.4,
  experience: 0.25,
  location: 0.2,
  salary: 0.15,
}

/**
 * Calculate match score between a user profile and a job
 */
export function calculateMatch(profile: UserProfile, job: Job): MatchResult {
  const skillsResult = calculateSkillsMatch(profile.skills, job.tech_stack || [])
  const experienceScore = calculateExperienceMatch(profile.yearsExperience, job.experience_level)
  const locationScore = calculateLocationMatch(profile.preferredLocations, job)
  const salaryScore = calculateSalaryMatch(
    profile.salaryExpectationMin,
    profile.salaryExpectationMax,
    job.salary_min,
    job.salary_max
  )

  const breakdown: MatchBreakdown = {
    skills: skillsResult.score,
    experience: experienceScore,
    location: locationScore,
    salary: salaryScore,
  }

  // Weighted overall score
  const overallScore = Math.round(
    breakdown.skills * WEIGHTS.skills +
    breakdown.experience * WEIGHTS.experience +
    breakdown.location * WEIGHTS.location +
    breakdown.salary * WEIGHTS.salary
  )

  const suggestions = generateSuggestions(profile, job, skillsResult, breakdown)

  return {
    overallScore,
    breakdown,
    suggestions,
    matchedSkills: skillsResult.matched,
    missingSkills: skillsResult.missing,
  }
}

/**
 * Calculate skills match score
 */
function calculateSkillsMatch(
  userSkills: string[],
  jobSkills: string[]
): { score: number; matched: string[]; missing: string[] } {
  if (jobSkills.length === 0) {
    // No skills listed = neutral match
    return { score: 75, matched: [], missing: [] }
  }

  const normalizedUserSkills = new Set(
    userSkills.map((s) => normalizeSkill(s))
  )
  const normalizedJobSkills = jobSkills.map((s) => normalizeSkill(s))

  const matched: string[] = []
  const missing: string[] = []

  for (const jobSkill of jobSkills) {
    const normalized = normalizeSkill(jobSkill)
    if (normalizedUserSkills.has(normalized) || findRelatedSkill(normalized, normalizedUserSkills)) {
      matched.push(jobSkill)
    } else {
      missing.push(jobSkill)
    }
  }

  const matchRatio = matched.length / jobSkills.length
  const score = Math.round(matchRatio * 100)

  return { score, matched, missing }
}

/**
 * Normalize skill names for comparison
 */
function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/js$/, 'javascript')
    .replace(/^ts$/, 'typescript')
    .replace(/^py$/, 'python')
    .replace(/^node$/, 'nodejs')
    .replace(/^react$/, 'reactjs')
    .replace(/^vue$/, 'vuejs')
    .replace(/^angular$/, 'angularjs')
}

/**
 * Check for related skills (e.g., React ~ React.js)
 */
function findRelatedSkill(skill: string, userSkills: Set<string>): boolean {
  const skillGroups: string[][] = [
    ['react', 'reactjs', 'reactnative'],
    ['vue', 'vuejs', 'vue3'],
    ['angular', 'angularjs', 'angular2'],
    ['node', 'nodejs', 'expressjs'],
    ['python', 'django', 'flask', 'fastapi'],
    ['java', 'spring', 'springboot'],
    ['javascript', 'js', 'es6', 'typescript', 'ts'],
    ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite'],
    ['nosql', 'mongodb', 'dynamodb', 'redis'],
    ['aws', 'ec2', 's3', 'lambda', 'cloudformation'],
    ['gcp', 'googlecloud', 'bigquery', 'cloudfunctions'],
    ['azure', 'microsoftazure', 'azurefunctions'],
    ['docker', 'containers', 'kubernetes', 'k8s'],
    ['ci', 'cd', 'cicd', 'jenkins', 'github actions', 'gitlab'],
  ]

  for (const group of skillGroups) {
    if (group.includes(skill)) {
      return group.some((related) => userSkills.has(related))
    }
  }

  return false
}

/**
 * Calculate experience level match
 */
function calculateExperienceMatch(
  yearsExperience: number | null,
  jobLevel: string | null
): number {
  if (yearsExperience === null || !jobLevel) {
    return 75 // Neutral if data is missing
  }

  const levelRanges: Record<string, { min: number; max: number }> = {
    entry: { min: 0, max: 2 },
    junior: { min: 0, max: 2 },
    mid: { min: 2, max: 5 },
    senior: { min: 5, max: 10 },
    lead: { min: 7, max: 15 },
    principal: { min: 10, max: 20 },
    staff: { min: 10, max: 20 },
    any: { min: 0, max: 99 },
  }

  const range = levelRanges[jobLevel.toLowerCase()] || levelRanges['any']

  if (yearsExperience >= range.min && yearsExperience <= range.max) {
    return 100 // Perfect match
  }

  if (yearsExperience < range.min) {
    // Under-qualified
    const gap = range.min - yearsExperience
    return Math.max(20, 100 - gap * 15)
  }

  // Over-qualified (less of a penalty)
  const excess = yearsExperience - range.max
  return Math.max(60, 100 - excess * 5)
}

/**
 * Calculate location match
 */
function calculateLocationMatch(
  preferredLocations: string[],
  job: Job
): number {
  // Remote jobs match everyone
  if (
    job.timezone === 'global' ||
    job.job_type?.toLowerCase().includes('remote')
  ) {
    return 100
  }

  if (preferredLocations.length === 0) {
    return 75 // No preference = neutral
  }

  // Check if any preferred location matches job timezone or location
  const jobLocation = (job.timezone || '').toLowerCase()
  const normalizedPreferred = preferredLocations.map((l) => l.toLowerCase())

  // Simple matching - could be improved with geo data
  for (const pref of normalizedPreferred) {
    if (
      jobLocation.includes(pref) ||
      pref.includes(jobLocation) ||
      pref === 'remote' ||
      pref === 'anywhere'
    ) {
      return 100
    }
  }

  return 40 // Location mismatch
}

/**
 * Calculate salary match
 */
function calculateSalaryMatch(
  userMin: number | null,
  userMax: number | null,
  jobMin: number | null,
  jobMax: number | null
): number {
  // No salary info = neutral
  if ((jobMin === null && jobMax === null) || (userMin === null && userMax === null)) {
    return 75
  }

  const userTarget = userMin ?? userMax ?? 0
  const jobMid = (jobMin || 0 + (jobMax || 0)) / 2 || jobMin || jobMax || 0

  if (jobMid === 0 || userTarget === 0) {
    return 75
  }

  // Calculate how close the job salary is to user expectation
  const ratio = jobMid / userTarget

  if (ratio >= 1.0) {
    // Job pays at or above expectation
    return 100
  }

  if (ratio >= 0.9) {
    // Within 10% below
    return 90
  }

  if (ratio >= 0.8) {
    // Within 20% below
    return 70
  }

  if (ratio >= 0.6) {
    // Significantly below
    return 50
  }

  return 30 // Way below
}

/**
 * Generate improvement suggestions based on match analysis
 */
function generateSuggestions(
  profile: UserProfile,
  job: Job,
  skillsResult: { score: number; matched: string[]; missing: string[] },
  breakdown: MatchBreakdown
): string[] {
  const suggestions: string[] = []

  // Skills suggestions
  if (skillsResult.missing.length > 0 && skillsResult.missing.length <= 3) {
    suggestions.push(
      `Add ${skillsResult.missing.slice(0, 3).join(', ')} to your skills to improve this match`
    )
  } else if (skillsResult.missing.length > 3) {
    suggestions.push(
      `This role requires ${skillsResult.missing.length} skills not on your profile. Consider adding relevant experience.`
    )
  }

  // Experience suggestions
  if (breakdown.experience < 70) {
    if (profile.yearsExperience !== null) {
      const jobLevel = job.experience_level || 'mid'
      if (['senior', 'lead', 'principal', 'staff'].includes(jobLevel.toLowerCase())) {
        suggestions.push(
          `This is a ${jobLevel}-level role. Highlight leadership and major project accomplishments.`
        )
      }
    }
  }

  // Salary suggestions
  if (breakdown.salary < 70 && job.salary_min) {
    suggestions.push(
      `The listed salary may be below your expectations. Consider negotiating or adjusting expectations.`
    )
  }

  // Location suggestions
  if (breakdown.location < 70) {
    suggestions.push(
      `This role may have location requirements. Check if remote work is available.`
    )
  }

  // Positive reinforcement for good matches
  if (skillsResult.matched.length > 0 && suggestions.length === 0) {
    suggestions.push(
      `Great match! Highlight your experience with ${skillsResult.matched.slice(0, 3).join(', ')} in your application.`
    )
  }

  return suggestions.slice(0, 3)
}

/**
 * Get match level label based on score
 */
export function getMatchLevel(score: number): 'excellent' | 'good' | 'fair' | 'low' {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'low'
}

/**
 * Get match color class based on score
 */
export function getMatchColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50'
  if (score >= 60) return 'text-yellow-600 bg-yellow-50'
  return 'text-gray-500 bg-gray-50'
}
