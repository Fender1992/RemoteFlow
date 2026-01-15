'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Menu, Briefcase, Search, Kanban, Settings, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MobileMenu } from './MobileMenu'

interface HeaderProps {
  user?: { email?: string; name?: string } | null
}

// Navigation configuration - single source of truth
const NAV_ITEMS = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/import', label: 'Find Jobs', icon: Search },
  { href: '/saved', label: 'Pipeline', icon: Kanban },
  { href: '/profile/verification', label: 'Trust Dashboard', icon: Shield },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

// Export for use in MobileMenu
export { NAV_ITEMS }

function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-1.5 group">
      <span className="text-xl" aria-hidden="true">⚡</span>
      <span className="text-xl tracking-tight">
        <span className="font-medium text-[var(--gray-900)]">Job</span>
        <span className="text-[var(--primary-500)] font-light">|</span>
        <span className="font-bold text-[var(--primary-600)]">IQ</span>
      </span>
    </Link>
  )
}

interface NavLinkProps {
  href: string
  children: React.ReactNode
  isActive: boolean
}

function NavLink({ href, children, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`
        relative px-3 py-2 font-medium transition-all duration-200
        ${isActive
          ? 'text-[var(--primary-600)] bg-[var(--primary-50)]'
          : 'text-[var(--gray-600)] hover:text-[var(--gray-900)] hover:bg-[var(--gray-100)]'
        }
      `}
    >
      {children}
      {/* Bottom border indicator for active state */}
      {isActive && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-600)]"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const isActive = (path: string) => {
    if (path === '/jobs') {
      return pathname === '/jobs' || pathname?.startsWith('/jobs/')
    }
    if (path === '/settings') {
      // Also match /preferences and /profile for backwards compatibility
      return pathname === '/settings' ||
        pathname?.startsWith('/settings/') ||
        pathname === '/preferences' ||
        pathname?.startsWith('/preferences/') ||
        pathname === '/profile' ||
        pathname?.startsWith('/profile/')
    }
    return pathname === path || pathname?.startsWith(`${path}/`)
  }

  return (
    <header className="bg-white border-b border-[var(--gray-200)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Logo href={user ? '/jobs' : '/'} />

            {user && (
              <nav className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    isActive={isActive(item.href)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-[var(--gray-600)] hidden sm:block">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-[var(--gray-600)] hover:text-[var(--gray-900)] font-medium transition-colors duration-200 hidden md:block"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-[var(--gray-600)] hover:text-[var(--gray-900)] font-medium transition-colors duration-200 hidden md:block"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-[var(--primary-600)] text-white px-4 py-2 rounded-lg hover:bg-[var(--primary-700)] font-medium transition-colors duration-200 hidden md:block"
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile hamburger button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="touch-target flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)] transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-[var(--gray-600)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        onSignOut={handleSignOut}
      />
    </header>
  )
}
