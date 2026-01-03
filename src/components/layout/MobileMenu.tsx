'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  user?: { email?: string; name?: string } | null
  onSignOut: () => void
}

interface MobileNavLinkProps {
  href: string
  children: React.ReactNode
  isActive: boolean
  onClick: () => void
}

function MobileNavLink({ href, children, isActive, onClick }: MobileNavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        touch-target flex items-center px-4 py-3 text-lg font-medium rounded-lg transition-colors
        ${isActive
          ? 'bg-[var(--primary-50)] text-[var(--primary-600)]'
          : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      {children}
    </Link>
  )
}

export function MobileMenu({ isOpen, onClose, user, onSignOut }: MobileMenuProps) {
  const pathname = usePathname()

  // Prevent body scroll when menu is open
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

  const isActive = (path: string) => {
    if (path === '/jobs') {
      return pathname === '/jobs' || pathname?.startsWith('/jobs/')
    }
    return pathname === path || pathname?.startsWith(`${path}/`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl animate-slide-in-from-right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200">
            <span className="text-xl font-bold text-[var(--primary-600)]">JobIQ</span>
            <button
              onClick={onClose}
              className="touch-target flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {user ? (
              <>
                <MobileNavLink href="/jobs" isActive={isActive('/jobs')} onClick={onClose}>
                  Jobs
                </MobileNavLink>
                <MobileNavLink href="/import" isActive={isActive('/import')} onClick={onClose}>
                  Find Jobs
                </MobileNavLink>
                <MobileNavLink href="/saved" isActive={isActive('/saved')} onClick={onClose}>
                  Saved
                </MobileNavLink>
                <MobileNavLink href="/preferences" isActive={isActive('/preferences')} onClick={onClose}>
                  Preferences
                </MobileNavLink>
              </>
            ) : (
              <>
                <MobileNavLink href="/login" isActive={isActive('/login')} onClick={onClose}>
                  Sign in
                </MobileNavLink>
                <MobileNavLink href="/signup" isActive={isActive('/signup')} onClick={onClose}>
                  Get Started
                </MobileNavLink>
              </>
            )}
          </nav>

          {/* User section */}
          {user && (
            <div
              className="border-t border-gray-200 px-4 py-4"
              style={{ paddingBottom: 'calc(var(--safe-area-bottom) + 1rem)' }}
            >
              <div className="mb-3">
                <p className="text-sm text-gray-500">Signed in as</p>
                <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  onSignOut()
                  onClose()
                }}
                className="w-full touch-target flex items-center justify-center px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
