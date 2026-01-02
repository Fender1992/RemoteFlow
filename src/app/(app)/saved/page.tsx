import { createClient } from '@/lib/supabase/server'
import { SavedJobsClient } from './saved-client'

export default async function SavedJobsPage() {
  const supabase = await createClient()

  const { data: savedJobs } = await supabase
    .from('saved_jobs')
    .select(`
      *,
      job:jobs(*)
    `)
    .order('created_at', { ascending: false })

  return <SavedJobsClient initialSavedJobs={savedJobs || []} />
}
