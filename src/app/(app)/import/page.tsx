import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImportClient } from './import-client'
import type { UserPreferencesExtended } from '@/types'

export default async function ImportPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/import')
  }

  // Get user preferences
  const { data: profile } = await supabase
    .from('users_profile')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const preferences = (profile?.preferences || {}) as UserPreferencesExtended

  // Get recent import sessions
  const { data: sessions } = await supabase
    .from('import_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <ImportClient
        preferences={preferences}
        recentSessions={sessions || []}
      />
    </div>
  )
}
