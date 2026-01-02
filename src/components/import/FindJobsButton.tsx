'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface FindJobsButtonProps {
  onSessionStarted: (sessionId: string) => void
  disabled?: boolean
}

export function FindJobsButton({ onSessionStarted, disabled }: FindJobsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/import/find-jobs', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 400 && data.error === 'preferences_required') {
          throw new Error('Please configure your search roles in Preferences first.')
        }
        if (res.status === 429) {
          throw new Error(data.message || 'Rate limit exceeded. Please try again later.')
        }
        throw new Error(data.message || data.error || 'Failed to start import')
      }

      onSessionStarted(data.session_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={loading || disabled}
        size="lg"
        className="w-full py-4 text-lg"
      >
        {loading ? 'Starting Import...' : 'Find Jobs For Me'}
      </Button>
      {error && (
        <p className="text-red-500 text-sm text-center">{error}</p>
      )}
    </div>
  )
}
