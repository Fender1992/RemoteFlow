'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, ExternalLink, Trash2 } from 'lucide-react'

interface PipelineCardMenuProps {
  jobId: string
  jobUrl: string
  onRemove?: (jobId: string) => Promise<void>
}

export function PipelineCardMenu({ jobId, jobUrl, onRemove }: PipelineCardMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRemove) {
      await onRemove(jobId)
    }
    setIsOpen(false)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        className="p-1 rounded hover:bg-[var(--gray-100)] text-[var(--text-tertiary)]"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-6 z-10 bg-white rounded-lg shadow-lg border border-[var(--border-default)] py-1 min-w-[140px]">
          <a
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--gray-50)]"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
            View Details
          </a>
          <button
            onClick={handleRemove}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[var(--health-danger)] hover:bg-[var(--gray-50)]"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
