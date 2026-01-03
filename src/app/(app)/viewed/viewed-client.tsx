'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { JobView, JobViewPlatform } from '@/types'

interface ViewedClientProps {
  initialViews: JobView[]
  availablePlatforms: string[]
}

const PLATFORM_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  linkedin: { name: 'LinkedIn', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  indeed: { name: 'Indeed', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  glassdoor: { name: 'Glassdoor', color: 'text-green-700', bgColor: 'bg-green-100' },
  greenhouse: { name: 'Greenhouse', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  lever: { name: 'Lever', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  workday: { name: 'Workday', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  ashby: { name: 'Ashby', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  dice: { name: 'Dice', color: 'text-red-700', bgColor: 'bg-red-100' },
  wellfound: { name: 'Wellfound', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  remotive: { name: 'Remotive', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  unknown: { name: 'Other', color: 'text-gray-700', bgColor: 'bg-gray-100' },
}

function PlatformBadge({ platform }: { platform: JobViewPlatform | null }) {
  const config = PLATFORM_CONFIG[platform || 'unknown'] || PLATFORM_CONFIG.unknown

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${config.bgColor} ${config.color}`}>
      {config.name}
    </span>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function BookmarkIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
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

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-sm">
      <div className="text-center py-16 px-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-[var(--primary-50)] flex items-center justify-center mb-6">
          <EyeIcon className="w-10 h-10 text-[var(--primary-600)]" />
        </div>

        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          No viewed jobs yet
        </h2>

        <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-8">
          Install the RemoteFlow browser extension to automatically track jobs you view on LinkedIn, Indeed, Glassdoor, and more.
        </p>

        <div className="bg-[var(--primary-50)] rounded-lg p-6 max-w-lg mx-auto mb-8">
          <h3 className="text-sm font-semibold text-[var(--primary-700)] uppercase tracking-wide mb-4">
            How It Works
          </h3>
          <ul className="space-y-4 text-left">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary-100)] flex items-center justify-center text-sm font-medium text-[var(--primary-600)]">
                1
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Install the browser extension from the Chrome Web Store
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary-100)] flex items-center justify-center text-sm font-medium text-[var(--primary-600)]">
                2
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Browse jobs normally on your favorite job boards
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary-100)] flex items-center justify-center text-sm font-medium text-[var(--primary-600)]">
                3
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Your view history appears here automatically
              </span>
            </li>
          </ul>
        </div>

        <Link href="/jobs">
          <Button variant="primary" size="lg">
            Browse Jobs on RemoteFlow
          </Button>
        </Link>
      </div>
    </div>
  )
}

function ViewedJobCard({
  view,
  onSave,
  saving,
}: {
  view: JobView
  onSave: (view: JobView) => void
  saving: boolean
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-default)] p-4 hover:border-[var(--primary-600)] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PlatformBadge platform={view.platform} />
            <span className="text-xs text-[var(--text-tertiary)]">
              {formatTimeAgo(view.viewed_at)}
            </span>
          </div>

          <h3 className="font-medium text-[var(--text-primary)] truncate">
            {view.title || 'Untitled Job'}
          </h3>

          {view.company && (
            <p className="text-sm text-[var(--text-secondary)] truncate">
              {view.company}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!view.saved ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSave(view)}
              disabled={saving}
              className="flex items-center gap-1.5"
            >
              <BookmarkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          ) : (
            <Badge variant="success" className="flex items-center gap-1">
              <BookmarkIcon className="w-3 h-3" filled />
              Saved
            </Badge>
          )}

          <a
            href={view.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            title="Open original posting"
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

export function ViewedClient({ initialViews, availablePlatforms }: ViewedClientProps) {
  const [views, setViews] = useState<JobView[]>(initialViews)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialViews.length >= 20)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const fetchViews = useCallback(async (newPage: number, platform: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(newPage),
        limit: '20',
      })
      if (platform !== 'all') {
        params.set('platform', platform)
      }

      const res = await fetch(`/api/job-views?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (newPage === 1) {
          setViews(data.views)
        } else {
          setViews(prev => [...prev, ...data.views])
        }
        setHasMore(data.hasMore)
        setPage(newPage)
      }
    } catch (err) {
      console.error('Failed to fetch views:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform)
    setPage(1)
    fetchViews(1, platform)
  }

  const handleLoadMore = () => {
    fetchViews(page + 1, selectedPlatform)
  }

  const handleSave = async (view: JobView) => {
    if (!view.job_id) {
      // Cannot save if there's no matched job_id in our database
      // For now, we'll just mark it as saved in job_views
      setSavingIds(prev => new Set(prev).add(view.id))
      try {
        // Update the job_views table to mark as saved
        const res = await fetch('/api/job-views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: view.url,
            title: view.title,
            company: view.company,
            platform: view.platform,
          }),
        })

        if (res.ok) {
          // Mark the view as saved locally
          setViews(prev =>
            prev.map(v => (v.id === view.id ? { ...v, saved: true } : v))
          )
        }
      } catch (err) {
        console.error('Failed to save view:', err)
      } finally {
        setSavingIds(prev => {
          const next = new Set(prev)
          next.delete(view.id)
          return next
        })
      }
      return
    }

    // If we have a job_id, save to saved_jobs table
    setSavingIds(prev => new Set(prev).add(view.id))
    try {
      const res = await fetch('/api/saved-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: view.job_id }),
      })

      if (res.ok || res.status === 409) {
        // 409 means already saved, which is fine
        setViews(prev =>
          prev.map(v => (v.id === view.id ? { ...v, saved: true } : v))
        )
      }
    } catch (err) {
      console.error('Failed to save job:', err)
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev)
        next.delete(view.id)
        return next
      })
    }
  }

  const filteredViews = selectedPlatform === 'all'
    ? views
    : views.filter(v => v.platform === selectedPlatform)

  const platformTabs = [
    { value: 'all', label: 'All' },
    ...availablePlatforms.map(p => ({
      value: p,
      label: PLATFORM_CONFIG[p]?.name || p,
    })),
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Jobs You've Viewed
        </h1>
        <p className="text-[var(--text-secondary)]">
          Track your browsing history across job boards
        </p>
      </div>

      {views.length === 0 && selectedPlatform === 'all' ? (
        <EmptyState />
      ) : (
        <>
          {/* Platform filter tabs */}
          {availablePlatforms.length > 0 && (
            <div className="horizontal-scroll mb-6">
              {platformTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => handlePlatformChange(tab.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    selectedPlatform === tab.value
                      ? 'bg-[var(--primary-600)] text-white shadow-md shadow-[var(--primary-600)]/25'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] hover:border-[var(--primary-600)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Views list */}
          {filteredViews.length === 0 ? (
            <div className="text-center py-12 bg-[var(--bg-card)] rounded-lg border border-[var(--border-default)]">
              <p className="text-[var(--text-tertiary)]">
                No jobs viewed on {PLATFORM_CONFIG[selectedPlatform]?.name || selectedPlatform}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredViews.map((view) => (
                <ViewedJobCard
                  key={view.id}
                  view={view}
                  onSave={handleSave}
                  saving={savingIds.has(view.id)}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="secondary"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
