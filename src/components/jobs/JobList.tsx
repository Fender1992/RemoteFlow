'use client'

import { JobCard } from './JobCard'
import type { Job, SavedJob } from '@/types'

interface JobListProps {
  jobs: Job[]
  savedJobs?: SavedJob[]
  onSave?: (jobId: string) => Promise<void>
  onUnsave?: (jobId: string) => Promise<void>
  onApply?: (jobId: string) => Promise<void>
  showActions?: boolean
}

export function JobList({
  jobs,
  savedJobs = [],
  onSave,
  onUnsave,
  onApply,
  showActions = true,
}: JobListProps) {
  const savedJobMap = new Map(savedJobs.map((sj) => [sj.job_id, sj]))

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No jobs found matching your criteria.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const savedJob = savedJobMap.get(job.id)
        return (
          <JobCard
            key={job.id}
            job={job}
            isSaved={!!savedJob}
            savedStatus={savedJob?.status}
            onSave={onSave}
            onUnsave={onUnsave}
            onApply={onApply}
            showActions={showActions}
          />
        )
      })}
    </div>
  )
}
