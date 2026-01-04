import { createClient } from '@/lib/supabase/server'
import { ApiKeysClient } from './api-keys-client'

export default async function SettingsApiKeysPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users_profile')
    .select('subscription_tier')
    .single()

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-6">
      <ApiKeysClient subscriptionTier={profile?.subscription_tier || 'free'} />
    </div>
  )
}
