'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
            <Link href={user ? '/jobs' : '/'} className="text-xl font-bold text-blue-600">
              RemoteFlow
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
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors duration-200"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
