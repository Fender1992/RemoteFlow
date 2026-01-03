'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import type { Job, JobChatMessage, JobChatResponse, SUGGESTED_QUESTIONS } from '@/types'

interface JobChatPanelProps {
  isOpen: boolean
  onClose: () => void
  job: Job
}

const SUGGESTED_QUESTIONS_LIST: string[] = [
  'Is this a ghost job?',
  "What's the company's reputation?",
  'What are the red flags in this listing?',
  'Is the salary competitive for this role?',
  'What skills should I highlight in my application?',
]

interface ChatUsage {
  remaining: number
  limit: number
}

export function JobChatPanel({ isOpen, onClose, job }: JobChatPanelProps) {
  const [messages, setMessages] = useState<JobChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<ChatUsage | null>(null)
  const [hasKey, setHasKey] = useState(true)
  const [needsKey, setNeedsKey] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch usage limits on open
  useEffect(() => {
    if (isOpen) {
      fetchUsage()
      // Reset messages for new job
      setMessages([])
      setError(null)
    }
  }, [isOpen, job.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle escape key to close panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isLoading, onClose])

  // Prevent body scroll when panel is open
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

  const fetchUsage = async () => {
    try {
      const response = await fetch(`/api/jobs/${job.id}/chat`)
      if (response.ok) {
        const data = await response.json()
        setUsage(data.usage)
        setHasKey(data.hasKey)
        setNeedsKey(data.needsKey)
      }
    } catch {
      // Silently fail - we'll show error when they try to send
    }
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)
    setIsLoading(true)

    // Add user message optimistically
    const userMessage: JobChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')

    try {
      // Build history from existing messages
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
        // Handle specific errors
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

      // Add assistant message
      const assistantMessage: JobChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        cached: data.cached,
        responseTimeMs: data.responseTimeMs,
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Update usage
      if (data.usage) {
        setUsage(data.usage)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      // Remove the optimistic user message on error
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

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={handleOverlayClick}
    >
      {/* Sliding panel */}
      <div
        className="w-full h-full md:h-auto md:max-w-md bg-white shadow-xl flex flex-col animate-slide-in-right"
        style={{
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="md:hidden p-1 text-gray-400 hover:text-gray-600 rounded -ml-1"
              disabled={isLoading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0 mr-3">
              <h2 className="text-sm font-semibold text-gray-900 truncate">
                Ask about this job
              </h2>
              <p className="text-xs text-gray-500 truncate">
                {job.title} at {job.company}
              </p>
            </div>
            <button
              onClick={onClose}
              className="hidden md:block p-1 text-gray-400 hover:text-gray-600 rounded"
              disabled={isLoading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Usage indicator */}
          {usage && (
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <span className={usage.remaining <= 2 ? 'text-orange-600' : ''}>
                {usage.remaining}/{usage.limit} questions for this job
              </span>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* API key required notice */}
          {needsKey && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                To use job chat, please add your CacheGPT API key in{' '}
                <a href="/preferences" className="underline font-medium">
                  Settings
                </a>
                .
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Upgrade to Max tier for unlimited access with our platform key.
              </p>
            </div>
          )}

          {/* Empty state with suggested questions */}
          {messages.length === 0 && !needsKey && (
            <div className="py-4">
              <p className="text-sm text-gray-500 mb-3">
                Ask me anything about this job listing. Try one of these:
              </p>
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS_LIST.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSuggestedQuestion(question)}
                    disabled={isLoading || (usage?.remaining ?? 1) <= 0}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {/* Cached indicator for assistant messages */}
                {message.role === 'assistant' && message.cached && (
                  <span className="inline-flex items-center mt-1 px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                    Instant
                  </span>
                )}
                {message.role === 'assistant' && message.responseTimeMs && !message.cached && (
                  <span className="text-xs text-gray-400 mt-1 block">
                    {(message.responseTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 0.75rem)' }}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={needsKey ? 'Add API key to chat...' : 'Ask a question...'}
              disabled={isLoading || needsKey || (usage?.remaining ?? 1) <= 0}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => sendMessage(inputValue)}
              disabled={isLoading || !inputValue.trim() || needsKey || (usage?.remaining ?? 1) <= 0}
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </Button>
          </div>
          {usage && usage.remaining <= 0 && (
            <p className="text-xs text-gray-500 mt-2">
              You've used all questions for this job. Try asking about other jobs!
            </p>
          )}
        </div>
      </div>

      {/* CSS for slide animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
