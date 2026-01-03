import { createClient } from '@/lib/supabase/server'
import { ViewedClient } from './viewed-client'

export default async function ViewedJobsPage() {
  const supabase = await createClient()

  const { data: views } = await supabase
    .from('job_views')
    .select('*')
    .order('viewed_at', { ascending: false })
    .limit(20)

  // Get distinct platforms for the filter
  const { data: platforms } = await supabase
    .from('job_views')
    .select('platform')
    .not('platform', 'is', null)

  // Extract unique platforms
  const uniquePlatforms = [...new Set(platforms?.map(p => p.platform).filter(Boolean) || [])]

  return (
    <ViewedClient
      initialViews={views || []}
      availablePlatforms={uniquePlatforms as string[]}
    />
  )
}
