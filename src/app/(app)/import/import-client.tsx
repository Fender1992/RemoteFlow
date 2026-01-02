'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FindJobsButton } from '@/components/import/FindJobsButton'
import { ImportProgress } from '@/components/import/ImportProgress'
import type { UserPreferencesExtended, ImportSession } from '@/types'

interface ImportClientProps {
  preferences: UserPreferencesExtended
  recentSessions: ImportSession[]
}

// Site logo components
const SiteLogos = {
  linkedin: () => (
    <div className="w-8 h-8 bg-[#0A66C2] rounded flex items-center justify-center">
      <span className="text-white text-xs font-bold">in</span>
    </div>
  ),
  indeed: () => (
    <div className="w-8 h-8 bg-[#2164f3] rounded flex items-center justify-center">
      <span className="text-white text-xs font-bold">in</span>
    </div>
  ),
  glassdoor: () => (
    <div className="w-8 h-8 bg-[#0caa41] rounded flex items-center justify-center">
      <span className="text-white text-xs font-bold">G</span>
    </div>
  ),
  dice: () => (
    <div className="w-8 h-8 bg-[#eb1c26] rounded flex items-center justify-center">
      <span className="text-white text-xs font-bold">D</span>
    </div>
  ),
  wellfound: () => (
    <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
      <span className="text-white text-xs font-bold">W</span>
    </div>
  ),
}

export function ImportClient({ preferences, recentSessions }: ImportClientProps) {
  const router = useRouter()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const hasSearchRoles = preferences.search_roles && preferences.search_roles.length > 0
  const enabledSites = preferences.enabled_sites || ['linkedin', 'indeed', 'glassdoor', 'dice', 'wellfound']

  const handleSessionStarted = (sessionId: string) => {
    setActiveSessionId(sessionId)
  }

  const handleImportComplete = () => {
    // Could refresh the page or update state
  }

  const handleCancel = () => {
    setActiveSessionId(null)
  }

  // If an import is active, show the progress
  if (activeSessionId) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => setActiveSessionId(null)}
            className="text-[var(--primary-600)] hover:text-[var(--primary-700)] text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Import Dashboard
          </button>
        </div>
        <ImportProgress
          sessionId={activeSessionId}
          onComplete={handleImportComplete}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary-50)] rounded-full border border-[var(--primary-100)]">
          <svg
            className="w-4 h-4 text-[var(--primary-600)] animate-sparkle"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
          </svg>
          <span className="text-sm font-medium text-[var(--primary-700)]">AI-Powered Job Intelligence</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold text-[var(--text-primary)]">
          Find Jobs For Me
        </h1>

        {/* Subtitle with colored text */}
        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
          One click to search all major job boards. We&apos;ll tell you which jobs are{' '}
          <span className="font-semibold text-[var(--health-good)]">actually hiring</span>
          {' '}and which are{' '}
          <span className="font-semibold text-[var(--health-danger)]">ghost jobs</span>.
        </p>
      </div>

      {/* Main Search Card */}
      <Card className="border-2 border-[var(--primary-100)] shadow-lg overflow-hidden">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            {/* Ready Status */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--health-good-bg)] rounded-full">
              <svg className="w-4 h-4 text-[var(--health-good)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm font-medium text-[var(--health-good-text)]">Ready to Search</span>
            </div>

            {hasSearchRoles ? (
              <>
                {/* Search Roles as Chips */}
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-tertiary)]">Searching for:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {preferences.search_roles?.map((role) => (
                      <span
                        key={role}
                        className="px-4 py-2 bg-[var(--primary-100)] text-[var(--primary-700)] rounded-full text-sm font-medium"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Location Indicator */}
                {preferences.location_preference && (
                  <div className="flex items-center justify-center gap-2 text-[var(--text-secondary)]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm">
                      {preferences.location_preference === 'remote'
                        ? 'Remote positions'
                        : preferences.location_preference === 'hybrid'
                          ? `Hybrid - ${preferences.preferred_cities?.join(', ') || 'Any location'}`
                          : preferences.preferred_cities?.join(', ') || 'Any location'
                      }
                    </span>
                  </div>
                )}

                {/* CTA Button */}
                <div className="pt-4">
                  <FindJobsButton onSessionStarted={handleSessionStarted} />
                </div>

                {/* Site Logos Row */}
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-[var(--text-tertiary)]">Searching across</p>
                  <div className="flex justify-center gap-3">
                    {enabledSites.map((site) => {
                      const Logo = SiteLogos[site as keyof typeof SiteLogos]
                      return Logo ? (
                        <div key={site} className="group relative">
                          <Logo />
                          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity capitalize whitespace-nowrap">
                            {site}
                          </span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4 py-4">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-medium mb-1">
                    Configure your search preferences
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Add your target roles and preferences to get started
                  </p>
                </div>
                <Button onClick={() => router.push('/preferences')} variant="gradient" size="lg">
                  Set Up Preferences
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings Summary Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--text-primary)]">Search Settings</h2>
            <Link
              href="/preferences"
              className="text-sm text-[var(--primary-600)] hover:text-[var(--primary-700)] flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Preferences
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                Search Roles
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {preferences.search_roles?.length
                  ? `${preferences.search_roles.length} role${preferences.search_roles.length > 1 ? 's' : ''}`
                  : 'Not configured'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                Location
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)] capitalize">
                {preferences.location_preference || 'Remote'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                Salary Range
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {preferences.salary_range?.min
                  ? `$${(preferences.salary_range.min / 1000).toFixed(0)}k - $${(preferences.salary_range.max! / 1000).toFixed(0)}k`
                  : 'Any'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                Sites Enabled
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {enabledSites.length} site{enabledSites.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Imports */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--text-primary)]">Recent Imports</h2>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-sm text-[var(--primary-600)] hover:text-[var(--primary-700)]"
              >
                {showHistory ? 'Hide' : 'Show'} History
              </button>
            </div>
          </CardHeader>
          {showHistory && (
            <CardContent>
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between py-3 border-b border-[var(--border-default)] last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {session.search_params.roles?.join(', ')}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {new Date(session.created_at).toLocaleDateString()} at{' '}
                        {new Date(session.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span
                        className={`text-sm font-medium ${
                          session.status === 'completed'
                            ? 'text-[var(--health-good)]'
                            : session.status === 'failed'
                              ? 'text-[var(--health-danger)]'
                              : 'text-[var(--text-tertiary)]'
                        }`}
                      >
                        {session.status === 'completed'
                          ? `${session.total_jobs_imported} jobs`
                          : session.status}
                      </span>
                      {(session.status === 'pending' || session.status === 'running') && (
                        <button
                          onClick={() => setActiveSessionId(session.id)}
                          className="text-sm text-[var(--primary-600)] hover:text-[var(--primary-700)] font-medium"
                        >
                          View Progress
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* How It Works Info Card */}
      <Card className="bg-gradient-to-br from-[var(--primary-50)] to-white border-[var(--primary-100)]">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-[var(--primary-100)] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-[var(--text-primary)]">How it works</h3>
              <ol className="text-sm text-[var(--text-secondary)] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-[var(--primary-100)] text-[var(--primary-700)] rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                  <span>Configure your search roles and preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-[var(--primary-100)] text-[var(--primary-700)] rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                  <span>Click &quot;Find Jobs For Me&quot; - we search LinkedIn, Indeed, Glassdoor, Dice, and Wellfound</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-[var(--primary-100)] text-[var(--primary-700)] rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                  <span>Jobs are imported, deduplicated, and scored for quality</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-[var(--primary-100)] text-[var(--primary-700)] rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">4</span>
                  <span>AI identifies potential ghost jobs and highlights actively hiring positions</span>
                </li>
              </ol>
              <p className="text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-default)]">
                Free users: 3 imports/hour, 10/day. Jobs are shared with all users.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
