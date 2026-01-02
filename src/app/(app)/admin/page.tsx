'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

interface ReviewItem {
  id: string
  entity_type: 'job' | 'company'
  entity_id: string
  reason: string
  priority: number
  status: string
  created_at: string
  job?: {
    id: string
    title: string
    company: string
    url: string
    ghost_score: number
    quality_score: number
  }
  company?: {
    id: string
    name: string
    is_verified: boolean
    is_blacklisted: boolean
  }
}

export default function AdminPage() {
  const router = useRouter()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')

  const fetchItems = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/review-queue?status=${statusFilter}`)
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        if (response.status === 403) {
          setError('You do not have permission to access the admin panel.')
          return
        }
        throw new Error('Failed to fetch review queue')
      }

      const data = await response.json()
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [statusFilter])

  const handleAction = async (
    id: string,
    action: 'approve' | 'remove' | 'blacklist' | 'dismiss',
    notes?: string
  ) => {
    setActionLoading(id)

    try {
      const response = await fetch('/api/admin/review-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, notes }),
      })

      if (!response.ok) {
        throw new Error('Failed to perform action')
      }

      // Remove item from list
      setItems(items.filter((item) => item.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'text-red-600 bg-red-50'
    if (priority <= 4) return 'text-orange-600 bg-orange-50'
    return 'text-gray-600 bg-gray-50'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Review Queue</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <Button variant="secondary" onClick={fetchItems}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No items in the review queue.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(item.priority)}`}
                      >
                        Priority {item.priority}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                        {item.entity_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    {item.entity_type === 'job' && item.job && (
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.job.title}</h3>
                        <p className="text-sm text-gray-600">{item.job.company}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Ghost Score: {item.job.ghost_score} | Quality: {item.job.quality_score}
                        </p>
                        <a
                          href={item.job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Job
                        </a>
                      </div>
                    )}

                    {item.entity_type === 'company' && item.company && (
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.company.name}</h3>
                        <div className="flex gap-2 mt-1">
                          {item.company.is_verified && (
                            <span className="text-xs text-green-600">Verified</span>
                          )}
                          {item.company.is_blacklisted && (
                            <span className="text-xs text-red-600">Blacklisted</span>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-gray-500 mt-2">{item.reason}</p>
                  </div>

                  {statusFilter === 'pending' && (
                    <div className="flex flex-col gap-2">
                      {item.entity_type === 'job' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleAction(item.id, 'approve')}
                            disabled={actionLoading === item.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleAction(item.id, 'remove')}
                            disabled={actionLoading === item.id}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                      {item.entity_type === 'company' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleAction(item.id, 'approve')}
                            disabled={actionLoading === item.id}
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleAction(item.id, 'blacklist')}
                            disabled={actionLoading === item.id}
                          >
                            Blacklist
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAction(item.id, 'dismiss')}
                        disabled={actionLoading === item.id}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
