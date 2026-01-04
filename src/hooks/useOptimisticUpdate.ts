'use client'

import { useState, useCallback } from 'react'
import type { SavedJobStatus, SavedJob, Job } from '@/types'

interface SavedJobWithJob extends Omit<SavedJob, 'job'> {
  job: Job
}

interface UseOptimisticUpdateReturn {
  jobs: SavedJobWithJob[]
  updateStatus: (jobId: string, newStatus: SavedJobStatus) => Promise<void>
  removeJob: (jobId: string) => Promise<void>
  isUpdating: boolean
}

export function useOptimisticUpdate(
  initialJobs: SavedJobWithJob[]
): UseOptimisticUpdateReturn {
  const [jobs, setJobs] = useState(initialJobs)
  const [isUpdating, setIsUpdating] = useState(false)

  const updateStatus = useCallback(
    async (jobId: string, newStatus: SavedJobStatus) => {
      // Capture previous state for rollback
      const previousJobs = [...jobs]

      // Optimistic update
      setJobs((current) =>
        current.map((job) =>
          job.job_id === jobId ? { ...job, status: newStatus } : job
        )
      )

      setIsUpdating(true)

      try {
        const res = await fetch(`/api/saved-jobs/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })

        if (!res.ok) {
          throw new Error('Failed to update status')
        }
      } catch (error) {
        // Rollback on failure
        console.error('Status update failed, rolling back:', error)
        setJobs(previousJobs)
      } finally {
        setIsUpdating(false)
      }
    },
    [jobs]
  )

  const removeJob = useCallback(
    async (jobId: string) => {
      const previousJobs = [...jobs]

      // Optimistic removal
      setJobs((current) => current.filter((job) => job.job_id !== jobId))

      setIsUpdating(true)

      try {
        const res = await fetch(`/api/saved-jobs/${jobId}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          throw new Error('Failed to remove job')
        }
      } catch (error) {
        console.error('Remove failed, rolling back:', error)
        setJobs(previousJobs)
      } finally {
        setIsUpdating(false)
      }
    },
    [jobs]
  )

  return { jobs, updateStatus, removeJob, isUpdating }
}
