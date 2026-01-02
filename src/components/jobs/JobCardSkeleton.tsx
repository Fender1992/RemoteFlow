'use client'

import { cn } from '@/lib/utils'

interface JobCardSkeletonProps {
  className?: string
}

export function JobCardSkeleton({ className }: JobCardSkeletonProps) {
  return (
    <div
      className={cn(
        'relative bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Left edge health indicator bar skeleton */}
      <div className="absolute left-0 top-0 bottom-0 w-1 skeleton" />

      <div className="pl-4">
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Company logo placeholder */}
            <div className="w-10 h-10 rounded-lg skeleton" />
            <div className="space-y-2">
              {/* Company name */}
              <div className="h-4 w-24 rounded skeleton" />
              {/* Posted date */}
              <div className="h-3 w-16 rounded skeleton" />
            </div>
          </div>
          {/* Save button placeholder */}
          <div className="w-8 h-8 rounded skeleton" />
        </div>

        {/* Title */}
        <div className="px-5 pb-3">
          <div className="h-6 w-3/4 rounded skeleton" />
        </div>

        {/* Meta row */}
        <div className="px-5 pb-4 flex flex-wrap gap-4">
          <div className="h-4 w-20 rounded skeleton" />
          <div className="h-4 w-24 rounded skeleton" />
          <div className="h-4 w-16 rounded skeleton" />
        </div>

        {/* Tags */}
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          <div className="h-6 w-16 rounded-md skeleton" />
          <div className="h-6 w-20 rounded-md skeleton" />
          <div className="h-6 w-14 rounded-md skeleton" />
        </div>

        {/* Intelligence section */}
        <div className="mx-5 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="h-7 w-28 rounded-md skeleton" />
            <div className="h-4 w-32 rounded skeleton" />
            <div className="h-4 w-24 rounded skeleton" />
          </div>
        </div>

        {/* Ask AI button */}
        <div className="px-5 pb-4">
          <div className="h-10 w-full rounded-lg skeleton" />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-default)] bg-gray-50 rounded-b-xl flex items-center justify-between">
          <div className="h-4 w-24 rounded skeleton" />
          <div className="h-4 w-20 rounded skeleton" />
        </div>
      </div>
    </div>
  )
}

export function JobCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  )
}
