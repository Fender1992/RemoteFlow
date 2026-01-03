'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { MatchBreakdown } from '@/lib/profile/job-matcher'

interface MatchBadgeProps {
  jobId: string
  className?: string
  showTooltip?: boolean
}

interface MatchData {
  overallScore: number
  breakdown: MatchBreakdown
  suggestions?: string[]
  matchedSkills?: string[]
  missingSkills?: string[]
}

type MatchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: MatchData }
  | { status: 'profile_incomplete'; completenessScore: number }
  | { status: 'error'; message: string }
  | { status: 'unauthorized' }

function getMatchColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) {
    return {
      bg: 'bg-[var(--health-good-bg)]',
      text: 'text-[var(--health-good-text)]',
      label: 'Great match',
    }
  }
  if (score >= 60) {
    return {
      bg: 'bg-[var(--health-caution-bg)]',
      text: 'text-[var(--health-caution-text)]',
      label: 'Good match',
    }
  }
  return {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: 'Low match',
  }
}

function BreakdownItem({ label, score }: { label: string; score: number }) {
  const getBarColor = (s: number) => {
    if (s >= 80) return 'bg-[var(--health-good)]'
    if (s >= 60) return 'bg-[var(--health-caution)]'
    return 'bg-gray-400'
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', getBarColor(score))}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-white font-medium w-8 text-right">{score}%</span>
      </div>
    </div>
  )
}

export function MatchBadge({ jobId, className, showTooltip = true }: MatchBadgeProps) {
  const [state, setState] = useState<MatchState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false

    const fetchMatch = async () => {
      setState({ status: 'loading' })

      try {
        const response = await fetch(`/api/jobs/${jobId}/match`)

        if (!response.ok) {
          const data = await response.json()

          if (response.status === 401) {
            setState({ status: 'unauthorized' })
            return
          }

          if (data.error === 'profile_incomplete') {
            setState({
              status: 'profile_incomplete',
              completenessScore: data.completenessScore || 0,
            })
            return
          }

          setState({ status: 'error', message: data.error || 'Failed to load match' })
          return
        }

        const data = await response.json()
        if (!cancelled) {
          setState({ status: 'success', data })
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', message: 'Failed to load match' })
        }
      }
    }

    fetchMatch()

    return () => {
      cancelled = true
    }
  }, [jobId])

  // Don't render anything for unauthorized users
  if (state.status === 'unauthorized' || state.status === 'idle') {
    return null
  }

  // Loading state
  if (state.status === 'loading') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500',
          className
        )}
      >
        <svg
          className="w-3 h-3 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Matching...</span>
      </div>
    )
  }

  // Profile incomplete state
  if (state.status === 'profile_incomplete') {
    return (
      <div className={cn('relative group', className)}>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
            'bg-blue-50 text-blue-600 border border-blue-200'
          )}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Complete profile</span>
        </div>

        {showTooltip && (
          <div className="absolute left-0 top-full mt-2 z-50 w-56 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
            <p className="mb-2">Add skills or upload your resume to see how well you match with this job.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${state.completenessScore}%` }}
                />
              </div>
              <span className="text-gray-400">{state.completenessScore}%</span>
            </div>
            <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 rotate-45" />
          </div>
        )}
      </div>
    )
  }

  // Error state - render nothing to avoid cluttering the UI
  if (state.status === 'error') {
    return null
  }

  // Success state
  const { data } = state
  const colors = getMatchColor(data.overallScore)

  return (
    <div className={cn('relative group', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold',
          colors.bg,
          colors.text
        )}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <span>{data.overallScore}% match</span>
      </div>

      {/* Tooltip with breakdown */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
          {/* Overall score header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
            <span className="font-semibold">{colors.label}</span>
            <span className={cn('font-bold text-sm', colors.text)}>{data.overallScore}%</span>
          </div>

          {/* Breakdown */}
          <div className="space-y-2 mb-3">
            <BreakdownItem label="Skills" score={data.breakdown.skills} />
            <BreakdownItem label="Experience" score={data.breakdown.experience} />
            <BreakdownItem label="Location" score={data.breakdown.location} />
            <BreakdownItem label="Salary" score={data.breakdown.salary} />
          </div>

          {/* Matched skills preview */}
          {data.matchedSkills && data.matchedSkills.length > 0 && (
            <div className="pt-2 border-t border-gray-700">
              <p className="text-gray-400 mb-1">Matching skills:</p>
              <div className="flex flex-wrap gap-1">
                {data.matchedSkills.slice(0, 5).map((skill) => (
                  <span
                    key={skill}
                    className="px-1.5 py-0.5 bg-gray-700 text-gray-200 rounded text-[10px]"
                  >
                    {skill}
                  </span>
                ))}
                {data.matchedSkills.length > 5 && (
                  <span className="text-gray-500">+{data.matchedSkills.length - 5} more</span>
                )}
              </div>
            </div>
          )}

          {/* Missing skills preview */}
          {data.missingSkills && data.missingSkills.length > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-700">
              <p className="text-gray-400 mb-1">Skills to add:</p>
              <div className="flex flex-wrap gap-1">
                {data.missingSkills.slice(0, 3).map((skill) => (
                  <span
                    key={skill}
                    className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px] border border-gray-600"
                  >
                    {skill}
                  </span>
                ))}
                {data.missingSkills.length > 3 && (
                  <span className="text-gray-500">+{data.missingSkills.length - 3} more</span>
                )}
              </div>
            </div>
          )}

          <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  )
}
