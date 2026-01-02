import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'health-good' | 'health-caution' | 'health-danger'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    // Health-specific variants using CSS variables
    'health-good': 'bg-[var(--health-good-bg)] text-[var(--health-good-text)]',
    'health-caution': 'bg-[var(--health-caution-bg)] text-[var(--health-caution-text)]',
    'health-danger': 'bg-[var(--health-danger-bg)] text-[var(--health-danger-text)]',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
