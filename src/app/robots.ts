import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jobiq.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/saved/', '/settings/', '/preferences/', '/profile/', '/admin/', '/import/', '/viewed/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
