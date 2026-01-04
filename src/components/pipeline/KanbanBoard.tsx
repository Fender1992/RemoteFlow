'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { PipelineCard } from './PipelineCard'
import { KANBAN_COLUMNS, SavedJobStatus, SavedJob, Job } from '@/types'

interface SavedJobWithJob extends Omit<SavedJob, 'job'> {
  job: Job
}

interface KanbanBoardProps {
  savedJobs: SavedJobWithJob[]
  onStatusChange: (jobId: string, newStatus: SavedJobStatus) => Promise<void>
  onRemove: (jobId: string) => Promise<void>
}

export function KanbanBoard({ savedJobs, onStatusChange, onRemove }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Group jobs by status
  const jobsByStatus = KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = savedJobs.filter((sj) => sj.status === col.id)
      return acc
    },
    {} as Record<SavedJobStatus, SavedJobWithJob[]>
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const jobId = active.id as string
    const newStatus = over.id as SavedJobStatus

    // Find the current job to check if status actually changed
    const currentJob = savedJobs.find((sj) => sj.job_id === jobId)

    if (currentJob && currentJob.status !== newStatus) {
      onStatusChange(jobId, newStatus)
    }
  }

  const activeJob = activeId
    ? savedJobs.find((sj) => sj.job_id === activeId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x">
        {KANBAN_COLUMNS.map((column) => (
          <div key={column.id} className="snap-start">
            <KanbanColumn
              column={column}
              jobs={jobsByStatus[column.id] || []}
              onRemove={onRemove}
            />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeJob && (
          <PipelineCard savedJob={activeJob} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  )
}
