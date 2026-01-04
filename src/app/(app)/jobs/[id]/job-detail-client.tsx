'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, DollarSign, Briefcase, Clock, ExternalLink, Bookmark, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { JobHealthBadge, getHealthStatus } from '@/components/jobs/JobHealthBadge'
import { MatchBadge } from '@/components/jobs/MatchBadge'
import { JobChatInline } from '@/components/jobs/JobChatInline'
import { formatSalary, formatDate, capitalizeFirst, cn } from '@/lib/utils'
import type { Job, SavedJob, Company, CompanyReputation, SavedJobStatus } from '@/types'

interface CompanyWithReputation extends Company {
  reputation?: CompanyReputation
}

interface JobDetailClientProps {
  job: Job
  savedJob: SavedJob | null
  isAuthenticated: boolean
}

function getCompanyResponseRate(companyData?: CompanyWithReputation): number | null {
  const rep = companyData?.reputation
  if (!rep || !rep.total_applications_tracked) return null
  return rep.applications_with_response / rep.total_applications_tracked
}

export function JobDetailClient({ job, savedJob: initialSavedJob, isAuthenticated }: JobDetailClientProps) {
  const [savedJob, setSavedJob] = useState(initialSavedJob)
  const [saving, setSaving] = useState(false)

  const healthScore = job.health_score ?? job.quality_score ?? 0.5
  const ghostScore = job.ghost_score ?? 0
  const healthStatus = getHealthStatus(healthScore, ghostScore)
  const companyData = job.company_data as CompanyWithReputation | undefined
  const responseRate = getCompanyResponseRate(companyData)

  const handleSaveToggle = async () => {
    if (!isAuthenticated || saving) return
    setSaving(true)

    try {
      if (savedJob) {
        // Unsave
        const res = await fetch(`/api/saved-jobs/${job.id}`, { method: 'DELETE' })
        if (res.ok) {
          setSavedJob(null)
        }
      } else {
        // Save
        const res = await fetch('/api/saved-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id }),
        })
        if (res.ok) {
          const data = await res.json()
          setSavedJob(data)
        }
      }
    } catch (error) {
      console.error('Failed to toggle save:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (newStatus: SavedJobStatus) => {
    if (!savedJob || saving) return
    setSaving(true)

    try {
      const res = await fetch(`/api/saved-jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedJob(data)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${job.title} at ${job.company}`,
          text: `Check out this job: ${job.title} at ${job.company}`,
          url: window.location.href,
        })
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/jobs"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to jobs
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left column - Main content */}
        <div className="flex-1 lg:max-w-[65%]">
          {/* Header card */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-6 mb-6">
            {/* Company info */}
            <div className="flex items-start gap-4 mb-6">
              {job.company_logo ? (
                <img
                  src={job.company_logo}
                  alt={job.company}
                  className="w-16 h-16 rounded-xl object-contain bg-gray-50 border border-[var(--border-default)]"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--primary-100)] to-[var(--primary-50)] border border-[var(--border-default)]">
                  <span className="text-2xl font-semibold text-[var(--primary-600)]">
                    {job.company.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium text-[var(--text-secondary)]">{job.company}</p>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">{job.title}</h1>
              </div>
              <MatchBadge jobId={job.id} className="flex-shrink-0" />
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-[var(--text-secondary)]">
              {job.timezone && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span>{job.timezone === 'global' ? 'Worldwide' : job.timezone}</span>
                </div>
              )}
              {(job.salary_min || job.salary_max) && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span>{formatSalary(job.salary_min, job.salary_max, job.currency)}</span>
                </div>
              )}
              {job.job_type && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span>{capitalizeFirst(job.job_type)}</span>
                </div>
              )}
              {job.posted_date && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span>Posted {formatDate(job.posted_date)}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {job.experience_level && job.experience_level !== 'any' && (
                <Badge variant="default">{capitalizeFirst(job.experience_level)}</Badge>
              )}
              {job.tech_stack?.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 bg-gray-100 text-[var(--text-secondary)] text-sm rounded-lg"
                >
                  {tech}
                </span>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="primary" size="lg" className="w-full">
                  Apply Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </a>
              <Button
                variant={savedJob ? 'primary' : 'secondary'}
                size="lg"
                onClick={handleSaveToggle}
                disabled={saving || !isAuthenticated}
                className={cn(savedJob && 'bg-[var(--primary-100)] text-[var(--primary-700)] border-[var(--primary-200)]')}
              >
                <Bookmark className={cn('w-4 h-4 mr-2', savedJob && 'fill-current')} />
                {savedJob ? 'Saved' : 'Save'}
              </Button>
              <Button variant="ghost" size="lg" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Pipeline status if saved */}
            {savedJob && (
              <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                <p className="text-sm text-[var(--text-tertiary)] mb-2">Pipeline status</p>
                <div className="flex flex-wrap gap-2">
                  {(['saved', 'applied', 'interviewing', 'offer', 'rejected'] as SavedJobStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(status)}
                      disabled={saving}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        savedJob.status === status
                          ? 'bg-[var(--primary-600)] text-white'
                          : 'bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200'
                      )}
                    >
                      {capitalizeFirst(status)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Job Description</h2>
            {job.description ? (
              <div
                className="prose prose-sm max-w-none text-[var(--text-secondary)]"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            ) : (
              <p className="text-[var(--text-tertiary)]">
                No description available. Visit the original posting for more details.
              </p>
            )}
          </div>
        </div>

        {/* Right column - Sidebar */}
        <div className="lg:w-[35%]">
          <div className="lg:sticky lg:top-24 space-y-6">
            {/* Job Intelligence Panel */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide mb-4">
                Job Intelligence
              </h3>
              <div className="space-y-4">
                {/* Health badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Health Status</span>
                  <JobHealthBadge
                    healthScore={healthScore}
                    ghostScore={ghostScore}
                    showTooltip={true}
                  />
                </div>

                {/* Response rate */}
                {responseRate !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Company Response Rate</span>
                    <span className={cn(
                      'text-sm font-medium',
                      responseRate >= 0.5 ? 'text-[var(--health-good-text)]' : 'text-[var(--text-secondary)]'
                    )}>
                      {Math.round(responseRate * 100)}%
                    </span>
                  </div>
                )}

                {/* Repost count */}
                {(job.repost_count ?? 0) > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Times Reposted</span>
                    <span className="text-sm font-medium text-[var(--health-caution-text)]">
                      {job.repost_count}x
                    </span>
                  </div>
                )}

                {/* Application count */}
                {(job.application_count ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Applications via JobIQ</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {job.application_count}
                    </span>
                  </div>
                )}

                {/* Average apply time */}
                {job.avg_time_to_apply_seconds != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Avg. Application Time</span>
                    <span className={cn(
                      'text-sm font-medium',
                      job.avg_time_to_apply_seconds < 300
                        ? 'text-[var(--health-good-text)]'
                        : job.avg_time_to_apply_seconds > 900
                          ? 'text-[var(--health-caution-text)]'
                          : 'text-[var(--text-secondary)]'
                    )}>
                      {Math.round(job.avg_time_to_apply_seconds / 60)} min
                    </span>
                  </div>
                )}

                {/* Company verification */}
                {companyData?.is_verified && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Company Verified</span>
                    <span className="text-sm font-medium text-[var(--health-good-text)]">Yes</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Chat Panel */}
            <JobChatInline job={job} />
          </div>
        </div>
      </div>
    </div>
  )
}
