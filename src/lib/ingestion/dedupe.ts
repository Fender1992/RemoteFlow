import type { SupabaseClient } from '@supabase/supabase-js'
import type { Job } from '@/types'
import {
  hashDescription,
  detectGhostIndicators,
  calculateHealthScore,
  calculateFreshness,
  calculateQualityScore,
  detectRepost,
  recordJobLineage,
  findOrCreateCompany,
  getCompanyReputation,
  incrementCompanyJobCount,
} from '@/lib/quality'

type JobInsert = Omit<Job, 'id' | 'created_at' | 'fetched_at'>

export async function dedupeAndUpsertJobs(
  supabase: SupabaseClient,
  jobs: JobInsert[],
  calculateQuality = true
): Promise<{ inserted: number; errors: number; qualityCalculated: number }> {
  let inserted = 0
  let errors = 0
  let qualityCalculated = 0

  // Process in batches of 50
  const batchSize = 50

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize)

    // First, upsert the jobs
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
      .select('id, url')

    if (error) {
      console.error('Batch upsert error:', error)
      errors += batch.length
      continue
    }

    inserted += data?.length || 0

    // Calculate quality scores for each job if enabled
    if (calculateQuality && data) {
      for (const insertedJob of data) {
        // Find the original job data from batch
        const originalJob = batch.find(j => j.url === insertedJob.url)
        if (!originalJob) continue

        try {
          await calculateJobQualityScores(supabase, insertedJob.id, originalJob)
          qualityCalculated++
        } catch (err) {
          console.error(`Quality calculation error for job ${insertedJob.id}:`, err)
        }
      }
    }
  }

  return { inserted, errors, qualityCalculated }
}

/**
 * Calculate and update all quality scores for a single job
 */
async function calculateJobQualityScores(
  supabase: SupabaseClient,
  jobId: string,
  job: JobInsert
) {
  // 1. Find/create company and link
  const company = await findOrCreateCompany(supabase, job.company, job.company_logo)
  let companyId: string | null = null

  if (company) {
    companyId = company.id
    await incrementCompanyJobCount(supabase, company.id)
  }

  // 2. Check for reposts
  const repostResult = await detectRepost(supabase, {
    company: job.company,
    title: job.title,
    description: job.description,
    url: job.url,
    source: job.source,
  })

  // Record lineage
  await recordJobLineage(
    supabase,
    jobId,
    repostResult.canonicalJobId,
    repostResult.instanceNumber
  )

  // 3. Get company reputation
  const companyRep = companyId ? await getCompanyReputation(supabase, companyId) : 0.5

  // 4. Calculate description hash
  const descHash = hashDescription(job.description || '')

  // 5. Calculate health score
  const { healthScore } = calculateHealthScore(
    {
      posted_date: job.posted_date || null,
      repost_count: repostResult.instanceNumber,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      description: job.description,
      url: job.url,
    },
    companyRep
  )

  // 6. Detect ghost indicators
  const { ghostScore, ghostFlags } = detectGhostIndicators({
    posted_date: job.posted_date || null,
    repost_count: repostResult.instanceNumber,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    description: job.description,
    url: job.url,
  })

  // 7. Calculate final quality score
  const freshness = calculateFreshness(job.posted_date || null)
  const qualityScore = calculateQualityScore(healthScore, freshness, companyRep, ghostScore)

  // 8. Update job record with all quality data
  await supabase.from('jobs').update({
    company_id: companyId,
    description_hash: descHash,
    repost_count: repostResult.instanceNumber,
    health_score: healthScore,
    quality_score: qualityScore,
    ghost_score: ghostScore,
    ghost_flags: ghostFlags,
    quality_updated_at: new Date().toISOString(),
  }).eq('id', jobId)
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
