'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  user?: { email?: string; name?: string } | null
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
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
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/jobs"
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Jobs
                </Link>
                <Link
                  href="/saved"
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Saved
                </Link>
                <Link
                  href="/preferences"
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Preferences
                </Link>
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
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
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
