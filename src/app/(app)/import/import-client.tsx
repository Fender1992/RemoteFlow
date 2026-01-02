'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FindJobsButton } from '@/components/import/FindJobsButton'
import { ImportProgress } from '@/components/import/ImportProgress'
import type { UserPreferencesExtended, ImportSession } from '@/types'

interface ImportClientProps {
  preferences: UserPreferencesExtended
  recentSessions: ImportSession[]
}

export function ImportClient({ preferences, recentSessions }: ImportClientProps) {
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
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Find Jobs For Me</h1>
        <p className="text-gray-600">
          One click to search all major job boards based on your preferences
        </p>
      </div>

      {/* Main Import Card */}
      <Card className="border-2 border-blue-100">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-4xl mb-2">&#128269;</div>
            <h2 className="text-xl font-semibold text-gray-900">
              Ready to Search
            </h2>

            {hasSearchRoles ? (
              <>
                <div className="text-gray-600">
                  <p className="mb-2">
                    Searching {enabledSites.length} sites for:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {preferences.search_roles?.map((role) => (
                      <span
                        key={role}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                  {preferences.location_preference && (
                    <p className="mt-2 text-sm">
                      Location: {preferences.location_preference}
                      {preferences.preferred_cities?.length ? ` (${preferences.preferred_cities.join(', ')})` : ''}
                    </p>
                  )}
                </div>

                <div className="pt-4">
                  <FindJobsButton onSessionStarted={handleSessionStarted} />
                </div>

                <p className="text-xs text-gray-400">
                  Sites: {enabledSites.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  You need to configure your search preferences before importing jobs.
                </p>
                <Link href="/preferences">
                  <Button>Configure Preferences</Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Import Settings</h2>
            <Link href="/preferences" className="text-sm text-blue-600 hover:text-blue-700">
              Edit Preferences
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Search Roles</p>
              <p className="font-medium">
                {preferences.search_roles?.length
                  ? preferences.search_roles.join(', ')
                  : 'Not configured'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Location</p>
              <p className="font-medium capitalize">
                {preferences.location_preference || 'Remote'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Salary Range</p>
              <p className="font-medium">
                {preferences.salary_range?.min
                  ? `$${preferences.salary_range.min.toLocaleString()} - $${preferences.salary_range.max?.toLocaleString()}`
                  : 'Any'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Sites Enabled</p>
              <p className="font-medium">{enabledSites.length} sites</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Imports */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Imports</h2>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-sm text-blue-600 hover:text-blue-700"
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
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {session.search_params.roles?.join(', ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.created_at).toLocaleDateString()} at{' '}
                        {new Date(session.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-sm ${
                          session.status === 'completed'
                            ? 'text-green-600'
                            : session.status === 'failed'
                              ? 'text-red-600'
                              : 'text-gray-500'
                        }`}
                      >
                        {session.status === 'completed'
                          ? `${session.total_jobs_imported} jobs`
                          : session.status}
                      </span>
                      {(session.status === 'pending' || session.status === 'running') && (
                        <button
                          onClick={() => setActiveSessionId(session.id)}
                          className="ml-2 text-sm text-blue-600 hover:text-blue-700"
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

      {/* Info Card */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <h3 className="font-medium text-gray-900 mb-2">How it works</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Configure your search roles and preferences</li>
            <li>Click &quot;Find Jobs For Me&quot;</li>
            <li>We search LinkedIn, Indeed, Glassdoor, Dice, and Wellfound</li>
            <li>New jobs are imported and deduplicated</li>
            <li>Jobs get quality scores and appear in your feed</li>
          </ol>
          <p className="text-xs text-gray-400 mt-3">
            Free users: 3 imports/hour, 10/day. Jobs are shared with all users.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
