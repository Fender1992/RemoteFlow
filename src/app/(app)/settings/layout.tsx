import { SettingsSidebar } from '@/components/settings/SettingsSidebar'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Manage your profile, preferences, and integrations
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar - hidden on mobile, shown on desktop */}
        <aside className="hidden lg:block lg:w-64 flex-shrink-0">
          <div className="sticky top-24 bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-4">
            <SettingsSidebar />
          </div>
        </aside>

        {/* Mobile nav - horizontal scroll */}
        <div className="lg:hidden">
          <div className="horizontal-scroll flex gap-2 pb-4 -mx-4 px-4">
            <MobileNavItem href="/settings/profile" label="Profile" />
            <MobileNavItem href="/settings/search" label="Search" />
            <MobileNavItem href="/settings/notifications" label="Notifications" />
            <MobileNavItem href="/settings/api-keys" label="API Keys" />
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}

function MobileNavItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] hover:border-[var(--primary-600)] transition-colors"
    >
      {label}
    </a>
  )
}
