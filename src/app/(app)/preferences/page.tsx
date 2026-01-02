import { createClient } from '@/lib/supabase/server'
import { PreferencesClient } from './preferences-client'

export default async function PreferencesPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users_profile')
    .select('preferences, subscription_tier')
    .single()

  return (
    <PreferencesClient
      initialPreferences={profile?.preferences || {}}
      subscriptionTier={profile?.subscription_tier || 'free'}
    />
  )
}
