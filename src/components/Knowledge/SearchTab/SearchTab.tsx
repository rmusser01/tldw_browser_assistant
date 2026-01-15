import React from "react"
import { Select } from "antd"
import { useTranslation } from "react-i18next"
import type { RagPresetName, RagSource } from "@/services/rag/unified-rag"
import type { RagPinnedResult } from "@/utils/rag-format"
import type { RagResult, SortMode } from "../hooks"
import { SearchInput } from "./SearchInput"
import { SourceChips } from "./SourceChips"
import { ResultsList } from "./ResultsList"
import { PinnedChips } from "./PinnedChips"

type SearchTabProps = {
  // Query state
  query: string
  onQueryChange: (query: string) => void
  useCurrentMessage: boolean
  onUseCurrentMessageChange: (value: boolean) => void

  // Sources
  selectedSources: RagSource[]
  onSourcesChange: (sources: RagSource[]) => void

  // Preset (quick access in Search tab)
  preset: RagPresetName
  onPresetChange: (preset: RagPresetName) => void

  // Search execution
  onSearch: () => void
  loading: boolean
  queryError: string | null

  // Results
  results: RagResult[]
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
  sortResults: (results: RagResult[]) => RagResult[]
  hasAttemptedSearch: boolean
  timedOut: boolean
  highlightTerms?: boolean

  // Pinned results
  pinnedResults: RagPinnedResult[]
  onPin: (result: RagResult) => void
  onUnpin: (id: string) => void
  onClearPins: () => void

  // Result actions
  onInsert: (result: RagResult) => void
  onAsk: (result: RagResult) => void
  onPreview: (result: RagResult) => void

  // Connection state
  isConnected?: boolean
  autoFocus?: boolean
}

/**
 * Search tab - the primary 80% use case workflow
 *
 * Features:
 * - Query input with "Use current message" toggle
 * - Source filter chips (multi-select)
 * - Preset dropdown for quick quality adjustment
 * - Results list with actions
 * - Compact pinned results display
 */
export const SearchTab: React.FC<SearchTabProps> = ({
  query,
  onQueryChange,
  useCurrentMessage,
  onUseCurrentMessageChange,
  selectedSources,
  onSourcesChange,
  preset,
  onPresetChange,
  onSearch,
  loading,
  queryError,
  results,
  sortMode,
  onSortModeChange,
  sortResults,
  hasAttemptedSearch,
  timedOut,
  highlightTerms = true,
  pinnedResults,
  onPin,
  onUnpin,
  onClearPins,
  onInsert,
  onAsk,
  onPreview,
  isConnected = true,
  autoFocus = true
}) => {
  const { t } = useTranslation(["sidepanel"])

  const presetOptions = React.useMemo(
    () => [
      { label: t("sidepanel:rag.presets.fast", "Fast"), value: "fast" },
      { label: t("sidepanel:rag.presets.balanced", "Balanced"), value: "balanced" },
      { label: t("sidepanel:rag.presets.thorough", "Thorough"), value: "thorough" },
      { label: t("sidepanel:rag.presets.custom", "Custom"), value: "custom" }
    ],
    [t]
  )

  // Build screen reader announcement for search status
  const statusAnnouncement = React.useMemo(() => {
    if (loading) return t("sidepanel:rag.searching", "Searching...")
    if (!hasAttemptedSearch) return ""
    if (timedOut) return t("sidepanel:rag.searchTimedOut", "Search timed out")
    if (results.length === 0) return t("sidepanel:rag.noResultsFound", "No results found")
    return t("sidepanel:rag.resultsFound", "{{count}} results found", { count: results.length })
  }, [loading, hasAttemptedSearch, timedOut, results.length, t])

  return (
    <div
      className="flex flex-col gap-4 p-3"
      role="tabpanel"
      id="knowledge-tabpanel-search"
      aria-labelledby="knowledge-tab-search"
    >
      {/* Screen reader announcement for search status */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusAnnouncement}
      </div>

      {/* Search input */}
      <SearchInput
        query={query}
        onQueryChange={onQueryChange}
        useCurrentMessage={useCurrentMessage}
        onUseCurrentMessageChange={onUseCurrentMessageChange}
        onSearch={onSearch}
        loading={loading}
        error={queryError}
        autoFocus={autoFocus}
        disabled={!isConnected}
      />

      {/* Source chips + Preset dropdown */}
      <div className="flex items-center justify-between gap-3">
        <SourceChips
          selectedSources={selectedSources}
          onSourcesChange={onSourcesChange}
          disabled={!isConnected}
        />
        <Select
          value={preset}
          onChange={onPresetChange}
          options={presetOptions}
          size="small"
          className="w-28 flex-shrink-0"
          disabled={!isConnected}
        />
      </div>

      {/* Results list */}
      <ResultsList
        results={results}
        loading={loading}
        query={query}
        sortMode={sortMode}
        onSortModeChange={onSortModeChange}
        sortResults={sortResults}
        pinnedResults={pinnedResults}
        onInsert={onInsert}
        onAsk={onAsk}
        onPreview={onPreview}
        onPin={onPin}
        hasAttemptedSearch={hasAttemptedSearch}
        timedOut={timedOut}
        onRetry={onSearch}
        highlightTerms={highlightTerms}
      />

      {/* Pinned results */}
      <PinnedChips
        pinnedResults={pinnedResults}
        onUnpin={onUnpin}
        onClearAll={onClearPins}
      />
    </div>
  )
}
