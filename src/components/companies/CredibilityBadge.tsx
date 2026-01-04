'use client'

import { cn } from '@/lib/utils'
import { scoreToGrade } from '@/lib/quality/credibility'

interface CredibilityBadgeProps {
  score?: number        // 0-1 credibility score
  grade?: string        // A+, A, B+, etc. (if grade is provided, use it directly)
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean   // Show "Company Score" label below grade
  className?: string
}

type GradeCategory = 'excellent' | 'good' | 'fair' | 'poor'

function getGradeCategory(grade: string): GradeCategory {
  const upperGrade = grade.toUpperCase()

  if (upperGrade.startsWith('A')) {
    return 'excellent'
  }
  if (upperGrade.startsWith('B')) {
    return 'good'
  }
  if (upperGrade.startsWith('C')) {
    return 'fair'
  }
  // D, F, or any other grade
  return 'poor'
}

const categoryStyles: Record<GradeCategory, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-amber-100 text-amber-800',
  poor: 'bg-red-100 text-red-800',
}

const sizeStyles = {
  sm: 'text-xs py-1 px-2',
  md: 'text-sm py-1.5 px-3',
  lg: 'text-base py-2 px-4',
}

export function CredibilityBadge({
  score,
  grade,
  size = 'md',
  showLabel = false,
  className,
}: CredibilityBadgeProps) {
  // Determine the grade to display
  let displayGrade: string | null = null

  if (grade) {
    displayGrade = grade
  } else if (score !== undefined) {
    displayGrade = scoreToGrade(score)
  }

  // If no grade can be determined, don't render anything
  if (!displayGrade) {
    return null
  }

  const category = getGradeCategory(displayGrade)

  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-md font-semibold',
          categoryStyles[category],
          sizeStyles[size]
        )}
      >
        {displayGrade}
      </span>
      {showLabel && (
        <span className="mt-1 text-xs text-gray-500">Company Score</span>
      )}
    </div>
  )
}

export default CredibilityBadge
