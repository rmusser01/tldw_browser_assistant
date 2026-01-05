import { useState, useEffect } from "react"

/**
 * Hook to detect media query matches
 * @param query - CSS media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler)
      return () => mediaQuery.removeEventListener("change", handler)
    }

    // Legacy browsers (Safari < 14)
    mediaQuery.addListener(handler)
    return () => mediaQuery.removeListener(handler)
  }, [query])

  return matches
}

/**
 * Convenience hook to detect mobile viewport
 * @returns boolean indicating if viewport is mobile-sized (<768px)
 */
export function useMobile(): boolean {
  return useMediaQuery("(max-width: 767px)")
}

/**
 * Convenience hook to detect tablet viewport
 * @returns boolean indicating if viewport is tablet-sized (768px - 1023px)
 */
export function useTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
}

/**
 * Convenience hook to detect desktop viewport
 * @returns boolean indicating if viewport is desktop-sized (≥1024px)
 */
export function useDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)")
}
