'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatSalary, formatDate, capitalizeFirst, cn } from '@/lib/utils'
import { JobHealthBadge, getHealthStatus } from '@/components/jobs/JobHealthBadge'
import { ReportJobModal } from '@/components/jobs/ReportJobModal'
import { JobChatPanel } from '@/components/jobs/JobChatPanel'
import { MatchBadge } from '@/components/jobs/MatchBadge'
import type { Job, GhostFlag, Company, CompanyReputation } from '@/types'

interface JobCardProps {
  job: Job
  isSaved?: boolean
  savedStatus?: string
  onSave?: (jobId: string) => Promise<void>
  onUnsave?: (jobId: string) => Promise<void>
  onApply?: (jobId: string) => Promise<void>
  showActions?: boolean
  showReportButton?: boolean
  showMatchBadge?: boolean
}

// Extended Company type that includes reputation
interface CompanyWithReputation extends Company {
  reputation?: CompanyReputation
}

function getCompanyResponseRate(companyData?: CompanyWithReputation): number | null {
  const rep = companyData?.reputation
  if (!rep || !rep.total_applications_tracked) return null
  return rep.applications_with_response / rep.total_applications_tracked
}

function getHealthIndicatorColor(status: 'healthy' | 'caution' | 'danger'): string {
  switch (status) {
    case 'healthy':
      return 'bg-[var(--health-good)]'
    case 'caution':
      return 'bg-[var(--health-caution)]'
    case 'danger':
      return 'bg-[var(--health-danger)]'
  }
}

export function JobCard({
  job,
  isSaved = false,
  savedStatus,
  onSave,
  onUnsave,
  onApply,
  showActions = true,
  showReportButton = true,
  showMatchBadge = true,
}: JobCardProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(isSaved)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(false)

  const healthScore = job.health_score ?? job.quality_score ?? 0.5
  const ghostScore = job.ghost_score ?? 0
  const healthStatus = getHealthStatus(healthScore, ghostScore)
  const companyData = job.company_data as CompanyWithReputation | undefined
  const responseRate = getCompanyResponseRate(companyData)

  const handleSaveToggle = async () => {
    if (saving) return
    setSaving(true)

    try {
      if (saved && onUnsave) {
        await onUnsave(job.id)
        setSaved(false)
      } else if (!saved && onSave) {
        await onSave(job.id)
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to toggle save:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
      {/* Left edge health indicator bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1',
          getHealthIndicatorColor(healthStatus)
        )}
      />

      <CardContent className="p-4 pl-5">
        {/* Header: Logo, Company Name, Posted Date, Save Button */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Company logo or placeholder with gradient */}
            {job.company_logo ? (
              <img
                src={job.company_logo}
                alt={job.company}
                className="w-12 h-12 rounded-lg object-contain bg-gray-50 border border-[var(--border-default)]"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--primary-100)] to-[var(--primary-50)] border border-[var(--border-default)]">
                <span className="text-lg font-semibold text-[var(--primary-600)]">
                  {job.company.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">{job.company}</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {job.posted_date ? formatDate(job.posted_date) : 'Recently posted'}
              </p>
            </div>
          </div>

          {/* Save button */}
          {showActions && (
            <button
              onClick={handleSaveToggle}
              disabled={saving}
              className={cn(
                'p-2 rounded-lg transition-colors',
                saved
                  ? 'text-[var(--primary-600)] bg-[var(--primary-50)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--primary-600)] hover:bg-[var(--primary-50)]'
              )}
              title={saved ? 'Remove from saved' : 'Save job'}
            >
              <svg
                className="w-5 h-5"
                fill={saved ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Title section with hover color change and match badge */}
        <div className="flex items-start gap-2 mb-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] group flex-1">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--primary-600)] transition-colors"
            >
              {job.title}
            </a>
          </h3>
          {showMatchBadge && (
            <MatchBadge jobId={job.id} className="flex-shrink-0" />
          )}
        </div>

        {/* Meta row: Location, Salary, Job Type with icons */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-[var(--text-secondary)]">
          {/* Location */}
          {job.timezone && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{job.timezone === 'global' ? 'Worldwide' : job.timezone}</span>
            </div>
          )}

          {/* Salary */}
          {(job.salary_min || job.salary_max) && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatSalary(job.salary_min, job.salary_max, job.currency)}</span>
            </div>
          )}

          {/* Job Type */}
          {job.job_type && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{capitalizeFirst(job.job_type)}</span>
            </div>
          )}
        </div>

        {/* Tags section (tech stack, experience level) - limit to 6, horizontal scroll on mobile */}
        <div className="horizontal-scroll flex flex-nowrap sm:flex-wrap gap-1.5 mb-4 -mx-1 px-1">
          {job.experience_level && job.experience_level !== 'any' && (
            <Badge variant="default">{capitalizeFirst(job.experience_level)}</Badge>
          )}
          {job.tech_stack && job.tech_stack.slice(0, 5).map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 bg-gray-100 text-[var(--text-secondary)] text-xs rounded"
            >
              {tech}
            </span>
          ))}
          {job.tech_stack && job.tech_stack.length > 5 && (
            <span className="px-2 py-0.5 text-[var(--text-tertiary)] text-xs">
              +{job.tech_stack.length - 5} more
            </span>
          )}
        </div>

        {/* Intelligence section - gray background panel, stacks on mobile */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-[var(--border-default)]">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
            {/* Health badge */}
            <JobHealthBadge
              healthScore={healthScore}
              ghostScore={ghostScore}
              showTooltip={true}
            />

            {/* Company response rate */}
            {responseRate !== null && (
              <div className="flex items-center gap-1.5 text-sm">
                <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-[var(--text-secondary)]">
                  {Math.round(responseRate * 100)}% response rate
                </span>
              </div>
            )}

            {/* Repost warning */}
            {(job.repost_count ?? 0) > 1 && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--health-caution-text)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reposted {job.repost_count}x</span>
              </div>
            )}

            {/* Application count badge */}
            {(job.application_count ?? 0) >= 5 && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>{job.application_count} applied via JobIQ</span>
              </div>
            )}

            {/* Application time indicator */}
            {job.avg_time_to_apply_seconds != null && (
              <div className={cn(
                "flex items-center gap-1.5 text-sm",
                job.avg_time_to_apply_seconds < 300
                  ? "text-[var(--health-good-text)]"
                  : job.avg_time_to_apply_seconds > 900
                    ? "text-[var(--health-caution-text)]"
                    : "text-[var(--text-tertiary)]"
              )}>
                <span>
                  {job.avg_time_to_apply_seconds < 300
                    ? `⚡ Quick apply (${Math.round(job.avg_time_to_apply_seconds / 60)} min avg)`
                    : job.avg_time_to_apply_seconds > 900
                      ? `📝 Long application (${Math.round(job.avg_time_to_apply_seconds / 60)} min avg)`
                      : `${Math.round(job.avg_time_to_apply_seconds / 60)} min avg to apply`
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Prominent "Ask AI" button - full width, gradient background, sparkle animation */}
        <button
          onClick={() => setShowChatPanel(true)}
          className="w-full py-2.5 px-4 rounded-lg font-medium text-white bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-700)] hover:from-[var(--primary-700)] hover:to-[var(--primary-600)] transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 animate-sparkle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Ask AI About This Job
        </button>
      </CardContent>

      {/* Footer: View Details link, Report button - stacks on mobile */}
      <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--primary-600)] hover:text-[var(--primary-700)] flex items-center gap-1"
        >
          View Details
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        <div className="flex items-center gap-3">
          {/* Mark Applied button for saved jobs */}
          {saved && savedStatus === 'saved' && onApply && showActions && (
            <button
              onClick={() => onApply(job.id)}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--primary-600)]"
            >
              Mark Applied
            </button>
          )}

          {/* Report button */}
          {showReportButton && (
            <button
              onClick={() => setShowReportModal(true)}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--health-danger)] flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              Report
            </button>
          )}
        </div>
      </CardFooter>

      {/* Report Modal */}
      <ReportJobModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        jobId={job.id}
        jobTitle={job.title}
      />

      {/* Chat Panel */}
      <JobChatPanel
        isOpen={showChatPanel}
        onClose={() => setShowChatPanel(false)}
        job={job}
      />
    </Card>
  )
}
