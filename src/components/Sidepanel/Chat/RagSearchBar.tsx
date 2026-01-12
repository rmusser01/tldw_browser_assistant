import React from "react"
import {
  Button,
  Checkbox,
  Collapse,
  Dropdown,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Spin,
  Switch
} from "antd"
import type { InputRef, MenuProps } from "antd"
import { X } from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"
import { browser } from "wxt/browser"
import { useTranslation } from "react-i18next"
import { shallow } from "zustand/shallow"
import type { UploadedFile } from "@/db/dexie/types"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import {
  DEFAULT_RAG_SETTINGS,
  type RagPresetName,
  type RagSettings,
  applyRagPreset,
  buildRagSearchRequest,
  toRagAdvancedOptions
} from "@/services/rag/unified-rag"
import type { TabInfo } from "@/hooks/useTabMentions"
import {
  formatRagResult,
  type RagCopyFormat,
  type RagPinnedResult
} from "@/utils/rag-format"
import { formatFileSize } from "@/utils/format"
import { useStoreMessageOption } from "@/store/option"

type Props = {
  onInsert: (text: string) => void
  onAsk: (text: string, options?: { ignorePinnedResults?: boolean }) => void
  isConnected?: boolean
  open?: boolean
  onOpenChange?: (nextOpen: boolean) => void
  autoFocus?: boolean
  showToggle?: boolean
  variant?: "card" | "embedded"
  currentMessage?: string
  showAttachedContext?: boolean
  attachedTabs?: TabInfo[]
  availableTabs?: TabInfo[]
  attachedFiles?: UploadedFile[]
  onRemoveTab?: (tabId: number) => void
  onAddTab?: (tab: TabInfo) => void
  onClearTabs?: () => void
  onRefreshTabs?: () => void
  onAddFile?: () => void
  onRemoveFile?: (fileId: string) => void
  onClearFiles?: () => void
}

type RagResult = {
  content?: string
  text?: string
  chunk?: string
  metadata?: any
  score?: number
  relevance?: number
}

type BatchResultGroup = {
  query: string
  results: RagResult[]
}

const TRANSIENT_KEYS = new Set<keyof RagSettings>(["query", "batch_queries"])

const SOURCE_OPTIONS = [
  { label: "Media DB", value: "media_db" },
  { label: "Notes", value: "notes" },
  { label: "Characters", value: "characters" },
  { label: "Chats", value: "chats" }
]

const STRATEGY_OPTIONS = [
  { label: "Standard", value: "standard" },
  { label: "Agentic", value: "agentic" }
]

const SEARCH_MODE_OPTIONS = [
  { label: "FTS", value: "fts" },
  { label: "Vector", value: "vector" },
  { label: "Hybrid", value: "hybrid" }
]

const FTS_LEVEL_OPTIONS = [
  { label: "Media", value: "media" },
  { label: "Chunk", value: "chunk" }
]

const EXPANSION_OPTIONS = [
  { label: "Acronym", value: "acronym" },
  { label: "Synonym", value: "synonym" },
  { label: "Semantic", value: "semantic" },
  { label: "Domain", value: "domain" },
  { label: "Entity", value: "entity" }
]

const SENSITIVITY_OPTIONS = [
  { label: "Public", value: "public" },
  { label: "Internal", value: "internal" },
  { label: "Confidential", value: "confidential" },
  { label: "Restricted", value: "restricted" }
]

const TABLE_METHOD_OPTIONS = [
  { label: "Markdown", value: "markdown" },
  { label: "HTML", value: "html" },
  { label: "Hybrid", value: "hybrid" }
]

const CHUNK_TYPE_OPTIONS = [
  { label: "Text", value: "text" },
  { label: "Code", value: "code" },
  { label: "Table", value: "table" },
  { label: "List", value: "list" }
]

const CLAIM_EXTRACTOR_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "APS", value: "aps" },
  { label: "Claimify", value: "claimify" },
  { label: "NER", value: "ner" }
]

const CLAIM_VERIFIER_OPTIONS = [
  { label: "Hybrid", value: "hybrid" },
  { label: "NLI", value: "nli" },
  { label: "LLM", value: "llm" }
]

const RERANK_STRATEGY_OPTIONS = [
  { label: "FlashRank", value: "flashrank" },
  { label: "Cross-encoder", value: "cross_encoder" },
  { label: "Hybrid", value: "hybrid" },
  { label: "llama.cpp", value: "llama_cpp" },
  { label: "LLM scoring", value: "llm_scoring" },
  { label: "Two-tier", value: "two_tier" },
  { label: "None", value: "none" }
]

const CITATION_STYLE_OPTIONS = [
  { label: "APA", value: "apa" },
  { label: "MLA", value: "mla" },
  { label: "Chicago", value: "chicago" },
  { label: "Harvard", value: "harvard" },
  { label: "IEEE", value: "ieee" }
]

const ABSTENTION_OPTIONS = [
  { label: "Continue", value: "continue" },
  { label: "Ask", value: "ask" },
  { label: "Decline", value: "decline" }
]

const CONTENT_POLICY_TYPES = [
  { label: "PII", value: "pii" },
  { label: "PHI", value: "phi" }
]

const CONTENT_POLICY_MODES = [
  { label: "Redact", value: "redact" },
  { label: "Drop", value: "drop" },
  { label: "Annotate", value: "annotate" }
]

const NUMERIC_FIDELITY_OPTIONS = [
  { label: "Continue", value: "continue" },
  { label: "Ask", value: "ask" },
  { label: "Decline", value: "decline" },
  { label: "Retry", value: "retry" }
]

const LOW_CONFIDENCE_OPTIONS = [
  { label: "Continue", value: "continue" },
  { label: "Ask", value: "ask" },
  { label: "Decline", value: "decline" }
]

const normalizeSettings = (value?: Partial<RagSettings>) => ({
  ...DEFAULT_RAG_SETTINGS,
  ...(value || {})
})

const parseIdList = (value: string) =>
  value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isFinite(num) && num > 0)

const stringifyIdList = (value: number[]) => value.join(", ")

const parseBatchQueries = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

const formatScore = (score?: number) =>
  typeof score === "number" && Number.isFinite(score)
    ? score.toFixed(2)
    : null

const formatDate = (value?: string | number) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date)
}

const getResultText = (item: RagResult) =>
  item.content || item.text || item.chunk || ""

const getResultTitle = (item: RagResult) =>
  item.metadata?.title || item.metadata?.source || item.metadata?.url || ""

const getResultUrl = (item: RagResult) =>
  item.metadata?.url || item.metadata?.source || ""

const getResultType = (item: RagResult) => item.metadata?.type || ""

const getResultDate = (item: RagResult) =>
  item.metadata?.created_at || item.metadata?.date || item.metadata?.added_at

const getResultScore = (item: RagResult) =>
  typeof item.score === "number"
    ? item.score
    : typeof item.relevance === "number"
      ? item.relevance
      : undefined

const toPinnedResult = (item: RagResult): RagPinnedResult => {
  const snippet = getResultText(item).slice(0, 800)
  const title = getResultTitle(item)
  const url = getResultUrl(item)
  return {
    id: `${title || url || snippet.slice(0, 12)}-${item.metadata?.id || ""}`,
    title: title || undefined,
    source: item.metadata?.source || undefined,
    url: url || undefined,
    snippet,
    type: getResultType(item) || undefined
  }
}

const highlightText = (text: string, query: string) => {
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
  if (terms.length === 0) return text
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const regex = new RegExp(`(${escaped.join("|")})`, "gi")
  const parts = text.split(regex)
  const termSet = new Set(terms.map((term) => term.toLowerCase()))
  return parts.map((part, idx) =>
    termSet.has(part.toLowerCase()) ? (
      <mark key={`h-${idx}`} className="bg-warn/20 text-text">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`t-${idx}`}>{part}</React.Fragment>
    )
  )
}

export const RagSearchBar: React.FC<Props> = ({
  onInsert,
  onAsk,
  isConnected = true,
  open,
  onOpenChange,
  autoFocus = true,
  showToggle = true,
  variant = "card",
  currentMessage,
  showAttachedContext = false,
  attachedTabs = [],
  availableTabs = [],
  attachedFiles = [],
  onRemoveTab,
  onAddTab,
  onClearTabs,
  onRefreshTabs,
  onAddFile,
  onRemoveFile,
  onClearFiles
}) => {
  const { t } = useTranslation(["sidepanel", "playground", "common"])
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = typeof open === "boolean"
  const isOpen = isControlled ? open : internalOpen
  const setOpenState = React.useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next)
        return
      }
      setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  const searchInputRef = React.useRef<InputRef | null>(null)
  const [ragHintSeen, setRagHintSeen] = useStorage<boolean>(
    "ragSearchHintSeen",
    false
  )
  const [preset, setPreset] = useStorage<RagPresetName>(
    "ragSearchPreset",
    "balanced"
  )
  const [storedSettings, setStoredSettings] = useStorage<RagSettings>(
    "ragSearchSettingsV2",
    DEFAULT_RAG_SETTINGS
  )
  const [useCurrentMessage, setUseCurrentMessage] = useStorage<boolean>(
    "ragSearchUseCurrentMessage",
    true
  )
  const [draftSettings, setDraftSettings] = React.useState<RagSettings>(
    normalizeSettings(storedSettings)
  )
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [advancedSearch, setAdvancedSearch] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<RagResult[]>([])
  const [batchResults, setBatchResults] = React.useState<BatchResultGroup[]>([])
  const [sortMode, setSortMode] = React.useState<"relevance" | "date" | "type">(
    "relevance"
  )
  const [timedOut, setTimedOut] = React.useState(false)
  const [hasAttemptedSearch, setHasAttemptedSearch] = React.useState(false)
  const [queryError, setQueryError] = React.useState<string | null>(null)
  const [previewItem, setPreviewItem] = React.useState<RagPinnedResult | null>(
    null
  )

  const {
    ragPinnedResults,
    setRagPinnedResults,
    setRagSearchMode,
    setRagTopK,
    setRagEnableGeneration,
    setRagEnableCitations,
    setRagSources,
    setRagAdvancedOptions
  } = useStoreMessageOption(
    (state) => ({
      ragPinnedResults: state.ragPinnedResults,
      setRagPinnedResults: state.setRagPinnedResults,
      setRagSearchMode: state.setRagSearchMode,
      setRagTopK: state.setRagTopK,
      setRagEnableGeneration: state.setRagEnableGeneration,
      setRagEnableCitations: state.setRagEnableCitations,
      setRagSources: state.setRagSources,
      setRagAdvancedOptions: state.setRagAdvancedOptions
    }),
    shallow
  )

  React.useEffect(() => {
    setDraftSettings(normalizeSettings(storedSettings))
  }, [storedSettings])

  const updateSetting = React.useCallback(
    <K extends keyof RagSettings>(
      key: K,
      value: RagSettings[K],
      options?: { transient?: boolean }
    ) => {
      setDraftSettings((prev) => ({
        ...prev,
        [key]: value
      }))
      if (!options?.transient && preset !== "custom") {
        if (!TRANSIENT_KEYS.has(key)) {
          setPreset("custom")
        }
      }
    },
    [preset, setPreset]
  )

  const applyPresetSelection = React.useCallback(
    (nextPreset: RagPresetName) => {
      setPreset(nextPreset)
      if (nextPreset === "custom") return
      const nextSettings = applyRagPreset(nextPreset)
      nextSettings.query = draftSettings.query
      nextSettings.batch_queries = draftSettings.batch_queries
      setDraftSettings(nextSettings)
    },
    [draftSettings.batch_queries, draftSettings.query, setPreset]
  )

  const applySettings = React.useCallback(() => {
    const persistedSettings = {
      ...draftSettings,
      query: "",
      batch_queries: []
    }
    setStoredSettings(persistedSettings)
    setRagSearchMode(draftSettings.search_mode)
    setRagTopK(draftSettings.top_k)
    setRagEnableGeneration(draftSettings.enable_generation)
    setRagEnableCitations(draftSettings.enable_citations)
    setRagSources(draftSettings.sources)
    setRagAdvancedOptions(toRagAdvancedOptions(draftSettings))
  }, [
    draftSettings,
    setRagEnableCitations,
    setRagEnableGeneration,
    setRagSearchMode,
    setRagSources,
    setRagTopK,
    setRagAdvancedOptions,
    setStoredSettings
  ])

  const resolvedQuery = React.useMemo(() => {
    if (useCurrentMessage && !draftSettings.query.trim()) {
      return (currentMessage || "").trim()
    }
    return draftSettings.query.trim()
  }, [currentMessage, draftSettings.query, useCurrentMessage])

  const resetToBalanced = () => {
    applyPresetSelection("balanced")
  }

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

  const sortResults = React.useCallback(
    (items: RagResult[]) => {
      if (sortMode === "type") {
        return [...items].sort((a, b) =>
          String(getResultType(a)).localeCompare(String(getResultType(b)))
        )
      }
      if (sortMode === "date") {
        return [...items].sort((a, b) => {
          const dateA = new Date(
            a.metadata?.created_at ||
              a.metadata?.date ||
              a.metadata?.added_at ||
              0
          ).getTime()
          const dateB = new Date(
            b.metadata?.created_at ||
              b.metadata?.date ||
              b.metadata?.added_at ||
              0
          ).getTime()
          return dateB - dateA
        })
      }
      return [...items].sort((a, b) => {
        const scoreA = getResultScore(a) ?? 0
        const scoreB = getResultScore(b) ?? 0
        return scoreB - scoreA
      })
    },
    [sortMode]
  )

  const runSearch = async (opts?: { applyFirst?: boolean }) => {
    if (opts?.applyFirst) {
      applySettings()
    }
    const hasBatchQueries =
      draftSettings.enable_batch && draftSettings.batch_queries.length > 0
    const query = resolvedQuery || (hasBatchQueries ? draftSettings.batch_queries[0] : "")
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
    try {
      await tldwClient.initialize()
      const settings = {
        ...draftSettings,
        query
      }
      const { query: resolved, options, timeoutMs } =
        buildRagSearchRequest(settings)
      const ragRes = await tldwClient.ragSearch(resolved, {
        ...options,
        timeoutMs
      })
      const grouped = normalizeBatchResults(
        ragRes?.batch_results || ragRes?.results_by_query
      )
      if (grouped.length > 0) {
        setBatchResults(grouped)
      } else {
        const docs = ragRes?.results || ragRes?.documents || ragRes?.docs || []
        setResults(docs)
      }
      setTimedOut(false)
    } catch (e) {
      setResults([])
      setBatchResults([])
      setTimedOut(true)
    } finally {
      setLoading(false)
    }
  }

  const copyResult = async (item: RagResult, format: RagCopyFormat) => {
    const pinned = toPinnedResult(item)
    await navigator.clipboard.writeText(formatRagResult(pinned, format))
  }

  const handleAsk = (item: RagResult) => {
    const pinned = toPinnedResult(item)
    if ((ragPinnedResults || []).length > 0) {
      Modal.confirm({
        title: t("sidepanel:rag.askConfirmTitle", "Ask about this item?") as string,
        content: t(
          "sidepanel:rag.askConfirmContent",
          "Pinned results will be ignored for this Ask."
        ) as string,
        okText: t("common:continue", "Continue") as string,
        cancelText: t("common:cancel", "Cancel") as string,
        onOk: () => onAsk(formatRagResult(pinned, "markdown"), { ignorePinnedResults: true })
      })
      return
    }
    onAsk(formatRagResult(pinned, "markdown"), { ignorePinnedResults: true })
  }

  const handleInsert = (item: RagResult) => {
    const pinned = toPinnedResult(item)
    onInsert(formatRagResult(pinned, "markdown"))
  }

  const handleOpen = (item: RagResult) => {
    const url = getResultUrl(item)
    if (!url) return
    window.open(String(url), "_blank")
  }

  const handlePin = (item: RagResult) => {
    const pinned = toPinnedResult(item)
    const existing = ragPinnedResults || []
    if (existing.some((result) => result.id === pinned.id)) return
    setRagPinnedResults([...existing, pinned])
  }

  const handleUnpin = (id: string) => {
    setRagPinnedResults((ragPinnedResults || []).filter((item) => item.id !== id))
  }

  const handleClearPins = () => setRagPinnedResults([])

  React.useEffect(() => {
    const handler = () => setOpenState(!isOpen)
    window.addEventListener("tldw:toggle-rag", handler)
    return () => window.removeEventListener("tldw:toggle-rag", handler)
  }, [isOpen, setOpenState])

  React.useEffect(() => {
    if (!isOpen || !autoFocus) return
    const id = requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [isOpen, autoFocus])

  const wrapperClassName = variant === "embedded" ? "w-full" : "w-full mb-2"
  const panelClassName =
    variant === "embedded"
      ? "panel-elevated p-2 relative"
      : "panel-card p-2 mb-2 relative"

  const copyMenu = (item: RagResult): MenuProps => ({
    items: [
      {
        key: "markdown",
        label: t("sidepanel:rag.copyMarkdown", "Copy as Markdown")
      },
      {
        key: "text",
        label: t("sidepanel:rag.copyText", "Copy as text")
      }
    ],
    onClick: ({ key }) => copyResult(item, key as RagCopyFormat)
  })

  const advancedSearchLower = advancedSearch.trim().toLowerCase()
  const hasSettingsFilter = advancedOpen && advancedSearchLower.length > 0
  const matchesAdvancedSearch = (label: string) =>
    !hasSettingsFilter || label.toLowerCase().includes(advancedSearchLower)
  const matchesAny = (...labels: string[]) => labels.some(matchesAdvancedSearch)

  const renderNumberInput = (
    label: string,
    value: number,
    onChange: (next: number) => void,
    options?: { min?: number; max?: number; step?: number; helper?: string }
  ) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text">{label}</span>
      <InputNumber
        min={options?.min}
        max={options?.max}
        step={options?.step}
        value={value}
        aria-label={label}
        onChange={(next) => {
          if (next === null || next === undefined) return
          const parsed = Number(next)
          if (!Number.isFinite(parsed)) return
          onChange(parsed)
        }}
      />
      {options?.helper && (
        <span className="text-[11px] text-text-muted">{options.helper}</span>
      )}
    </div>
  )

  const renderTextInput = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    options?: { placeholder?: string; helper?: string }
  ) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text">{label}</span>
      <Input
        value={value}
        placeholder={options?.placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
      {options?.helper && (
        <span className="text-[11px] text-text-muted">{options.helper}</span>
      )}
    </div>
  )

  const renderSelect = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    options: { label: string; value: string }[],
    helper?: string
  ) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text">{label}</span>
      <Select
        value={value}
        onChange={(next) => onChange(String(next))}
        options={options}
        aria-label={label}
      />
      {helper && <span className="text-[11px] text-text-muted">{helper}</span>}
    </div>
  )

  const renderMultiSelect = (
    label: string,
    value: string[],
    onChange: (next: string[]) => void,
    options: { label: string; value: string }[],
    helper?: string
  ) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text">{label}</span>
      <Select
        mode="multiple"
        value={value}
        onChange={(next) => onChange(next as string[])}
        options={options}
        aria-label={label}
      />
      {helper && <span className="text-[11px] text-text-muted">{helper}</span>}
    </div>
  )

  const advancedItems = [
    matchesAny(
      t("sidepanel:rag.sourceScope", "Source scope") as string,
      t("sidepanel:rag.corpus", "Corpus") as string,
      t("sidepanel:rag.indexNamespace", "Index namespace") as string
    ) && {
      key: "source-scope",
      label: t("sidepanel:rag.sourceScope", "Source scope"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.sourceScope", "Source scope") as string,
            t("sidepanel:rag.corpus", "Corpus") as string
          ) &&
            renderTextInput(
              t("sidepanel:rag.corpus", "Corpus"),
              draftSettings.corpus,
              (next) => updateSetting("corpus", next)
            )}
          {matchesAny(
            t("sidepanel:rag.sourceScope", "Source scope") as string,
            t("sidepanel:rag.indexNamespace", "Index namespace") as string
          ) &&
            renderTextInput(
              t("sidepanel:rag.indexNamespace", "Index namespace"),
              draftSettings.index_namespace,
              (next) => updateSetting("index_namespace", next)
            )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.queryExpansion", "Query expansion") as string,
      t("sidepanel:rag.expandQuery", "Expand query") as string,
      t("sidepanel:rag.expansionStrategies", "Expansion strategies") as string,
      t("sidepanel:rag.spellCheck", "Spell check") as string
    ) && {
      key: "query-expansion",
      label: t("sidepanel:rag.queryExpansion", "Query expansion"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.queryExpansion", "Query expansion") as string,
            t("sidepanel:rag.expandQuery", "Expand query") as string,
            t("sidepanel:rag.expansionStrategies", "Expansion strategies") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.expand_query}
                onChange={(checked) => updateSetting("expand_query", checked)}
                aria-label={t("sidepanel:rag.expandQuery", "Expand query")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.expandQuery", "Expand query")}
              </span>
            </div>
          )}
          {draftSettings.expand_query &&
            matchesAny(
              t("sidepanel:rag.queryExpansion", "Query expansion") as string,
              t("sidepanel:rag.expansionStrategies", "Expansion strategies") as string
            ) &&
            renderMultiSelect(
              t("sidepanel:rag.expansionStrategies", "Expansion strategies"),
              draftSettings.expansion_strategies,
              (next) =>
                updateSetting(
                  "expansion_strategies",
                  next as RagSettings["expansion_strategies"]
                ),
              EXPANSION_OPTIONS
            )}
          {matchesAny(
            t("sidepanel:rag.queryExpansion", "Query expansion") as string,
            t("sidepanel:rag.spellCheck", "Spell check") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.spell_check}
                onChange={(checked) => updateSetting("spell_check", checked)}
                aria-label={t("sidepanel:rag.spellCheck", "Spell check")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.spellCheck", "Spell check")}
              </span>
            </div>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.caching", "Caching") as string,
      t("sidepanel:rag.enableCache", "Enable cache") as string,
      t("sidepanel:rag.cacheThreshold", "Cache threshold") as string,
      t("sidepanel:rag.adaptiveCache", "Adaptive cache") as string
    ) && {
      key: "caching",
      label: t("sidepanel:rag.caching", "Caching"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.caching", "Caching") as string,
            t("sidepanel:rag.enableCache", "Enable cache") as string,
            t("sidepanel:rag.cacheThreshold", "Cache threshold") as string,
            t("sidepanel:rag.adaptiveCache", "Adaptive cache") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_cache}
                onChange={(checked) => updateSetting("enable_cache", checked)}
                aria-label={t("sidepanel:rag.enableCache", "Enable cache")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableCache", "Enable cache")}
              </span>
            </div>
          )}
          {draftSettings.enable_cache && (
            <>
              {matchesAny(
                t("sidepanel:rag.caching", "Caching") as string,
                t("sidepanel:rag.cacheThreshold", "Cache threshold") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.cacheThreshold", "Cache threshold"),
                  draftSettings.cache_threshold,
                  (next) => updateSetting("cache_threshold", next),
                  { min: 0, max: 1, step: 0.05 }
                )}
              {matchesAny(
                t("sidepanel:rag.caching", "Caching") as string,
                t("sidepanel:rag.adaptiveCache", "Adaptive cache") as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.adaptive_cache}
                    onChange={(checked) => updateSetting("adaptive_cache", checked)}
                    aria-label={t("sidepanel:rag.adaptiveCache", "Adaptive cache")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.adaptiveCache", "Adaptive cache")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.documentProcessing", "Document processing") as string,
      t("sidepanel:rag.enableTableProcessing", "Enable table processing") as string,
      t("sidepanel:rag.tableMethod", "Table method") as string
    ) && {
      key: "document-processing",
      label: t("sidepanel:rag.documentProcessing", "Document processing"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.documentProcessing", "Document processing") as string,
            t("sidepanel:rag.enableTableProcessing", "Enable table processing") as string,
            t("sidepanel:rag.tableMethod", "Table method") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_table_processing}
                onChange={(checked) => updateSetting("enable_table_processing", checked)}
                aria-label={t(
                  "sidepanel:rag.enableTableProcessing",
                  "Enable table processing"
                )}
              />
              <span className="text-xs text-text">
                {t(
                  "sidepanel:rag.enableTableProcessing",
                  "Enable table processing"
                )}
              </span>
            </div>
          )}
          {draftSettings.enable_table_processing &&
            matchesAny(
              t("sidepanel:rag.documentProcessing", "Document processing") as string,
              t("sidepanel:rag.tableMethod", "Table method") as string
            ) &&
            renderSelect(
              t("sidepanel:rag.tableMethod", "Table method"),
              draftSettings.table_method,
              (next) =>
                updateSetting("table_method", next as RagSettings["table_method"]),
              TABLE_METHOD_OPTIONS
            )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.vlm", "VLM late chunking") as string,
      t("sidepanel:rag.enableVlm", "Enable VLM late chunking") as string,
      t("sidepanel:rag.vlmBackend", "VLM backend") as string,
      t("sidepanel:rag.vlmDetectTables", "Detect tables only") as string,
      t("sidepanel:rag.vlmMaxPages", "Max pages") as string,
      t("sidepanel:rag.vlmTopKDocs", "Top K docs") as string
    ) && {
      key: "vlm",
      label: t("sidepanel:rag.vlm", "VLM late chunking"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.vlm", "VLM late chunking") as string,
            t("sidepanel:rag.enableVlm", "Enable VLM late chunking") as string,
            t("sidepanel:rag.vlmBackend", "VLM backend") as string,
            t("sidepanel:rag.vlmDetectTables", "Detect tables only") as string,
            t("sidepanel:rag.vlmMaxPages", "Max pages") as string,
            t("sidepanel:rag.vlmTopKDocs", "Top K docs") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_vlm_late_chunking}
                onChange={(checked) =>
                  updateSetting("enable_vlm_late_chunking", checked)
                }
                aria-label={t("sidepanel:rag.enableVlm", "Enable VLM late chunking")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableVlm", "Enable VLM late chunking")}
              </span>
            </div>
          )}
          {draftSettings.enable_vlm_late_chunking && (
            <>
              {matchesAny(
                t("sidepanel:rag.vlm", "VLM late chunking") as string,
                t("sidepanel:rag.vlmBackend", "VLM backend") as string
              ) &&
                renderTextInput(
                  t("sidepanel:rag.vlmBackend", "VLM backend"),
                  draftSettings.vlm_backend || "",
                  (next) => updateSetting("vlm_backend", next || null)
                )}
              {matchesAny(
                t("sidepanel:rag.vlm", "VLM late chunking") as string,
                t("sidepanel:rag.vlmDetectTables", "Detect tables only") as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.vlm_detect_tables_only}
                    onChange={(checked) =>
                      updateSetting("vlm_detect_tables_only", checked)
                    }
                    aria-label={t("sidepanel:rag.vlmDetectTables", "Detect tables only")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.vlmDetectTables", "Detect tables only")}
                  </span>
                </div>
              )}
              {matchesAny(
                t("sidepanel:rag.vlm", "VLM late chunking") as string,
                t("sidepanel:rag.vlmMaxPages", "Max pages") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.vlmMaxPages", "Max pages"),
                  draftSettings.vlm_max_pages,
                  (next) => updateSetting("vlm_max_pages", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.vlm", "VLM late chunking") as string,
                t("sidepanel:rag.vlmTopKDocs", "Top K docs") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.vlmTopKDocs", "Top K docs"),
                  draftSettings.vlm_late_chunk_top_k_docs,
                  (next) => updateSetting("vlm_late_chunk_top_k_docs", next),
                  { min: 1 }
                )}
            </>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.advancedRetrieval", "Advanced retrieval") as string,
      t("sidepanel:rag.multiVector", "Multi-vector passages") as string,
      t("sidepanel:rag.mvSpanChars", "Span chars") as string,
      t("sidepanel:rag.mvStride", "Stride") as string,
      t("sidepanel:rag.mvMaxSpans", "Max spans") as string,
      t("sidepanel:rag.mvFlatten", "Flatten to spans") as string,
      t("sidepanel:rag.numericTableBoost", "Numeric table boost") as string
    ) && {
      key: "advanced-retrieval",
      label: t("sidepanel:rag.advancedRetrieval", "Advanced retrieval"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.advancedRetrieval", "Advanced retrieval") as string,
            t("sidepanel:rag.multiVector", "Multi-vector passages") as string,
            t("sidepanel:rag.mvSpanChars", "Span chars") as string,
            t("sidepanel:rag.mvStride", "Stride") as string,
            t("sidepanel:rag.mvMaxSpans", "Max spans") as string,
            t("sidepanel:rag.mvFlatten", "Flatten to spans") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_multi_vector_passages}
                onChange={(checked) =>
                  updateSetting("enable_multi_vector_passages", checked)
                }
                aria-label={t("sidepanel:rag.multiVector", "Multi-vector passages")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.multiVector", "Multi-vector passages")}
              </span>
            </div>
          )}
          {draftSettings.enable_multi_vector_passages && (
            <>
              {matchesAny(
                t("sidepanel:rag.advancedRetrieval", "Advanced retrieval") as string,
                t("sidepanel:rag.mvSpanChars", "Span chars") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.mvSpanChars", "Span chars"),
                  draftSettings.mv_span_chars,
                  (next) => updateSetting("mv_span_chars", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.advancedRetrieval", "Advanced retrieval") as string,
                t("sidepanel:rag.mvStride", "Stride") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.mvStride", "Stride"),
                  draftSettings.mv_stride,
                  (next) => updateSetting("mv_stride", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.advancedRetrieval", "Advanced retrieval") as string,
                t("sidepanel:rag.mvMaxSpans", "Max spans") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.mvMaxSpans", "Max spans"),
                  draftSettings.mv_max_spans,
                  (next) => updateSetting("mv_max_spans", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.advancedRetrieval", "Advanced retrieval") as string,
                t("sidepanel:rag.mvFlatten", "Flatten to spans") as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.mv_flatten_to_spans}
                    onChange={(checked) => updateSetting("mv_flatten_to_spans", checked)}
                    aria-label={t("sidepanel:rag.mvFlatten", "Flatten to spans")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.mvFlatten", "Flatten to spans")}
                  </span>
                </div>
              )}
            </>
          )}
          {matchesAny(
            t("sidepanel:rag.advancedRetrieval", "Advanced retrieval") as string,
            t("sidepanel:rag.numericTableBoost", "Numeric table boost") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_numeric_table_boost}
                onChange={(checked) =>
                  updateSetting("enable_numeric_table_boost", checked)
                }
                aria-label={t("sidepanel:rag.numericTableBoost", "Numeric table boost")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.numericTableBoost", "Numeric table boost")}
              </span>
            </div>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.claims", "Claims & factuality") as string,
      t("sidepanel:rag.enableClaims", "Enable claims") as string,
      t("sidepanel:rag.claimExtractor", "Claim extractor") as string,
      t("sidepanel:rag.claimVerifier", "Claim verifier") as string,
      t("sidepanel:rag.claimsTopK", "Claims top_k") as string,
      t("sidepanel:rag.claimsThreshold", "Confidence threshold") as string,
      t("sidepanel:rag.claimsMax", "Claims max") as string,
      t("sidepanel:rag.claimsConcurrency", "Concurrency") as string,
      t("sidepanel:rag.nliModel", "NLI model") as string
    ) && {
      key: "claims",
      label: t("sidepanel:rag.claims", "Claims & factuality"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.claims", "Claims & factuality") as string,
            t("sidepanel:rag.enableClaims", "Enable claims") as string,
            t("sidepanel:rag.claimExtractor", "Claim extractor") as string,
            t("sidepanel:rag.claimVerifier", "Claim verifier") as string,
            t("sidepanel:rag.claimsTopK", "Claims top_k") as string,
            t("sidepanel:rag.claimsThreshold", "Confidence threshold") as string,
            t("sidepanel:rag.claimsMax", "Claims max") as string,
            t("sidepanel:rag.claimsConcurrency", "Concurrency") as string,
            t("sidepanel:rag.nliModel", "NLI model") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_claims}
                onChange={(checked) => updateSetting("enable_claims", checked)}
                aria-label={t("sidepanel:rag.enableClaims", "Enable claims")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableClaims", "Enable claims")}
              </span>
            </div>
          )}
          {draftSettings.enable_claims && (
            <>
              {matchesAny(
                t("sidepanel:rag.claims", "Claims & factuality") as string,
                t("sidepanel:rag.claimExtractor", "Claim extractor") as string
              ) &&
                renderSelect(
                  t("sidepanel:rag.claimExtractor", "Claim extractor"),
                  draftSettings.claim_extractor,
                  (next) =>
                    updateSetting(
                      "claim_extractor",
                      next as RagSettings["claim_extractor"]
                    ),
                  CLAIM_EXTRACTOR_OPTIONS
                )}
              {matchesAny(
                t("sidepanel:rag.claims", "Claims & factuality") as string,
                t("sidepanel:rag.claimVerifier", "Claim verifier") as string
              ) &&
                renderSelect(
                  t("sidepanel:rag.claimVerifier", "Claim verifier"),
                  draftSettings.claim_verifier,
                  (next) =>
                    updateSetting(
                      "claim_verifier",
                      next as RagSettings["claim_verifier"]
                    ),
                  CLAIM_VERIFIER_OPTIONS
                )}
              {matchesAny(
                t("sidepanel:rag.claims", "Claims & factuality") as string,
                t("sidepanel:rag.claimsTopK", "Claims top_k") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.claimsTopK", "Claims top_k"),
                  draftSettings.claims_top_k,
                  (next) => updateSetting("claims_top_k", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.claims", "Claims & factuality") as string,
                t("sidepanel:rag.claimsThreshold", "Confidence threshold") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.claimsThreshold", "Confidence threshold"),
                  draftSettings.claims_conf_threshold,
                  (next) => updateSetting("claims_conf_threshold", next),
                  { min: 0, max: 1, step: 0.05 }
                )}
              {matchesAny(
                t("sidepanel:rag.claims", "Claims & factuality") as string,
                t("sidepanel:rag.claimsMax", "Claims max") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.claimsMax", "Claims max"),
                  draftSettings.claims_max,
                  (next) => updateSetting("claims_max", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.claims", "Claims & factuality") as string,
                t("sidepanel:rag.claimsConcurrency", "Concurrency") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.claimsConcurrency", "Concurrency"),
                  draftSettings.claims_concurrency,
                  (next) => updateSetting("claims_concurrency", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.claims", "Claims & factuality") as string,
                t("sidepanel:rag.nliModel", "NLI model") as string
              ) &&
                renderTextInput(
                  t("sidepanel:rag.nliModel", "NLI model"),
                  draftSettings.nli_model,
                  (next) => updateSetting("nli_model", next)
                )}
            </>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.guardrails", "Generation guardrails") as string,
      t("sidepanel:rag.contentPolicy", "Content policy filter") as string,
      t("sidepanel:rag.contentPolicyTypes", "Policy types") as string,
      t("sidepanel:rag.contentPolicyMode", "Policy mode") as string,
      t("sidepanel:rag.htmlSanitizer", "HTML sanitizer") as string,
      t("sidepanel:rag.allowedTags", "Allowed tags") as string,
      t("sidepanel:rag.allowedAttrs", "Allowed attrs") as string,
      t("sidepanel:rag.ocrThreshold", "OCR confidence threshold") as string
    ) && {
      key: "guardrails",
      label: t("sidepanel:rag.guardrails", "Generation guardrails"),
      children: !draftSettings.enable_generation ? (
        <div className="text-xs text-text-muted">
          {t(
            "sidepanel:rag.guardrailsRequiresGeneration",
            "Enable generation to configure guardrails."
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.guardrails", "Generation guardrails") as string,
            t("sidepanel:rag.contentPolicy", "Content policy filter") as string,
            t("sidepanel:rag.contentPolicyTypes", "Policy types") as string,
            t("sidepanel:rag.contentPolicyMode", "Policy mode") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_content_policy_filter}
                onChange={(checked) =>
                  updateSetting("enable_content_policy_filter", checked)
                }
                aria-label={t("sidepanel:rag.contentPolicy", "Content policy filter")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.contentPolicy", "Content policy filter")}
              </span>
            </div>
          )}
          {draftSettings.enable_content_policy_filter && (
            <>
              {matchesAny(
                t("sidepanel:rag.guardrails", "Generation guardrails") as string,
                t("sidepanel:rag.contentPolicyTypes", "Policy types") as string
              ) &&
                renderMultiSelect(
                  t("sidepanel:rag.contentPolicyTypes", "Policy types"),
                  draftSettings.content_policy_types,
                  (next) =>
                    updateSetting(
                      "content_policy_types",
                      next as RagSettings["content_policy_types"]
                    ),
                  CONTENT_POLICY_TYPES
                )}
              {matchesAny(
                t("sidepanel:rag.guardrails", "Generation guardrails") as string,
                t("sidepanel:rag.contentPolicyMode", "Policy mode") as string
              ) &&
                renderSelect(
                  t("sidepanel:rag.contentPolicyMode", "Policy mode"),
                  draftSettings.content_policy_mode,
                  (next) =>
                    updateSetting(
                      "content_policy_mode",
                      next as RagSettings["content_policy_mode"]
                    ),
                  CONTENT_POLICY_MODES
                )}
            </>
          )}
          {matchesAny(
            t("sidepanel:rag.guardrails", "Generation guardrails") as string,
            t("sidepanel:rag.htmlSanitizer", "HTML sanitizer") as string,
            t("sidepanel:rag.allowedTags", "Allowed tags") as string,
            t("sidepanel:rag.allowedAttrs", "Allowed attrs") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_html_sanitizer}
                onChange={(checked) => updateSetting("enable_html_sanitizer", checked)}
                aria-label={t("sidepanel:rag.htmlSanitizer", "HTML sanitizer")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.htmlSanitizer", "HTML sanitizer")}
              </span>
            </div>
          )}
          {draftSettings.enable_html_sanitizer && (
            <>
              {matchesAny(
                t("sidepanel:rag.guardrails", "Generation guardrails") as string,
                t("sidepanel:rag.allowedTags", "Allowed tags") as string
              ) && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.allowedTags", "Allowed tags")}
                  </span>
                  <Select
                    mode="tags"
                    value={draftSettings.html_allowed_tags}
                    onChange={(next) =>
                      updateSetting("html_allowed_tags", next as string[])
                    }
                    aria-label={t("sidepanel:rag.allowedTags", "Allowed tags")}
                  />
                </div>
              )}
              {matchesAny(
                t("sidepanel:rag.guardrails", "Generation guardrails") as string,
                t("sidepanel:rag.allowedAttrs", "Allowed attrs") as string
              ) && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.allowedAttrs", "Allowed attrs")}
                  </span>
                  <Select
                    mode="tags"
                    value={draftSettings.html_allowed_attrs}
                    onChange={(next) =>
                      updateSetting("html_allowed_attrs", next as string[])
                    }
                    aria-label={t("sidepanel:rag.allowedAttrs", "Allowed attrs")}
                  />
                </div>
              )}
            </>
          )}
          {matchesAny(
            t("sidepanel:rag.guardrails", "Generation guardrails") as string,
            t("sidepanel:rag.ocrThreshold", "OCR confidence threshold") as string
          ) &&
            renderNumberInput(
              t("sidepanel:rag.ocrThreshold", "OCR confidence threshold"),
              draftSettings.ocr_confidence_threshold,
              (next) => updateSetting("ocr_confidence_threshold", next),
              { min: 0, max: 1, step: 0.05 }
            )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.postVerification", "Post-verification") as string,
      t("sidepanel:rag.enablePostVerification", "Enable post verification") as string,
      t("sidepanel:rag.adaptiveRetries", "Max retries") as string,
      t("sidepanel:rag.adaptiveUnsupported", "Unsupported threshold") as string,
      t("sidepanel:rag.adaptiveMaxClaims", "Max claims") as string,
      t("sidepanel:rag.adaptiveBudget", "Time budget") as string,
      t("sidepanel:rag.lowConfidence", "Low confidence behavior") as string,
      t("sidepanel:rag.advancedRewrites", "Advanced rewrites") as string,
      t("sidepanel:rag.rerunLowConfidence", "Rerun on low confidence") as string,
      t("sidepanel:rag.rerunIncludeGeneration", "Rerun include generation") as string,
      t("sidepanel:rag.rerunBypassCache", "Rerun bypass cache") as string,
      t("sidepanel:rag.rerunTimeBudget", "Rerun time budget") as string,
      t("sidepanel:rag.rerunDocBudget", "Rerun doc budget") as string
    ) && {
      key: "post-verification",
      label: t("sidepanel:rag.postVerification", "Post-verification"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.postVerification", "Post-verification") as string,
            t("sidepanel:rag.enablePostVerification", "Enable post verification") as string,
            t("sidepanel:rag.adaptiveRetries", "Max retries") as string,
            t("sidepanel:rag.adaptiveUnsupported", "Unsupported threshold") as string,
            t("sidepanel:rag.adaptiveMaxClaims", "Max claims") as string,
            t("sidepanel:rag.adaptiveBudget", "Time budget") as string,
            t("sidepanel:rag.lowConfidence", "Low confidence behavior") as string,
            t("sidepanel:rag.advancedRewrites", "Advanced rewrites") as string,
            t("sidepanel:rag.rerunLowConfidence", "Rerun on low confidence") as string,
            t("sidepanel:rag.rerunIncludeGeneration", "Rerun include generation") as string,
            t("sidepanel:rag.rerunBypassCache", "Rerun bypass cache") as string,
            t("sidepanel:rag.rerunTimeBudget", "Rerun time budget") as string,
            t("sidepanel:rag.rerunDocBudget", "Rerun doc budget") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_post_verification}
                onChange={(checked) =>
                  updateSetting("enable_post_verification", checked)
                }
                aria-label={t(
                  "sidepanel:rag.enablePostVerification",
                  "Enable post verification"
                )}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enablePostVerification", "Enable post verification")}
              </span>
            </div>
          )}
          {draftSettings.enable_post_verification && (
            <>
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.adaptiveRetries", "Max retries") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.adaptiveRetries", "Max retries"),
                  draftSettings.adaptive_max_retries,
                  (next) => updateSetting("adaptive_max_retries", next),
                  { min: 0 }
                )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.adaptiveUnsupported", "Unsupported threshold") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.adaptiveUnsupported", "Unsupported threshold"),
                  draftSettings.adaptive_unsupported_threshold,
                  (next) => updateSetting("adaptive_unsupported_threshold", next),
                  { min: 0, max: 1, step: 0.05 }
                )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.adaptiveMaxClaims", "Max claims") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.adaptiveMaxClaims", "Max claims"),
                  draftSettings.adaptive_max_claims,
                  (next) => updateSetting("adaptive_max_claims", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.adaptiveBudget", "Time budget") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.adaptiveBudget", "Time budget"),
                  draftSettings.adaptive_time_budget_sec,
                  (next) => updateSetting("adaptive_time_budget_sec", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.lowConfidence", "Low confidence behavior") as string
              ) &&
                renderSelect(
                  t("sidepanel:rag.lowConfidence", "Low confidence behavior"),
                  draftSettings.low_confidence_behavior,
                  (next) =>
                    updateSetting(
                      "low_confidence_behavior",
                      next as RagSettings["low_confidence_behavior"]
                    ),
                  LOW_CONFIDENCE_OPTIONS
                )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.advancedRewrites", "Advanced rewrites") as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.adaptive_advanced_rewrites}
                    onChange={(checked) =>
                      updateSetting("adaptive_advanced_rewrites", checked)
                    }
                    aria-label={t("sidepanel:rag.advancedRewrites", "Advanced rewrites")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.advancedRewrites", "Advanced rewrites")}
                  </span>
                </div>
              )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.rerunLowConfidence", "Rerun on low confidence") as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.adaptive_rerun_on_low_confidence}
                    onChange={(checked) =>
                      updateSetting("adaptive_rerun_on_low_confidence", checked)
                    }
                    aria-label={t(
                      "sidepanel:rag.rerunLowConfidence",
                      "Rerun on low confidence"
                    )}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.rerunLowConfidence", "Rerun on low confidence")}
                  </span>
                </div>
              )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t(
                  "sidepanel:rag.rerunIncludeGeneration",
                  "Rerun include generation"
                ) as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.adaptive_rerun_include_generation}
                    onChange={(checked) =>
                      updateSetting("adaptive_rerun_include_generation", checked)
                    }
                    aria-label={t(
                      "sidepanel:rag.rerunIncludeGeneration",
                      "Rerun include generation"
                    )}
                  />
                  <span className="text-xs text-text">
                    {t(
                      "sidepanel:rag.rerunIncludeGeneration",
                      "Rerun include generation"
                    )}
                  </span>
                </div>
              )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.rerunBypassCache", "Rerun bypass cache") as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.adaptive_rerun_bypass_cache}
                    onChange={(checked) =>
                      updateSetting("adaptive_rerun_bypass_cache", checked)
                    }
                    aria-label={t("sidepanel:rag.rerunBypassCache", "Rerun bypass cache")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.rerunBypassCache", "Rerun bypass cache")}
                  </span>
                </div>
              )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.rerunTimeBudget", "Rerun time budget") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.rerunTimeBudget", "Rerun time budget"),
                  draftSettings.adaptive_rerun_time_budget_sec,
                  (next) => updateSetting("adaptive_rerun_time_budget_sec", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.postVerification", "Post-verification") as string,
                t("sidepanel:rag.rerunDocBudget", "Rerun doc budget") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.rerunDocBudget", "Rerun doc budget"),
                  draftSettings.adaptive_rerun_doc_budget,
                  (next) => updateSetting("adaptive_rerun_doc_budget", next),
                  { min: 1 }
                )}
            </>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.agentic", "Agentic strategy") as string,
      t("sidepanel:rag.agenticOnly", "Switch strategy to Agentic to configure these settings.") as string,
      t("sidepanel:rag.agenticTopK", "Top K docs") as string,
      t("sidepanel:rag.agenticWindow", "Window chars") as string,
      t("sidepanel:rag.agenticMaxTokens", "Max tokens read") as string,
      t("sidepanel:rag.agenticToolCalls", "Max tool calls") as string,
      t("sidepanel:rag.agenticExtractive", "Extractive only") as string,
      t("sidepanel:rag.agenticQuoteSpans", "Quote spans") as string,
      t("sidepanel:rag.agenticDebug", "Debug trace") as string,
      t("sidepanel:rag.agenticTools", "Enable tools") as string,
      t("sidepanel:rag.agenticPlanner", "Use LLM planner") as string,
      t("sidepanel:rag.agenticTimeBudget", "Time budget") as string,
      t("sidepanel:rag.agenticCacheTtl", "Cache TTL") as string,
      t("sidepanel:rag.agenticDecomposition", "Query decomposition") as string,
      t("sidepanel:rag.agenticSubgoalMax", "Subgoal max") as string,
      t("sidepanel:rag.agenticSemanticWithin", "Semantic within") as string,
      t("sidepanel:rag.agenticSectionIndex", "Section index") as string,
      t("sidepanel:rag.agenticAnchors", "Prefer anchors") as string,
      t("sidepanel:rag.agenticTableSupport", "Table support") as string,
      t("sidepanel:rag.agenticVlm", "Agentic VLM late chunking") as string,
      t("sidepanel:rag.agenticVlmBackend", "VLM backend") as string,
      t("sidepanel:rag.agenticVlmDetect", "Detect tables only") as string,
      t("sidepanel:rag.agenticVlmPages", "Max pages") as string,
      t("sidepanel:rag.agenticVlmTopK", "Top K docs") as string,
      t("sidepanel:rag.agenticProviderEmbeddings", "Use provider embeddings") as string,
      t("sidepanel:rag.agenticProviderModel", "Provider model id") as string,
      t("sidepanel:rag.agenticAdaptiveBudgets", "Adaptive budgets") as string,
      t("sidepanel:rag.agenticCoverage", "Coverage target") as string,
      t("sidepanel:rag.agenticMinCorroborating", "Min corroborating docs") as string,
      t("sidepanel:rag.agenticMaxRedundancy", "Max redundancy") as string,
      t("sidepanel:rag.agenticMetrics", "Enable metrics") as string
    ) && {
      key: "agentic",
      label: t("sidepanel:rag.agentic", "Agentic strategy"),
      children:
        draftSettings.strategy !== "agentic" ? (
          <div className="text-xs text-text-muted">
            {t(
              "sidepanel:rag.agenticOnly",
              "Switch strategy to Agentic to configure these settings."
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticTopK", "Top K docs") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticTopK", "Top K docs"),
                draftSettings.agentic_top_k_docs,
                (next) => updateSetting("agentic_top_k_docs", next),
                { min: 1 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticWindow", "Window chars") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticWindow", "Window chars"),
                draftSettings.agentic_window_chars,
                (next) => updateSetting("agentic_window_chars", next),
                { min: 1 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticMaxTokens", "Max tokens read") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticMaxTokens", "Max tokens read"),
                draftSettings.agentic_max_tokens_read,
                (next) => updateSetting("agentic_max_tokens_read", next),
                { min: 1 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticToolCalls", "Max tool calls") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticToolCalls", "Max tool calls"),
                draftSettings.agentic_max_tool_calls,
                (next) => updateSetting("agentic_max_tool_calls", next),
                { min: 0 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticExtractive", "Extractive only") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_extractive_only}
                  onChange={(checked) =>
                    updateSetting("agentic_extractive_only", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticExtractive", "Extractive only")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticExtractive", "Extractive only")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticQuoteSpans", "Quote spans") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_quote_spans}
                  onChange={(checked) => updateSetting("agentic_quote_spans", checked)}
                  aria-label={t("sidepanel:rag.agenticQuoteSpans", "Quote spans")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticQuoteSpans", "Quote spans")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticDebug", "Debug trace") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_debug_trace}
                  onChange={(checked) => updateSetting("agentic_debug_trace", checked)}
                  aria-label={t("sidepanel:rag.agenticDebug", "Debug trace")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticDebug", "Debug trace")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticTools", "Enable tools") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_enable_tools}
                  onChange={(checked) =>
                    updateSetting("agentic_enable_tools", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticTools", "Enable tools")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticTools", "Enable tools")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticPlanner", "Use LLM planner") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_use_llm_planner}
                  onChange={(checked) =>
                    updateSetting("agentic_use_llm_planner", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticPlanner", "Use LLM planner")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticPlanner", "Use LLM planner")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticTimeBudget", "Time budget") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticTimeBudget", "Time budget"),
                draftSettings.agentic_time_budget_sec,
                (next) => updateSetting("agentic_time_budget_sec", next),
                { min: 1 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticCacheTtl", "Cache TTL") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticCacheTtl", "Cache TTL"),
                draftSettings.agentic_cache_ttl_sec,
                (next) => updateSetting("agentic_cache_ttl_sec", next),
                { min: 1 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticDecomposition", "Query decomposition") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_enable_query_decomposition}
                  onChange={(checked) =>
                    updateSetting("agentic_enable_query_decomposition", checked)
                  }
                  aria-label={t(
                    "sidepanel:rag.agenticDecomposition",
                    "Query decomposition"
                  )}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticDecomposition", "Query decomposition")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticSubgoalMax", "Subgoal max") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticSubgoalMax", "Subgoal max"),
                draftSettings.agentic_subgoal_max,
                (next) => updateSetting("agentic_subgoal_max", next),
                { min: 1 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticSemanticWithin", "Semantic within") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_enable_semantic_within}
                  onChange={(checked) =>
                    updateSetting("agentic_enable_semantic_within", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticSemanticWithin", "Semantic within")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticSemanticWithin", "Semantic within")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticSectionIndex", "Section index") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_enable_section_index}
                  onChange={(checked) =>
                    updateSetting("agentic_enable_section_index", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticSectionIndex", "Section index")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticSectionIndex", "Section index")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticAnchors", "Prefer anchors") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_prefer_structural_anchors}
                  onChange={(checked) =>
                    updateSetting("agentic_prefer_structural_anchors", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticAnchors", "Prefer anchors")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticAnchors", "Prefer anchors")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticTableSupport", "Table support") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_enable_table_support}
                  onChange={(checked) =>
                    updateSetting("agentic_enable_table_support", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticTableSupport", "Table support")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticTableSupport", "Table support")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticVlm", "Agentic VLM late chunking") as string,
              t("sidepanel:rag.agenticVlmBackend", "VLM backend") as string,
              t("sidepanel:rag.agenticVlmDetect", "Detect tables only") as string,
              t("sidepanel:rag.agenticVlmPages", "Max pages") as string,
              t("sidepanel:rag.agenticVlmTopK", "Top K docs") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_enable_vlm_late_chunking}
                  onChange={(checked) =>
                    updateSetting("agentic_enable_vlm_late_chunking", checked)
                  }
                  aria-label={t(
                    "sidepanel:rag.agenticVlm",
                    "Agentic VLM late chunking"
                  )}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticVlm", "Agentic VLM late chunking")}
                </span>
              </div>
            )}
            {draftSettings.agentic_enable_vlm_late_chunking && (
              <>
                {matchesAny(
                  t("sidepanel:rag.agentic", "Agentic strategy") as string,
                  t("sidepanel:rag.agenticVlmBackend", "VLM backend") as string
                ) &&
                  renderTextInput(
                    t("sidepanel:rag.agenticVlmBackend", "VLM backend"),
                    draftSettings.agentic_vlm_backend || "",
                    (next) => updateSetting("agentic_vlm_backend", next || null)
                  )}
                {matchesAny(
                  t("sidepanel:rag.agentic", "Agentic strategy") as string,
                  t("sidepanel:rag.agenticVlmDetect", "Detect tables only") as string
                ) && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={draftSettings.agentic_vlm_detect_tables_only}
                      onChange={(checked) =>
                        updateSetting("agentic_vlm_detect_tables_only", checked)
                      }
                      aria-label={t(
                        "sidepanel:rag.agenticVlmDetect",
                        "Detect tables only"
                      )}
                    />
                    <span className="text-xs text-text">
                      {t("sidepanel:rag.agenticVlmDetect", "Detect tables only")}
                    </span>
                  </div>
                )}
                {matchesAny(
                  t("sidepanel:rag.agentic", "Agentic strategy") as string,
                  t("sidepanel:rag.agenticVlmPages", "Max pages") as string
                ) &&
                  renderNumberInput(
                    t("sidepanel:rag.agenticVlmPages", "Max pages"),
                    draftSettings.agentic_vlm_max_pages,
                    (next) => updateSetting("agentic_vlm_max_pages", next),
                    { min: 1 }
                  )}
                {matchesAny(
                  t("sidepanel:rag.agentic", "Agentic strategy") as string,
                  t("sidepanel:rag.agenticVlmTopK", "Top K docs") as string
                ) &&
                  renderNumberInput(
                    t("sidepanel:rag.agenticVlmTopK", "Top K docs"),
                    draftSettings.agentic_vlm_late_chunk_top_k_docs,
                    (next) => updateSetting("agentic_vlm_late_chunk_top_k_docs", next),
                    { min: 1 }
                  )}
              </>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticProviderEmbeddings", "Use provider embeddings") as string,
              t("sidepanel:rag.agenticProviderModel", "Provider model id") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_use_provider_embeddings_within}
                  onChange={(checked) =>
                    updateSetting("agentic_use_provider_embeddings_within", checked)
                  }
                  aria-label={t(
                    "sidepanel:rag.agenticProviderEmbeddings",
                    "Use provider embeddings"
                  )}
                />
                <span className="text-xs text-text">
                  {t(
                    "sidepanel:rag.agenticProviderEmbeddings",
                    "Use provider embeddings"
                  )}
                </span>
              </div>
            )}
            {draftSettings.agentic_use_provider_embeddings_within &&
              matchesAny(
                t("sidepanel:rag.agentic", "Agentic strategy") as string,
                t("sidepanel:rag.agenticProviderModel", "Provider model id") as string
              ) &&
              renderTextInput(
                t("sidepanel:rag.agenticProviderModel", "Provider model id"),
                draftSettings.agentic_provider_embedding_model_id,
                (next) =>
                  updateSetting("agentic_provider_embedding_model_id", next)
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticAdaptiveBudgets", "Adaptive budgets") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_adaptive_budgets}
                  onChange={(checked) =>
                    updateSetting("agentic_adaptive_budgets", checked)
                  }
                  aria-label={t(
                    "sidepanel:rag.agenticAdaptiveBudgets",
                    "Adaptive budgets"
                  )}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticAdaptiveBudgets", "Adaptive budgets")}
                </span>
              </div>
            )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticCoverage", "Coverage target") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticCoverage", "Coverage target"),
                draftSettings.agentic_coverage_target,
                (next) => updateSetting("agentic_coverage_target", next),
                { min: 0, max: 1, step: 0.05 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticMinCorroborating", "Min corroborating docs") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticMinCorroborating", "Min corroborating docs"),
                draftSettings.agentic_min_corroborating_docs,
                (next) => updateSetting("agentic_min_corroborating_docs", next),
                { min: 1 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticMaxRedundancy", "Max redundancy") as string
            ) &&
              renderNumberInput(
                t("sidepanel:rag.agenticMaxRedundancy", "Max redundancy"),
                draftSettings.agentic_max_redundancy,
                (next) => updateSetting("agentic_max_redundancy", next),
                { min: 0 }
              )}
            {matchesAny(
              t("sidepanel:rag.agentic", "Agentic strategy") as string,
              t("sidepanel:rag.agenticMetrics", "Enable metrics") as string
            ) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draftSettings.agentic_enable_metrics}
                  onChange={(checked) =>
                    updateSetting("agentic_enable_metrics", checked)
                  }
                  aria-label={t("sidepanel:rag.agenticMetrics", "Enable metrics")}
                />
                <span className="text-xs text-text">
                  {t("sidepanel:rag.agenticMetrics", "Enable metrics")}
                </span>
              </div>
            )}
          </div>
        )
    },
    matchesAny(
      t("sidepanel:rag.monitoring", "Monitoring & analytics") as string,
      t("sidepanel:rag.enableMonitoring", "Enable monitoring") as string,
      t("sidepanel:rag.enableAnalytics", "Enable analytics") as string,
      t("sidepanel:rag.enableObservability", "Enable observability") as string,
      t("sidepanel:rag.traceId", "Trace ID") as string
    ) && {
      key: "monitoring",
      label: t("sidepanel:rag.monitoring", "Monitoring & analytics"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.monitoring", "Monitoring & analytics") as string,
            t("sidepanel:rag.enableMonitoring", "Enable monitoring") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_monitoring}
                onChange={(checked) => updateSetting("enable_monitoring", checked)}
                aria-label={t("sidepanel:rag.enableMonitoring", "Enable monitoring")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableMonitoring", "Enable monitoring")}
              </span>
            </div>
          )}
          {matchesAny(
            t("sidepanel:rag.monitoring", "Monitoring & analytics") as string,
            t("sidepanel:rag.enableAnalytics", "Enable analytics") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_analytics}
                onChange={(checked) => updateSetting("enable_analytics", checked)}
                aria-label={t("sidepanel:rag.enableAnalytics", "Enable analytics")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableAnalytics", "Enable analytics")}
              </span>
            </div>
          )}
          {matchesAny(
            t("sidepanel:rag.monitoring", "Monitoring & analytics") as string,
            t("sidepanel:rag.enableObservability", "Enable observability") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_observability}
                onChange={(checked) => updateSetting("enable_observability", checked)}
                aria-label={t("sidepanel:rag.enableObservability", "Enable observability")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableObservability", "Enable observability")}
              </span>
            </div>
          )}
          {matchesAny(
            t("sidepanel:rag.monitoring", "Monitoring & analytics") as string,
            t("sidepanel:rag.traceId", "Trace ID") as string
          ) &&
            renderTextInput(
              t("sidepanel:rag.traceId", "Trace ID"),
              draftSettings.trace_id,
              (next) => updateSetting("trace_id", next)
            )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.performance", "Performance") as string,
      t("sidepanel:rag.connectionPool", "Use connection pool") as string,
      t("sidepanel:rag.embeddingCache", "Use embedding cache") as string,
      t("sidepanel:rag.performanceAnalysis", "Performance analysis") as string,
      t("sidepanel:rag.timeout", "Timeout (s)") as string
    ) && {
      key: "performance",
      label: t("sidepanel:rag.performance", "Performance"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.performance", "Performance") as string,
            t("sidepanel:rag.connectionPool", "Use connection pool") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.use_connection_pool}
                onChange={(checked) => updateSetting("use_connection_pool", checked)}
                aria-label={t("sidepanel:rag.connectionPool", "Use connection pool")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.connectionPool", "Use connection pool")}
              </span>
            </div>
          )}
          {matchesAny(
            t("sidepanel:rag.performance", "Performance") as string,
            t("sidepanel:rag.embeddingCache", "Use embedding cache") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.use_embedding_cache}
                onChange={(checked) => updateSetting("use_embedding_cache", checked)}
                aria-label={t("sidepanel:rag.embeddingCache", "Use embedding cache")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.embeddingCache", "Use embedding cache")}
              </span>
            </div>
          )}
          {matchesAny(
            t("sidepanel:rag.performance", "Performance") as string,
            t("sidepanel:rag.performanceAnalysis", "Performance analysis") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_performance_analysis}
                onChange={(checked) =>
                  updateSetting("enable_performance_analysis", checked)
                }
                aria-label={t("sidepanel:rag.performanceAnalysis", "Performance analysis")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.performanceAnalysis", "Performance analysis")}
              </span>
            </div>
          )}
          {matchesAny(
            t("sidepanel:rag.performance", "Performance") as string,
            t("sidepanel:rag.timeout", "Timeout (s)") as string
          ) &&
            renderNumberInput(
              t("sidepanel:rag.timeout", "Timeout (s)"),
              draftSettings.timeout_seconds,
              (next) => updateSetting("timeout_seconds", next),
              { min: 1 }
            )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.resilience", "Resilience") as string,
      t("sidepanel:rag.enableResilience", "Enable resilience") as string,
      t("sidepanel:rag.retryAttempts", "Retry attempts") as string,
      t("sidepanel:rag.circuitBreaker", "Circuit breaker") as string
    ) && {
      key: "resilience",
      label: t("sidepanel:rag.resilience", "Resilience"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.resilience", "Resilience") as string,
            t("sidepanel:rag.enableResilience", "Enable resilience") as string,
            t("sidepanel:rag.retryAttempts", "Retry attempts") as string,
            t("sidepanel:rag.circuitBreaker", "Circuit breaker") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_resilience}
                onChange={(checked) => updateSetting("enable_resilience", checked)}
                aria-label={t("sidepanel:rag.enableResilience", "Enable resilience")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableResilience", "Enable resilience")}
              </span>
            </div>
          )}
          {draftSettings.enable_resilience && (
            <>
              {matchesAny(
                t("sidepanel:rag.resilience", "Resilience") as string,
                t("sidepanel:rag.retryAttempts", "Retry attempts") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.retryAttempts", "Retry attempts"),
                  draftSettings.retry_attempts,
                  (next) => updateSetting("retry_attempts", next),
                  { min: 0 }
                )}
              {matchesAny(
                t("sidepanel:rag.resilience", "Resilience") as string,
                t("sidepanel:rag.circuitBreaker", "Circuit breaker") as string
              ) && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.circuit_breaker}
                    onChange={(checked) => updateSetting("circuit_breaker", checked)}
                    aria-label={t("sidepanel:rag.circuitBreaker", "Circuit breaker")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.circuitBreaker", "Circuit breaker")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.batch", "Batch") as string,
      t("sidepanel:rag.enableBatch", "Enable batch") as string,
      t("sidepanel:rag.batchConcurrent", "Batch concurrent") as string,
      t("sidepanel:rag.batchQueries", "Batch queries") as string
    ) && {
      key: "batch",
      label: t("sidepanel:rag.batch", "Batch"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.batch", "Batch") as string,
            t("sidepanel:rag.enableBatch", "Enable batch") as string,
            t("sidepanel:rag.batchConcurrent", "Batch concurrent") as string,
            t("sidepanel:rag.batchQueries", "Batch queries") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.enable_batch}
                onChange={(checked) => updateSetting("enable_batch", checked)}
                aria-label={t("sidepanel:rag.enableBatch", "Enable batch")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.enableBatch", "Enable batch")}
              </span>
            </div>
          )}
          {draftSettings.enable_batch && (
            <>
              {matchesAny(
                t("sidepanel:rag.batch", "Batch") as string,
                t("sidepanel:rag.batchConcurrent", "Batch concurrent") as string
              ) &&
                renderNumberInput(
                  t("sidepanel:rag.batchConcurrent", "Batch concurrent"),
                  draftSettings.batch_concurrent,
                  (next) => updateSetting("batch_concurrent", next),
                  { min: 1 }
                )}
              {matchesAny(
                t("sidepanel:rag.batch", "Batch") as string,
                t("sidepanel:rag.batchQueries", "Batch queries") as string
              ) && (
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.batchQueries", "Batch queries")}
                  </span>
                  <Input.TextArea
                    value={draftSettings.batch_queries.join("\n")}
                    onChange={(e) =>
                      updateSetting(
                        "batch_queries",
                        parseBatchQueries(e.target.value),
                        {
                          transient: true
                        }
                      )
                    }
                    rows={4}
                    aria-label={t("sidepanel:rag.batchQueries", "Batch queries")}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.feedback", "Feedback") as string,
      t("sidepanel:rag.collectFeedback", "Collect feedback") as string,
      t("sidepanel:rag.feedbackUserId", "Feedback user id") as string,
      t("sidepanel:rag.feedbackBoost", "Apply feedback boost") as string
    ) && {
      key: "feedback",
      label: t("sidepanel:rag.feedback", "Feedback"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.feedback", "Feedback") as string,
            t("sidepanel:rag.collectFeedback", "Collect feedback") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.collect_feedback}
                onChange={(checked) => updateSetting("collect_feedback", checked)}
                aria-label={t("sidepanel:rag.collectFeedback", "Collect feedback")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.collectFeedback", "Collect feedback")}
              </span>
            </div>
          )}
          {matchesAny(
            t("sidepanel:rag.feedback", "Feedback") as string,
            t("sidepanel:rag.feedbackUserId", "Feedback user id") as string
          ) &&
            renderTextInput(
              t("sidepanel:rag.feedbackUserId", "Feedback user id"),
              draftSettings.feedback_user_id,
              (next) => updateSetting("feedback_user_id", next)
            )}
          {matchesAny(
            t("sidepanel:rag.feedback", "Feedback") as string,
            t("sidepanel:rag.feedbackBoost", "Apply feedback boost") as string
          ) && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draftSettings.apply_feedback_boost}
                onChange={(checked) => updateSetting("apply_feedback_boost", checked)}
                aria-label={t("sidepanel:rag.feedbackBoost", "Apply feedback boost")}
              />
              <span className="text-xs text-text">
                {t("sidepanel:rag.feedbackBoost", "Apply feedback boost")}
              </span>
            </div>
          )}
        </div>
      )
    },
    matchesAny(
      t("sidepanel:rag.userContext", "User context") as string,
      t("sidepanel:rag.userId", "User ID") as string,
      t("sidepanel:rag.sessionId", "Session ID") as string
    ) && {
      key: "user-context",
      label: t("sidepanel:rag.userContext", "User context"),
      children: (
        <div className="grid gap-3 md:grid-cols-2">
          {matchesAny(
            t("sidepanel:rag.userContext", "User context") as string,
            t("sidepanel:rag.userId", "User ID") as string
          ) &&
            renderTextInput(
              t("sidepanel:rag.userId", "User ID"),
              draftSettings.user_id || "",
              (next) => updateSetting("user_id", next || null)
            )}
          {matchesAny(
            t("sidepanel:rag.userContext", "User context") as string,
            t("sidepanel:rag.sessionId", "Session ID") as string
          ) &&
            renderTextInput(
              t("sidepanel:rag.sessionId", "Session ID"),
              draftSettings.session_id || "",
              (next) => updateSetting("session_id", next || null)
            )}
        </div>
      )
    }
  ].filter(Boolean) as any[]

  return (
    <div className={wrapperClassName}>
      {showToggle && (
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="rag-search-panel"
            className="text-caption text-text-muted underline"
            onClick={() => setOpenState(!isOpen)}
            title={
              isOpen
                ? t("sidepanel:rag.hide", "Hide Search & Context")
                : t("sidepanel:rag.show", "Show Search & Context")
            }
          >
            {isOpen
              ? t("sidepanel:rag.hide", "Hide Search & Context")
              : t("sidepanel:rag.show", "Show Search & Context")}
          </button>
        </div>
      )}
      {isOpen && (
        <div id="rag-search-panel" data-testid="rag-search-panel" className={panelClassName}>
          {!isConnected && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-surface2">
              <span className="text-sm text-text-muted">
                {t(
                  "sidepanel:rag.disconnected",
                  "Connect to server to search knowledge base"
                )}
              </span>
            </div>
          )}
          {!ragHintSeen && !hasAttemptedSearch && (
            <div className="mb-2 flex items-start gap-2 rounded border-l-2 border-primary bg-surface2 p-2">
              <div className="flex-1">
                <p className="text-xs text-text">
                  {t(
                    "sidepanel:rag.hint.message",
                    "Search your knowledge base and insert results into your message."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRagHintSeen(true)}
                className="rounded p-1 text-text-subtle hover:bg-surface"
                aria-label={t("sidepanel:rag.hint.dismiss", "Dismiss")}
                title={t("sidepanel:rag.hint.dismiss", "Dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-text">
              {t("sidepanel:rag.title", "Search & Context")}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-text-muted">
                {t("sidepanel:rag.preset", "Preset")}
              </span>
              <Select
                size="small"
                value={preset}
                onChange={(value) => applyPresetSelection(value as RagPresetName)}
                options={[
                  { label: "Fast", value: "fast" },
                  { label: "Balanced", value: "balanced" },
                  { label: "Thorough", value: "thorough" },
                  { label: "Custom", value: "custom" }
                ]}
                aria-label={t("sidepanel:rag.preset", "Preset")}
                className="min-w-28"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-text-muted">
                {t("sidepanel:rag.strategy", "Strategy")}
              </span>
              <Select
                size="small"
                value={draftSettings.strategy}
                onChange={(value) =>
                  updateSetting("strategy", value as RagSettings["strategy"])
                }
                options={STRATEGY_OPTIONS}
                aria-label={t("sidepanel:rag.strategy", "Strategy")}
                className="min-w-28"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-muted">
                {t("sidepanel:rag.explainOnly", "Explain only")}
              </span>
              <Switch
                size="small"
                checked={draftSettings.explain_only}
                onChange={(checked) => updateSetting("explain_only", checked)}
                aria-label={t("sidepanel:rag.explainOnly", "Explain only")}
              />
            </div>
            <Button size="small" type="link" onClick={resetToBalanced}>
              {t("sidepanel:rag.reset", "Reset to Balanced")}
            </Button>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <Checkbox
              checked={useCurrentMessage}
              onChange={(e) => setUseCurrentMessage(e.target.checked)}
            >
              {t("sidepanel:rag.useCurrentMessage", "Use current message")}
            </Checkbox>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <Input
              ref={searchInputRef}
              placeholder={t("sidepanel:rag.searchPlaceholder", "Search query")}
              value={draftSettings.query}
              aria-label={t("sidepanel:rag.searchPlaceholder", "Search query")}
              onChange={(e) =>
                updateSetting("query", e.target.value, { transient: true })
              }
              onPressEnter={() => runSearch()}
            />
            <Button onClick={() => runSearch()} type="default">
              {t("sidepanel:rag.search", "Search")}
            </Button>
          </div>
          {queryError && (
            <div className="text-xs text-danger mb-2">{queryError}</div>
          )}

          <div className="space-y-3">
            {matchesAny(
              t("sidepanel:rag.sourcesFilters", "Sources & Filters") as string,
              t("sidepanel:rag.sources", "Sources") as string,
              t("sidepanel:rag.keywordFilter", "Keyword filter") as string,
              t("sidepanel:rag.includeMediaIds", "Include media IDs") as string,
              t("sidepanel:rag.includeNoteIds", "Include note IDs") as string
            ) && (
              <div className="rounded border border-border bg-surface p-3">
                <div className="text-xs font-semibold text-text mb-2">
                  {t("sidepanel:rag.sourcesFilters", "Sources & Filters")}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {matchesAny(
                    t("sidepanel:rag.sourcesFilters", "Sources & Filters") as string,
                    t("sidepanel:rag.sources", "Sources") as string
                  ) &&
                    renderMultiSelect(
                      t("sidepanel:rag.sources", "Sources"),
                      draftSettings.sources,
                      (next) =>
                        updateSetting("sources", next as RagSettings["sources"]),
                      SOURCE_OPTIONS
                    )}
                  {matchesAny(
                    t("sidepanel:rag.sourcesFilters", "Sources & Filters") as string,
                    t("sidepanel:rag.keywordFilter", "Keyword filter") as string
                  ) &&
                    renderTextInput(
                      t("sidepanel:rag.keywordFilter", "Keyword filter"),
                      draftSettings.keyword_filter,
                      (next) => updateSetting("keyword_filter", next),
                      {
                        placeholder: t(
                          "sidepanel:rag.keywordFilterPlaceholder",
                          "Comma-separated keywords"
                        ) as string
                      }
                    )}
                  {matchesAny(
                    t("sidepanel:rag.sourcesFilters", "Sources & Filters") as string,
                    t("sidepanel:rag.includeMediaIds", "Include media IDs") as string
                  ) &&
                    renderTextInput(
                      t("sidepanel:rag.includeMediaIds", "Include media IDs"),
                      stringifyIdList(draftSettings.include_media_ids),
                      (next) =>
                        updateSetting("include_media_ids", parseIdList(next)),
                      {
                        placeholder: "1, 2, 3"
                      }
                    )}
                  {matchesAny(
                    t("sidepanel:rag.sourcesFilters", "Sources & Filters") as string,
                    t("sidepanel:rag.includeNoteIds", "Include note IDs") as string
                  ) &&
                    renderTextInput(
                      t("sidepanel:rag.includeNoteIds", "Include note IDs"),
                      stringifyIdList(draftSettings.include_note_ids),
                      (next) =>
                        updateSetting("include_note_ids", parseIdList(next)),
                      {
                        placeholder: "10, 11, 12"
                      }
                    )}
                </div>
              </div>
            )}

            {matchesAny(
              t("sidepanel:rag.retrieval", "Retrieval") as string,
              t("sidepanel:rag.searchMode", "Retrieval mode") as string,
              t("sidepanel:rag.ftsLevel", "FTS level") as string,
              t("sidepanel:rag.hybridAlpha", "Hybrid alpha") as string,
              t("sidepanel:rag.intentRouting", "Intent routing") as string,
              t("sidepanel:rag.topK", "Results (top_k)") as string,
              t("sidepanel:rag.minScore", "Minimum relevance") as string
            ) && (
              <div className="rounded border border-border bg-surface p-3">
                <div className="text-xs font-semibold text-text mb-2">
                  {t("sidepanel:rag.retrieval", "Retrieval")}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {matchesAny(
                    t("sidepanel:rag.retrieval", "Retrieval") as string,
                    t("sidepanel:rag.searchMode", "Retrieval mode") as string
                  ) &&
                    renderSelect(
                      t("sidepanel:rag.searchMode", "Retrieval mode"),
                      draftSettings.search_mode,
                      (next) =>
                        updateSetting(
                          "search_mode",
                          next as RagSettings["search_mode"]
                        ),
                      SEARCH_MODE_OPTIONS
                    )}
                  {draftSettings.search_mode !== "vector" &&
                    matchesAny(
                      t("sidepanel:rag.retrieval", "Retrieval") as string,
                      t("sidepanel:rag.ftsLevel", "FTS level") as string
                    ) &&
                    renderSelect(
                      t("sidepanel:rag.ftsLevel", "FTS level"),
                      draftSettings.fts_level,
                      (next) =>
                        updateSetting(
                          "fts_level",
                          next as RagSettings["fts_level"]
                        ),
                      FTS_LEVEL_OPTIONS
                    )}
                  {draftSettings.search_mode === "hybrid" &&
                    matchesAny(
                      t("sidepanel:rag.retrieval", "Retrieval") as string,
                      t("sidepanel:rag.hybridAlpha", "Hybrid alpha") as string
                    ) &&
                    renderNumberInput(
                      t("sidepanel:rag.hybridAlpha", "Hybrid alpha"),
                      draftSettings.hybrid_alpha,
                      (next) => updateSetting("hybrid_alpha", next),
                      { min: 0, max: 1, step: 0.05 }
                    )}
                  {matchesAny(
                    t("sidepanel:rag.retrieval", "Retrieval") as string,
                    t("sidepanel:rag.intentRouting", "Intent routing") as string
                  ) && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draftSettings.enable_intent_routing}
                        onChange={(checked) =>
                          updateSetting("enable_intent_routing", checked)
                        }
                        aria-label={t("sidepanel:rag.intentRouting", "Intent routing")}
                      />
                      <span className="text-xs text-text">
                        {t("sidepanel:rag.intentRouting", "Intent routing")}
                      </span>
                    </div>
                  )}
                  {matchesAny(
                    t("sidepanel:rag.retrieval", "Retrieval") as string,
                    t("sidepanel:rag.topK", "Results (top_k)") as string
                  ) &&
                    renderNumberInput(
                      t("sidepanel:rag.topK", "Results (top_k)"),
                      draftSettings.top_k,
                      (next) => updateSetting("top_k", next),
                      { min: 1 }
                    )}
                  {matchesAny(
                    t("sidepanel:rag.retrieval", "Retrieval") as string,
                    t("sidepanel:rag.minScore", "Minimum relevance") as string
                  ) &&
                    renderNumberInput(
                      t("sidepanel:rag.minScore", "Minimum relevance"),
                      draftSettings.min_score,
                      (next) => updateSetting("min_score", next),
                      { min: 0, max: 1, step: 0.05 }
                    )}
                </div>
              </div>
            )}

            <div className="rounded border border-border bg-surface p-3">
              <div className="text-xs font-semibold text-text mb-2">
                {t("sidepanel:rag.reranking", "Reranking")}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.enable_reranking}
                    onChange={(checked) => updateSetting("enable_reranking", checked)}
                    aria-label={t("sidepanel:rag.enableReranking", "Enable reranking")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.enableReranking", "Enable reranking")}
                  </span>
                </div>
                {draftSettings.enable_reranking && (
                  <>
                    {renderSelect(
                      t("sidepanel:rag.rerankStrategy", "Strategy"),
                      draftSettings.reranking_strategy,
                      (next) =>
                        updateSetting(
                          "reranking_strategy",
                          next as RagSettings["reranking_strategy"]
                        ),
                      RERANK_STRATEGY_OPTIONS
                    )}
                    {renderNumberInput(
                      t("sidepanel:rag.rerankTopK", "Rerank top_k"),
                      draftSettings.rerank_top_k,
                      (next) => updateSetting("rerank_top_k", next),
                      { min: 1 }
                    )}
                    {renderTextInput(
                      t("sidepanel:rag.rerankingModel", "Reranking model"),
                      draftSettings.reranking_model,
                      (next) => updateSetting("reranking_model", next)
                    )}
                    {renderNumberInput(
                      t("sidepanel:rag.rerankMinProb", "Min relevance prob"),
                      draftSettings.rerank_min_relevance_prob,
                      (next) => updateSetting("rerank_min_relevance_prob", next),
                      { min: 0, max: 1, step: 0.05 }
                    )}
                    {renderNumberInput(
                      t("sidepanel:rag.rerankSentinel", "Sentinel margin"),
                      draftSettings.rerank_sentinel_margin,
                      (next) => updateSetting("rerank_sentinel_margin", next),
                      { min: 0, max: 1, step: 0.05 }
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="rounded border border-border bg-surface p-3">
              <div className="text-xs font-semibold text-text mb-2">
                {t("sidepanel:rag.answerCitations", "Answer & Citations")}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.enable_generation}
                    onChange={(checked) => updateSetting("enable_generation", checked)}
                    aria-label={t("sidepanel:rag.enableGeneration", "Enable generation")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.enableGeneration", "Enable generation")}
                  </span>
                </div>
                {draftSettings.enable_generation && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draftSettings.strict_extractive}
                        onChange={(checked) =>
                          updateSetting("strict_extractive", checked)
                        }
                        aria-label={t("sidepanel:rag.strictExtractive", "Strict extractive")}
                      />
                      <span className="text-xs text-text">
                        {t("sidepanel:rag.strictExtractive", "Strict extractive")}
                      </span>
                    </div>
                    {renderTextInput(
                      t("sidepanel:rag.generationModel", "Generation model"),
                      draftSettings.generation_model || "",
                      (next) => updateSetting("generation_model", next || null)
                    )}
                    {renderTextInput(
                      t("sidepanel:rag.generationPrompt", "Generation prompt"),
                      draftSettings.generation_prompt || "",
                      (next) => updateSetting("generation_prompt", next || null)
                    )}
                    {renderNumberInput(
                      t("sidepanel:rag.maxTokens", "Max tokens"),
                      draftSettings.max_generation_tokens,
                      (next) => updateSetting("max_generation_tokens", next),
                      { min: 1 }
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draftSettings.enable_abstention}
                        onChange={(checked) => updateSetting("enable_abstention", checked)}
                        aria-label={t("sidepanel:rag.enableAbstention", "Enable abstention")}
                      />
                      <span className="text-xs text-text">
                        {t("sidepanel:rag.enableAbstention", "Enable abstention")}
                      </span>
                    </div>
                    {draftSettings.enable_abstention &&
                      renderSelect(
                        t("sidepanel:rag.abstentionBehavior", "Abstention behavior"),
                        draftSettings.abstention_behavior,
                        (next) =>
                          updateSetting(
                            "abstention_behavior",
                            next as RagSettings["abstention_behavior"]
                          ),
                        ABSTENTION_OPTIONS
                      )}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draftSettings.enable_multi_turn_synthesis}
                        onChange={(checked) =>
                          updateSetting("enable_multi_turn_synthesis", checked)
                        }
                        aria-label={t("sidepanel:rag.enableSynthesis", "Multi-turn synthesis")}
                      />
                      <span className="text-xs text-text">
                        {t("sidepanel:rag.enableSynthesis", "Multi-turn synthesis")}
                      </span>
                    </div>
                    {draftSettings.enable_multi_turn_synthesis && (
                      <>
                        {renderNumberInput(
                          t("sidepanel:rag.synthesisBudget", "Synthesis time budget"),
                          draftSettings.synthesis_time_budget_sec,
                          (next) => updateSetting("synthesis_time_budget_sec", next),
                          { min: 1 }
                        )}
                        {renderNumberInput(
                          t("sidepanel:rag.synthesisDraft", "Draft tokens"),
                          draftSettings.synthesis_draft_tokens,
                          (next) => updateSetting("synthesis_draft_tokens", next),
                          { min: 1 }
                        )}
                        {renderNumberInput(
                          t("sidepanel:rag.synthesisRefine", "Refine tokens"),
                          draftSettings.synthesis_refine_tokens,
                          (next) => updateSetting("synthesis_refine_tokens", next),
                          { min: 1 }
                        )}
                      </>
                    )}
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.enable_citations}
                    onChange={(checked) => updateSetting("enable_citations", checked)}
                    aria-label={t("sidepanel:rag.enableCitations", "Enable citations")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.enableCitations", "Enable citations")}
                  </span>
                </div>
                {draftSettings.enable_citations && (
                  <>
                    {renderSelect(
                      t("sidepanel:rag.citationStyle", "Citation style"),
                      draftSettings.citation_style,
                      (next) =>
                        updateSetting(
                          "citation_style",
                          next as RagSettings["citation_style"]
                        ),
                      CITATION_STYLE_OPTIONS
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draftSettings.include_page_numbers}
                        onChange={(checked) => updateSetting("include_page_numbers", checked)}
                        aria-label={t("sidepanel:rag.includePageNumbers", "Include page numbers")}
                      />
                      <span className="text-xs text-text">
                        {t("sidepanel:rag.includePageNumbers", "Include page numbers")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draftSettings.enable_chunk_citations}
                        onChange={(checked) => updateSetting("enable_chunk_citations", checked)}
                        aria-label={t("sidepanel:rag.chunkCitations", "Chunk citations")}
                      />
                      <span className="text-xs text-text">
                        {t("sidepanel:rag.chunkCitations", "Chunk citations")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draftSettings.require_hard_citations}
                        onChange={(checked) => updateSetting("require_hard_citations", checked)}
                        aria-label={t("sidepanel:rag.requireHardCitations", "Require hard citations")}
                      />
                      <span className="text-xs text-text">
                        {t("sidepanel:rag.requireHardCitations", "Require hard citations")}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded border border-border bg-surface p-3">
              <div className="text-xs font-semibold text-text mb-2">
                {t("sidepanel:rag.safetyIntegrity", "Safety & Integrity")}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.enable_security_filter}
                    onChange={(checked) => updateSetting("enable_security_filter", checked)}
                    aria-label={t("sidepanel:rag.securityFilter", "Security filter")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.securityFilter", "Security filter")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.content_filter}
                    onChange={(checked) => updateSetting("content_filter", checked)}
                    aria-label={t("sidepanel:rag.contentFilter", "Content filter")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.contentFilter", "Content filter")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.detect_pii}
                    onChange={(checked) => updateSetting("detect_pii", checked)}
                    aria-label={t("sidepanel:rag.detectPii", "PII detect")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.detectPii", "PII detect")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.redact_pii}
                    onChange={(checked) => updateSetting("redact_pii", checked)}
                    aria-label={t("sidepanel:rag.redactPii", "PII redact")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.redactPii", "PII redact")}
                  </span>
                </div>
                {renderSelect(
                  t("sidepanel:rag.sensitivity", "Sensitivity"),
                  draftSettings.sensitivity_level,
                  (next) =>
                    updateSetting(
                      "sensitivity_level",
                      next as RagSettings["sensitivity_level"]
                    ),
                  SENSITIVITY_OPTIONS
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.enable_injection_filter}
                    onChange={(checked) => updateSetting("enable_injection_filter", checked)}
                    aria-label={t("sidepanel:rag.injectionFilter", "Injection filter")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.injectionFilter", "Injection filter")}
                  </span>
                </div>
                {draftSettings.enable_injection_filter &&
                  renderNumberInput(
                    t("sidepanel:rag.injectionStrength", "Injection strength"),
                    draftSettings.injection_filter_strength,
                    (next) => updateSetting("injection_filter_strength", next),
                    { min: 0, max: 1, step: 0.05 }
                  )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.enable_numeric_fidelity}
                    onChange={(checked) => updateSetting("enable_numeric_fidelity", checked)}
                    aria-label={t("sidepanel:rag.numericFidelity", "Numeric fidelity")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.numericFidelity", "Numeric fidelity")}
                  </span>
                </div>
                {draftSettings.enable_numeric_fidelity &&
                  renderSelect(
                    t("sidepanel:rag.numericFidelityBehavior", "Numeric fidelity behavior"),
                    draftSettings.numeric_fidelity_behavior,
                    (next) =>
                      updateSetting(
                        "numeric_fidelity_behavior",
                        next as RagSettings["numeric_fidelity_behavior"]
                      ),
                    NUMERIC_FIDELITY_OPTIONS
                  )}
              </div>
            </div>

            <div className="rounded border border-border bg-surface p-3">
              <div className="text-xs font-semibold text-text mb-2">
                {t("sidepanel:rag.contextConstruction", "Context Construction")}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {renderMultiSelect(
                  t("sidepanel:rag.chunkTypeFilter", "Chunk types"),
                  draftSettings.chunk_type_filter,
                  (next) =>
                    updateSetting("chunk_type_filter", next as RagSettings["chunk_type_filter"]),
                  CHUNK_TYPE_OPTIONS
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.enable_parent_expansion}
                    onChange={(checked) => updateSetting("enable_parent_expansion", checked)}
                    aria-label={t("sidepanel:rag.parentExpansion", "Parent expansion")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.parentExpansion", "Parent expansion")}
                  </span>
                </div>
                {draftSettings.enable_parent_expansion && (
                  <>
                    {renderNumberInput(
                      t("sidepanel:rag.parentContextSize", "Parent context size"),
                      draftSettings.parent_context_size,
                      (next) => updateSetting("parent_context_size", next),
                      { min: 1 }
                    )}
                    {renderNumberInput(
                      t("sidepanel:rag.parentMaxTokens", "Parent max tokens"),
                      draftSettings.parent_max_tokens,
                      (next) => updateSetting("parent_max_tokens", next),
                      { min: 1 }
                    )}
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.include_sibling_chunks}
                    onChange={(checked) => updateSetting("include_sibling_chunks", checked)}
                    aria-label={t("sidepanel:rag.includeSiblings", "Include siblings")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.includeSiblings", "Include siblings")}
                  </span>
                </div>
                {draftSettings.include_sibling_chunks &&
                  renderNumberInput(
                    t("sidepanel:rag.siblingWindow", "Sibling window"),
                    draftSettings.sibling_window,
                    (next) => updateSetting("sibling_window", next),
                    { min: 0 }
                  )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.include_parent_document}
                    onChange={(checked) => updateSetting("include_parent_document", checked)}
                    aria-label={t("sidepanel:rag.includeParentDoc", "Include parent document")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.includeParentDoc", "Include parent document")}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded border border-border bg-surface p-3">
              <div className="text-xs font-semibold text-text mb-2">
                {t("sidepanel:rag.quickWins", "Quick Wins")}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.highlight_results}
                    onChange={(checked) => updateSetting("highlight_results", checked)}
                    aria-label={t("sidepanel:rag.highlightResults", "Highlight results")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.highlightResults", "Highlight results")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.highlight_query_terms}
                    onChange={(checked) => updateSetting("highlight_query_terms", checked)}
                    aria-label={t("sidepanel:rag.highlightQuery", "Highlight query terms")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.highlightQuery", "Highlight query terms")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.track_cost}
                    onChange={(checked) => updateSetting("track_cost", checked)}
                    aria-label={t("sidepanel:rag.trackCost", "Track cost")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.trackCost", "Track cost")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draftSettings.debug_mode}
                    onChange={(checked) => updateSetting("debug_mode", checked)}
                    aria-label={t("sidepanel:rag.debugMode", "Debug mode")}
                  />
                  <span className="text-xs text-text">
                    {t("sidepanel:rag.debugMode", "Debug mode")}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded border border-border bg-surface p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text">
                  {t("sidepanel:rag.advanced", "Advanced")}
                </span>
                <Button
                  size="small"
                  type="link"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                >
                  {advancedOpen
                    ? t("sidepanel:rag.hideAdvanced", "Hide")
                    : t("sidepanel:rag.showAdvanced", "Show")}
                </Button>
              </div>
              {advancedOpen && (
                <div className="space-y-3">
                  <Input
                    placeholder={t(
                      "sidepanel:rag.searchSettings",
                      "Search settings"
                    )}
                    value={advancedSearch}
                    aria-label={t("sidepanel:rag.searchSettings", "Search settings")}
                    onChange={(e) => setAdvancedSearch(e.target.value)}
                  />
                  {advancedItems.length === 0 ? (
                    <div className="text-xs text-text-muted">
                      {t("sidepanel:rag.advancedNoMatches", "No matching advanced settings.")}
                    </div>
                  ) : (
                    <Collapse size="small" items={advancedItems} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="py-4 text-center">
                <Spin size="small" />
              </div>
            ) : timedOut ? (
              <div className="text-xs text-text-muted">
                {t("sidepanel:rag.timeout.message", "Request timed out.")}
                <div className="mt-1 flex items-center gap-2">
                  <Button size="small" type="primary" onClick={() => runSearch()}>
                    {t("sidepanel:rag.timeout.retry", "Retry")}
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      updateSetting("timeout_seconds", draftSettings.timeout_seconds + 5)
                    }
                  >
                    {t("sidepanel:rag.timeout.increase", "Increase timeout")}
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      try {
                        const url = browser.runtime.getURL(
                          "/options.html#/settings/health"
                        )
                        browser.tabs.create({ url })
                      } catch {
                        window.open("#/settings/health", "_blank")
                      }
                    }}
                  >
                    {t("sidepanel:rag.timeout.checkHealth", "Check server health")}
                  </Button>
                </div>
              </div>
            ) : results.length === 0 && batchResults.length === 0 ? (
              <div className="text-xs text-text-subtle">
                {t("sidepanel:rag.noResults", "No results yet. Enter a query to search.")}
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">
                    {t("sidepanel:rag.results", "Results")}
                  </span>
                  <Select
                    size="small"
                    value={sortMode}
                    onChange={(value) => setSortMode(value as typeof sortMode)}
                    options={[
                      { label: "Relevance", value: "relevance" },
                      { label: "Date", value: "date" },
                      { label: "Type", value: "type" }
                    ]}
                    aria-label={t("sidepanel:rag.sort", "Sort results")}
                  />
                </div>
                {batchResults.length > 0 ? (
                  <div className="space-y-4">
                    {batchResults.map((group) => (
                      <div key={group.query}>
                        <div className="mb-2 text-xs font-semibold text-text">
                          {group.query}
                        </div>
                        <List
                          size="small"
                          dataSource={group.results}
                          renderItem={(item) => {
                            const snippet = getResultText(item).slice(0, 240)
                            const title = getResultTitle(item)
                            const scoreLabel = formatScore(getResultScore(item))
                            const typeLabel = getResultType(item)
                            const dateLabel = formatDate(getResultDate(item))
                            const metaText = [typeLabel, dateLabel].filter(Boolean).join(" • ")
                            return (
                              <List.Item
                                className={
                                  draftSettings.highlight_results ? "bg-surface2/40" : undefined
                                }
                                actions={[
                                  <button
                                    key="insert"
                                    type="button"
                                    onClick={() => handleInsert(item)}
                                    className="text-primary hover:text-primaryStrong"
                                  >
                                    {t("sidepanel:rag.actions.insert", "Insert")}
                                  </button>,
                                  <button
                                    key="ask"
                                    type="button"
                                    onClick={() => handleAsk(item)}
                                    className="text-primary hover:text-primaryStrong"
                                  >
                                    {t("sidepanel:rag.actions.ask", "Ask")}
                                  </button>,
                                  <button
                                    key="preview"
                                    type="button"
                                    onClick={() => setPreviewItem(toPinnedResult(item))}
                                    className="text-primary hover:text-primaryStrong"
                                  >
                                    {t("sidepanel:rag.actions.preview", "Preview")}
                                  </button>,
                                  <button
                                    key="open"
                                    type="button"
                                    onClick={() => handleOpen(item)}
                                    className="text-primary hover:text-primaryStrong"
                                  >
                                    {t("sidepanel:rag.actions.open", "Open")}
                                  </button>,
                                  <Dropdown key="copy" menu={copyMenu(item)}>
                                    <button
                                      type="button"
                                      className="text-primary hover:text-primaryStrong"
                                    >
                                      {t("sidepanel:rag.actions.copy", "Copy")}
                                    </button>
                                  </Dropdown>,
                                  <button
                                    key="pin"
                                    type="button"
                                    onClick={() => handlePin(item)}
                                    className="text-primary hover:text-primaryStrong"
                                  >
                                    {t("sidepanel:rag.actions.pin", "Pin")}
                                  </button>
                                ]}
                              >
                                <List.Item.Meta
                                  title={
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-text">
                                        {title || t("sidepanel:rag.untitled", "Untitled")}
                                      </span>
                                      {scoreLabel && (
                                        <span className="text-[10px] text-text-muted">
                                          {scoreLabel}
                                        </span>
                                      )}
                                    </div>
                                  }
                                  description={
                                    <div className="space-y-1">
                                      {metaText && (
                                        <div className="text-[10px] text-text-muted">
                                          {metaText}
                                        </div>
                                      )}
                                      <div className="text-xs text-text-muted line-clamp-3">
                                        {draftSettings.highlight_query_terms
                                          ? highlightText(snippet, resolvedQuery)
                                          : snippet}
                                      </div>
                                    </div>
                                  }
                                />
                              </List.Item>
                            )
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <List
                    size="small"
                    dataSource={results}
                    renderItem={(item) => {
                      const snippet = getResultText(item).slice(0, 240)
                      const title = getResultTitle(item)
                      const scoreLabel = formatScore(getResultScore(item))
                      const typeLabel = getResultType(item)
                      const dateLabel = formatDate(getResultDate(item))
                      const metaText = [typeLabel, dateLabel].filter(Boolean).join(" • ")
                      return (
                        <List.Item
                          className={
                            draftSettings.highlight_results ? "bg-surface2/40" : undefined
                          }
                          actions={[
                            <button
                              key="insert"
                              type="button"
                              onClick={() => handleInsert(item)}
                              className="text-primary hover:text-primaryStrong"
                            >
                              {t("sidepanel:rag.actions.insert", "Insert")}
                            </button>,
                            <button
                              key="ask"
                              type="button"
                              onClick={() => handleAsk(item)}
                              className="text-primary hover:text-primaryStrong"
                            >
                              {t("sidepanel:rag.actions.ask", "Ask")}
                            </button>,
                            <button
                              key="preview"
                              type="button"
                              onClick={() => setPreviewItem(toPinnedResult(item))}
                              className="text-primary hover:text-primaryStrong"
                            >
                              {t("sidepanel:rag.actions.preview", "Preview")}
                            </button>,
                            <button
                              key="open"
                              type="button"
                              onClick={() => handleOpen(item)}
                              className="text-primary hover:text-primaryStrong"
                            >
                              {t("sidepanel:rag.actions.open", "Open")}
                            </button>,
                            <Dropdown key="copy" menu={copyMenu(item)}>
                              <button
                                type="button"
                                className="text-primary hover:text-primaryStrong"
                              >
                                {t("sidepanel:rag.actions.copy", "Copy")}
                              </button>
                            </Dropdown>,
                            <button
                              key="pin"
                              type="button"
                              onClick={() => handlePin(item)}
                              className="text-primary hover:text-primaryStrong"
                            >
                              {t("sidepanel:rag.actions.pin", "Pin")}
                            </button>
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text">
                                  {title || t("sidepanel:rag.untitled", "Untitled")}
                                </span>
                                {scoreLabel && (
                                  <span className="text-[10px] text-text-muted">
                                    {scoreLabel}
                                  </span>
                                )}
                              </div>
                            }
                            description={
                              <div className="space-y-1">
                                {metaText && (
                                  <div className="text-[10px] text-text-muted">
                                    {metaText}
                                  </div>
                                )}
                                <div className="text-xs text-text-muted line-clamp-3">
                                  {draftSettings.highlight_query_terms
                                    ? highlightText(snippet, resolvedQuery)
                                    : snippet}
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )
                    }}
                  />
                )}
              </>
            )}
          </div>

          {showAttachedContext ? (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-text">
                {t("sidepanel:rag.attachedContext", "Attached context")}
              </div>
              <div className="space-y-3">
                <div className="rounded border border-border bg-surface p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">
                      {t(
                        "playground:composer.contextTabsTitle",
                        "Tabs in context"
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {onRefreshTabs && (
                        <Button size="small" type="link" onClick={onRefreshTabs}>
                          {t("common:refresh", "Refresh")}
                        </Button>
                      )}
                      {onClearTabs && attachedTabs.length > 0 && (
                        <Button size="small" type="link" onClick={onClearTabs}>
                          {t("playground:composer.clearTabs", "Remove all")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {attachedTabs.length === 0 ? (
                    <div className="text-xs text-text-muted">
                      {t(
                        "playground:composer.contextTabsEmpty",
                        "No tabs selected yet."
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachedTabs.map((tab) => (
                        <div
                          key={tab.id}
                          className="flex items-center justify-between gap-2 rounded border border-border bg-surface2 px-2 py-1"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs text-text">
                              {tab.title || tab.url}
                            </div>
                            <div className="truncate text-[10px] text-text-muted">
                              {tab.url}
                            </div>
                          </div>
                          {onRemoveTab && (
                            <Button
                              size="small"
                              type="link"
                              onClick={() => onRemoveTab(tab.id)}
                            >
                              {t("common:remove", "Remove")}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {onAddTab && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-text">
                        {t(
                          "playground:composer.contextTabsAvailable",
                          "Open tabs"
                        )}
                      </div>
                      <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                        {availableTabs.length > 0 ? (
                          availableTabs.map((tab) => (
                            <div
                              key={tab.id}
                              className="flex items-center justify-between gap-2 rounded border border-border bg-surface2 px-2 py-1"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs text-text">
                                  {tab.title || tab.url}
                                </div>
                                <div className="truncate text-[10px] text-text-muted">
                                  {tab.url}
                                </div>
                              </div>
                              <Button
                                size="small"
                                type="link"
                                onClick={() => onAddTab(tab)}
                              >
                                {t("common:add", "Add")}
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-text-muted">
                            {t(
                              "playground:composer.noTabsFound",
                              "No eligible open tabs found."
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded border border-border bg-surface p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">
                      {t(
                        "playground:composer.contextFilesTitle",
                        "Files in context"
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {onAddFile && (
                        <Button size="small" type="link" onClick={onAddFile}>
                          {t("playground:composer.addFile", "Add file")}
                        </Button>
                      )}
                      {onClearFiles && attachedFiles.length > 0 && (
                        <Button size="small" type="link" onClick={onClearFiles}>
                          {t("playground:composer.clearFiles", "Remove all")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {attachedFiles.length === 0 ? (
                    <div className="text-xs text-text-muted">
                      {t(
                        "playground:composer.contextFilesEmpty",
                        "No files attached yet."
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-2 rounded border border-border bg-surface2 px-2 py-1"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs text-text">
                              {file.filename}
                            </div>
                            <div className="text-[10px] text-text-muted">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                          {onRemoveFile && (
                            <Button
                              size="small"
                              type="link"
                              onClick={() => onRemoveFile(file.id)}
                            >
                              {t("common:remove", "Remove")}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded border border-border bg-surface p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">
                      {t("sidepanel:rag.pinned", "Pinned results")}
                    </span>
                    {(ragPinnedResults || []).length > 0 && (
                      <Button size="small" type="link" onClick={handleClearPins}>
                        {t("sidepanel:rag.clearPins", "Clear all")}
                      </Button>
                    )}
                  </div>
                  {(ragPinnedResults || []).length === 0 ? (
                    <div className="text-xs text-text-muted">
                      {t("sidepanel:rag.pinsEmpty", "No pinned results yet.")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(ragPinnedResults || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded border border-border bg-surface2 px-2 py-1"
                        >
                          <div className="min-w-0 truncate text-xs text-text">
                            {item.title || item.source || item.url || "Untitled"}
                          </div>
                          <Button
                            size="small"
                            type="link"
                            onClick={() => handleUnpin(item.id)}
                          >
                            {t("sidepanel:rag.remove", "Remove")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-text">
                {t("sidepanel:rag.pinned", "Pinned results")}
              </div>
              {(ragPinnedResults || []).length === 0 ? (
                <div className="text-xs text-text-muted">
                  {t("sidepanel:rag.pinsEmpty", "No pinned results yet.")}
                </div>
              ) : (
                <div className="space-y-2">
                  {(ragPinnedResults || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded border border-border bg-surface p-2"
                    >
                      <div className="text-xs text-text">
                        {item.title || item.source || item.url || "Untitled"}
                      </div>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => handleUnpin(item.id)}
                      >
                        {t("sidepanel:rag.remove", "Remove")}
                      </Button>
                    </div>
                  ))}
                  <Button size="small" onClick={handleClearPins}>
                    {t("sidepanel:rag.clearPins", "Clear all")}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="primary"
              onClick={() => {
                applySettings()
                setOpenState(false)
              }}
            >
              {t("sidepanel:rag.apply", "Apply")}
            </Button>
            <Button type="default" onClick={() => runSearch({ applyFirst: true })}>
              {t("sidepanel:rag.applySearch", "Apply & Search")}
            </Button>
            <Button
              type="text"
              onClick={() => {
                setDraftSettings(normalizeSettings(storedSettings))
                setOpenState(false)
              }}
            >
              {t("common:cancel", "Cancel")}
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!previewItem}
        onCancel={() => setPreviewItem(null)}
        footer={null}
        title={previewItem?.title || t("sidepanel:rag.preview", "Preview")}
      >
        {previewItem && (
          <div className="space-y-3">
            <div className="text-xs text-text-muted">
              {previewItem.source || previewItem.url}
            </div>
            <div className="text-sm text-text whitespace-pre-wrap">
              {previewItem.snippet}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="small"
                onClick={() => onInsert(formatRagResult(previewItem, "markdown"))}
              >
                {t("sidepanel:rag.actions.insert", "Insert")}
              </Button>
              <Button
                size="small"
                onClick={() => handleAsk({ content: previewItem.snippet, metadata: { url: previewItem.url, source: previewItem.source, title: previewItem.title } })}
              >
                {t("sidepanel:rag.actions.ask", "Ask")}
              </Button>
              <Dropdown menu={copyMenu({ content: previewItem.snippet, metadata: { url: previewItem.url, source: previewItem.source, title: previewItem.title } })}>
                <Button size="small">
                  {t("sidepanel:rag.actions.copy", "Copy")}
                </Button>
              </Dropdown>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default RagSearchBar
