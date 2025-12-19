import React, { useEffect, useMemo } from "react"
import { Skeleton } from "antd"
import { useTranslation } from "react-i18next"
import { cn } from "@/libs/utils"
import { translateMessage } from "@/i18n/translateMessage"

export interface LoadingSource {
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
 *     { key: "local", loading: isLocalLoading, label: "Local data" },
 *     { key: "server", loading: isServerLoading, label: "Server sync" },
 *     { key: "folders", loading: isFoldersLoading, label: "Folder structure" }
 *   ]}
 *   showLabels={true}
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
  const { t } = useTranslation(["common"])
  const loadingSources = useMemo(
    () => sources.filter((source) => source.loading),
    [sources]
  )
  const isAnyLoading = loadingSources.length > 0

  useEffect(() => {
    if (!showLabels) return
    if (process.env.NODE_ENV === "production") return
    const missingLabels = loadingSources
      .filter((source) => !source.label?.trim())
      .map((source) => source.key)
    if (missingLabels.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[UnifiedLoadingState] Missing labels for loading sources:",
        missingLabels
      )
    }
  }, [loadingSources, showLabels])

  if (!isAnyLoading) {
    return <>{children}</>
  }

  const getSourceLabel = (source: LoadingSource) => {
    if (source.label) {
      return translateMessage(t, source.label, source.label)
    }
    return translateMessage(
      t,
      `common:loadingSource.${source.key}`,
      `Loading: ${source.key}`
    )
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
              {getSourceLabel(source)}
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
  return useMemo(() => {
    const isLoading = sources.some((s) => s.loading)
    const loadingSources = sources.filter((s) => s.loading)
    const completedSources = sources.filter((s) => !s.loading)

    return {
      isLoading,
      loadingSources,
      completedSources,
      progress:
        sources.length > 0
          ? Math.round((completedSources.length / sources.length) * 100)
          : 100
    }
  }, [sources])
}

export default UnifiedLoadingState
