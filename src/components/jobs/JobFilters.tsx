'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
]

const EXPERIENCE_LEVELS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
]

const SORT_OPTIONS = [
  { value: 'quality', label: 'Best Match' },
  { value: 'date', label: 'Newest' },
  { value: 'salary', label: 'Highest Salary' },
]

const HEALTH_OPTIONS = [
  { value: 'healthy', label: 'Healthy', color: 'var(--health-good)' },
  { value: 'caution', label: 'Caution', color: 'var(--health-caution)' },
  { value: 'danger', label: 'Danger', color: 'var(--health-danger)' },
]

const RESPONSE_RATE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'high', label: 'High (70%+)' },
  { value: 'medium', label: 'Medium (40-70%)' },
  { value: 'low', label: 'Low (<40%)' },
]

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 0L9.5 5.5L15 7L9.5 8.5L8 14L6.5 8.5L1 7L6.5 5.5L8 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function JobFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentJobTypes = searchParams.get('job_types')?.split(',').filter(Boolean) || []
  const currentExpLevels = searchParams.get('experience_levels')?.split(',').filter(Boolean) || []
  const currentHealthFilters = searchParams.get('health')?.split(',').filter(Boolean) || []
  const currentSort = searchParams.get('sort') || 'quality'
  const hideGhosts = searchParams.get('hide_ghosts') === 'true'
  const currentResponseRate = searchParams.get('response_rate') || ''

  const updateFilters = useCallback(
    (key: string, value: string[]) => {
      const params = new URLSearchParams(searchParams.toString())

      if (value.length > 0) {
        params.set(key, value.join(','))
      } else {
        params.delete(key)
      }

      params.delete('page') // Reset to page 1 when filters change
      router.push(`/jobs?${params.toString()}`)
    },
    [router, searchParams]
  )

  const updateSingleFilter = useCallback(
    (key: string, value: string | boolean) => {
      const params = new URLSearchParams(searchParams.toString())

      if (value === '' || value === false) {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }

      params.delete('page')
      router.push(`/jobs?${params.toString()}`)
    },
    [router, searchParams]
  )

  const toggleJobType = (type: string) => {
    const newTypes = currentJobTypes.includes(type)
      ? currentJobTypes.filter((t) => t !== type)
      : [...currentJobTypes, type]
    updateFilters('job_types', newTypes)
  }

  const toggleExpLevel = (level: string) => {
    const newLevels = currentExpLevels.includes(level)
      ? currentExpLevels.filter((l) => l !== level)
      : [...currentExpLevels, level]
    updateFilters('experience_levels', newLevels)
  }

  const toggleHealthFilter = (health: string) => {
    const newHealth = currentHealthFilters.includes(health)
      ? currentHealthFilters.filter((h) => h !== health)
      : [...currentHealthFilters, health]
    updateFilters('health', newHealth)
  }

  const clearFilters = () => {
    router.push('/jobs')
  }

  const hasFilters =
    currentJobTypes.length > 0 ||
    currentExpLevels.length > 0 ||
    currentHealthFilters.length > 0 ||
    hideGhosts ||
    currentSort !== 'quality' ||
    currentResponseRate !== ''

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Filters</h3>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Job Health - Highlighted Section */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <SparkleIcon className="text-amber-500" />
          <h4 className="text-sm font-semibold text-gray-900">Job Health</h4>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          We analyze posting patterns to detect ghost jobs
        </p>
        <div className="space-y-2">
          {HEALTH_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={currentHealthFilters.includes(option.value)}
                  onChange={() => toggleHealthFilter(option.value)}
                  className="sr-only peer"
                />
                <div
                  className="w-4 h-4 rounded border-2 border-gray-300 peer-checked:border-transparent peer-focus:ring-2 peer-focus:ring-offset-1 peer-focus:ring-blue-500 transition-colors"
                  style={{
                    backgroundColor: currentHealthFilters.includes(option.value)
                      ? option.color
                      : 'transparent',
                    borderColor: currentHealthFilters.includes(option.value)
                      ? option.color
                      : undefined,
                  }}
                >
                  {currentHealthFilters.includes(option.value) && (
                    <svg
                      className="w-full h-full text-white"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M13 4L6 11L3 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700">{option.label}</span>
              <span
                className="w-2 h-2 rounded-full ml-auto"
                style={{ backgroundColor: option.color }}
              />
            </label>
          ))}
        </div>

        {/* Enhanced Hide Suspicious Jobs Toggle */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={hideGhosts}
                onChange={(e) => updateSingleFilter('hide_ghosts', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Hide suspicious jobs
              </span>
              <span className="text-xs text-gray-500">
                Filter out potential ghost listings
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Company Response Rate */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Company Response Rate</h4>
        <select
          value={currentResponseRate}
          onChange={(e) => updateSingleFilter('response_rate', e.target.value)}
          className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          {RESPONSE_RATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Sort By</h4>
        <select
          value={currentSort}
          onChange={(e) => updateSingleFilter('sort', e.target.value)}
          className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Job Type */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Job Type</h4>
        <div className="space-y-2">
          {JOB_TYPES.map((type) => (
            <label key={type.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentJobTypes.includes(type.value)}
                onChange={() => toggleJobType(type.value)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              />
              <span className="text-sm text-gray-700">{type.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Experience Level */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Experience Level</h4>
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((level) => (
            <label key={level.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentExpLevels.includes(level.value)}
                onChange={() => toggleExpLevel(level.value)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              />
              <span className="text-sm text-gray-700">{level.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
