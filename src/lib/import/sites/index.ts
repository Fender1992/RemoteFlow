import type { ImportSiteId } from '@/types'
import type { SiteConfigWithPrompt, SearchUrlParams } from './types'

import { linkedin, buildLinkedInSearchUrl } from './linkedin'
import { indeed, buildIndeedSearchUrl } from './indeed'
import { glassdoor, buildGlassdoorSearchUrl } from './glassdoor'
import { dice, buildDiceSearchUrl } from './dice'
import { wellfound, buildWellfoundSearchUrl } from './wellfound'

// Export all site configurations
export const siteConfigs: Record<ImportSiteId, SiteConfigWithPrompt> = {
  linkedin,
  indeed,
  glassdoor,
  dice,
  wellfound,
}

// Export URL builders
export const urlBuilders: Record<ImportSiteId, (params: SearchUrlParams) => string> = {
  linkedin: buildLinkedInSearchUrl,
  indeed: buildIndeedSearchUrl,
  glassdoor: buildGlassdoorSearchUrl,
  dice: buildDiceSearchUrl,
  wellfound: buildWellfoundSearchUrl,
}

/**
 * Get site configuration by ID
 */
export function getSiteConfig(siteId: ImportSiteId): SiteConfigWithPrompt {
  return siteConfigs[siteId]
}

/**
 * Build search URL for a site with given parameters
 */
export function buildSearchUrl(siteId: ImportSiteId, params: SearchUrlParams): string {
  const builder = urlBuilders[siteId]
  return builder(params)
}

/**
 * Get all available sites for display
 */
export function getAvailableSites(): Array<{
  id: ImportSiteId
  name: string
  maxJobsPerSearch: number
}> {
  return Object.values(siteConfigs).map((site) => ({
    id: site.config.id,
    name: site.config.name,
    maxJobsPerSearch: site.config.maxJobsPerSearch,
  }))
}

// Re-export types
export * from './types'
