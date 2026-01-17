import { tldwClient } from "@/services/tldw/TldwApiClient"

/**
 * Hook to access the tldwClient singleton.
 * Provides type-safe access to the TLDW API client.
 */
export function useTldwApiClient() {
  return tldwClient
}
