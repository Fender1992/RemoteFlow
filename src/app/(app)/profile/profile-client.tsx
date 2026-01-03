'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface ProfileData {
  name: string
  email: string
  subscriptionTier: string
  resumeFilename: string | null
  resumeUploadedAt: string | null
  skills: string[]
  jobTitles: string[]
  yearsExperience: number | null
  educationLevel: string | null
  preferredLocations: string[]
  salaryExpectationMin: number | null
  salaryExpectationMax: number | null
  completenessScore: number
  hasApiKey: boolean
}

interface ProfileClientProps {
  initialProfile: ProfileData
}

const EDUCATION_LEVELS = [
  { value: 'high_school', label: 'High School' },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'phd', label: 'PhD' },
  { value: 'other', label: 'Other' },
]

export function ProfileClient({ initialProfile }: ProfileClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState(initialProfile)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newSkill, setNewSkill] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('resume', file)

    try {
      const res = await fetch('/api/profile/resume', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Upload failed')
      }

      // Update local state with parsed data
      setProfile({
        ...profile,
        resumeFilename: file.name,
        resumeUploadedAt: new Date().toISOString(),
        skills: data.parsed.skills || [],
        jobTitles: data.parsed.jobTitles || [],
        yearsExperience: data.parsed.yearsExperience,
        educationLevel: data.parsed.educationLevel,
        preferredLocations: data.parsed.locations || [],
        salaryExpectationMin: data.parsed.salaryRange?.min || null,
        salaryExpectationMax: data.parsed.salaryRange?.max || null,
        completenessScore: data.completenessScore || 0,
      })

      setSuccess('Resume parsed successfully! Review the extracted data below.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload resume')
    } finally {
      setIsUploading(false)
    }
  }

  const handleTextSubmit = async () => {
    if (!resumeText.trim()) return

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('text', resumeText)

    try {
      const res = await fetch('/api/profile/resume', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Parsing failed')
      }

      setProfile({
        ...profile,
        resumeFilename: 'pasted_resume.txt',
        resumeUploadedAt: new Date().toISOString(),
        skills: data.parsed.skills || [],
        jobTitles: data.parsed.jobTitles || [],
        yearsExperience: data.parsed.yearsExperience,
        educationLevel: data.parsed.educationLevel,
        preferredLocations: data.parsed.locations || [],
        salaryExpectationMin: data.parsed.salaryRange?.min || null,
        salaryExpectationMax: data.parsed.salaryRange?.max || null,
        completenessScore: data.completenessScore || 0,
      })

      setSuccess('Resume parsed successfully!')
      setShowTextInput(false)
      setResumeText('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse resume')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          skills: profile.skills,
          job_titles: profile.jobTitles,
          years_experience: profile.yearsExperience,
          education_level: profile.educationLevel,
          preferred_locations: profile.preferredLocations,
          salary_expectation_min: profile.salaryExpectationMin,
          salary_expectation_max: profile.salaryExpectationMax,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save profile')
      }

      setSuccess('Profile saved successfully!')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const addSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile({
        ...profile,
        skills: [...profile.skills, newSkill.trim()],
      })
      setNewSkill('')
    }
  }

  const removeSkill = (skill: string) => {
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skill),
    })
  }

  const addLocation = () => {
    if (newLocation.trim() && !profile.preferredLocations.includes(newLocation.trim())) {
      setProfile({
        ...profile,
        preferredLocations: [...profile.preferredLocations, newLocation.trim()],
      })
      setNewLocation('')
    }
  }

  const removeLocation = (location: string) => {
    setProfile({
      ...profile,
      preferredLocations: profile.preferredLocations.filter((l) => l !== location),
    })
  }

  const completenessPercentage = profile.completenessScore

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Profile</h1>
        <p className="text-gray-600">
          Build your profile to get personalized job match scores
        </p>
      </div>

      {/* Completeness Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Profile Completeness</h2>
          <span className="text-2xl font-bold text-[var(--primary-600)]">
            {completenessPercentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-[var(--primary-600)] h-3 rounded-full transition-all duration-500"
            style={{ width: `${completenessPercentage}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {completenessPercentage < 50 && 'Upload a resume to boost your profile'}
          {completenessPercentage >= 50 && completenessPercentage < 80 && 'Add more skills and experience'}
          {completenessPercentage >= 80 && 'Great profile! You\'ll see accurate match scores'}
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Resume Upload Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Resume</h2>

        {profile.resumeFilename ? (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
            <div>
              <p className="font-medium text-gray-900">{profile.resumeFilename}</p>
              <p className="text-sm text-gray-500">
                Uploaded {new Date(profile.resumeUploadedAt!).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Upload your resume to auto-fill your profile
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports TXT files (PDF/DOCX coming soon)
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.docx"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Parsing...' : 'Upload Resume'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowTextInput(!showTextInput)}
          >
            Paste Text
          </Button>
        </div>

        {showTextInput && (
          <div className="mt-4">
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowTextInput(false)
                  setResumeText('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleTextSubmit}
                disabled={isUploading || !resumeText.trim()}
              >
                {isUploading ? 'Parsing...' : 'Parse Text'}
              </Button>
            </div>
          </div>
        )}

        {!profile.hasApiKey && (
          <p className="mt-4 text-sm text-amber-600">
            Note: Resume parsing requires a CacheGPT API key.{' '}
            <a href="/preferences" className="underline">
              Add your key in Settings
            </a>
          </p>
        )}
      </div>

      {/* Skills Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {profile.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center px-3 py-1 bg-[var(--primary-50)] text-[var(--primary-700)] rounded-full text-sm"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="ml-2 text-[var(--primary-500)] hover:text-[var(--primary-700)]"
              >
                ×
              </button>
            </span>
          ))}
          {profile.skills.length === 0 && (
            <span className="text-gray-400 text-sm">No skills added yet</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            placeholder="Add a skill..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
          />
          <Button variant="secondary" size="sm" onClick={addSkill}>
            Add
          </Button>
        </div>
      </div>

      {/* Experience Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Experience</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Years of Experience
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={profile.yearsExperience || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  yearsExperience: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Education Level
            </label>
            <select
              value={profile.educationLevel || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  educationLevel: e.target.value || null,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            >
              <option value="">Select...</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Location Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Preferred Locations
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {profile.preferredLocations.map((location) => (
            <span
              key={location}
              className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
            >
              {location}
              <button
                onClick={() => removeLocation(location)}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </span>
          ))}
          {profile.preferredLocations.length === 0 && (
            <span className="text-gray-400 text-sm">
              No preferences set (will match all locations)
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLocation()}
            placeholder="Add a location (e.g., Remote, New York)..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
          />
          <Button variant="secondary" size="sm" onClick={addLocation}>
            Add
          </Button>
        </div>
      </div>

      {/* Salary Expectations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Salary Expectations (USD)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={profile.salaryExpectationMin || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  salaryExpectationMin: e.target.value
                    ? parseInt(e.target.value)
                    : null,
                })
              }
              placeholder="e.g., 80000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={profile.salaryExpectationMax || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  salaryExpectationMax: e.target.value
                    ? parseInt(e.target.value)
                    : null,
                })
              }
              placeholder="e.g., 120000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 px-4 py-4 sm:static sm:border-0 sm:mx-0 sm:px-0 sm:py-0">
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </div>
  )
}
