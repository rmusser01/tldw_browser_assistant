import React from "react"
import { Select, Spin } from "antd"
import { useTranslation } from "react-i18next"
import {
  getResultChunkIndex,
  getResultDate,
  getResultId,
  getResultScore,
  getResultSource,
  getResultText,
  getResultTitle,
  getResultType,
  getResultUrl
} from "../hooks"
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

const getMetadataTitle = (result: RagResult) => {
  const metadata = result.metadata
  if (!metadata || typeof metadata !== "object") return ""
  const title = (metadata as Record<string, unknown>).title
  return typeof title === "string" ? title : ""
}

const getResultKey = (result: RagResult) => {
  const resultId = getResultId(result)
  if (resultId !== undefined) return `id:${String(resultId)}`

  const title = getResultTitle(result)
  const url = getResultUrl(result)
  const type = getResultType(result)
  const date = getResultDate(result)
  const score = getResultScore(result)
  const source = getResultSource(result)
  const chunkIndex = getResultChunkIndex(result)
  const snippet = getResultText(result).slice(0, 32)

  const parts = [
    title,
    source,
    url,
    type,
    date,
    chunkIndex,
    score,
    snippet
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value))

  if (parts.length === 0) {
    return JSON.stringify(result)
  }

  return parts.join("|")
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
      const resultId = getResultId(result)
      if (resultId !== undefined) {
        return pinnedResults.some((p) => p.id === String(resultId))
      }

      const metadataTitle = getMetadataTitle(result)
      if (!metadataTitle) return false

      return pinnedResults.some(
        (p) => p.id === metadataTitle || p.title === metadataTitle
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
        {sortedResults.map((result) => (
          <div key={getResultKey(result)} role="listitem">
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
