'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { UserPreferencesExtended, JobType, ExperienceLevel } from '@/types'

interface SearchPreferencesClientProps {
  initialPreferences: UserPreferencesExtended
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'max'
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
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
  { value: 'any', label: 'Any' },
] as const

export function SearchPreferencesClient({ initialPreferences }: SearchPreferencesClientProps) {
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

  const handleSalaryChange = (field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value, 10) || 0
    const current = preferences.salary_range || { min: 0, max: 0, currency: 'USD' }
    setPreferences({
      ...preferences,
      salary_range: { ...current, [field]: numValue },
    })
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
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Search Preferences</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Configure your job search criteria for the Find Jobs feature
        </p>
      </div>

      {/* Search Roles */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
          Job Titles / Roles
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRole())}
            placeholder="e.g., React Developer, Frontend Engineer"
            className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
          />
          <Button variant="secondary" size="sm" onClick={handleAddRole}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(preferences.search_roles || []).map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-50)] text-[var(--primary-700)] rounded-lg text-sm"
            >
              {role}
              <button
                onClick={() => handleRemoveRole(role)}
                className="text-[var(--primary-400)] hover:text-[var(--primary-600)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Job Types */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
          Job Types
        </label>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPES.map((type) => {
            const isSelected = (preferences.job_types || []).includes(type.value)
            return (
              <button
                key={type.value}
                onClick={() => handleJobTypeToggle(type.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-[var(--primary-600)] text-white'
                    : 'bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200'
                }`}
              >
                {type.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Experience Levels */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
          Experience Levels
        </label>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_LEVELS.map((level) => {
            const isSelected = (preferences.experience_levels || []).includes(level.value)
            return (
              <button
                key={level.value}
                onClick={() => handleExpLevelToggle(level.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-[var(--primary-600)] text-white'
                    : 'bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200'
                }`}
              >
                {level.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Location Preference */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
          Location Preference
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {LOCATION_OPTIONS.map((option) => {
            const isSelected = preferences.location_preference === option.value
            return (
              <button
                key={option.value}
                onClick={() => handleLocationChange(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-[var(--primary-600)] text-white'
                    : 'bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {/* Cities (for hybrid/onsite) */}
        {(preferences.location_preference === 'hybrid' || preferences.location_preference === 'onsite') && (
          <div className="mt-4">
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Preferred Cities
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCity())}
                placeholder="e.g., San Francisco, New York"
                className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
              />
              <Button variant="secondary" size="sm" onClick={handleAddCity}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(preferences.preferred_cities || []).map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-[var(--text-secondary)] rounded-lg text-sm"
                >
                  {city}
                  <button
                    onClick={() => handleRemoveCity(city)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Salary Range */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
          Salary Range (USD)
        </label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="number"
              value={preferences.salary_range?.min || ''}
              onChange={(e) => handleSalaryChange('min', e.target.value)}
              placeholder="Min"
              className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            />
          </div>
          <span className="text-[var(--text-tertiary)]">to</span>
          <div className="flex-1">
            <input
              type="number"
              value={preferences.salary_range?.max || ''}
              onChange={(e) => handleSalaryChange('max', e.target.value)}
              placeholder="Max"
              className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            />
          </div>
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {saved && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">Preferences saved successfully!</p>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t border-[var(--border-default)]">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  )
}
