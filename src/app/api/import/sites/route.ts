import { NextResponse } from 'next/server'
import { getAvailableSites } from '@/lib/import/sites'

export const dynamic = 'force-dynamic'

/**
 * GET /api/import/sites
 * List available import sites and their configurations
 */
export async function GET() {
  const sites = getAvailableSites()

  return NextResponse.json({
    sites: sites.map((site) => ({
      id: site.id,
      name: site.name,
      maxJobsPerSearch: site.maxJobsPerSearch,
    })),
  })
}
