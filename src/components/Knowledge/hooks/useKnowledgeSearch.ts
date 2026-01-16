import React from "react"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { shallow } from "zustand/shallow"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import {
  type RagSettings,
  buildRagSearchRequest
} from "@/services/rag/unified-rag"
import {
  formatRagResult,
  type RagCopyFormat,
  type RagPinnedResult
} from "@/utils/rag-format"
import { useStoreMessageOption } from "@/store/option"

/**
 * RAG search result type
 */
export type RagResult = {
  content?: string
  text?: string
  chunk?: string
  metadata?: Record<string, unknown>
  score?: number
  relevance?: number
}

/**
 * Batch result grouping
 */
export type BatchResultGroup = {
  query: string
  results: RagResult[]
}

/**
 * Sort mode for results
 */
export type SortMode = "relevance" | "date" | "type"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const getMetadataValue = (
  metadata: RagResult["metadata"],
  key: string
): unknown => (isRecord(metadata) ? metadata[key] : undefined)

const getMetadataString = (metadata: RagResult["metadata"], keys: string[]) => {
  for (const key of keys) {
    const value = getMetadataValue(metadata, key)
    if (typeof value === "string" && value.trim().length > 0) {
      return value
    }
  }
  return ""
}

const getMetadataPrimitive = (
  metadata: RagResult["metadata"],
  keys: string[]
) => {
  for (const key of keys) {
    const value = getMetadataValue(metadata, key)
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed.length > 0) return trimmed
    } else if (typeof value === "number") {
      return value
    }
  }
  return undefined
}

// Helper functions for result extraction
export const getResultText = (item: RagResult) =>
  item.content || item.text || item.chunk || ""

export const getResultTitle = (item: RagResult) =>
  getMetadataString(item.metadata, ["title", "source", "url"])

export const getResultUrl = (item: RagResult) =>
  getMetadataString(item.metadata, ["url", "source"])

export const getResultType = (item: RagResult) =>
  getMetadataString(item.metadata, ["type"])

export const getResultDate = (item: RagResult) =>
  getMetadataPrimitive(item.metadata, ["created_at", "date", "added_at"])

export const getResultId = (item: RagResult) =>
  getMetadataPrimitive(item.metadata, ["id"])

export const getResultSource = (item: RagResult) =>
  getMetadataString(item.metadata, ["source"])

export const getResultChunkIndex = (item: RagResult) =>
  getMetadataPrimitive(item.metadata, [
    "chunk_index",
    "chunkIndex",
    "index",
    "offset"
  ])

export const getResultScore = (item: RagResult) =>
  typeof item.score === "number"
    ? item.score
    : typeof item.relevance === "number"
      ? item.relevance
      : undefined

const getErrorMessage = (error: unknown) => {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null) {
    const candidate = (error as { message?: unknown }).message
    if (typeof candidate === "string") return candidate
  }
  return ""
}

const isTimeoutError = (error: unknown) => {
  if (error instanceof Error && error.name === "AbortError") return true
  const message = getErrorMessage(error).toLowerCase()
  return message.includes("timeout") || message.includes("timed out")
}

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

const buildPinnedResultId = (item: RagResult, text: string) => {
  const seedParts = [
    getResultId(item),
    getResultUrl(item),
    getResultSource(item),
    getResultTitle(item),
    getResultType(item),
    getResultDate(item),
    text ? text.slice(0, 4096) : ""
  ]
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean)

  if (seedParts.length === 0) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `rag-${crypto.randomUUID()}`
    }
    return `rag-${Math.random().toString(36).slice(2)}`
  }

  return `rag-${hashString(seedParts.join("|"))}`
}

/**
 * Convert a RAG result to a pinned result format
 */
export const toPinnedResult = (item: RagResult): RagPinnedResult => {
  const text = getResultText(item)
  const snippet = text.slice(0, 800)
  const title = getResultTitle(item)
  const url = getResultUrl(item)
  return {
    id: buildPinnedResultId(item, text),
    title: title || undefined,
    source: getResultSource(item) || undefined,
    url: url || undefined,
    snippet,
    type: getResultType(item) || undefined
  }
}

/**
 * Normalize batch results from various API response formats
 */
const normalizeBatchResults = (payload: any): BatchResultGroup[] => {
  if (!payload) return []
  if (Array.isArray(payload)) {
    return payload
      .map((group: any) => ({
        query: String(group.query || ""),
        results: group.results || []
      }))
      .filter((group: BatchResultGroup) => group.results.length > 0)
  }
  if (typeof payload === "object") {
    return Object.entries(payload)
      .map(([query, results]) => ({
        query,
        results: Array.isArray(results) ? results : []
      }))
      .filter((group) => group.results.length > 0)
  }
  return []
}

/**
 * Return type for useKnowledgeSearch hook
 */
export type UseKnowledgeSearchReturn = {
  // State
  loading: boolean
  results: RagResult[]
  batchResults: BatchResultGroup[]
  sortMode: SortMode
  timedOut: boolean
  hasAttemptedSearch: boolean
  queryError: string | null
  previewItem: RagPinnedResult | null
  ragHintSeen: boolean

  // Pinned results
  pinnedResults: RagPinnedResult[]

  // Actions
  runSearch: (opts?: { applyFirst?: boolean }) => Promise<void>
  setSortMode: (mode: SortMode) => void
  setPreviewItem: (item: RagPinnedResult | null) => void
  sortResults: (items: RagResult[]) => RagResult[]

  // Result actions
  handleInsert: (item: RagResult) => void
  handleAsk: (item: RagResult) => void
  handleOpen: (item: RagResult) => void
  handlePin: (item: RagResult) => void
  handleUnpin: (id: string) => void
  handleClearPins: () => void
  copyResult: (item: RagResult, format: RagCopyFormat) => Promise<void>
}

type UseKnowledgeSearchOptions = {
  resolvedQuery: string
  draftSettings: RagSettings
  applySettings: () => void
  onInsert: (text: string) => void
  onAsk: (text: string, options?: { ignorePinnedResults?: boolean }) => void
}

/**
 * Hook for managing RAG search execution and results
 */
export function useKnowledgeSearch({
  resolvedQuery,
  draftSettings,
  applySettings,
  onInsert,
  onAsk
}: UseKnowledgeSearchOptions): UseKnowledgeSearchReturn {
  const { t } = useTranslation(["sidepanel", "common"])

  // Search state
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<RagResult[]>([])
  const [batchResults, setBatchResults] = React.useState<BatchResultGroup[]>([])
  const [sortMode, setSortMode] = React.useState<SortMode>("relevance")
  const [timedOut, setTimedOut] = React.useState(false)
  const [hasAttemptedSearch, setHasAttemptedSearch] = React.useState(false)
  const [queryError, setQueryError] = React.useState<string | null>(null)
  const [previewItem, setPreviewItem] = React.useState<RagPinnedResult | null>(null)

  // Persisted hint state
  const [ragHintSeen, setRagHintSeen] = useStorage<boolean>(
    "ragSearchHintSeen",
    false
  )

  // Pinned results from store
  const { ragPinnedResults, setRagPinnedResults } = useStoreMessageOption(
    (state) => ({
      ragPinnedResults: state.ragPinnedResults,
      setRagPinnedResults: state.setRagPinnedResults
    }),
    shallow
  )

  const pinnedResults = ragPinnedResults || []

  // Sort results by the selected mode
  const sortResults = React.useCallback(
    (items: RagResult[]) => {
      if (sortMode === "type") {
        return [...items].sort((a, b) =>
          String(getResultType(a)).localeCompare(String(getResultType(b)))
        )
      }
      if (sortMode === "date") {
        return [...items].sort((a, b) => {
          const dateA = new Date(getResultDate(a) || 0).getTime()
          const dateB = new Date(getResultDate(b) || 0).getTime()
          return dateB - dateA
        })
      }
      // Default: relevance
      return [...items].sort((a, b) => {
        const scoreA = getResultScore(a) ?? 0
        const scoreB = getResultScore(b) ?? 0
        return scoreB - scoreA
      })
    },
    [sortMode]
  )

  // Execute search
  const runSearch = React.useCallback(
    async (opts?: { applyFirst?: boolean }) => {
      if (opts?.applyFirst) {
        applySettings()
      }

      const batchQueries = Array.isArray(draftSettings.batch_queries)
        ? draftSettings.batch_queries
        : []
      const hasBatchQueries =
        draftSettings.enable_batch && batchQueries.length > 0
      const batchQuery = hasBatchQueries
        ? batchQueries.find((value) => String(value).trim().length > 0) ?? ""
        : ""
      const query = (resolvedQuery || batchQuery).trim()

      if (!query) {
        setQueryError(
          t("sidepanel:rag.queryRequired", "Enter a query to search.") as string
        )
        return
      }

      setQueryError(null)
      if (!hasAttemptedSearch) {
        setHasAttemptedSearch(true)
        setRagHintSeen(true)
      }

      setLoading(true)
      setTimedOut(false)
      setResults([])
      setBatchResults([])

      let timeoutMs: number | undefined
      let startedAt = 0

      try {
        await tldwClient.initialize()
        const settings = {
          ...draftSettings,
          query
        }
        const request = buildRagSearchRequest(settings)
        timeoutMs = request.timeoutMs
        startedAt = Date.now()

        const ragRes = await tldwClient.ragSearch(request.query, {
          ...request.options,
          timeoutMs: request.timeoutMs
        })

        // Handle batch results
        const grouped = normalizeBatchResults(
          ragRes?.batch_results || ragRes?.results_by_query
        )
        if (grouped.length > 0) {
          setBatchResults(grouped)
        } else {
          const docs =
            ragRes?.results || ragRes?.documents || ragRes?.docs || []
          setResults(docs)
        }
        setTimedOut(false)
      } catch (e) {
        setResults([])
        setBatchResults([])
        const elapsedMs = startedAt ? Date.now() - startedAt : 0
        const isTimeout =
          (typeof timeoutMs === "number" &&
            startedAt > 0 &&
            elapsedMs >= timeoutMs) ||
          isTimeoutError(e)
        setTimedOut(isTimeout)
      } finally {
        setLoading(false)
      }
    },
    [
      applySettings,
      draftSettings,
      hasAttemptedSearch,
      resolvedQuery,
      setRagHintSeen,
      t
    ]
  )

  // Result actions
  const copyResult = React.useCallback(
    async (item: RagResult, format: RagCopyFormat) => {
      const pinned = toPinnedResult(item)
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        return
      }
      try {
        await navigator.clipboard.writeText(formatRagResult(pinned, format))
      } catch (error) {
        console.error("Failed to copy knowledge result to clipboard:", error)
      }
    },
    []
  )

  const handleInsert = React.useCallback(
    (item: RagResult) => {
      const pinned = toPinnedResult(item)
      onInsert(formatRagResult(pinned, "markdown"))
    },
    [onInsert]
  )

  const handleAsk = React.useCallback(
    (item: RagResult) => {
      const pinned = toPinnedResult(item)
      // Note: Modal.confirm would need to be handled at the component level
      // For now, we directly call onAsk
      onAsk(formatRagResult(pinned, "markdown"), { ignorePinnedResults: true })
    },
    [onAsk]
  )

  const handleOpen = React.useCallback((item: RagResult) => {
    const url = getResultUrl(item)
    if (!url) return
    window.open(String(url), "_blank")
  }, [])

  const handlePin = React.useCallback(
    (item: RagResult) => {
      const pinned = toPinnedResult(item)
      if (pinnedResults.some((result) => result.id === pinned.id)) return
      setRagPinnedResults([...pinnedResults, pinned])
    },
    [pinnedResults, setRagPinnedResults]
  )

  const handleUnpin = React.useCallback(
    (id: string) => {
      setRagPinnedResults(pinnedResults.filter((item) => item.id !== id))
    },
    [pinnedResults, setRagPinnedResults]
  )

  const handleClearPins = React.useCallback(() => {
    setRagPinnedResults([])
  }, [setRagPinnedResults])

  return {
    // State
    loading,
    results,
    batchResults,
    sortMode,
    timedOut,
    hasAttemptedSearch,
    queryError,
    previewItem,
    ragHintSeen,

    // Pinned results
    pinnedResults,

    // Actions
    runSearch,
    setSortMode,
    setPreviewItem,
    sortResults,

    // Result actions
    handleInsert,
    handleAsk,
    handleOpen,
    handlePin,
    handleUnpin,
    handleClearPins,
    copyResult
  }
}
