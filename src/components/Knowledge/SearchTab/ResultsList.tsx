import React from "react"
import { Select, Spin } from "antd"
import { useTranslation } from "react-i18next"
import type { RagResult, SortMode } from "../hooks"
import type { RagPinnedResult } from "@/utils/rag-format"
import { ResultItem } from "./ResultItem"
import { SearchEmptyState } from "./SearchEmptyState"

type ResultsListProps = {
  results: RagResult[]
  loading: boolean
  query?: string
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
  sortResults: (results: RagResult[]) => RagResult[]
  pinnedResults: RagPinnedResult[]
  onInsert: (result: RagResult) => void
  onAsk: (result: RagResult) => void
  onPreview: (result: RagResult) => void
  onPin: (result: RagResult) => void
  hasAttemptedSearch: boolean
  timedOut: boolean
  onRetry?: () => void
  highlightTerms?: boolean
}

/**
 * Results list with sorting and empty/loading/error states
 */
export const ResultsList: React.FC<ResultsListProps> = ({
  results,
  loading,
  query,
  sortMode,
  onSortModeChange,
  sortResults,
  pinnedResults,
  onInsert,
  onAsk,
  onPreview,
  onPin,
  hasAttemptedSearch,
  timedOut,
  onRetry,
  highlightTerms = true
}) => {
  const { t } = useTranslation(["sidepanel"])

  // Sort results
  const sortedResults = React.useMemo(
    () => sortResults(results),
    [results, sortResults]
  )

  // Check if a result is already pinned
  const isPinned = React.useCallback(
    (result: RagResult) => {
      const resultId =
        result.metadata?.id ||
        result.metadata?.title ||
        result.content?.slice(0, 20)
      return pinnedResults.some(
        (p) =>
          p.id.includes(String(resultId)) ||
          p.title === result.metadata?.title
      )
    },
    [pinnedResults]
  )

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spin size="default" />
        <span className="ml-2 text-sm text-text-muted">
          {t("sidepanel:rag.searching", "Searching...")}
        </span>
      </div>
    )
  }

  // Timeout/error state
  if (timedOut) {
    return (
      <SearchEmptyState
        variant="timeout"
        onRetry={onRetry}
      />
    )
  }

  // No results after search
  if (hasAttemptedSearch && sortedResults.length === 0) {
    return <SearchEmptyState variant="no-results" />
  }

  // Initial state (no search attempted)
  if (!hasAttemptedSearch) {
    return <SearchEmptyState variant="initial" />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with count and sort */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">
          {t("sidepanel:rag.resultsCount", "Results ({{count}})", {
            count: sortedResults.length
          })}
        </span>
        <Select
          value={sortMode}
          onChange={onSortModeChange}
          size="small"
          className="w-28"
          options={[
            {
              label: t("sidepanel:rag.sort.relevance", "Relevance"),
              value: "relevance"
            },
            {
              label: t("sidepanel:rag.sort.date", "Date"),
              value: "date"
            },
            {
              label: t("sidepanel:rag.sort.type", "Type"),
              value: "type"
            }
          ]}
        />
      </div>

      {/* Live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {t("sidepanel:rag.resultsFound", "{{count}} results found", {
          count: sortedResults.length
        })}
      </div>

      {/* Results list */}
      <div
        className="flex flex-col gap-2 max-h-[400px] overflow-y-auto"
        role="list"
        aria-label={t("sidepanel:rag.resultsList", "Search results")}
      >
        {sortedResults.map((result, index) => (
          <div key={result.metadata?.id || index} role="listitem">
            <ResultItem
              result={result}
              query={query}
              onInsert={onInsert}
              onAsk={onAsk}
              onPreview={onPreview}
              onPin={onPin}
              isPinned={isPinned(result)}
              highlightTerms={highlightTerms}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
