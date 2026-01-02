import { cn } from '@/lib/utils'
import type { GhostFlag } from '@/types'

interface QualityBadgeProps {
  quality_score: number
  ghost_score: number
  ghost_flags: GhostFlag[]
  company_verified?: boolean
  posted_date: string | null
  repost_count?: number
  className?: string
}

function isWithinDays(date: string | null, days: number): boolean {
  if (!date) return false
  const postDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - postDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays <= days
}

function QualityBadge({
  quality_score,
  ghost_score,
  ghost_flags,
  company_verified,
  posted_date,
  repost_count,
  className,
}: QualityBadgeProps) {
  const badges: React.ReactNode[] = []

  // Base badge styles with new design system
  const baseBadgeStyles = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold'

  // Positive badges
  if (isWithinDays(posted_date, 7)) {
    badges.push(
      <span
        key="fresh"
        className={baseBadgeStyles}
        style={{
          backgroundColor: 'var(--health-good-bg)',
          color: 'var(--health-good-text)',
        }}
      >
        Fresh
      </span>
    )
  }

  if (company_verified) {
    badges.push(
      <span
        key="verified"
        className={baseBadgeStyles}
        style={{
          backgroundColor: '#dbeafe',
          color: '#1e40af',
        }}
      >
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Verified
      </span>
    )
  }

  if (quality_score > 0.8) {
    badges.push(
      <span
        key="high-quality"
        className={baseBadgeStyles}
        style={{
          backgroundColor: 'var(--health-good-bg)',
          color: 'var(--health-good-text)',
        }}
      >
        High Quality
      </span>
    )
  }

  // Warning badges
  if (ghost_flags.includes('open_90_days')) {
    badges.push(
      <span
        key="open-90"
        className={baseBadgeStyles}
        style={{
          backgroundColor: 'var(--health-caution-bg)',
          color: 'var(--health-caution-text)',
        }}
      >
        Open 90+ days
      </span>
    )
  }

  if (repost_count !== undefined && repost_count > 2) {
    badges.push(
      <span
        key="reposted"
        className={baseBadgeStyles}
        style={{
          backgroundColor: 'var(--health-caution-bg)',
          color: 'var(--health-caution-text)',
        }}
      >
        Reposted multiple times
      </span>
    )
  }

  if (ghost_score >= 5) {
    badges.push(
      <span
        key="suspicious"
        className={baseBadgeStyles}
        style={{
          backgroundColor: 'var(--health-danger-bg)',
          color: 'var(--health-danger-text)',
        }}
      >
        Suspicious
      </span>
    )
  }

  if (badges.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {badges}
    </div>
  )
}

export default QualityBadge
