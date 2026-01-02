'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { ImportProgressResponse, ImportSiteId } from '@/types'

interface ImportProgressProps {
  sessionId: string
  onComplete?: () => void
  onCancel?: () => void
}

const SITE_NAMES: Record<ImportSiteId, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  glassdoor: 'Glassdoor',
  dice: 'Dice',
  wellfound: 'Wellfound',
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-600'
    case 'running':
      return 'text-blue-600'
    case 'failed':
      return 'text-red-600'
    case 'skipped':
      return 'text-gray-400'
    default:
      return 'text-gray-500'
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '\u2713' // checkmark
    case 'running':
      return '\u21bb' // refresh/loading symbol
    case 'failed':
      return '\u2717' // x mark
    case 'skipped':
      return '\u2014' // dash
    default:
      return '\u25cb' // circle
  }
}

export function ImportProgress({ sessionId, onComplete, onCancel }: ImportProgressProps) {
  const router = useRouter()
  const [session, setSession] = useState<ImportProgressResponse | null>(null)
  const [polling, setPolling] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/import/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setSession(data)

        // Stop polling when done
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          setPolling(false)
          if (data.status === 'completed' && onComplete) {
            onComplete()
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch import progress:', err)
    }
  }, [sessionId, onComplete])

  useEffect(() => {
    if (!polling) return

    // Initial fetch
    fetchProgress()

    // Poll every 2 seconds
    const interval = setInterval(fetchProgress, 2000)
    return () => clearInterval(interval)
  }, [polling, fetchProgress])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const res = await fetch(`/api/import/sessions/${sessionId}`, { method: 'DELETE' })
      if (res.ok) {
        setPolling(false)
        if (onCancel) onCancel()
      }
    } catch (err) {
      console.error('Failed to cancel import:', err)
    } finally {
      setCancelling(false)
    }
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">Loading import progress...</div>
        </CardContent>
      </Card>
    )
  }

  const isRunning = session.status === 'pending' || session.status === 'running'
  const completedSites = session.sites.filter((s) => s.status === 'completed').length
  const totalSites = session.sites.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              {isRunning ? 'Finding Jobs...' : session.status === 'completed' ? 'Import Complete!' : 'Import ' + session.status}
            </h2>
            <p className="text-sm text-gray-500">
              Searching for: {session.search_params.roles.join(', ')}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              session.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : session.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
            }`}
          >
            {session.status}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{session.progress.total_jobs_found}</p>
            <p className="text-sm text-gray-500">Jobs Found</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{session.progress.total_jobs_imported}</p>
            <p className="text-sm text-gray-500">New Jobs</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-400">{session.progress.duplicates_skipped}</p>
            <p className="text-sm text-gray-500">Duplicates</p>
          </div>
        </div>

        {/* Site progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Site Progress</span>
            <span>
              {completedSites} / {totalSites} complete
            </span>
          </div>

          {session.sites.map((site) => (
            <div
              key={site.site_id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg ${getStatusColor(site.status)}`}>
                  {site.status === 'running' ? (
                    <span className="inline-block animate-spin">{getStatusIcon(site.status)}</span>
                  ) : (
                    getStatusIcon(site.status)
                  )}
                </span>
                <span className="font-medium text-gray-700">
                  {SITE_NAMES[site.site_id as ImportSiteId] || site.site_id}
                </span>
              </div>
              <div className="text-right">
                {site.status === 'completed' ? (
                  <span className="text-sm text-green-600">
                    {site.jobs_imported} jobs imported
                  </span>
                ) : site.status === 'running' ? (
                  <span className="text-sm text-blue-600">
                    {site.jobs_found} found so far...
                  </span>
                ) : site.error ? (
                  <span className="text-sm text-red-500" title={site.error}>
                    Error
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">
                    {site.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {isRunning && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-gray-500 mb-3">
              You can close this page - the import will continue in the background.
            </p>
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Import'}
            </Button>
          </div>
        )}

        {session.status === 'completed' && (
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-green-600 font-medium mb-2">
              Successfully imported {session.progress.total_jobs_imported} new jobs!
            </p>
            <Button
              onClick={() => router.push('/jobs')}
            >
              View Jobs
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
