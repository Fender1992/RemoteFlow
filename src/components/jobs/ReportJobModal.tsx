'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

interface ReportJobModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
}

type ReportReason = 'fake' | 'spam' | 'expired' | 'misleading' | 'other'

interface ReportOption {
  value: ReportReason
  label: string
}

const REPORT_OPTIONS: ReportOption[] = [
  { value: 'fake', label: 'This job appears to be fake' },
  { value: 'spam', label: 'This is spam or promotional content' },
  { value: 'expired', label: 'This job is expired/filled' },
  { value: 'misleading', label: 'The job description is misleading' },
  { value: 'other', label: 'Other' },
]

export function ReportJobModal({ isOpen, onClose, jobId, jobTitle }: ReportJobModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedReason(null)
      setDetails('')
      setError(null)
      setSuccess(false)
    }
  }, [isOpen])

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isSubmitting, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Please select a reason for reporting')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/jobs/${jobId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit report')
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:bg-black/50"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full fixed inset-x-0 bottom-0 rounded-t-2xl sm:static sm:max-w-md sm:mx-4 sm:rounded-lg bg-white shadow-xl"
        style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 1rem)' }}
      >
        {/* Drag indicator handle for mobile */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Report Job</h2>
          <p className="mt-1 text-sm text-gray-600 truncate">
            Reporting: {jobTitle}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {success ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">Report Submitted</p>
              <p className="mt-1 text-sm text-gray-600">
                Thank you for helping keep our platform safe.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-600">
                Why are you reporting this job?
              </p>

              {/* Report reason options */}
              <div className="space-y-2">
                {REPORT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={option.value}
                      checked={selectedReason === option.value}
                      onChange={() => setSelectedReason(option.value)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>

              {/* Additional details textarea */}
              <div className="mt-4">
                <label
                  htmlFor="details"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Additional details (optional)
                </label>
                <textarea
                  id="details"
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional information..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedReason}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
