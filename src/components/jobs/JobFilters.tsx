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

export function JobFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentJobTypes = searchParams.get('job_types')?.split(',').filter(Boolean) || []
  const currentExpLevels = searchParams.get('experience_levels')?.split(',').filter(Boolean) || []
  const currentSort = searchParams.get('sort') || 'quality'
  const hideGhosts = searchParams.get('hide_ghosts') === 'true'

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

  const clearFilters = () => {
    router.push('/jobs')
  }

  const hasFilters = currentJobTypes.length > 0 || currentExpLevels.length > 0 || hideGhosts || currentSort !== 'quality'

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

      {/* Sort */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Sort By</h4>
        <select
          value={currentSort}
          onChange={(e) => updateSingleFilter('sort', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Quality Filter */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hideGhosts}
            onChange={(e) => updateSingleFilter('hide_ghosts', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Hide suspicious jobs</span>
        </label>
      </div>

      {/* Job Type */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Job Type</h4>
        <div className="space-y-2">
          {JOB_TYPES.map((type) => (
            <label key={type.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentJobTypes.includes(type.value)}
                onChange={() => toggleJobType(type.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">{type.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Experience Level */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Experience Level</h4>
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((level) => (
            <label key={level.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentExpLevels.includes(level.value)}
                onChange={() => toggleExpLevel(level.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">{level.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
