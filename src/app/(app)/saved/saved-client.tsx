'use client'

import { useState } from 'react'
import { JobCard } from '@/components/jobs/JobCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { SavedJob, Job, SavedJobStatus } from '@/types'

interface SavedJobWithJob extends Omit<SavedJob, 'job'> {
  job: Job
}

interface SavedJobsClientProps {
  initialSavedJobs: SavedJobWithJob[]
}

const STATUS_TABS: { value: SavedJobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'offer', label: 'Offers' },
  { value: 'rejected', label: 'Rejected' },
]

export function SavedJobsClient({ initialSavedJobs }: SavedJobsClientProps) {
  const [savedJobs, setSavedJobs] = useState(initialSavedJobs)
  const [activeTab, setActiveTab] = useState<SavedJobStatus | 'all'>('all')

  const filteredJobs = activeTab === 'all'
    ? savedJobs
    : savedJobs.filter((sj) => sj.status === activeTab)

  const handleUnsave = async (jobId: string) => {
    const res = await fetch(`/api/saved-jobs/${jobId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setSavedJobs(savedJobs.filter((sj) => sj.job_id !== jobId))
    }
  }

  const handleStatusChange = async (jobId: string, newStatus: SavedJobStatus) => {
    const res = await fetch(`/api/saved-jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (res.ok) {
      setSavedJobs(
        savedJobs.map((sj) =>
          sj.job_id === jobId ? { ...sj, status: newStatus } : sj
        )
      )
    }
  }

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: savedJobs.length }
    savedJobs.forEach((sj) => {
      counts[sj.status] = (counts[sj.status] || 0) + 1
    })
    return counts
  }

  const counts = getStatusCounts()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Saved Jobs</h1>
        <p className="text-gray-600">
          Track your job applications and saved positions
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {counts[tab.value] !== undefined && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">
            {activeTab === 'all'
              ? "You haven't saved any jobs yet."
              : `No ${activeTab} jobs.`}
          </p>
          {activeTab === 'all' && (
            <a
              href="/jobs"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium"
            >
              Browse jobs
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((savedJob) => (
            <div key={savedJob.id} className="relative">
              <JobCard
                job={savedJob.job}
                isSaved={true}
                savedStatus={savedJob.status}
                onUnsave={handleUnsave}
                showActions={false}
              />

              {/* Status controls */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    savedJob.status === 'applied'
                      ? 'info'
                      : savedJob.status === 'offer'
                      ? 'success'
                      : savedJob.status === 'rejected'
                      ? 'error'
                      : 'default'
                  }
                >
                  {savedJob.status.charAt(0).toUpperCase() + savedJob.status.slice(1)}
                </Badge>

                <div className="flex gap-2">
                  {savedJob.status === 'saved' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStatusChange(savedJob.job_id, 'applied')}
                    >
                      Mark Applied
                    </Button>
                  )}
                  {savedJob.status === 'applied' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStatusChange(savedJob.job_id, 'offer')}
                      >
                        Got Offer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(savedJob.job_id, 'rejected')}
                      >
                        Rejected
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnsave(savedJob.job_id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
