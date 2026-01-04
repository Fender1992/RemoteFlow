'use client'

import { useDroppable } from '@dnd-kit/core'
import { PipelineCard } from './PipelineCard'
import { cn } from '@/lib/utils'
import type { KanbanColumn as KanbanColumnType, SavedJob, Job } from '@/types'

interface SavedJobWithJob extends Omit<SavedJob, 'job'> {
  job: Job
}

interface KanbanColumnProps {
  column: KanbanColumnType
  jobs: SavedJobWithJob[]
  onRemove: (jobId: string) => Promise<void>
}

export function KanbanColumn({ column, jobs, onRemove }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-72 bg-[var(--gray-50)] rounded-lg border transition-colors',
        isOver
          ? 'border-[var(--primary-500)] bg-[var(--primary-50)]'
          : 'border-[var(--border-default)]'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{column.icon}</span>
          <h3 className="font-medium text-[var(--text-primary)]">
            {column.title}
          </h3>
        </div>
        <span className="px-2 py-0.5 bg-[var(--gray-200)] text-[var(--gray-600)] text-xs font-medium rounded-full">
          {jobs.length}
        </span>
      </div>

      {/* Cards Container */}
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        {jobs.map((savedJob) => (
          <PipelineCard
            key={savedJob.job_id}
            savedJob={savedJob}
            onRemove={onRemove}
          />
        ))}

        {jobs.length === 0 && (
          <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
            No jobs
          </div>
        )}
      </div>
    </div>
  )
}
