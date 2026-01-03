'use client'

import { useEffect } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'

interface FilterDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  onClearFilters?: () => void
  hasFilters?: boolean
}

export function FilterDrawer({
  isOpen,
  onClose,
  children,
  onClearFilters,
  hasFilters,
}: FilterDrawerProps) {
  // Prevent body scroll when drawer is open
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

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel - slides up from bottom */}
      <div className="absolute inset-x-0 bottom-0 animate-slide-in-bottom">
        <div className="bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col">
          {/* Drag indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            </div>
            <button
              onClick={onClose}
              className="touch-target flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close filters"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>

          {/* Footer with actions */}
          <div
            className="flex gap-3 px-4 py-4 border-t border-gray-200 bg-white"
            style={{ paddingBottom: 'calc(var(--safe-area-bottom) + 1rem)' }}
          >
            {hasFilters && onClearFilters && (
              <button
                onClick={onClearFilters}
                className="flex-1 touch-target px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 touch-target px-4 py-3 text-sm font-medium text-white bg-[var(--primary-600)] rounded-lg hover:bg-[var(--primary-700)] transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface FilterFABProps {
  onClick: () => void
  hasFilters?: boolean
}

export function FilterFAB({ onClick, hasFilters }: FilterFABProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 touch-target flex items-center gap-2 px-4 py-3 bg-[var(--primary-600)] text-white rounded-full shadow-lg hover:bg-[var(--primary-700)] transition-colors lg:hidden"
      style={{ bottom: 'calc(var(--safe-area-bottom) + 1.5rem)' }}
    >
      <SlidersHorizontal className="w-5 h-5" />
      <span className="font-medium">Filters</span>
      {hasFilters && (
        <span className="w-2 h-2 bg-white rounded-full" />
      )}
    </button>
  )
}
