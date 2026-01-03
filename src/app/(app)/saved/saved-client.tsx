'use client'

import { useState } from 'react'
import Link from 'next/link'
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

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
      />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function ShieldExclamationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"
      />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-sm">
      <div className="text-center py-16 px-6">
        {/* Large bookmark icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-[var(--primary-50)] flex items-center justify-center mb-6">
          <BookmarkIcon className="w-10 h-10 text-[var(--primary-600)]" />
        </div>

        {/* Headline */}
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          No saved jobs yet
        </h2>

        {/* Description */}
        <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-8">
          Save jobs you're interested in to keep track of them here. You can update their status as you apply and progress through the hiring process.
        </p>

        {/* Pro tips section */}
        <div className="bg-[var(--primary-50)] rounded-lg p-6 max-w-lg mx-auto mb-8">
          <h3 className="text-sm font-semibold text-[var(--primary-700)] uppercase tracking-wide mb-4">
            Pro Tips
          </h3>
          <ul className="space-y-4 text-left">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-[var(--primary-600)]" />
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Use <span className="font-medium text-[var(--text-primary)]">"Ask AI"</span> on any job to check if it's worth applying based on your profile
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--health-good-bg)] flex items-center justify-center">
                <CheckCircleIcon className="w-4 h-4 text-[var(--health-good)]" />
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Look for the <span className="font-medium text-[var(--health-good-text)]">green health indicator</span> - it means the job is actively hiring
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--health-danger-bg)] flex items-center justify-center">
                <ShieldExclamationIcon className="w-4 h-4 text-[var(--health-danger)]" />
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Avoid jobs with <span className="font-medium text-[var(--health-danger-text)]">"High ghost risk"</span> badges - they may be stale or inactive
              </span>
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <Link href="/jobs">
          <Button variant="primary" size="lg">
            Browse Jobs
          </Button>
        </Link>
      </div>
    </div>
  )
}

function FilteredEmptyState({ status }: { status: string }) {
  return (
    <div className="text-center py-12 bg-[var(--bg-card)] rounded-lg border border-[var(--border-default)]">
      <p className="text-[var(--text-tertiary)]">
        No {status} jobs.
      </p>
    </div>
  )
}

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
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Saved Jobs</h1>
        <p className="text-[var(--text-secondary)]">
          Track your job applications and saved positions
        </p>
      </div>

      {/* Status tabs */}
      <div className="horizontal-scroll mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.value
                ? 'bg-[var(--primary-600)] text-white shadow-md shadow-[var(--primary-600)]/25'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] hover:border-[var(--primary-600)]'
            }`}
          >
            {tab.label}
            {counts[tab.value] !== undefined && counts[tab.value] > 0 && (
              <span
                className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab.value
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--primary-50)] text-[var(--primary-600)]'
                }`}
              >
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      {filteredJobs.length === 0 ? (
        activeTab === 'all' ? (
          <EmptyState />
        ) : (
          <FilteredEmptyState status={activeTab} />
        )
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
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
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

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
