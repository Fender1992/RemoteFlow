import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-sm transition-all duration-200',
        hover && 'hover:border-[var(--primary-600)] hover:shadow-md hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: Omit<CardProps, 'hover'>) {
  return (
    <div className={cn('px-5 py-4 border-b border-[var(--border-default)]', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }: Omit<CardProps, 'hover'>) {
  return (
    <h3 className={cn('text-lg font-bold text-[var(--text-primary)]', className)}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className }: Omit<CardProps, 'hover'>) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}

export function CardFooter({ children, className }: Omit<CardProps, 'hover'>) {
  return (
    <div className={cn('px-5 py-3 border-t border-[var(--border-default)] bg-gray-50 rounded-b-xl', className)}>
      {children}
    </div>
  )
}
