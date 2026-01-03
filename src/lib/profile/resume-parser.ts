/**
 * Resume Parser Service
 *
 * Uses CacheGPT API to extract structured data from resume text.
 * Supports PDF, DOCX, and plain text resumes.
 */

const CACHEGPT_ENDPOINT =
  process.env.CACHEGPT_API_URL || 'https://cachegpt.app/api/v2/unified-chat'

export interface ParsedResume {
  skills: string[]
  jobTitles: string[]
  yearsExperience: number | null
  educationLevel: 'high_school' | 'bachelors' | 'masters' | 'phd' | 'other' | null
  locations: string[]
  salaryRange: { min: number; max: number } | null
  summary: string
}

export interface ResumeParserConfig {
  apiKey: string
}

const EXTRACTION_PROMPT = `You are a resume parsing assistant. Extract structured information from the provided resume text.

Return a JSON object with these fields:
- skills: Array of technical and soft skills (max 20, most relevant first)
- jobTitles: Array of job titles/roles the person has held (max 5, most recent first)
- yearsExperience: Total years of professional experience as a number, or null if unclear
- educationLevel: One of "high_school", "bachelors", "masters", "phd", "other", or null
- locations: Array of cities/locations mentioned as work preferences or history (max 5)
- salaryRange: Object with min and max in USD if mentioned, or null
- summary: A 1-2 sentence professional summary

Only return valid JSON, no markdown or extra text.`

/**
 * Parse resume text and extract structured data
 */
export async function parseResume(
  config: ResumeParserConfig,
  resumeText: string
): Promise<ParsedResume> {
  if (!resumeText || resumeText.trim().length < 50) {
    throw new Error('Resume text too short to parse')
  }

  // Truncate very long resumes to avoid token limits
  const truncatedText = resumeText.slice(0, 15000)

  const requestBody = {
    messages: [
      {
        role: 'user',
        content: `Parse this resume:\n\n${truncatedText}`,
      },
    ],
    systemPrompt: EXTRACTION_PROMPT,
    contextHash: `resume_parse_${Date.now()}`,
    contextType: 'resume',
    maxTokens: 1000,
    temperature: 0.1,
  }

  const response = await fetch(CACHEGPT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))

    if (response.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.')
    }
    if (response.status === 401) {
      throw new Error('Invalid API key.')
    }

    throw new Error(
      errorData.error || errorData.message || `Resume parsing failed: ${response.status}`
    )
  }

  const data = await response.json()
  const content = data.response || data.content || data.message

  // Parse the JSON response
  try {
    // Handle potential markdown code blocks
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
    }

    const parsed = JSON.parse(jsonStr)

    // Validate and normalize the response
    return {
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.slice(0, 20).map((s: unknown) => String(s).trim())
        : [],
      jobTitles: Array.isArray(parsed.jobTitles)
        ? parsed.jobTitles.slice(0, 5).map((t: unknown) => String(t).trim())
        : [],
      yearsExperience:
        typeof parsed.yearsExperience === 'number' ? parsed.yearsExperience : null,
      educationLevel: validateEducationLevel(parsed.educationLevel),
      locations: Array.isArray(parsed.locations)
        ? parsed.locations.slice(0, 5).map((l: unknown) => String(l).trim())
        : [],
      salaryRange: validateSalaryRange(parsed.salaryRange),
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
    }
  } catch {
    console.error('Failed to parse resume extraction response:', content)
    throw new Error('Failed to parse resume data. Please try again.')
  }
}

/**
 * Validate education level value
 */
function validateEducationLevel(
  value: unknown
): ParsedResume['educationLevel'] {
  const validLevels = ['high_school', 'bachelors', 'masters', 'phd', 'other']
  if (typeof value === 'string' && validLevels.includes(value)) {
    return value as ParsedResume['educationLevel']
  }
  return null
}

/**
 * Validate salary range object
 */
function validateSalaryRange(
  value: unknown
): { min: number; max: number } | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'min' in value &&
    'max' in value &&
    typeof (value as Record<string, unknown>).min === 'number' &&
    typeof (value as Record<string, unknown>).max === 'number'
  ) {
    return {
      min: (value as { min: number; max: number }).min,
      max: (value as { min: number; max: number }).max,
    }
  }
  return null
}

/**
 * Extract text from common file formats
 * Note: PDF and DOCX extraction should be done server-side using appropriate libraries
 */
export function extractTextFromPlainFile(content: string): string {
  // For plain text files, just return the content
  return content
}

/**
 * Calculate a profile completeness score based on parsed resume
 */
export function calculateParseCompleteness(parsed: ParsedResume): number {
  let score = 0

  // Skills: 25 points
  if (parsed.skills.length > 0) {
    score += Math.min(25, parsed.skills.length * 2.5)
  }

  // Job titles: 20 points
  if (parsed.jobTitles.length > 0) {
    score += Math.min(20, parsed.jobTitles.length * 4)
  }

  // Years experience: 15 points
  if (parsed.yearsExperience !== null) {
    score += 15
  }

  // Education: 15 points
  if (parsed.educationLevel !== null) {
    score += 15
  }

  // Locations: 10 points
  if (parsed.locations.length > 0) {
    score += 10
  }

  // Salary range: 10 points
  if (parsed.salaryRange !== null) {
    score += 10
  }

  // Summary: 5 points
  if (parsed.summary.length > 20) {
    score += 5
  }

  return Math.round(score)
}
