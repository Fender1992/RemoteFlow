'use client'

import { cn } from '@/lib/utils'

interface FeedbackPromptProps {
  prompt: {
    id: string
    savedJobId: string
    jobTitle: string
    company: string
    appliedAt?: string
    daysSinceApply: number
    promptType: string
  }
  onSubmit: (outcome: string) => void
  onDismiss: () => void
  isLoading?: boolean
  className?: string
}

interface OutcomeButton {
  outcome: string
  label: string
  emoji: string
  colorClass: string
  hoverClass: string
}

const OUTCOME_BUTTONS: OutcomeButton[] = [
  {
    outcome: 'no_response',
    label: 'Nothing yet',
    emoji: '👻',
    colorClass: 'bg-gray-100 text-gray-700 border-gray-200',
    hoverClass: 'hover:bg-gray-200 hover:border-gray-300',
  },
  {
    outcome: 'rejected',
    label: 'Rejected',
    emoji: '❌',
    colorClass: 'bg-red-50 text-red-700 border-red-200',
    hoverClass: 'hover:bg-red-100 hover:border-red-300',
  },
  {
    outcome: 'interview',
    label: 'Got Interview',
    emoji: '💬',
    colorClass: 'bg-green-50 text-green-700 border-green-200',
    hoverClass: 'hover:bg-green-100 hover:border-green-300',
  },
  {
    outcome: 'offer',
    label: 'Got Offer!',
    emoji: '🎉',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
    hoverClass: 'hover:bg-amber-100 hover:border-amber-300',
  },
]

export function FeedbackPrompt({
  prompt,
  onSubmit,
  onDismiss,
  isLoading = false,
  className,
}: FeedbackPromptProps) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Quick Update
        </h3>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-gray-100 transition-colors"
          aria-label="Dismiss"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          You applied to{' '}
          <span className="font-medium text-[var(--text-primary)]">
            {prompt.jobTitle}
          </span>{' '}
          at{' '}
          <span className="font-medium text-[var(--text-primary)]">
            {prompt.company}
          </span>{' '}
          {prompt.daysSinceApply} days ago. Any response?
        </p>

        {/* Outcome buttons - 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {OUTCOME_BUTTONS.map((button) => (
            <button
              key={button.outcome}
              type="button"
              onClick={() => onSubmit(button.outcome)}
              disabled={isLoading}
              className={cn(
                'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200',
                button.colorClass,
                button.hoverClass,
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
              )}
            >
              <span className="text-base">{button.emoji}</span>
              <span>{button.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-[var(--border-default)] bg-gray-50 rounded-b-xl">
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Your feedback helps others know which companies actually respond.
        </p>
      </div>
    </div>
  )
}
