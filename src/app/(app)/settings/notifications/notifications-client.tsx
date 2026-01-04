'use client'

import { useState } from 'react'
import { Bell, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface NotificationsClientProps {
  initialEmailDigest: boolean
  email: string
}

export function NotificationsClient({ initialEmailDigest, email }: NotificationsClientProps) {
  const [emailDigest, setEmailDigest] = useState(initialEmailDigest)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_digest: emailDigest }),
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
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Notifications</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Manage how you receive updates about new jobs
        </p>
      </div>

      {/* Email Digest */}
      <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-[var(--border-default)]">
        <div className="w-10 h-10 rounded-lg bg-[var(--primary-50)] flex items-center justify-center flex-shrink-0">
          <Mail className="w-5 h-5 text-[var(--primary-600)]" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Daily Email Digest</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Receive a daily email with new jobs matching your preferences
              </p>
              {email && (
                <p className="text-xs text-[var(--text-tertiary)] mt-2">
                  Sent to: {email}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setEmailDigest(!emailDigest)
                setSaved(false)
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-2 ${
                emailDigest ? 'bg-[var(--primary-600)]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  emailDigest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Future notification options placeholder */}
      <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-[var(--border-default)] opacity-50">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">Push Notifications</h3>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Coming soon: Get instant notifications for hot jobs
              </p>
            </div>
            <span className="px-2 py-1 bg-gray-200 text-gray-500 text-xs rounded">Soon</span>
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
          <p className="text-sm text-green-600">Notification preferences saved!</p>
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
