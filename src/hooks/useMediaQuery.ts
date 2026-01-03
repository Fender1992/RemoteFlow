'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if the viewport matches a media query
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * Returns true if viewport is mobile (< 640px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 639px)')
}

/**
 * Returns true if viewport is tablet or larger (>= 640px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 640px)')
}

/**
 * Returns true if viewport is desktop (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
