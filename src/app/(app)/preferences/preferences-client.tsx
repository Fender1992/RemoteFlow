'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import type { UserPreferencesExtended, JobType, ExperienceLevel, ImportSiteId } from '@/types'

interface PreferencesClientProps {
  initialPreferences: UserPreferencesExtended
}

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
]

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'junior', label: 'Junior / Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Principal' },
]

const LOCATION_OPTIONS = [
  { value: 'remote', label: 'Remote only' },
  { value: 'hybrid', label: 'Hybrid (specify cities)' },
  { value: 'onsite', label: 'On-site (specify cities)' },
  { value: 'any', label: 'Any' },
] as const

const IMPORT_SITES: { id: ImportSiteId; name: string }[] = [
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'indeed', name: 'Indeed' },
  { id: 'glassdoor', name: 'Glassdoor' },
  { id: 'dice', name: 'Dice' },
  { id: 'wellfound', name: 'Wellfound' },
]

export function PreferencesClient({ initialPreferences }: PreferencesClientProps) {
  const [preferences, setPreferences] = useState<UserPreferencesExtended>(initialPreferences)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newRole, setNewRole] = useState('')
  const [newCity, setNewCity] = useState('')

  const handleJobTypeToggle = (type: JobType) => {
    const current = preferences.job_types || []
    const newTypes = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    setPreferences({ ...preferences, job_types: newTypes })
    setSaved(false)
  }

  const handleExpLevelToggle = (level: ExperienceLevel) => {
    const current = preferences.experience_levels || []
    const newLevels = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level]
    setPreferences({ ...preferences, experience_levels: newLevels })
    setSaved(false)
  }

  const handleEmailDigestToggle = () => {
    setPreferences({ ...preferences, email_digest: !preferences.email_digest })
    setSaved(false)
  }

  // Search roles handlers
  const handleAddRole = () => {
    if (!newRole.trim()) return
    const current = preferences.search_roles || []
    if (!current.includes(newRole.trim())) {
      setPreferences({ ...preferences, search_roles: [...current, newRole.trim()] })
      setSaved(false)
    }
    setNewRole('')
  }

  const handleRemoveRole = (role: string) => {
    const current = preferences.search_roles || []
    setPreferences({ ...preferences, search_roles: current.filter((r) => r !== role) })
    setSaved(false)
  }

  // Location handlers
  const handleLocationChange = (value: 'remote' | 'hybrid' | 'onsite' | 'any') => {
    setPreferences({ ...preferences, location_preference: value })
    setSaved(false)
  }

  const handleAddCity = () => {
    if (!newCity.trim()) return
    const current = preferences.preferred_cities || []
    if (!current.includes(newCity.trim())) {
      setPreferences({ ...preferences, preferred_cities: [...current, newCity.trim()] })
      setSaved(false)
    }
    setNewCity('')
  }

  const handleRemoveCity = (city: string) => {
    const current = preferences.preferred_cities || []
    setPreferences({ ...preferences, preferred_cities: current.filter((c) => c !== city) })
    setSaved(false)
  }

  // Salary handlers
  const handleSalaryChange = (field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value, 10) || 0
    const current = preferences.salary_range || { min: 0, max: 0, currency: 'USD' }
    setPreferences({
      ...preferences,
      salary_range: { ...current, [field]: numValue },
    })
    setSaved(false)
  }

  // Import site handlers
  const handleSiteToggle = (siteId: ImportSiteId) => {
    const current = preferences.enabled_sites || ['linkedin', 'indeed', 'glassdoor', 'dice', 'wellfound']
    const newSites = current.includes(siteId)
      ? current.filter((s) => s !== siteId)
      : [...current, siteId]
    setPreferences({ ...preferences, enabled_sites: newSites as ImportSiteId[] })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })

      if (res.ok) {
        setSaved(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to save preferences')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const showCities = preferences.location_preference === 'hybrid' || preferences.location_preference === 'onsite'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Preferences</h1>
        <p className="text-gray-600">
          Customize your job search and import preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Search Roles - For One-Click Import */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Search Roles</h2>
            <p className="text-sm text-gray-600">
              Job titles to search for when using one-click import (e.g., &quot;React Developer&quot;, &quot;Frontend Engineer&quot;)
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
                  placeholder="Add a job title..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button variant="secondary" onClick={handleAddRole}>
                  Add
                </Button>
              </div>
              {preferences.search_roles?.length ? (
                <div className="flex flex-wrap gap-2">
                  {preferences.search_roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {role}
                      <button
                        onClick={() => handleRemoveRole(role)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No search roles added yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location Preference */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Location Preference</h2>
            <p className="text-sm text-gray-600">Where do you want to work?</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2">
                {LOCATION_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="location"
                      checked={preferences.location_preference === option.value}
                      onChange={() => handleLocationChange(option.value)}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
              {showCities && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-2">Preferred cities:</p>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCity()}
                      placeholder="Add a city..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Button variant="secondary" size="sm" onClick={handleAddCity}>
                      Add
                    </Button>
                  </div>
                  {preferences.preferred_cities?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {preferences.preferred_cities.map((city) => (
                        <span
                          key={city}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                        >
                          {city}
                          <button
                            onClick={() => handleRemoveCity(city)}
                            className="ml-1 text-gray-500 hover:text-gray-700"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Salary Range */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Salary Range</h2>
            <p className="text-sm text-gray-600">Your desired salary range (USD/year)</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-600">Minimum</label>
                <div className="flex items-center">
                  <span className="text-gray-400 mr-1">$</span>
                  <input
                    type="number"
                    value={preferences.salary_range?.min || ''}
                    onChange={(e) => handleSalaryChange('min', e.target.value)}
                    placeholder="100000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <span className="text-gray-400 mt-5">to</span>
              <div className="flex-1">
                <label className="text-sm text-gray-600">Maximum</label>
                <div className="flex items-center">
                  <span className="text-gray-400 mr-1">$</span>
                  <input
                    type="number"
                    value={preferences.salary_range?.max || ''}
                    onChange={(e) => handleSalaryChange('max', e.target.value)}
                    placeholder="200000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import Sites */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Job Sites to Search</h2>
            <p className="text-sm text-gray-600">Select which sites to search when importing jobs</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {IMPORT_SITES.map((site) => (
                <label key={site.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.enabled_sites?.includes(site.id) ?? true}
                    onChange={() => handleSiteToggle(site.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{site.name}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <hr className="border-gray-200" />

        {/* Job Types */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Job Types</h2>
            <p className="text-sm text-gray-600">Select the types of jobs you&apos;re interested in</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {JOB_TYPES.map((type) => (
                <label key={type.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.job_types?.includes(type.value) || false}
                    onChange={() => handleJobTypeToggle(type.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Experience Levels */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Experience Level</h2>
            <p className="text-sm text-gray-600">Select your experience levels</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {EXPERIENCE_LEVELS.map((level) => (
                <label key={level.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.experience_levels?.includes(level.value) || false}
                    onChange={() => handleExpLevelToggle(level.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{level.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Email Digest */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Email Notifications</h2>
            <p className="text-sm text-gray-600">Manage your email preferences</p>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.email_digest || false}
                onChange={handleEmailDigestToggle}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-gray-700">Weekly job digest</span>
                <p className="text-sm text-gray-500">
                  Receive a weekly email with new jobs matching your preferences
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
          {saved && (
            <span className="text-sm text-green-600">Preferences saved!</span>
          )}
          {error && (
            <span className="text-sm text-red-600">{error}</span>
          )}
        </div>
      </div>
    </div>
  )
}
