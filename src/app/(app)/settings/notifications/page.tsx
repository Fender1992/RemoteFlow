import { createClient } from '@/lib/supabase/server'
import { NotificationsClient } from './notifications-client'

export default async function SettingsNotificationsPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users_profile')
    .select('preferences, email')
    .single()

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-6">
      <NotificationsClient
        initialEmailDigest={profile?.preferences?.email_digest ?? false}
        email={profile?.email || ''}
      />
    </div>
  )
}
