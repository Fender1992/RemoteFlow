'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { NAV_ITEMS } from './Header'

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
  icon?: React.ComponentType<{ className?: string }>
}

function MobileNavLink({ href, children, isActive, onClick, icon: Icon }: MobileNavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        touch-target flex items-center gap-3 px-4 py-3 text-lg font-medium rounded-lg transition-colors
        ${isActive
          ? 'bg-[var(--primary-50)] text-[var(--primary-600)] border-l-2 border-[var(--primary-600)]'
          : 'text-[var(--gray-700)] hover:bg-[var(--gray-100)]'
        }
      `}
    >
      {Icon && <Icon className="w-5 h-5" />}
      {children}
    </Link>
  )
}

function MobileLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xl" aria-hidden="true">⚡</span>
      <span className="text-xl tracking-tight">
        <span className="font-medium text-[var(--gray-900)]">Job</span>
        <span className="text-[var(--primary-500)] font-light">|</span>
        <span className="font-bold text-[var(--primary-600)]">IQ</span>
      </span>
    </div>
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
          <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--gray-200)]">
            <MobileLogo />
            <button
              onClick={onClose}
              className="touch-target flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)] transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6 text-[var(--gray-600)]" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {user ? (
              <>
                {NAV_ITEMS.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    href={item.href}
                    isActive={isActive(item.href)}
                    onClick={onClose}
                    icon={item.icon}
                  >
                    {item.label}
                  </MobileNavLink>
                ))}
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
              className="border-t border-[var(--gray-200)] px-4 py-4"
              style={{ paddingBottom: 'calc(var(--safe-area-bottom) + 1rem)' }}
            >
              <div className="mb-3">
                <p className="text-sm text-[var(--gray-500)]">Signed in as</p>
                <p className="text-sm font-medium text-[var(--gray-900)] truncate">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  onSignOut()
                  onClose()
                }}
                className="w-full touch-target flex items-center justify-center px-4 py-3 text-sm font-medium text-[var(--gray-700)] bg-[var(--gray-100)] rounded-lg hover:bg-[var(--gray-200)] transition-colors"
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
