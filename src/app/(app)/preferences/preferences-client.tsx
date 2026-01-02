'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import type { UserPreferences, JobType, ExperienceLevel } from '@/types'

interface PreferencesClientProps {
  initialPreferences: UserPreferences
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

export function PreferencesClient({ initialPreferences }: PreferencesClientProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  const handleSave = async () => {
    setSaving(true)

    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    })

    if (res.ok) {
      setSaved(true)
    }

    setSaving(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Preferences</h1>
        <p className="text-gray-600">
          Customize your job search preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Job Types */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Job Types</h2>
            <p className="text-sm text-gray-600">Select the types of jobs you're interested in</p>
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
        </div>
      </div>
    </div>
  )
}
