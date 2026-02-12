import Link from 'next/link'
import { Header } from '@/components/layout/Header'

const JOB_SOURCES = [
  'Remotive',
  'Jobicy',
  'RemoteOK',
  'Himalayas',
  'We Work Remotely',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />

      {/* Hero section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center lg:pt-32">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl md:text-6xl">
            <span className="block">Find Your Next</span>
            <span className="block text-[var(--primary-600)]">Remote Job</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)]">
            JobIQ aggregates remote jobs from {JOB_SOURCES.length} top job boards, scores them
            for quality, and helps you track your applications — all in one place.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-[var(--primary-600)] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[var(--primary-700)] transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[var(--gray-100)] px-6 py-3 text-base font-semibold text-[var(--text-primary)] hover:bg-[var(--gray-200)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Job Sources */}
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-[var(--text-tertiary)] mb-4">
            Aggregating jobs from
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {JOB_SOURCES.map((source) => (
              <span
                key={source}
                className="text-sm font-semibold text-[var(--text-secondary)]"
              >
                {source}
              </span>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="py-16 border-t border-[var(--border-default)]">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[var(--text-primary)]">
              Everything you need to land a remote role
            </h2>
            <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              Stop wasting time on ghost listings. Focus on real opportunities with data-driven insights.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl border border-[var(--border-default)] hover:border-[var(--primary-300)] transition-colors">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Aggregated Jobs</h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                Jobs from {JOB_SOURCES.length} remote job boards, deduplicated and normalized into a single searchable feed.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-[var(--border-default)] hover:border-[var(--primary-300)] transition-colors">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Quality Scores</h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                Every listing is scored for freshness, salary transparency, and ghost job signals so you apply with confidence.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-[var(--border-default)] hover:border-[var(--primary-300)] transition-colors">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Company Reputation</h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                See employer credibility grades, hiring trends, and red flags before you invest time in applying.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-[var(--border-default)] hover:border-[var(--primary-300)] transition-colors">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Kanban Pipeline</h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                Organize saved jobs into stages — saved, applied, interviewing, offer — and never lose track.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-[var(--border-default)] hover:border-[var(--primary-300)] transition-colors">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Weekly Digest</h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                Get a personalized email with the best new jobs matching your filters, delivered weekly.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-[var(--border-default)] hover:border-[var(--primary-300)] transition-colors">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Browser Extension</h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                Save jobs from any site and auto-track application status directly from your browser.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="py-16 border-t border-[var(--border-default)]">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[var(--text-primary)]">
              Ready to find your next remote role?
            </h2>
            <p className="mt-4 text-lg text-[var(--text-secondary)]">
              Join thousands of remote workers finding their dream jobs.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-lg bg-[var(--primary-600)] px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[var(--primary-700)] transition-colors"
            >
              Start Free Today
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-default)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-[var(--text-muted)]">
          <p>&copy; {new Date().getFullYear()} JobIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
