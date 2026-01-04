'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Job, JobChatMessage } from '@/types'

interface JobChatInlineProps {
  job: Job
}

const QUICK_QUESTIONS = [
  'Is this a ghost job?',
  "What's the company's reputation?",
  'Red flags in this listing?',
  'Is the salary competitive?',
]

interface ChatUsage {
  remaining: number
  limit: number
}

export function JobChatInline({ job }: JobChatInlineProps) {
  const [messages, setMessages] = useState<JobChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<ChatUsage | null>(null)
  const [needsKey, setNeedsKey] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage()
  }, [job.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchUsage = async () => {
    try {
      const response = await fetch(`/api/jobs/${job.id}/chat`)
      if (response.ok) {
        const data = await response.json()
        setUsage(data.usage)
        setNeedsKey(data.needsKey)
      }
    } catch {
      // Silently fail
    }
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)
    setIsLoading(true)
    setIsExpanded(true)

    const userMessage: JobChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch(`/api/jobs/${job.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          history,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'api_key_required') {
          setNeedsKey(true)
          throw new Error(data.message)
        }
        if (data.error === 'rate_limit_exceeded') {
          setUsage(data.usage)
          throw new Error(data.message)
        }
        throw new Error(data.error || data.message || 'Failed to send message')
      }

      const assistantMessage: JobChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        cached: data.cached,
        responseTimeMs: data.responseTimeMs,
      }
      setMessages((prev) => [...prev, assistantMessage])

      if (data.usage) {
        setUsage(data.usage)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-default)] bg-gradient-to-r from-[var(--primary-50)] to-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--primary-600)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ask AI</h3>
        </div>
        {usage && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            {usage.remaining}/{usage.limit} questions remaining
          </p>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* API key required notice */}
        {needsKey && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
            <p className="text-sm text-yellow-800">
              Add your API key in{' '}
              <a href="/settings/api-keys" className="underline font-medium">
                Settings
              </a>{' '}
              to use AI chat.
            </p>
          </div>
        )}

        {/* Quick questions when no messages */}
        {messages.length === 0 && !needsKey && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-[var(--text-tertiary)] mb-2">Quick questions:</p>
            {QUICK_QUESTIONS.map((question) => (
              <button
                key={question}
                onClick={() => sendMessage(question)}
                disabled={isLoading || (usage?.remaining ?? 1) <= 0}
                className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] bg-gray-50 hover:bg-gray-100 rounded-lg border border-[var(--border-default)] transition-colors disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {isExpanded && messages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-[var(--primary-600)] text-white'
                      : 'bg-gray-100 text-[var(--text-primary)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === 'assistant' && message.cached && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                      Instant
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={needsKey ? 'Add API key...' : 'Ask a question...'}
            disabled={isLoading || needsKey || (usage?.remaining ?? 1) <= 0}
            className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:border-transparent disabled:bg-gray-50"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim() || needsKey || (usage?.remaining ?? 1) <= 0}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
