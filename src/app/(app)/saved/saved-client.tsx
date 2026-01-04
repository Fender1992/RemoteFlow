'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bookmark, Sparkles, CheckCircle, ShieldAlert } from 'lucide-react'
import { JobCard } from '@/components/jobs/JobCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { ViewToggle, type ViewMode } from '@/components/pipeline/ViewToggle'
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate'
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
  { value: 'interviewing', label: 'Interview' },
  { value: 'offer', label: 'Offers' },
  { value: 'rejected', label: 'Rejected' },
]

function EmptyState() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-sm">
      <div className="text-center py-16 px-6">
        {/* Large bookmark icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-[var(--primary-50)] flex items-center justify-center mb-6">
          <Bookmark className="w-10 h-10 text-[var(--primary-600)]" />
        </div>

        {/* Headline */}
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          No saved jobs yet
        </h2>

        {/* Description */}
        <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-8">
          Save jobs you&apos;re interested in to keep track of them here. You can update their status as you apply and progress through the hiring process.
        </p>

        {/* Pro tips section */}
        <div className="bg-[var(--primary-50)] rounded-lg p-6 max-w-lg mx-auto mb-8">
          <h3 className="text-sm font-semibold text-[var(--primary-700)] uppercase tracking-wide mb-4">
            Pro Tips
          </h3>
          <ul className="space-y-4 text-left">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[var(--primary-600)]" />
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Use <span className="font-medium text-[var(--text-primary)]">&quot;Ask AI&quot;</span> on any job to check if it&apos;s worth applying based on your profile
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--health-good-bg)] flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-[var(--health-good)]" />
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Look for the <span className="font-medium text-[var(--health-good-text)]">green health indicator</span> - it means the job is actively hiring
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--health-danger-bg)] flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-[var(--health-danger)]" />
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Avoid jobs with <span className="font-medium text-[var(--health-danger-text)]">&quot;High ghost risk&quot;</span> badges - they may be stale or inactive
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
  const { jobs: savedJobs, updateStatus, removeJob } = useOptimisticUpdate(initialSavedJobs)
  const [activeTab, setActiveTab] = useState<SavedJobStatus | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [isMobile, setIsMobile] = useState(false)

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // On mobile, default to list view
  const effectiveViewMode = isMobile ? 'list' : viewMode

  const filteredJobs = activeTab === 'all'
    ? savedJobs
    : savedJobs.filter((sj) => sj.status === activeTab)

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
      {/* Header with view toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Job Pipeline
          </h1>
          <p className="text-[var(--text-secondary)]">
            Track your job applications and saved positions
          </p>
        </div>

        {/* View toggle - hidden on mobile */}
        {!isMobile && savedJobs.length > 0 && (
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        )}
      </div>

      {/* Conditional rendering based on view mode */}
      {savedJobs.length === 0 ? (
        <EmptyState />
      ) : effectiveViewMode === 'board' ? (
        <KanbanBoard
          savedJobs={savedJobs}
          onStatusChange={updateStatus}
          onRemove={removeJob}
        />
      ) : (
        <>
          {/* Status tabs for list view */}
          <div className="horizontal-scroll flex gap-2 mb-6">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
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
            <FilteredEmptyState status={activeTab} />
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((savedJob) => (
                <div key={savedJob.id} className="relative">
                  <JobCard
                    job={savedJob.job}
                    isSaved={true}
                    savedStatus={savedJob.status}
                    onUnsave={removeJob}
                    showActions={false}
                  />

                  {/* Status controls */}
                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                    <Badge
                      variant={
                        savedJob.status === 'applied'
                          ? 'info'
                          : savedJob.status === 'interviewing'
                          ? 'warning'
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
                          onClick={() => updateStatus(savedJob.job_id, 'applied')}
                        >
                          Mark Applied
                        </Button>
                      )}
                      {savedJob.status === 'applied' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => updateStatus(savedJob.job_id, 'interviewing')}
                          >
                            Got Interview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateStatus(savedJob.job_id, 'rejected')}
                          >
                            Rejected
                          </Button>
                        </>
                      )}
                      {savedJob.status === 'interviewing' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => updateStatus(savedJob.job_id, 'offer')}
                          >
                            Got Offer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateStatus(savedJob.job_id, 'rejected')}
                          >
                            Rejected
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeJob(savedJob.job_id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
