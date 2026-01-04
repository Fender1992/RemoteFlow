import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { JobDetailClient } from './job-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch job with company data
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      company_data:companies(
        *,
        reputation:company_reputation(*)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !job) {
    notFound()
  }

  // Get current user and check if job is saved
  const { data: { user } } = await supabase.auth.getUser()
  let savedJob = null

  if (user) {
    const { data } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('user_id', user.id)
      .eq('job_id', id)
      .single()

    savedJob = data
  }

  return (
    <JobDetailClient
      job={job}
      savedJob={savedJob}
      isAuthenticated={!!user}
    />
  )
}
