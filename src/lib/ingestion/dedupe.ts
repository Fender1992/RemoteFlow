import type { SupabaseClient } from '@supabase/supabase-js'
import type { Job } from '@/types'

type JobInsert = Omit<Job, 'id' | 'created_at' | 'fetched_at'>

export async function dedupeAndUpsertJobs(
  supabase: SupabaseClient,
  jobs: JobInsert[]
): Promise<{ inserted: number; errors: number }> {
  let inserted = 0
  let errors = 0

  // Process in batches of 50
  const batchSize = 50

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize)

    const { data, error } = await supabase
      .from('jobs')
      .upsert(
        batch.map(job => ({
          ...job,
          fetched_at: new Date().toISOString(),
          is_active: true,
        })),
        {
          onConflict: 'url',
          ignoreDuplicates: false, // Update existing records
        }
      )
      .select('id')

    if (error) {
      console.error('Batch upsert error:', error)
      errors += batch.length
    } else {
      inserted += data?.length || 0
    }
  }

  return { inserted, errors }
}

// Mark old jobs as inactive (not fetched recently)
export async function markStaleJobsInactive(
  supabase: SupabaseClient,
  source: string,
  daysOld: number = 7
): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)

  const { data, error } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .eq('source', source)
    .lt('fetched_at', cutoffDate.toISOString())
    .eq('is_active', true)
    .select('id')

  if (error) {
    console.error('Error marking stale jobs:', error)
    return 0
  }

  return data?.length || 0
}
