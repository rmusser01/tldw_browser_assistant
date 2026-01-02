import { QueryClient } from "@tanstack/react-query"

const RATE_LIMIT_PATTERN = /(429|rate limit|too many requests)/i
const MAX_QUERY_RETRIES = 1

const isRateLimitError = (error: unknown): boolean => {
  if (!error) return false
  const msg =
    error instanceof Error ? error.message : String(error || "")
  return RATE_LIMIT_PATTERN.test(msg)
}

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: (failureCount, error) => {
          if (isRateLimitError(error)) return false
          return failureCount < MAX_QUERY_RETRIES
        }
      }
    }
  })
