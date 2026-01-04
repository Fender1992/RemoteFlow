'use client'

import { useState, useEffect } from 'react'
import { Key, ExternalLink, Trash2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ApiKeysClientProps {
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'max'
}

export function ApiKeysClient({ subscriptionTier }: ApiKeysClientProps) {
  // Anthropic API Key state
  const [apiKey, setApiKey] = useState('')
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(true)
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [apiKeySuccess, setApiKeySuccess] = useState(false)

  // CacheGPT API Key state
  const [cacheGptKey, setCacheGptKey] = useState('')
  const [maskedCacheGptKey, setMaskedCacheGptKey] = useState<string | null>(null)
  const [hasCacheGptKey, setHasCacheGptKey] = useState(false)
  const [cacheGptKeyLoading, setCacheGptKeyLoading] = useState(true)
  const [cacheGptKeySaving, setCacheGptKeySaving] = useState(false)
  const [cacheGptKeyError, setCacheGptKeyError] = useState<string | null>(null)
  const [cacheGptKeySuccess, setCacheGptKeySuccess] = useState(false)

  const needsApiKey = subscriptionTier !== 'max' && subscriptionTier !== 'enterprise'

  // Fetch API key status on mount
  useEffect(() => {
    async function fetchApiKeyStatus() {
      try {
        const res = await fetch('/api/user/api-key')
        if (res.ok) {
          const data = await res.json()
          setHasApiKey(data.hasKey)
          setMaskedApiKey(data.maskedKey)
        }
      } catch {
        // Ignore errors
      } finally {
        setApiKeyLoading(false)
      }
    }
    fetchApiKeyStatus()
  }, [])

  // Fetch CacheGPT API key status on mount
  useEffect(() => {
    async function fetchCacheGptKeyStatus() {
      try {
        const res = await fetch('/api/user/cachegpt-key')
        if (res.ok) {
          const data = await res.json()
          setHasCacheGptKey(data.hasKey)
          setMaskedCacheGptKey(data.maskedKey)
        }
      } catch {
        // Ignore errors
      } finally {
        setCacheGptKeyLoading(false)
      }
    }
    fetchCacheGptKeyStatus()
  }, [])

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return
    setApiKeySaving(true)
    setApiKeyError(null)
    setApiKeySuccess(false)

    try {
      const res = await fetch('/api/user/api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setHasApiKey(true)
        setMaskedApiKey(data.maskedKey)
        setApiKey('')
        setApiKeySuccess(true)
      } else {
        setApiKeyError(data.error || 'Failed to save API key')
      }
    } catch {
      setApiKeyError('Network error')
    } finally {
      setApiKeySaving(false)
    }
  }

  const handleDeleteApiKey = async () => {
    setApiKeySaving(true)
    setApiKeyError(null)

    try {
      const res = await fetch('/api/user/api-key', { method: 'DELETE' })
      if (res.ok) {
        setHasApiKey(false)
        setMaskedApiKey(null)
        setApiKeySuccess(false)
      }
    } catch {
      setApiKeyError('Failed to delete API key')
    } finally {
      setApiKeySaving(false)
    }
  }

  const handleSaveCacheGptKey = async () => {
    if (!cacheGptKey.trim()) return
    setCacheGptKeySaving(true)
    setCacheGptKeyError(null)
    setCacheGptKeySuccess(false)

    try {
      const res = await fetch('/api/user/cachegpt-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: cacheGptKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setHasCacheGptKey(true)
        setMaskedCacheGptKey(data.maskedKey)
        setCacheGptKey('')
        setCacheGptKeySuccess(true)
      } else {
        setCacheGptKeyError(data.error || 'Failed to save API key')
      }
    } catch {
      setCacheGptKeyError('Network error')
    } finally {
      setCacheGptKeySaving(false)
    }
  }

  const handleDeleteCacheGptKey = async () => {
    setCacheGptKeySaving(true)
    setCacheGptKeyError(null)

    try {
      const res = await fetch('/api/user/cachegpt-key', { method: 'DELETE' })
      if (res.ok) {
        setHasCacheGptKey(false)
        setMaskedCacheGptKey(null)
        setCacheGptKeySuccess(false)
      }
    } catch {
      setCacheGptKeyError('Failed to delete API key')
    } finally {
      setCacheGptKeySaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">API Keys</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Manage your API keys for AI-powered features
        </p>
      </div>

      {/* Subscription tier info */}
      {!needsApiKey && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {subscriptionTier === 'max' ? 'Max' : 'Enterprise'} Tier Active
            </p>
            <p className="text-sm text-green-700 mt-1">
              You have unlimited access to AI features using our platform API. No personal API keys required.
            </p>
          </div>
        </div>
      )}

      {/* Anthropic API Key */}
      <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-[var(--border-default)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-50)] flex items-center justify-center">
            <Key className="w-4 h-4 text-[var(--primary-600)]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Anthropic API Key</h3>
            <p className="text-xs text-[var(--text-tertiary)]">For AI matching and analysis</p>
          </div>
        </div>
        <div className="p-4">
          {apiKeyLoading ? (
            <div className="animate-pulse h-10 bg-gray-100 rounded" />
          ) : hasApiKey ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-[var(--text-secondary)] font-mono">
                  {maskedApiKey}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteApiKey}
                disabled={apiKeySaving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveApiKey}
                  disabled={apiKeySaving || !apiKey.trim()}
                >
                  {apiKeySaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--primary-600)] hover:text-[var(--primary-700)]"
              >
                Get your API key from Anthropic Console
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {apiKeyError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-600">{apiKeyError}</p>
            </div>
          )}
          {apiKeySuccess && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-600">API key saved successfully!</p>
            </div>
          )}
        </div>
      </div>

      {/* CacheGPT API Key */}
      <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-[var(--border-default)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <Key className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">CacheGPT API Key</h3>
            <p className="text-xs text-[var(--text-tertiary)]">For job chat feature</p>
          </div>
        </div>
        <div className="p-4">
          {cacheGptKeyLoading ? (
            <div className="animate-pulse h-10 bg-gray-100 rounded" />
          ) : hasCacheGptKey ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-[var(--text-secondary)] font-mono">
                  {maskedCacheGptKey}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteCacheGptKey}
                disabled={cacheGptKeySaving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={cacheGptKey}
                  onChange={(e) => setCacheGptKey(e.target.value)}
                  placeholder="Your CacheGPT API key..."
                  className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveCacheGptKey}
                  disabled={cacheGptKeySaving || !cacheGptKey.trim()}
                >
                  {cacheGptKeySaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <a
                href="https://www.cachegpt.co"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--primary-600)] hover:text-[var(--primary-700)]"
              >
                Get your API key from CacheGPT
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {cacheGptKeyError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-600">{cacheGptKeyError}</p>
            </div>
          )}
          {cacheGptKeySuccess && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-600">API key saved successfully!</p>
            </div>
          )}
        </div>
      </div>

      {/* Security note */}
      <div className="text-xs text-[var(--text-tertiary)] bg-gray-50 p-4 rounded-lg border border-[var(--border-default)]">
        <p className="font-medium text-[var(--text-secondary)] mb-1">Security Note</p>
        <p>
          Your API keys are encrypted before storage and are never exposed in responses.
          They are only used server-side to make API calls on your behalf.
        </p>
      </div>
    </div>
  )
}
