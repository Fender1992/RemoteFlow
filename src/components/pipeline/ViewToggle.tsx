'use client'

import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'board' | 'list'

interface ViewToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--gray-100)] rounded-lg">
      <button
        onClick={() => onChange('board')}
        className={cn(
          'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5',
          mode === 'board'
            ? 'bg-white text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
        )}
      >
        <LayoutGrid className="w-4 h-4" />
        Board
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5',
          mode === 'list'
            ? 'bg-white text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
        )}
      >
        <List className="w-4 h-4" />
        List
      </button>
    </div>
  )
}
