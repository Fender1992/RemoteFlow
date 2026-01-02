'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatSalary, formatDate, capitalizeFirst } from '@/lib/utils'
import type { Job } from '@/types'

interface JobCardProps {
  job: Job
  isSaved?: boolean
  savedStatus?: string
  onSave?: (jobId: string) => Promise<void>
  onUnsave?: (jobId: string) => Promise<void>
  onApply?: (jobId: string) => Promise<void>
  showActions?: boolean
}

export function JobCard({
  job,
  isSaved = false,
  savedStatus,
  onSave,
  onUnsave,
  onApply,
  showActions = true,
}: JobCardProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(isSaved)

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

  const handleApply = async () => {
    if (onApply) {
      await onApply(job.id)
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Company logo and name */}
            <div className="flex items-center gap-3 mb-2">
              {job.company_logo && (
                <img
                  src={job.company_logo}
                  alt={job.company}
                  className="w-10 h-10 rounded-lg object-contain bg-gray-50"
                />
              )}
              <div>
                <p className="text-sm text-gray-600">{job.company}</p>
                <p className="text-xs text-gray-400">{formatDate(job.posted_date)}</p>
              </div>
            </div>

            {/* Job title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600"
              >
                {job.title}
              </a>
            </h3>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {job.job_type && (
                <Badge variant="info">{capitalizeFirst(job.job_type)}</Badge>
              )}
              {job.experience_level && job.experience_level !== 'any' && (
                <Badge variant="default">{capitalizeFirst(job.experience_level)}</Badge>
              )}
              {(job.salary_min || job.salary_max) && (
                <Badge variant="success">
                  {formatSalary(job.salary_min, job.salary_max, job.currency)}
                </Badge>
              )}
              {job.timezone && job.timezone !== 'global' && (
                <Badge variant="default">{job.timezone}</Badge>
              )}
            </div>

            {/* Tech stack */}
            {job.tech_stack && job.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {job.tech_stack.slice(0, 6).map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {tech}
                  </span>
                ))}
                {job.tech_stack.length > 6 && (
                  <span className="px-2 py-0.5 text-gray-400 text-xs">
                    +{job.tech_stack.length - 6} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex flex-col gap-2">
              <Button
                variant={saved ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleSaveToggle}
                disabled={saving}
              >
                {saving ? '...' : saved ? 'Saved' : 'Save'}
              </Button>
              {saved && savedStatus === 'saved' && onApply && (
                <Button variant="ghost" size="sm" onClick={handleApply}>
                  Mark Applied
                </Button>
              )}
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-sm text-blue-600 hover:text-blue-700"
              >
                View Job
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
