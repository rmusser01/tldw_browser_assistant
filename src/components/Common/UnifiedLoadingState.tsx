import React from "react"
import { Skeleton } from "antd"
import { cn } from "@/libs/utils"

export type LoadingSource = {
  key: string
  loading: boolean
  label?: string
}

interface UnifiedLoadingStateProps {
  /** Array of loading sources to track */
  sources: LoadingSource[]
  /** Number of skeleton rows (default: 4) */
  rows?: number
  /** Custom className */
  className?: string
  /** Whether to show individual source labels during loading */
  showLabels?: boolean
  /** Children to render when all sources are done loading */
  children?: React.ReactNode
}

/**
 * Unified loading state component that combines multiple loading sources
 * into a single skeleton display. Shows loading until ALL sources complete.
 *
 * Usage:
 * ```tsx
 * <UnifiedLoadingState
 *   sources={[
 *     { key: 'local', loading: isLocalLoading },
 *     { key: 'server', loading: isServerLoading },
 *     { key: 'folders', loading: isFoldersLoading }
 *   ]}
 * >
 *   <YourContent />
 * </UnifiedLoadingState>
 * ```
 */
export function UnifiedLoadingState({
  sources,
  rows = 4,
  className,
  showLabels = false,
  children
}: UnifiedLoadingStateProps) {
  const isAnyLoading = sources.some((source) => source.loading)
  const loadingSources = sources.filter((source) => source.loading)

  if (!isAnyLoading) {
    return <>{children}</>
  }

  return (
    <div className={cn("flex flex-col items-center py-4 px-2", className)}>
      {showLabels && loadingSources.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          {loadingSources.map((source) => (
            <span
              key={source.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {source.label || source.key}
            </span>
          ))}
        </div>
      )}
      <Skeleton active paragraph={{ rows }} className="w-full" />
    </div>
  )
}

/**
 * Hook to manage multiple loading sources and determine unified loading state
 */
export function useUnifiedLoading(
  sources: Array<{ key: string; loading: boolean; label?: string }>
) {
  const isLoading = sources.some((s) => s.loading)
  const loadingSources = sources.filter((s) => s.loading)
  const completedSources = sources.filter((s) => !s.loading)

  return {
    isLoading,
    loadingSources,
    completedSources,
    progress: sources.length > 0
      ? Math.round((completedSources.length / sources.length) * 100)
      : 100
  }
}

export default UnifiedLoadingState
