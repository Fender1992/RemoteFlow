'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatSalary, formatDate, cn } from '@/lib/utils'
import { PipelineCardMenu } from './PipelineCardMenu'
import type { SavedJob, Job } from '@/types'

interface SavedJobWithJob extends Omit<SavedJob, 'job'> {
  job: Job
}

interface PipelineCardProps {
  savedJob: SavedJobWithJob
  onRemove?: (jobId: string) => Promise<void>
  isDragging?: boolean
}

export function PipelineCard({ savedJob, onRemove, isDragging = false }: PipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: savedJob.job_id,
    data: {
      savedJob,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const statusDate = savedJob.applied_date || savedJob.created_at
  const statusLabel = savedJob.status === 'saved'
    ? 'Saved'
    : savedJob.status === 'applied'
      ? 'Applied'
      : savedJob.status === 'interviewing'
        ? 'Interview'
        : savedJob.status === 'offer'
          ? 'Offer'
          : 'Updated'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'bg-white rounded-lg border border-[var(--border-default)] p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-md hover:border-[var(--primary-500)] transition-all',
        isDragging && 'shadow-lg opacity-90 rotate-1 scale-105 z-50'
      )}
    >
      {/* Header with title and menu */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <a
          href={savedJob.job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm text-[var(--text-primary)] hover:text-[var(--primary-600)] line-clamp-2"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {savedJob.job.title}
        </a>
        <div onPointerDown={(e) => e.stopPropagation()}>
          <PipelineCardMenu
            jobId={savedJob.job_id}
            jobUrl={savedJob.job.url}
            onRemove={onRemove}
          />
        </div>
      </div>

      {/* Company */}
      <p className="text-xs text-[var(--text-secondary)] mb-2">
        {savedJob.job.company}
      </p>

      {/* Salary */}
      {(savedJob.job.salary_min || savedJob.job.salary_max) && (
        <p className="text-xs font-medium text-[var(--text-primary)] mb-2">
          {formatSalary(savedJob.job.salary_min, savedJob.job.salary_max, savedJob.job.currency)}
        </p>
      )}

      {/* Tech tags (max 2) */}
      {savedJob.job.tech_stack && savedJob.job.tech_stack.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {savedJob.job.tech_stack.slice(0, 2).map((tech) => (
            <span
              key={tech}
              className="px-1.5 py-0.5 bg-[var(--gray-100)] text-[var(--text-tertiary)] text-xs rounded"
            >
              {tech}
            </span>
          ))}
          {savedJob.job.tech_stack.length > 2 && (
            <span className="text-xs text-[var(--text-tertiary)]">
              +{savedJob.job.tech_stack.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Status date */}
      <p className="text-xs text-[var(--text-tertiary)]">
        {statusLabel} {formatDate(statusDate)}
      </p>
    </div>
  )
}
