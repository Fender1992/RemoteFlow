'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MobileMenu } from './MobileMenu'

interface HeaderProps {
  user?: { email?: string; name?: string } | null
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
        px-3 py-2 rounded-md font-medium transition-all duration-200
        ${isActive
          ? 'bg-[var(--primary-50)] text-[var(--primary-600)] font-semibold'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
      `}
    >
      {children}
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
    return pathname === path || pathname?.startsWith(`${path}/`)
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href={user ? '/jobs' : '/'} className="text-xl font-bold text-[var(--primary-600)]">
              JobIQ
            </Link>

            {user && (
              <nav className="hidden md:flex items-center gap-2">
                <NavLink href="/jobs" isActive={isActive('/jobs')}>
                  Jobs
                </NavLink>
                <NavLink href="/import" isActive={isActive('/import')}>
                  Find Jobs
                </NavLink>
                <NavLink href="/saved" isActive={isActive('/saved')}>
                  Saved
                </NavLink>
                <NavLink href="/preferences" isActive={isActive('/preferences')}>
                  Preferences
                </NavLink>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-600 hidden sm:block">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 hidden md:block"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 hidden md:block"
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
              className="touch-target flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
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
