'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Search, Bell, Key } from 'lucide-react'
import { cn } from '@/lib/utils'

const SETTINGS_ITEMS = [
  {
    href: '/settings/profile',
    label: 'Profile',
    description: 'Resume, skills, experience',
    icon: User,
  },
  {
    href: '/settings/search',
    label: 'Search Preferences',
    description: 'Roles, locations, sites',
    icon: Search,
  },
  {
    href: '/settings/notifications',
    label: 'Notifications',
    description: 'Email digest settings',
    icon: Bell,
  },
  {
    href: '/settings/api-keys',
    label: 'API Keys',
    description: 'Anthropic, CacheGPT',
    icon: Key,
  },
] as const

export function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {SETTINGS_ITEMS.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-lg transition-all',
              isActive
                ? 'bg-[var(--primary-50)] border-l-2 border-[var(--primary-600)]'
                : 'hover:bg-gray-50'
            )}
          >
            <Icon
              className={cn(
                'w-5 h-5 flex-shrink-0 mt-0.5',
                isActive ? 'text-[var(--primary-600)]' : 'text-[var(--text-tertiary)]'
              )}
            />
            <div>
              <p
                className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-[var(--primary-700)]' : 'text-[var(--text-primary)]'
                )}
              >
                {item.label}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{item.description}</p>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
