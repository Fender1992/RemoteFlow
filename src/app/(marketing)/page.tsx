import Link from 'next/link'
import { Header } from '@/components/layout/Header'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center lg:pt-32">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Find Your Next</span>
            <span className="block text-blue-600">Remote Job</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            RemoteFlow aggregates remote jobs from top job boards so you can find the perfect
            opportunity. Save jobs, track applications, and never miss a deadline.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-gray-100 px-6 py-3 text-base font-semibold text-gray-900 hover:bg-gray-200"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="py-16 border-t border-gray-200">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Aggregated Jobs</h3>
              <p className="mt-2 text-gray-600">
                Jobs from Remotive and other top remote job boards, all in one place.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Save & Track</h3>
              <p className="mt-2 text-gray-600">
                Save interesting jobs and track your application status from saved to offer.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Weekly Digest</h3>
              <p className="mt-2 text-gray-600">
                Get a weekly email with new jobs matching your preferences.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="py-16 border-t border-gray-200">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Ready to find your next remote role?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Join thousands of remote workers finding their dream jobs.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Start Free Today
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} RemoteFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
