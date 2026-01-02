'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { JobList } from '@/components/jobs/JobList'
import { JobFilters } from '@/components/jobs/JobFilters'
import { JobSearch } from '@/components/jobs/JobSearch'
import { JobCardSkeletonList } from '@/components/jobs/JobCardSkeleton'
import { Button } from '@/components/ui/Button'
import type { Job } from '@/types'

interface JobsClientProps {
  initialJobs: Job[]
  savedJobs: { job_id: string; status: string }[]
  totalJobs: number
  currentPage: number
  pageSize: number
}

function JobsClientInner({
  initialJobs,
  savedJobs: initialSavedJobs,
  totalJobs,
  currentPage,
  pageSize,
}: JobsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [jobs] = useState(initialJobs)
  const [saved, setSaved] = useState(initialSavedJobs)

  const totalPages = Math.ceil(totalJobs / pageSize)

  const handleSave = async (jobId: string) => {
    const res = await fetch('/api/saved-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    })

    if (res.ok) {
      setSaved([...saved, { job_id: jobId, status: 'saved' }])
    }
  }

  const handleUnsave = async (jobId: string) => {
    const res = await fetch(`/api/saved-jobs/${jobId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setSaved(saved.filter((s) => s.job_id !== jobId))
    }
  }

  const handleApply = async (jobId: string) => {
    const res = await fetch(`/api/saved-jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'applied' }),
    })

    if (res.ok) {
      setSaved(saved.map((s) => (s.job_id === jobId ? { ...s, status: 'applied' } : s)))
    }
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/jobs?${params.toString()}`)
  }

  // Convert saved array to SavedJob format for JobList
  const savedJobsForList = saved.map((s) => ({
    id: '',
    user_id: '',
    job_id: s.job_id,
    status: s.status as 'saved' | 'applied' | 'rejected' | 'offer',
    notes: null,
    applied_date: null,
    created_at: '',
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Remote Jobs</h1>
        <p className="text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--primary-600)]">{totalJobs.toLocaleString()}</span> jobs with AI-powered ghost detection
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters sidebar */}
        <aside className="lg:w-64 flex-shrink-0">
          <Suspense fallback={<div className="p-4 bg-white rounded-lg border">Loading filters...</div>}>
            <JobFilters />
          </Suspense>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          <div className="mb-4">
            <Suspense fallback={<div className="h-10 bg-gray-100 rounded-lg animate-pulse" />}>
              <JobSearch />
            </Suspense>
          </div>

          <JobList
            jobs={jobs}
            savedJobs={savedJobsForList}
            onSave={handleSave}
            onUnsave={handleUnsave}
            onApply={handleApply}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--text-secondary)] px-3 py-1 bg-gray-50 rounded-md">
                Page <span className="font-medium text-[var(--text-primary)]">{currentPage}</span> of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function JobsClient(props: JobsClientProps) {
  return (
    <Suspense fallback={
      <div>
        <div className="mb-6">
          <div className="h-8 w-48 rounded skeleton mb-2" />
          <div className="h-5 w-64 rounded skeleton" />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-64 flex-shrink-0">
            <div className="p-4 bg-white rounded-lg border space-y-4">
              <div className="h-6 w-32 rounded skeleton" />
              <div className="h-10 w-full rounded skeleton" />
              <div className="h-10 w-full rounded skeleton" />
            </div>
          </aside>
          <div className="flex-1">
            <JobCardSkeletonList count={5} />
          </div>
        </div>
      </div>
    }>
      <JobsClientInner {...props} />
    </Suspense>
  )
}
