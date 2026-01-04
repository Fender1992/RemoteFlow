import { createClient } from '@/lib/supabase/server'
import { SearchPreferencesClient } from './search-client'

export default async function SettingsSearchPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users_profile')
    .select('preferences, subscription_tier')
    .single()

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-6">
      <SearchPreferencesClient
        initialPreferences={profile?.preferences || {}}
        subscriptionTier={profile?.subscription_tier || 'free'}
      />
    </div>
  )
}
