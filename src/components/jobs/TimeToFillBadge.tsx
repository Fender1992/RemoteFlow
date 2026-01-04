'use client'

import { cn } from '@/lib/utils'

interface TimeToFillBadgeProps {
  days?: number | null
  type?: 'time-to-fill' | 'days-active'
  className?: string
}

type SpeedCategory = 'fast' | 'normal' | 'slow'

function getSpeedCategory(days: number): SpeedCategory {
  if (days < 21) return 'fast'
  if (days <= 45) return 'normal'
  return 'slow'
}

const categoryConfig = {
  fast: {
    bgColor: 'bg-[var(--health-good-bg)]',
    textColor: 'text-[var(--health-good-text)]',
    iconColor: 'text-[var(--health-good)]',
    indicator: 'Fast',
    icon: (
      // Lightning bolt icon
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  normal: {
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    iconColor: 'text-gray-500',
    indicator: null,
    icon: null,
  },
  slow: {
    bgColor: 'bg-[var(--health-caution-bg)]',
    textColor: 'text-[var(--health-caution-text)]',
    iconColor: 'text-[var(--health-caution)]',
    indicator: 'Slow',
    icon: (
      // Turtle icon
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M15.5 9.5c0-.28-.22-.5-.5-.5h-1V8c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v1H5c-.28 0-.5.22-.5.5s.22.5.5.5h1v1c0 1.66 1.34 3 3 3h.5v2h1v-2h.5c1.66 0 3-1.34 3-3v-1h1c.28 0 .5-.22.5-.5zM7 8c0-.55.45-1 1-1h4c.55 0 1 .45 1 1v1H7V8zm5 5H8c-1.1 0-2-.9-2-2v-1h8v1c0 1.1-.9 2-2 2z" />
        <circle cx="8.5" cy="8.5" r=".5" />
        <circle cx="11.5" cy="8.5" r=".5" />
        <path d="M3 10.5c0 .28.22.5.5.5H5v.5c0 .17.01.34.03.5H3.5c-.28 0-.5.22-.5.5s.22.5.5.5h1.76c.3.58.76 1.07 1.32 1.41l-.88 1.76c-.12.25-.02.55.23.68.08.04.16.06.24.06.18 0 .36-.1.44-.28l.89-1.78c.48.15.99.24 1.5.24V14h1v.09c.51 0 1.02-.09 1.5-.24l.89 1.78c.08.17.26.28.44.28.08 0 .16-.02.24-.06.25-.12.35-.42.23-.68l-.88-1.76c.56-.34 1.02-.83 1.32-1.41h1.76c.28 0 .5-.22.5-.5s-.22-.5-.5-.5h-1.53c.02-.16.03-.33.03-.5V11h1.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5H15V9h1.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5H15c0-1.66-1.34-3-3-3V4.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5V5H9V4.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5V5c-1.66 0-3 1.34-3 3H3.5c-.28 0-.5.22-.5.5s.22.5.5.5H5v1H3.5c-.28 0-.5.22-.5.5z" />
      </svg>
    ),
  },
}

export function TimeToFillBadge({ days, type = 'time-to-fill', className }: TimeToFillBadgeProps) {
  // Don't render if days is null or undefined
  if (days === null || days === undefined) {
    return null
  }

  const category = getSpeedCategory(days)
  const config = categoryConfig[category]

  // Format the text based on type
  const text = type === 'time-to-fill' ? `${days}d avg hire` : `${days} days active`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.icon && <span className={config.iconColor}>{config.icon}</span>}
      <span>{text}</span>
      {config.indicator && (
        <span className="font-bold">{config.indicator}</span>
      )}
    </span>
  )
}

export { getSpeedCategory }
export type { SpeedCategory, TimeToFillBadgeProps }
