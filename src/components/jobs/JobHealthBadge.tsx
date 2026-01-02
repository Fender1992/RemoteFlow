'use client'

import { cn } from '@/lib/utils'

interface JobHealthBadgeProps {
  healthScore: number
  ghostScore: number
  className?: string
  showTooltip?: boolean
}

type HealthStatus = 'healthy' | 'caution' | 'danger'

function getHealthStatus(healthScore: number, ghostScore: number): HealthStatus {
  if (ghostScore >= 5 || healthScore < 0.3) return 'danger'
  if (ghostScore >= 3 || healthScore < 0.6) return 'caution'
  return 'healthy'
}

const statusConfig = {
  healthy: {
    label: 'Looks legit',
    description: 'This job appears to be actively hiring based on posting age, company patterns, and user verifications.',
    bgColor: 'bg-[var(--health-good-bg)]',
    textColor: 'text-[var(--health-good-text)]',
    iconColor: 'text-[var(--health-good)]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  caution: {
    label: 'Some concerns',
    description: 'This job has some yellow flags. Consider asking AI for more details before applying.',
    bgColor: 'bg-[var(--health-caution-bg)]',
    textColor: 'text-[var(--health-caution-text)]',
    iconColor: 'text-[var(--health-caution)]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  danger: {
    label: 'High ghost risk',
    description: 'This job shows signs of being inactive: open too long, reposted multiple times, or company has poor hiring patterns.',
    bgColor: 'bg-[var(--health-danger-bg)]',
    textColor: 'text-[var(--health-danger-text)]',
    iconColor: 'text-[var(--health-danger)]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
}

export function JobHealthBadge({ healthScore, ghostScore, className, showTooltip = true }: JobHealthBadgeProps) {
  const status = getHealthStatus(healthScore, ghostScore)
  const config = statusConfig[status]

  return (
    <div className={cn('relative group', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
          config.bgColor,
          config.textColor
        )}
      >
        <span className={config.iconColor}>{config.icon}</span>
        <span>{config.label}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
          <p>{config.description}</p>
          <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  )
}

// Export the helper function for use in other components
export { getHealthStatus }
export type { HealthStatus }
