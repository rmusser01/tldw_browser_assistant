import React, { useEffect, useState, useCallback } from 'react'
import { Modal, Button, Input, Select, Space, Switch, Typography, Tag, message, Collapse, InputNumber, Tooltip as AntTooltip, Spin } from 'antd'
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from 'react-i18next'
import { useNavigate } from "react-router-dom"
import { browser } from "wxt/browser"
import { tldwClient } from '@/services/tldw/TldwApiClient'
import { QuickIngestTabs } from "./QuickIngest/QuickIngestTabs"
import { QueueTab } from "./QuickIngest/QueueTab/QueueTab"
import { FileDropZone } from "./QuickIngest/QueueTab/FileDropZone"
import { OptionsTab } from "./QuickIngest/OptionsTab/OptionsTab"
import { ResultsTab } from "./QuickIngest/ResultsTab/ResultsTab"
import { ProcessButton } from "./QuickIngest/shared/ProcessButton"
import { QUICK_INGEST_ACCEPT_STRING } from "./QuickIngest/constants"
import type { QuickIngestTab, IngestPreset, ResultOutcome } from "./QuickIngest/types"
import {
  DEFAULT_PRESET,
  detectPreset,
  getPresetConfig,
  resolvePresetMap,
  type PresetMap
} from "./QuickIngest/presets"
import {
  QUICK_INGEST_SCHEMA_FALLBACK,
  QUICK_INGEST_SCHEMA_FALLBACK_VERSION
} from '@/services/tldw/fallback-schemas'
import { HelpCircle, Headphones, Layers, Database, FileText, Film, Cookie, Info, Clock, Grid, BookText, Link2, File as FileIcon, AlertTriangle, Star, X } from 'lucide-react'
import { useStorage } from '@plasmohq/storage/hook'
import { useConfirmDanger } from '@/components/Common/confirm-danger'
import { QuickIngestInspectorDrawer } from "@/components/Common/QuickIngestInspectorDrawer"
import {
  defaultEmbeddingModelForRag,
  fetchChatModels,
  getEmbeddingModels
} from '@/services/tldw-server'
import { tldwModels } from '@/services/tldw'
import {
  ensureSelectOption,
  getAdvancedFieldSelectOptions
} from "@/components/Common/QuickIngest/advanced-field-options"
import {
  coerceDraftMediaType,
  extractYouTubePlaylistId,
  inferIngestTypeFromUrl,
  inferUploadMediaTypeFromFile
} from "@/services/tldw/media-routing"
import { useConnectionActions, useConnectionState } from '@/hooks/useConnectionState'
import { useQuickIngestStore } from "@/store/quick-ingest"
import { ConnectionPhase } from "@/types/connection"
import { detectSections } from "@/utils/content-review"
import {
  DRAFT_STORAGE_CAP_BYTES,
  storeDraftAsset,
  upsertContentDraft,
  upsertDraftBatch
} from "@/db/dexie/drafts"
import type { ContentDraft, DraftBatch } from "@/db/dexie/types"
import { setSetting } from "@/services/settings/registry"
import {
  DISCUSS_MEDIA_PROMPT_SETTING,
  LAST_MEDIA_ID_SETTING
} from "@/services/settings/ui-settings"

type TypeDefaults = {
  audio?: { language?: string; diarize?: boolean }
  document?: { ocr?: boolean }
  video?: { captions?: boolean }
}

type Entry = {
  id: string
  url: string
  type: 'auto' | 'html' | 'pdf' | 'document' | 'audio' | 'video'
  defaults?: TypeDefaults
  keywords?: string
  // Simple per-type options; server can ignore unknown fields
  audio?: { language?: string; diarize?: boolean }
  document?: { ocr?: boolean }
  video?: { captions?: boolean }
}

type QueuedFileStub = {
  id: string
  key: string
  instanceId?: string
  name: string
  size: number
  type?: string
  lastModified?: number
  defaults?: TypeDefaults
}

type ProcessingItem = {
  id?: string | number
  media_id?: string | number
  pk?: string | number
  uuid?: string | number
  media?: ProcessingItem
  status?: string
  url?: string
  input_ref?: string
  media_type?: string
  content?: string | Array<string | number>
  text?: string
  transcript?: string
  transcription?: string
  summary?: string
  analysis_content?: string
  analysis?: string
  prompt?: string
  custom_prompt?: string
  title?: string
  metadata?: Record<string, any>
  keywords?: string[] | string
  segments?: Record<string, any>[]
}

type ProcessingResultPayload =
  | ProcessingItem[]
  | ProcessingItem
  | {
      results?: ProcessingItem[]
      articles?: ProcessingItem[]
      result?: ProcessingItem | ProcessingItem[]
    }
  | null
  | undefined

type ResultItem = {
  id: string
  status: 'ok' | 'error'
  outcome?: ResultOutcome
  url?: string
  fileName?: string
  type: string
  data?: ProcessingResultPayload
  error?: string
}

type OptionsHash = `#${string}`

type ProcessingOptions = {
  perform_analysis: boolean
  perform_chunking: boolean
  overwrite_existing: boolean
  advancedValues: Record<string, any>
}

type AdvSchemaEntry = {
  name: string
  type: string
  enum?: any[]
  description?: string
  title?: string
}

type Props = {
  open: boolean
  onClose: () => void
  autoProcessQueued?: boolean
}

const buildLocalFileKey = (file: File) => {
  const name = file?.name || ""
  const size = Number.isFinite(file?.size) ? file.size : 0
  const lastModified = Number.isFinite(file?.lastModified) ? file.lastModified : 0
  return `${name}::${size}::${lastModified}`
}

// Per-session IDs avoid collisions when multiple files share the same signature.
const fileInstanceIds = new WeakMap<File, string>()

const getFileInstanceId = (file: File) => {
  const existing = fileInstanceIds.get(file)
  if (existing) return existing
  const id = crypto.randomUUID()
  fileInstanceIds.set(file, id)
  return id
}

type QuickIngestSpecCache = {
  entries: AdvSchemaEntry[]
  source: 'server' | 'fallback'
  cachedAt: number
  version?: string
}

const SPEC_CACHE_TTL_MS = 60 * 60 * 1000
const SPEC_FALLBACK_TTL_MS = 5 * 60 * 1000
let quickIngestSpecCache: QuickIngestSpecCache | null = null

const readSpecCache = (preferServer: boolean) => {
  const cache = quickIngestSpecCache
  if (!cache) return null
  if (!preferServer && cache.source !== 'fallback') return null
  const maxAge =
    cache.source === 'server' ? SPEC_CACHE_TTL_MS : SPEC_FALLBACK_TTL_MS
  if (Date.now() - cache.cachedAt > maxAge) return null
  return cache
}

const writeSpecCache = (next: Omit<QuickIngestSpecCache, 'cachedAt'>) => {
  quickIngestSpecCache = { ...next, cachedAt: Date.now() }
}

const snapshotTypeDefaults = (defaults?: TypeDefaults): TypeDefaults | undefined => {
  if (!defaults) return undefined
  const next: TypeDefaults = {}
  if (defaults.audio && (defaults.audio.language || typeof defaults.audio.diarize === 'boolean')) {
    next.audio = { ...defaults.audio }
  }
  if (defaults.document && typeof defaults.document.ocr === 'boolean') {
    next.document = { ...defaults.document }
  }
  if (defaults.video && typeof defaults.video.captions === 'boolean') {
    next.video = { ...defaults.video }
  }
  return Object.keys(next).length > 0 ? next : undefined
}

const buildQueuedFileStub = (
  file: File,
  defaults?: TypeDefaults
): QueuedFileStub => ({
  id: crypto.randomUUID(),
  key: buildLocalFileKey(file),
  instanceId: getFileInstanceId(file),
  name: file?.name || "",
  size: Number.isFinite(file?.size) ? file.size : 0,
  type: file?.type,
  lastModified: Number.isFinite(file?.lastModified) ? file.lastModified : undefined,
  defaults: snapshotTypeDefaults(defaults)
})

const ProcessingIndicator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 text-[11px] text-text-subtle">
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
    </span>
    <span>{label}</span>
  </div>
)

const QueuedItemRow = React.lazy(() =>
  import("./QuickIngest/QueuedItemRow").then((m) => ({
    default: m.QueuedItemRow
  }))
)
const QueuedFileRow = React.lazy(() =>
  import("./QuickIngest/QueuedFileRow").then((m) => ({
    default: m.QueuedFileRow
  }))
)
const createEmptyRow = (): Entry => ({
  id: crypto.randomUUID(),
  url: '',
  type: 'auto'
})

const DEFAULT_TYPE_DEFAULTS: TypeDefaults = {
  document: { ocr: true }
}

const MAX_LOCAL_FILE_BYTES = 500 * 1024 * 1024 // 500MB soft cap for local file ingest
const INLINE_FILE_WARN_BYTES = 100 * 1024 * 1024 // warn/block before copying very large buffers in-memory
const MAX_RECOMMENDED_FIELDS = 12
const PLAYLIST_EXPAND_DEBOUNCE_MS = 500
const PLAYLIST_CACHE_TTL_MS = 60 * 60 * 1000

const RESULT_FILTERS = {
  ALL: "all",
  SUCCESS: "success",
  ERROR: "error"
} as const

type ResultsFilter = (typeof RESULT_FILTERS)[keyof typeof RESULT_FILTERS]

const isLikelyUrl = (raw: string) => {
  const trimmed = (raw || "").trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}


const SKIPPED_STATUS_TOKENS = [
  "skip",
  "skipped",
  "duplicate",
  "exists",
  "already",
  "cached",
  "unchanged"
]

const normalizeStatusLabel = (value: unknown) =>
  String(value || "").trim().toLowerCase()

const isSkippedStatus = (status: string) =>
  SKIPPED_STATUS_TOKENS.some((token) => status.includes(token))

function mediaIdFromPayload(
  data: ProcessingResultPayload,
  visited?: WeakSet<object>
): string | number | null {
  if (!data || typeof data !== "object") {
    return null
  }
  if (Array.isArray(data)) {
    return data.length > 0 ? mediaIdFromPayload(data[0], visited) : null
  }
  if (!visited) {
    visited = new WeakSet<object>()
  }

  if (visited.has(data as object)) {
    return null
  }
  visited.add(data as object)

  if ("results" in data && Array.isArray(data.results) && data.results.length > 0) {
    return mediaIdFromPayload(data.results[0], visited)
  }
  if ("articles" in data && Array.isArray(data.articles) && data.articles.length > 0) {
    return mediaIdFromPayload(data.articles[0], visited)
  }
  if ("result" in data && data.result) {
    return mediaIdFromPayload(
      Array.isArray(data.result) ? data.result[0] : data.result,
      visited
    )
  }

  if (isProcessingItem(data)) {
    const direct = data.id ?? data.media_id ?? data.pk ?? data.uuid
    if (direct !== undefined && direct !== null) {
      return direct
    }
    if (data.media && typeof data.media === "object") {
      return mediaIdFromPayload(data.media, visited)
    }
  }
  return null
}

const normalizeKeywords = (value: ProcessingItem['keywords']): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

const resolveContent = (item: ProcessingItem): string => {
  if (Array.isArray(item?.content)) {
    return item.content
      .filter((v: unknown) => typeof v === "string" || typeof v === "number")
      .map((v: string | number) => String(v))
      .join("\n")
  }
  const candidates = [
    item?.content,
    item?.text,
    item?.transcript,
    item?.transcription,
    item?.summary,
    item?.analysis_content
  ]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }
  return ""
}

const resolveTitle = (item: ProcessingItem, fallback: string): string => {
  const title =
    item?.title ||
    item?.metadata?.title ||
    item?.input_ref ||
    fallback
  return String(title || "").trim() || fallback
}

const resolveAnalysis = (item: ProcessingItem): string | undefined => {
  if (typeof item?.analysis === "string") return item.analysis
  if (typeof item?.analysis_content === "string") return item.analysis_content
  return undefined
}

const resolvePrompt = (item: ProcessingItem): string | undefined => {
  if (typeof item?.prompt === "string") return item.prompt
  if (typeof item?.custom_prompt === "string") return item.custom_prompt
  return undefined
}

const inferContentFormat = (content: string): "plain" | "markdown" => {
  const text = String(content || "")
  if (/(^|\n)#{1,6}\s+\S/.test(text)) return "markdown"
  if (/```/.test(text)) return "markdown"
  if (/(^|\n)\s*[-*]\s+\S/.test(text)) return "markdown"
  return "plain"
}

const isResultsWrapper = (
  value: unknown
): value is { results: ProcessingItem[] } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Array.isArray((value as { results?: unknown }).results)
}

const isArticlesWrapper = (
  value: unknown
): value is { articles: ProcessingItem[] } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Array.isArray((value as { articles?: unknown }).articles)
}

const isResultWrapper = (
  value: unknown
): value is { result: ProcessingItem | ProcessingItem[] } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const result = (value as { result?: unknown }).result
  return Array.isArray(result) || (typeof result === "object" && result !== null)
}

const isProcessingItem = (value: unknown): value is ProcessingItem => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  if (isResultsWrapper(value) || isArticlesWrapper(value) || isResultWrapper(value)) {
    return false
  }
  return (
    "id" in value ||
    "media_id" in value ||
    "pk" in value ||
    "uuid" in value ||
    "content" in value ||
    "text" in value ||
    "transcript" in value ||
    "analysis" in value ||
    "analysis_content" in value
  )
}

const extractProcessingItems = (data: ProcessingResultPayload): ProcessingItem[] => {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (isResultsWrapper(data)) return data.results
  if (isArticlesWrapper(data)) return data.articles
  if (isResultWrapper(data)) {
    return Array.isArray(data.result) ? data.result : [data.result]
  }
  if (isProcessingItem(data)) return [data]
  return []
}

const getProcessingStatusLabels = (data: ProcessingResultPayload): string[] =>
  extractProcessingItems(data)
    .map((item) => normalizeStatusLabel(item.status))
    .filter(Boolean)

const cloneObject = <T extends Record<string, any>>(value: T): T | null => {
  try {
    return structuredClone(value)
  } catch {
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      console.warn("[cloneObject] Failed to clone object, returning null", value)
      return null
    }
  }
}

export const QuickIngestModal: React.FC<Props> = ({
  open,
  onClose,
  autoProcessQueued = false
}) => {
  const { t } = useTranslation(['option', 'settings'])
  const qi = React.useCallback(
    (key: string, defaultValue: string, options?: Record<string, any>) =>
      options
        ? t(`quickIngest.${key}`, { defaultValue, ...options })
        : t(`quickIngest.${key}`, defaultValue),
    [t]
  )
  const [messageApi, contextHolder] = message.useMessage({
    top: 12,
    getContainer: () =>
      (document.querySelector('.quick-ingest-modal .ant-modal-content') as HTMLElement) || document.body
  })

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<QuickIngestTab>('queue')
  const [runNonce, setRunNonce] = useState(0)

  // Auto-switch to results tab when processing starts (user-initiated only)
  useEffect(() => {
    if (runNonce > 0) {
      setActiveTab('results')
    }
  }, [runNonce])

  // Reset to queue tab when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab('queue')
    }
  }, [open])

  const [storeRemote, setStoreRemote] = useStorage<boolean>(
    "quickIngestStoreRemote",
    true
  )
  const [reviewBeforeStorage, setReviewBeforeStorage] = useStorage<boolean>(
    "quickIngestReviewBeforeStorage",
    false
  )
  const [rows, setRows] = useStorage<Entry[]>(
    "quickIngestQueuedRows",
    () => [createEmptyRow()]
  )
  const [queuedFiles, setQueuedFiles] = useStorage<QueuedFileStub[]>(
    "quickIngestQueuedFiles",
    []
  )
  const [typeDefaults, setTypeDefaults] = useStorage<TypeDefaults>(
    "quickIngestTypeDefaults",
    DEFAULT_TYPE_DEFAULTS
  )
  // Preset selection (persisted)
  const [activePreset, setActivePreset] = useStorage<IngestPreset>(
    "quickIngestPreset",
    DEFAULT_PRESET
  )
  const [presetConfigs] = useStorage<PresetMap>(
    "quickIngestPresetConfigs",
    resolvePresetMap()
  )
  const resolvedPresets = React.useMemo(
    () => resolvePresetMap(presetConfigs),
    [presetConfigs]
  )
  // Common ingest options available across media types (persisted for Custom preset recovery)
  const [common, setCommon] = useStorage<{
    perform_analysis: boolean
    perform_chunking: boolean
    overwrite_existing: boolean
  }>("quickIngestCommon", {
    perform_analysis: true,
    perform_chunking: true,
    overwrite_existing: false
  })
  const [running, setRunning] = React.useState<boolean>(false)
  const [results, setResults] = React.useState<ResultItem[]>([])
  const [localFiles, setLocalFiles] = React.useState<File[]>([])
  const [advancedOpen, setAdvancedOpen] = React.useState<boolean>(false)
  const [advancedValues, setAdvancedValues] = React.useState<Record<string, any>>({})
  const [advSchema, setAdvSchema] = React.useState<AdvSchemaEntry[]>([])
  const [specSource, setSpecSource] = React.useState<'server' | 'fallback' | 'none'>('none')
  const [fieldDetailsOpen, setFieldDetailsOpen] = React.useState<Record<string, boolean>>({})
  const [advSearch, setAdvSearch] = React.useState<string>('')
  const [savedAdvValues, setSavedAdvValues] = useStorage<Record<string, any>>('quickIngestAdvancedValues', {})
  const [uiPrefs, setUiPrefs] = useStorage<{ advancedOpen?: boolean; fieldDetailsOpen?: Record<string, boolean> }>('quickIngestAdvancedUI', {})
  const [specPrefs, setSpecPrefs] = useStorage<{ preferServer?: boolean; lastRemote?: { version?: string; cachedAt?: number } }>('quickIngestSpecPrefs', { preferServer: true })
  const [transcriptionModelOptions, setTranscriptionModelOptions] = React.useState<string[]>([])
  const [transcriptionModelsLoading, setTranscriptionModelsLoading] = React.useState(false)
  const [storageHintSeen, setStorageHintSeen] = useStorage<boolean>('quickIngestStorageHintSeen', false)
  const navigate = useNavigate()
  const normalizedTypeDefaults = React.useMemo(
    () => ({
      audio: typeDefaults?.audio,
      document: {
        ocr: typeDefaults?.document?.ocr ?? true
      },
      video: typeDefaults?.video
    }),
    [typeDefaults]
  )
  const modifiedAdvancedCount = React.useMemo(
    () => Object.keys(advancedValues || {}).length,
    [advancedValues]
  )
  const advancedDefaultsDirty = React.useMemo(() => {
    const current = JSON.stringify(advancedValues || {})
    const saved = JSON.stringify(savedAdvValues || {})
    return current !== saved
  }, [advancedValues, savedAdvValues])
  const createDefaultsSnapshot = React.useCallback(
    () => snapshotTypeDefaults(normalizedTypeDefaults),
    [normalizedTypeDefaults]
  )
  const buildRowEntry = React.useCallback(
    (url = '', type: Entry['type'] = 'auto'): Entry => ({
      id: crypto.randomUUID(),
      url,
      type,
      defaults: createDefaultsSnapshot()
    }),
    [createDefaultsSnapshot]
  )
  const lastRefreshedLabel = React.useMemo(() => {
    const ts = specPrefs?.lastRemote?.cachedAt
    if (!ts) return null
    const d = new Date(ts)
    return d.toLocaleString()
  }, [specPrefs])

  const fallbackSchemaVersion = QUICK_INGEST_SCHEMA_FALLBACK_VERSION
  const SAVE_DEBOUNCE_MS = 2000
  const lastSavedAdvValuesRef = React.useRef<string | null>(null)
  const lastSavedUiPrefsRef = React.useRef<string | null>(null)
  const specPrefsCacheRef = React.useRef<string | null>(null)
  const advSchemaRef = React.useRef(advSchema)
  const [totalPlanned, setTotalPlanned] = React.useState<number>(0)
  const [processedCount, setProcessedCount] = React.useState<number>(0)
  const [liveTotalCount, setLiveTotalCount] = React.useState<number>(0)
  const [ragEmbeddingLabel, setRagEmbeddingLabel] = React.useState<string | null>(null)
  const [runStartedAt, setRunStartedAt] = React.useState<number | null>(null)
  const [pendingUrlInput, setPendingUrlInput] = React.useState<string>('')
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null)
  const [pendingReattachId, setPendingReattachId] = React.useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = React.useState<boolean>(false)
  const [hasOpenedInspector, setHasOpenedInspector] = React.useState<boolean>(false)
  const [showInspectorIntro, setShowInspectorIntro] = React.useState<boolean>(true)
  const [inspectorIntroDismissed, setInspectorIntroDismissed] = useStorage<boolean>('quickIngestInspectorIntroDismissed', false)
  const [onboardingDismissed, setOnboardingDismissed] = useStorage<boolean>('quickIngestOnboardingDismissed', false)
  const playlistExpandTimersRef = React.useRef<Map<string, number>>(new Map())
  const playlistExpandInFlightRef = React.useRef<Set<string>>(new Set())
  const playlistCacheRef = React.useRef<Map<string, { urls: string[]; cachedAt: number }>>(
    new Map()
  )
  const selectedRowIdRef = React.useRef<string | null>(null)
  const reattachInputRef = React.useRef<HTMLInputElement | null>(null)
  const confirmDanger = useConfirmDanger()
  const introToast = React.useRef(false)
  const handleCloseInspector = React.useCallback(() => {
    setInspectorOpen(false)
  }, [])
  const handleDismissInspectorIntro = React.useCallback(() => {
    setShowInspectorIntro(false)
    try {
      setInspectorIntroDismissed(true)
    } catch {}
    setInspectorOpen(false)
    if (!introToast.current) {
      messageApi.success(
        qi(
          "inspectorIntroDismissed",
          "Intro dismissed — reset anytime in Settings > Quick Ingest (Reset Intro)."
        )
      )
      introToast.current = true
    }
  }, [messageApi, qi, setInspectorIntroDismissed])
  const { phase, isConnected, serverUrl } = useConnectionState()
  const { checkOnce } = useConnectionActions?.() || {}

  type IngestConnectionStatus =
    | "online"
    | "offline"
    | "unconfigured"
    | "unknown"

  const ingestConnectionStatus: IngestConnectionStatus = React.useMemo(() => {
    if (phase === ConnectionPhase.UNCONFIGURED) {
      return "unconfigured"
    }
    if (phase === ConnectionPhase.SEARCHING) {
      return "unknown"
    }
    if (phase === ConnectionPhase.CONNECTED && isConnected) {
      return "online"
    }
    if (phase === ConnectionPhase.ERROR) {
      return "offline"
    }
    if (!isConnected) {
      return "offline"
    }
    return "unknown"
  }, [phase, isConnected])
  const ingestBlocked = ingestConnectionStatus !== "online"
  const { data: chatModels = [], isLoading: chatModelsLoading } = useQuery({
    queryKey: ["playground:chatModels"],
    queryFn: () => fetchChatModels({ returnEmpty: true }),
    enabled: open && ingestConnectionStatus === "online"
  })
  const { data: embeddingModels = [], isLoading: embeddingModelsLoading } =
    useQuery({
      queryKey: ["embedding-models"],
      queryFn: () => getEmbeddingModels(),
      enabled: open && ingestConnectionStatus === "online"
    })
  const { markFailure, clearFailure, setQueuedCount } = useQuickIngestStore((s) => ({
    markFailure: s.markFailure,
    clearFailure: s.clearFailure,
    setQueuedCount: s.setQueuedCount
  }))
  const [lastRunError, setLastRunError] = React.useState<string | null>(null)
  const [draftCreationError, setDraftCreationError] = React.useState<string | null>(null)
  const [draftCreationRetrying, setDraftCreationRetrying] = React.useState(false)
  const [reviewNavigationError, setReviewNavigationError] = React.useState<string | null>(null)
  const [progressTick, setProgressTick] = React.useState<number>(0)
  const advancedHydratedRef = React.useRef(false)
  const uiPrefsHydratedRef = React.useRef(false)
  const [modalReady, setModalReady] = React.useState(false)
  const [reviewBatchId, setReviewBatchId] = React.useState<string | null>(null)
  const [reviewDraftWarning, setReviewDraftWarning] = useStorage<boolean>(
    "quickIngestReviewWarningSeen",
    false
  )

  const lastFileLookupRef = React.useRef<Map<string, File> | null>(null)
  const lastFileIdByInstanceIdRef = React.useRef<Map<string, string> | null>(null)
  const pendingStoreWithoutReviewRef = React.useRef(false)
  const unmountedRef = React.useRef(false)
  const processOnly = reviewBeforeStorage || !storeRemote
  const shouldStoreRemote = storeRemote && !processOnly
  const [lastRunProcessOnly, setLastRunProcessOnly] = React.useState(processOnly)
  const deriveResultOutcome = React.useCallback(
    (item: ResultItem): ResultOutcome => {
      if (item.status === "error") return "failed"
      const statuses = getProcessingStatusLabels(item.data)
      const isSkipped =
        statuses.length > 0 && statuses.every((status) => isSkippedStatus(status))
      if (isSkipped) return "skipped"
      return lastRunProcessOnly ? "processed" : "ingested"
    },
    [lastRunProcessOnly]
  )

  React.useEffect(() => {
    return () => {
      unmountedRef.current = true
    }
  }, [])

  React.useEffect(() => {
    selectedRowIdRef.current = selectedRowId
  }, [selectedRowId])

  React.useEffect(() => {
    return () => {
      const timers = playlistExpandTimersRef.current
      for (const timerId of timers.values()) {
        window.clearTimeout(timerId)
      }
      timers.clear()
      playlistExpandInFlightRef.current.clear()
    }
  }, [])

  React.useEffect(() => {
    if (reviewBeforeStorage && !storeRemote) {
      setStoreRemote(true)
    }
  }, [reviewBeforeStorage, storeRemote])

  React.useEffect(() => {
    if (!reviewBeforeStorage) {
      setDraftCreationError(null)
      setReviewNavigationError(null)
    }
  }, [reviewBeforeStorage])

  // Track if we're currently applying a preset to avoid auto-switch to Custom
  const applyingPresetRef = React.useRef(false)

  // Initialize options from preset or saved values when modal opens
  React.useEffect(() => {
    if (!open) return
    applyingPresetRef.current = true

    if (activePreset && activePreset !== "custom") {
      const presetConfig = getPresetConfig(activePreset, resolvedPresets)
      if (presetConfig) {
        setCommon(presetConfig.common)
        setStoreRemote(presetConfig.storeRemote)
        setReviewBeforeStorage(presetConfig.reviewBeforeStorage)
        setTypeDefaults(presetConfig.typeDefaults)
        setAdvancedValues(presetConfig.advancedValues ?? {})
      }
    }

    // Allow auto-switch detection after a short delay
    setTimeout(() => {
      applyingPresetRef.current = false
    }, 100)
  }, [open]) // Only run on modal open

  // Detect option changes and auto-switch to Custom preset
  React.useEffect(() => {
    if (!open || applyingPresetRef.current) return
    if (activePreset === "custom") return

    const currentConfig = {
      common,
      storeRemote,
      reviewBeforeStorage: reviewBeforeStorage ?? false,
      typeDefaults: normalizedTypeDefaults,
      advancedValues
    }

    const detectedPreset = detectPreset(currentConfig, resolvedPresets)
    if (detectedPreset !== activePreset) {
      setActivePreset("custom")
    }
  }, [
    common,
    storeRemote,
    reviewBeforeStorage,
    normalizedTypeDefaults,
    activePreset,
    open,
    advancedValues,
    resolvedPresets
  ])

  // Handler for preset selection
  const handlePresetChange = React.useCallback(
    (preset: IngestPreset) => {
      applyingPresetRef.current = true
      setActivePreset(preset)

      if (preset !== "custom") {
        const presetConfig = getPresetConfig(preset, resolvedPresets)
        if (presetConfig) {
          setCommon(presetConfig.common)
          setStoreRemote(presetConfig.storeRemote)
          setReviewBeforeStorage(presetConfig.reviewBeforeStorage)
          setTypeDefaults(presetConfig.typeDefaults)
          setAdvancedValues(presetConfig.advancedValues ?? {})
        }
      }
      // For Custom, keep current values (user is explicitly choosing to keep their config)

      setTimeout(() => {
        applyingPresetRef.current = false
      }, 100)
    },
    [
      setActivePreset,
      setCommon,
      setStoreRemote,
      setReviewBeforeStorage,
      setTypeDefaults,
      setAdvancedValues,
      resolvedPresets
    ]
  )

  // Handler for reset to defaults
  const handlePresetReset = React.useCallback(() => {
    handlePresetChange(DEFAULT_PRESET)
  }, [handlePresetChange])

  const formatBytes = React.useCallback((bytes?: number) => {
    if (!bytes || Number.isNaN(bytes)) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let v = bytes
    let u = 0
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024
      u += 1
    }
    return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[u]}`
  }, [])

  const handleReviewToggle = React.useCallback(
    async (checked: boolean) => {
      if (checked && !reviewDraftWarning) {
        const ok = await confirmDanger({
          title: qi(
            "reviewWarningTitle",
            "Store drafts locally?"
          ),
          content: (
            <div className="space-y-2 text-sm text-text-muted">
              <p>
                {qi(
                  "reviewWarningBody",
                  "Drafts are saved in this browser and may include sensitive data. You can clear drafts from the Content Review page at any time."
                )}
              </p>
              <p>
                {qi(
                  "reviewWarningBodySecondary",
                  "Review mode keeps content client-side until you commit it to your server."
                )}
              </p>
            </div>
          ),
          okText: qi("reviewWarningConfirm", "Enable review"),
          cancelText: qi("reviewWarningCancel", "Cancel"),
          danger: false,
          autoFocusButton: "ok"
        })
        if (!ok) return
        setReviewDraftWarning(true)
      }
      setReviewBeforeStorage(checked)
    },
    [
      confirmDanger,
      qi,
      reviewDraftWarning,
      setReviewBeforeStorage,
      setReviewDraftWarning
    ]
  )

  const createDraftBatchMetadata = React.useCallback(
    (okResults: ResultItem[]) => {
      const now = Date.now()
      const batchId = crypto.randomUUID()
      const batch: DraftBatch = {
        id: batchId,
        source: "quick_ingest",
        sourceDetails: {
          total: okResults.length
        },
        createdAt: now,
        updatedAt: now
      }

      const processingOptions: ProcessingOptions = {
        perform_analysis: Boolean(common.perform_analysis),
        perform_chunking: Boolean(common.perform_chunking),
        overwrite_existing: Boolean(common.overwrite_existing),
        advancedValues: { ...(advancedValues || {}) }
      }

      const expiresAt = now + 30 * 24 * 60 * 60 * 1000
      const rowMap = new Map(rows.map((row) => [row.id, row]))

      return { now, batchId, batch, processingOptions, expiresAt, rowMap }
    },
    [advancedValues, common, rows]
  )

  const extractMetadataForDraft = React.useCallback((processed: ProcessingItem) => {
    const metadata =
      processed?.metadata && typeof processed.metadata === "object"
        ? processed.metadata
        : {}
    const metadataCopy = cloneObject(metadata)
    const originalMetadata = cloneObject(metadata)
    if (!metadataCopy || !originalMetadata) {
      console.warn(
        "[createDraftsFromResults] Unable to clone metadata, using empty metadata",
        metadata
      )
    }
    const keywords = normalizeKeywords(
      processed?.keywords || metadata?.keywords
    )
    return {
      metadataCopy: metadataCopy ?? {},
      originalMetadata: originalMetadata ?? {},
      keywords
    }
  }, [])

  const storeDraftAssetIfPresent = React.useCallback(
    async ({
      draftId,
      localFile,
      item,
      sourceRow,
      processed
    }: {
      draftId: string
      localFile?: File
      item: ResultItem
      sourceRow?: Entry
      processed: ProcessingItem
    }) => {
      let sourceAssetId: string | undefined
      let source: ContentDraft["source"] = {
        kind: "url",
        url:
          sourceRow?.url ||
          item.url ||
          processed?.url ||
          processed?.input_ref
      }
      let skippedAssetsDelta = 0
      if (localFile) {
        const stored = await storeDraftAsset(draftId, localFile)
        const fileSource: ContentDraft["source"] = {
          kind: "file",
          fileName: localFile.name,
          mimeType: localFile.type,
          sizeBytes: localFile.size,
          lastModified: localFile.lastModified
        }
        if (stored.asset) {
          sourceAssetId = stored.asset.id
        } else {
          skippedAssetsDelta += 1
        }
        source = fileSource
      } else if (item.fileName) {
        source = {
          kind: "file",
          fileName: item.fileName
        }
      }
      return { source, sourceAssetId, skippedAssetsDelta }
    },
    []
  )

  const buildDraftFromProcessedItem = React.useCallback(
    async ({
      item,
      processed,
      sourceRow,
      localFile,
      batchId,
      now,
      expiresAt,
      processingOptions
    }: {
      item: ResultItem
      processed: ProcessingItem
      sourceRow?: Entry
      localFile?: File
      batchId: string
      now: number
      expiresAt: number
      processingOptions: ProcessingOptions
    }): Promise<{ draftId: string; skippedAssetsDelta: number } | null> => {
      const statusLabel = String(processed?.status || "").toLowerCase()
      if (statusLabel === "error" || statusLabel === "failed") {
        return null
      }

      const draftId = crypto.randomUUID()
      const content = resolveContent(processed)
      const { metadataCopy, originalMetadata, keywords } =
        extractMetadataForDraft(processed)
      const mediaTypeRaw = String(
        processed?.media_type || item.type || sourceRow?.type || "document"
      ).toLowerCase()
      const mediaType: ContentDraft["mediaType"] =
        coerceDraftMediaType(mediaTypeRaw)

      const sourceLabel =
        sourceRow?.url ||
        item.url ||
        localFile?.name ||
        item.fileName ||
        processed?.input_ref ||
        "Untitled source"
      const title = resolveTitle(processed, sourceLabel)
      const contentFormat = inferContentFormat(content)
      const { sections, strategy } = detectSections(
        content,
        processed?.segments
      )
      const processingSnapshot = {
        ...processingOptions,
        advancedValues: { ...(processingOptions.advancedValues || {}) }
      }
      const analysis = resolveAnalysis(processed)
      const prompt = resolvePrompt(processed)

      const { source, sourceAssetId, skippedAssetsDelta } =
        await storeDraftAssetIfPresent({
          draftId,
          localFile,
          item,
          sourceRow,
          processed
        })

      const draft: ContentDraft = {
        id: draftId,
        batchId,
        source,
        sourceAssetId,
        mediaType,
        title,
        originalTitle: title,
        content,
        originalContent: content,
        contentFormat,
        originalContentFormat: contentFormat,
        metadata: metadataCopy,
        originalMetadata,
        keywords,
        sections: sections.length > 0 ? sections : undefined,
        excludedSectionIds: [],
        sectionStrategy: strategy || undefined,
        revisions: [],
        processingOptions: processingSnapshot,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        expiresAt,
        analysis,
        prompt,
        originalAnalysis: analysis,
        originalPrompt: prompt
      }

      await upsertContentDraft(draft)
      return { draftId, skippedAssetsDelta }
    },
    [extractMetadataForDraft, storeDraftAssetIfPresent]
  )

  const createDraftsFromResults = React.useCallback(
    async (
      out: ResultItem[],
      fileLookup: Map<string, File>
    ): Promise<{
      batchId: string
      draftIds: string[]
      skippedAssets: number
    } | null> => {
      const okResults = out.filter((item) => item.status === "ok")
      if (okResults.length === 0) return null

      const { now, batchId, batch, processingOptions, expiresAt, rowMap } =
        createDraftBatchMetadata(okResults)
      const draftIds: string[] = []
      let skippedAssets = 0

      await upsertDraftBatch(batch)

      const draftPromises = okResults.map(async (item) => {
        const sourceRow = rowMap.get(item.id)
        const localFile = fileLookup.get(item.id)
        const processingItems = extractProcessingItems(item.data)
        if (processingItems.length === 0) return []
        const itemDrafts = await Promise.all(
          processingItems.map(async (processed) =>
            buildDraftFromProcessedItem({
              item,
              processed,
              sourceRow,
              localFile,
              batchId,
              now,
              expiresAt,
              processingOptions
            })
          )
        )
        return itemDrafts.filter(
          (draft): draft is { draftId: string; skippedAssetsDelta: number } =>
            Boolean(draft)
        )
      })
      const allDrafts = (await Promise.all(draftPromises)).flat()
      for (const draft of allDrafts) {
        skippedAssets += draft.skippedAssetsDelta
        draftIds.push(draft.draftId)
      }

      return { batchId, draftIds, skippedAssets }
    },
    [buildDraftFromProcessedItem, createDraftBatchMetadata]
  )

  const openContentReview = React.useCallback(
    async (batchId: string): Promise<boolean> => {
      const hash = `#/content-review?batch=${batchId}`
      const isOptionsContext = window.location.pathname.includes("options.html")
      if (isOptionsContext) {
        try {
          navigate(`/content-review?batch=${batchId}`)
          return true
        } catch {
          messageApi.error(
            qi(
              "reviewNavigationFailed",
              "Couldn't open Content Review. Please try again."
            )
          )
          return false
        }
      }
      try {
        const url = browser.runtime.getURL(`/options.html${hash}`)
        await browser.tabs.create({ url })
        return true
      } catch {
        try {
          const fallbackUrl = browser.runtime.getURL(`/options.html${hash}`)
          const win = window.open(fallbackUrl, "_blank")
          if (!win) {
            messageApi.error(
              qi(
                "reviewNavigationFailed",
                "Couldn't open Content Review. Please try again."
              )
            )
            return false
          }
          return Boolean(win)
        } catch {
          messageApi.error(
            qi(
              "reviewNavigationFailed",
              "Couldn't open Content Review. Please try again."
            )
          )
          return false
        }
      }
    },
    [messageApi, navigate, qi]
  )

  const tryOpenContentReview = React.useCallback(
    async (
      batchId: string,
      options?: { closeOnSuccess?: boolean; closeDelayMs?: number }
    ) => {
      setReviewNavigationError(null)
      const ok = await openContentReview(batchId)
      if (!ok) {
        const msg = qi(
          "reviewNavigationFailed",
          "Couldn't open Content Review. Please try again."
        )
        setReviewNavigationError(msg)
        return false
      }
      if (options?.closeOnSuccess) {
        const delayMs =
          typeof options.closeDelayMs === "number" ? options.closeDelayMs : 250
        if (delayMs > 0) {
          window.setTimeout(() => {
            onClose()
          }, delayMs)
        } else {
          onClose()
        }
      }
      return true
    },
    [onClose, openContentReview, qi]
  )

  const handleReviewBatchReady = React.useCallback(
    async (batch: { batchId: string; skippedAssets: number }) => {
      if (!batch?.batchId) return
      if (batch.skippedAssets > 0) {
        const reviewStorageCapDefault =
          batch.skippedAssets === 1
            ? "{{count}} file exceeds the local draft cap ({{cap}}). Attach sources before committing audio/video."
            : "{{count}} files exceed the local draft cap ({{cap}}). Attach sources before committing audio/video."
        messageApi.warning(
          qi(
            "reviewStorageCapWarning",
            reviewStorageCapDefault,
            {
              count: batch.skippedAssets,
              cap: formatBytes(DRAFT_STORAGE_CAP_BYTES)
            }
          )
        )
      } else {
        messageApi.success(
          qi("reviewDraftsCreated", "Drafts ready for review.")
        )
      }
      await tryOpenContentReview(batch.batchId, {
        closeOnSuccess: true,
        closeDelayMs: 250
      })
    },
    [formatBytes, messageApi, qi, tryOpenContentReview]
  )

  const fileTypeFromName = React.useCallback(
    (f: { name?: string; type?: string }): Entry['type'] => {
      const uploadType = inferUploadMediaTypeFromFile(
        f?.name || '',
        f?.type || ''
      )
      return uploadType === 'ebook' ? 'document' : uploadType
    },
    []
  )

  const typeIcon = React.useCallback((type: Entry['type']) => {
    const cls = 'w-4 h-4 text-text-subtle'
    switch (type) {
      case 'audio':
        return <Headphones className={cls} />
      case 'video':
        return <Film className={cls} />
      case 'pdf':
      case 'document':
        return <FileText className={cls} />
      case 'html':
        return <Link2 className={cls} />
      default:
        return <FileIcon className={cls} />
    }
  }, [])

  const mergeDefaults = React.useCallback(
    <T extends Record<string, any>>(defaults?: T, overrides?: T): T | undefined => {
      const next: Record<string, any> = {
        ...(defaults || {}),
        ...(overrides || {})
      }
      for (const key of Object.keys(next)) {
        if (next[key] === undefined || next[key] === null || next[key] === '') {
          delete next[key]
        }
      }
      return Object.keys(next).length > 0 ? (next as T) : undefined
    },
    []
  )

  const hasOverrides = React.useCallback(
    <T extends Record<string, any>>(overrides?: T, defaults?: T): boolean => {
      if (!overrides) return false
      for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined || value === null || value === '') continue
        const defaultValue = defaults ? (defaults as Record<string, any>)[key] : undefined
        if (value !== defaultValue) return true
      }
      return false
    },
    []
  )

  const statusForUrlRow = React.useCallback((row: Entry) => {
    const raw = (row.url || '').trim()
    if (raw && !isLikelyUrl(raw)) {
      return {
        label: qi('needsReview', 'Needs review'),
        color: 'orange',
        reason: qi('invalidUrlFormat', 'Invalid URL format')
      }
    }
    const baselineDefaults = row.defaults || normalizedTypeDefaults
    const hasKeywords = Boolean(row.keywords && row.keywords.trim())
    const custom =
      row.type !== 'auto' ||
      hasKeywords ||
      hasOverrides(row.audio, baselineDefaults.audio) ||
      hasOverrides(row.document, baselineDefaults.document) ||
      hasOverrides(row.video, baselineDefaults.video)
    return {
      label: custom ? qi('customLabel', 'Custom') : qi('defaultLabel', 'Default'),
      color: custom ? 'blue' : 'default' as const,
      reason: custom
        ? qi('customReason', 'Custom type or options')
        : undefined
    }
  }, [hasOverrides, qi, normalizedTypeDefaults])

  const statusForFile = React.useCallback((fileLike: { size: number }, attached: boolean) => {
    if (!attached) {
      return {
        label: qi('missingFile', 'Missing file'),
        color: 'orange',
        reason: qi('missingFileReason', 'Reattach this file to process it.')
      }
    }
    if (fileLike.size && fileLike.size > MAX_LOCAL_FILE_BYTES) {
      return {
        label: qi('needsReview', 'Needs review'),
        color: 'orange',
        reason: qi('fileTooLarge', 'File is over 500MB')
      }
    }
    return {
      label: qi('defaultLabel', 'Default'),
      color: 'default' as const
    }
  }, [qi])

  const fetchPlaylistUrls = React.useCallback(async (url: string): Promise<string[] | null> => {
    const trimmed = (url || "").trim()
    if (!trimmed) return null
    const playlistId = extractYouTubePlaylistId(trimmed)
    if (!playlistId) return null
    const cached = playlistCacheRef.current.get(playlistId)
    if (cached && Date.now() - cached.cachedAt < PLAYLIST_CACHE_TTL_MS) {
      return cached.urls
    }
    try {
      const resp = (await browser.runtime.sendMessage({
        type: "tldw:quick-ingest-expand-playlist",
        payload: { url: trimmed }
      })) as { ok: boolean; urls?: string[] } | undefined
      if (!resp?.ok) return []
      const urls = Array.isArray(resp?.urls) ? resp?.urls : []
      if (urls.length > 0) {
        playlistCacheRef.current.set(playlistId, {
          urls,
          cachedAt: Date.now()
        })
      }
      return urls
    } catch (error) {
      console.debug("[quick-ingest] playlist expansion failed", error)
      return []
    }
  }, [])

  const addUrlsFromInput = React.useCallback(
    async (text: string) => {
      if (ingestBlocked) {
        messageApi.warning(
          qi("queueBlocked", "Connect to your server to add items.")
        )
        return
      }
      const parts = text
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (parts.length === 0) return
      const expanded: string[] = []
      for (const raw of parts) {
        const trimmed = raw.trim()
        if (!trimmed) continue
        if (isLikelyUrl(trimmed)) {
          const playlistUrls = await fetchPlaylistUrls(trimmed)
          if (playlistUrls && playlistUrls.length > 0) {
            expanded.push(...playlistUrls)
            continue
          }
        }
        expanded.push(trimmed)
      }
      const entries = expanded.map((u) =>
        buildRowEntry(u, inferIngestTypeFromUrl(u) as Entry['type'])
      )
      setRows((prev) => [...prev, ...entries])
      setPendingUrlInput('')
      setSelectedRowId(entries[0].id)
      setSelectedFileId(null)
      messageApi.success(
        qi("urlsAdded", "Added {{count}} URL(s) to the queue.", {
          count: entries.length
        })
      )
    },
    [buildRowEntry, fetchPlaylistUrls, ingestBlocked, messageApi, qi]
  )

  const clearAllQueues = React.useCallback(() => {
    setRows([buildRowEntry()])
    setQueuedFiles([])
    setLocalFiles([])
    setSelectedRowId(null)
    setSelectedFileId(null)
    setPendingReattachId(null)
    setPendingUrlInput('')
  }, [buildRowEntry, setQueuedFiles, setRows])

  const pasteFromClipboard = React.useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        messageApi.info('Clipboard is empty.')
        return
      }
      setPendingUrlInput(text)
    } catch {
      messageApi.error('Unable to read from clipboard. Check browser permissions.')
    }
  }, [messageApi])

  const persistSpecPrefs = React.useCallback(
    (next: { preferServer?: boolean; lastRemote?: { version?: string; cachedAt?: number } }) => {
      const serialized = JSON.stringify(next || {})
      if (specPrefsCacheRef.current === serialized) return
      specPrefsCacheRef.current = serialized
      setSpecPrefs(next)
    },
    [setSpecPrefs]
  )

  const expandPlaylistRow = React.useCallback(
    async (rowId: string, urlSnapshot: string) => {
      if (running || !open) return
      const trimmedUrl = String(urlSnapshot || "").trim()
      if (!trimmedUrl || !isLikelyUrl(trimmedUrl)) return
      if (playlistExpandInFlightRef.current.has(rowId)) return
      if (!extractYouTubePlaylistId(trimmedUrl)) return

      playlistExpandInFlightRef.current.add(rowId)
      try {
        const urls = await fetchPlaylistUrls(trimmedUrl)
        if (!urls || urls.length === 0) return

        const shouldSelectReplacement = selectedRowIdRef.current === rowId
        let nextSelectedId: string | null = null

        setRows((prev) => {
          const idx = prev.findIndex((row) => row.id === rowId)
          if (idx === -1) return prev
          const existing = prev[idx]
          const existingTrimmed = String(existing.url || "").trim()
          if (!existingTrimmed || existingTrimmed !== trimmedUrl) {
            return prev
          }
          const mapped = urls.map((playlistUrl, index) => {
            const id = crypto.randomUUID()
            if (index === 0 && shouldSelectReplacement) {
              nextSelectedId = id
            }
            return {
              ...existing,
              id,
              url: playlistUrl
            }
          })
          return [...prev.slice(0, idx), ...mapped, ...prev.slice(idx + 1)]
        })

        if (shouldSelectReplacement && nextSelectedId) {
          setSelectedRowId(nextSelectedId)
        }
      } finally {
        playlistExpandInFlightRef.current.delete(rowId)
      }
    },
    [fetchPlaylistUrls, open, running, setRows]
  )

  const schedulePlaylistExpansion = React.useCallback(
    (rowId: string, url: string) => {
      if (!open || running) return
      const trimmed = (url || "").trim()
      if (!trimmed) return
      if (!isLikelyUrl(trimmed)) return
      if (!extractYouTubePlaylistId(trimmed)) return
      if (playlistExpandInFlightRef.current.has(rowId)) return
      const timers = playlistExpandTimersRef.current
      const existing = timers.get(rowId)
      if (existing) {
        window.clearTimeout(existing)
      }
      const timeoutId = window.setTimeout(() => {
        timers.delete(rowId)
        void expandPlaylistRow(rowId, trimmed)
      }, PLAYLIST_EXPAND_DEBOUNCE_MS)
      timers.set(rowId, timeoutId)
    },
    [expandPlaylistRow, open, running]
  )

  React.useEffect(() => {
    if (!open || running) return
    for (const row of rows) {
      const url = String(row?.url || "").trim()
      if (!url) continue
      schedulePlaylistExpansion(row.id, url)
    }
  }, [open, rows, running, schedulePlaylistExpansion])

  const addRow = () => setRows((r) => [...r, buildRowEntry()])
  const removeRow = (id: string) => {
    setRows((r) => r.filter((x) => x.id !== id))
    if (selectedRowId === id) {
      setSelectedRowId(null)
    }
  }
  const updateRow = React.useCallback(
    (id: string, patch: Partial<Entry>) => {
      setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))
      if (typeof patch.url === "string") {
        schedulePlaylistExpansion(id, patch.url)
      }
    },
    [schedulePlaylistExpansion, setRows]
  )

  // Resolve current RAG embedding model for display in Advanced section
  React.useEffect(() => {
    ;(async () => {
      try {
        const id = await defaultEmbeddingModelForRag()
        if (!id) {
          setRagEmbeddingLabel(null)
          return
        }
        // id comes from defaultEmbeddingModelForRag as provider/model
        const parts = String(id).split('/')
        const provider = parts.length > 1 ? parts[0] : 'unknown'
        const modelName = parts.length > 1 ? parts.slice(1).join('/') : id
        const models = await tldwModels.getEmbeddingModels().catch(() => [])
        const match = models.find((m) => m.id === id || m.id === modelName)
        const providerLabel = tldwModels.getProviderDisplayName(
          match?.provider || provider
        )
        const label = `${providerLabel} / ${modelName}`
        setRagEmbeddingLabel(label)
      } catch {
        setRagEmbeddingLabel(null)
      }
    })()
  }, [])

  const queuedFileStubs = queuedFiles || []

  React.useEffect(() => {
    if (!open) return
    const snapshot = createDefaultsSnapshot()
    if (!snapshot) return
    setRows((prev) => {
      let changed = false
      const next = prev.map((row) => {
        if (row.defaults) return row
        changed = true
        return { ...row, defaults: snapshotTypeDefaults(snapshot) }
      })
      return changed ? next : prev
    })
    setQueuedFiles((prev) => {
      if (!prev || prev.length === 0) return prev
      let changed = false
      const next = prev.map((stub) => {
        if (stub.defaults) return stub
        changed = true
        return { ...stub, defaults: snapshotTypeDefaults(snapshot) }
      })
      return changed ? next : prev
    })
  }, [createDefaultsSnapshot, open, setQueuedFiles, setRows])

  const attachedFilesByInstanceId = React.useMemo(
    () => new Map(localFiles.map((file) => [getFileInstanceId(file), file])),
    [localFiles]
  )

  const {
    attachedFileStubs,
    missingFileStubs,
    attachedFiles,
    fileForStubId,
    stubsNeedingInstanceId
  } = React.useMemo(() => {
    const fileForStubId = new Map<string, File>()
    const matchedInstanceIds = new Set<string>()
    const filesBySignature = new Map<string, File[]>()
    for (const file of localFiles) {
      const signature = buildLocalFileKey(file)
      const list = filesBySignature.get(signature) || []
      list.push(file)
      filesBySignature.set(signature, list)
    }
    const stubsNeedingInstanceId: Array<{ id: string; instanceId: string }> = []

    for (const stub of queuedFileStubs) {
      let file: File | undefined
      if (stub.instanceId) {
        file = attachedFilesByInstanceId.get(stub.instanceId)
      }
      if (!file) {
        const candidates = filesBySignature.get(stub.key)
        if (candidates) {
          file = candidates.find(
            (candidate) => !matchedInstanceIds.has(getFileInstanceId(candidate))
          )
        }
      }
      if (file) {
        const instanceId = getFileInstanceId(file)
        fileForStubId.set(stub.id, file)
        matchedInstanceIds.add(instanceId)
        if (!stub.instanceId || stub.instanceId !== instanceId) {
          stubsNeedingInstanceId.push({ id: stub.id, instanceId })
        }
      }
    }

    const attachedFileStubs = queuedFileStubs.filter((stub) =>
      fileForStubId.has(stub.id)
    )
    const missingFileStubs = queuedFileStubs.filter(
      (stub) => !fileForStubId.has(stub.id)
    )
    const attachedFiles = attachedFileStubs
      .map((stub) => fileForStubId.get(stub.id))
      .filter(Boolean) as File[]

    return {
      attachedFileStubs,
      missingFileStubs,
      attachedFiles,
      fileForStubId,
      stubsNeedingInstanceId
    }
  }, [attachedFilesByInstanceId, localFiles, queuedFileStubs])
  const hasMissingFiles = missingFileStubs.length > 0

  React.useEffect(() => {
    if (!stubsNeedingInstanceId.length) return
    setQueuedFiles((prev) => {
      if (!prev || prev.length === 0) return prev
      let changed = false
      const updates = new Map(
        stubsNeedingInstanceId.map((item) => [item.id, item.instanceId])
      )
      const next = prev.map((stub) => {
        const nextInstanceId = updates.get(stub.id)
        if (!nextInstanceId || stub.instanceId === nextInstanceId) return stub
        changed = true
        return { ...stub, instanceId: nextInstanceId }
      })
      return changed ? next : prev
    })
  }, [setQueuedFiles, stubsNeedingInstanceId])

  const plannedCount = React.useMemo(() => {
    const valid = rows.filter((r) => r.url.trim().length > 0)
    return valid.length + attachedFileStubs.length
  }, [rows, attachedFileStubs.length])

  React.useEffect(() => {
    const queuedUrls = rows.filter((r) => r.url.trim().length > 0).length
    const queuedFiles = queuedFileStubs.length
    setQueuedCount(queuedUrls + queuedFiles)
  }, [queuedFileStubs.length, rows, setQueuedCount])

  const hasTypeDefaultChanges = React.useMemo(() => {
    const baselineAudio = DEFAULT_TYPE_DEFAULTS.audio
    const baselineDocument = DEFAULT_TYPE_DEFAULTS.document
    const baselineVideo = DEFAULT_TYPE_DEFAULTS.video
    const currentAudio = normalizedTypeDefaults.audio
    const currentDocument = normalizedTypeDefaults.document
    const currentVideo = normalizedTypeDefaults.video

    const audioChanged =
      (currentAudio?.language ?? null) !== (baselineAudio?.language ?? null) ||
      (currentAudio?.diarize ?? null) !== (baselineAudio?.diarize ?? null)
    const documentChanged =
      (currentDocument?.ocr ?? true) !== (baselineDocument?.ocr ?? true)
    const videoChanged =
      (currentVideo?.captions ?? null) !== (baselineVideo?.captions ?? null)

    return audioChanged || documentChanged || videoChanged
  }, [normalizedTypeDefaults])

  // Compute tab badge state
  const tabBadges = React.useMemo(() => {
    // Options modified: check if common options differ from defaults or typeDefaults differ
    const optionsModified =
      common.perform_analysis !== true ||
      common.perform_chunking !== true ||
      common.overwrite_existing !== false ||
      hasTypeDefaultChanges ||
      reviewBeforeStorage ||
      !storeRemote ||
      Object.keys(advancedValues || {}).some((k) => advancedValues[k] != null)

    return {
      queueCount: plannedCount,
      optionsModified,
      isProcessing: running
    }
  }, [
    plannedCount,
    common,
    advancedValues,
    hasTypeDefaultChanges,
    reviewBeforeStorage,
    running,
    storeRemote
  ])

  const resultById = React.useMemo(() => {
    const map = new Map<string, ResultItem>()
    for (const r of results) map.set(r.id, r)
    return map
  }, [results])

  const getResultForFile = React.useCallback(
    (file: File) => {
      const fileIdByInstanceId = lastFileIdByInstanceIdRef.current
      if (fileIdByInstanceId) {
        const id = fileIdByInstanceId.get(getFileInstanceId(file))
        if (id) {
          return resultById.get(id) || null
        }
      }
      const fallbackMatches = results.filter((r) => r.fileName === file.name)
      return fallbackMatches.length === 1 ? fallbackMatches[0] : null
    },
    [resultById, results]
  )

  const pendingLabel = React.useMemo(() => {
    if (!ingestBlocked) {
      return ""
    }
    if (ingestConnectionStatus === "unconfigured") {
      return t(
        "quickIngest.pendingUnconfigured",
        "Not connected — configure your server to run."
      )
    }
    return t(
      "quickIngest.pendingLabel",
      "Not connected — reconnect to run."
    )
  }, [ingestBlocked, ingestConnectionStatus, t])

  // Mark modal as ready once we have evaluated connection state at least once
  React.useEffect(() => {
    if (!modalReady) {
      setModalReady(true)
    }
  }, [modalReady, ingestBlocked])

  const autoProcessedRef = React.useRef(false)

  // Allow external callers (e.g., tests) to force a connection check
  React.useEffect(() => {
    const handler = () => {
      try {
        checkOnce?.()
      } catch {
        // ignore check errors
      }
    }
    window.addEventListener("tldw:check-connection", handler)
    return () => window.removeEventListener("tldw:check-connection", handler)
  }, [checkOnce])

  // When modal opens and we are offline, automatically retry connection
  React.useEffect(() => {
    if (open && ingestBlocked) {
      try {
        checkOnce?.()
      } catch {
        // ignore retry failures
      }
    }
  }, [open, ingestBlocked, checkOnce])

  const run = React.useCallback(async () => {
    // Reset any previous error state before a new attempt.
    setLastRunError(null)
    setDraftCreationError(null)
    setDraftCreationRetrying(false)
    setReviewNavigationError(null)
    lastFileLookupRef.current = null
    lastFileIdByInstanceIdRef.current = null
    clearFailure()

    const missingFileCount = missingFileStubs.length
    if (missingFileCount > 0) {
      messageApi.error(
        qi(
          "missingFilesBlock",
          "Reattach {{count}} local file(s) to run ingest.",
          { count: missingFileCount }
        )
      )
      return
    }

    if (ingestBlocked) {
      const blockedMessage =
        ingestConnectionStatus === "unconfigured"
          ? t(
              "quickIngest.unavailableUnconfigured",
              "Ingest unavailable \u2014 server not configured"
            )
          : ingestConnectionStatus === "unknown"
            ? t(
                "quickIngest.checkingTitle",
                "Checking server connection\u2026"
              )
            : t(
                "quickIngest.unavailableOffline",
                "Ingest unavailable \u2014 not connected"
              )
      messageApi.warning(blockedMessage)
      return
    }
    const valid = rows.filter((r) => r.url.trim().length > 0)
    if (valid.length === 0 && attachedFiles.length === 0) {
      messageApi.error('Please add at least one URL or file')
      return
    }
    const oversizedFiles = attachedFiles.filter(
      (f) => f.size && f.size > MAX_LOCAL_FILE_BYTES
    )
    if (oversizedFiles.length > 0) {
      const maxLabel = formatBytes(MAX_LOCAL_FILE_BYTES)
      const names = oversizedFiles.map((f) => f.name).slice(0, 3).join(', ')
      const suffix = oversizedFiles.length > 3 ? '…' : ''
      const msg = names
        ? `File too large: ${names}${suffix}. Each file must be smaller than ${maxLabel}.`
        : `One or more files are too large. Each file must be smaller than ${maxLabel}.`
      messageApi.error(msg)
      setLastRunError(msg)
      return
    }
    const total = valid.length + attachedFiles.length
    // Increment runNonce to trigger auto-switch to results tab
    setRunNonce((n) => n + 1)
    setTotalPlanned(total)
    setProcessedCount(0)
    setLiveTotalCount(total)
    setRunStartedAt(Date.now())
    setLastRunProcessOnly(processOnly)
    setRunning(true)
    setResults([])
    setReviewBatchId(null)
    try {
      // Ensure tldwConfig is hydrated for background requests
      try {
        await tldwClient.initialize()
      } catch {}

      // Prepare entries payload (URLs + simple options)
      const entries = valid.map((r) => {
        const inferredType =
          r.type === "auto" ? inferIngestTypeFromUrl(r.url) : r.type
        const rowDefaults = r.defaults || normalizedTypeDefaults
        const defaultsForType = {
          audio: inferredType === "audio" ? rowDefaults.audio : undefined,
          document:
            inferredType === "document" || inferredType === "pdf"
              ? rowDefaults.document
              : undefined,
          video: inferredType === "video" ? rowDefaults.video : undefined
        }
        const audio = mergeDefaults(defaultsForType.audio, r.audio)
        const document = mergeDefaults(defaultsForType.document, r.document)
        const video = mergeDefaults(defaultsForType.video, r.video)
        return {
          id: r.id,
          url: r.url,
          type: r.type,
          keywords: r.keywords,
          audio,
          document,
          video
        }
      })

      const fileDefaults = {
        audio: mergeDefaults(normalizedTypeDefaults.audio),
        document: mergeDefaults(normalizedTypeDefaults.document),
        video: mergeDefaults(normalizedTypeDefaults.video)
      }
      const fileDefaultsByInstanceId = new Map<string, TypeDefaults>()
      for (const stub of attachedFileStubs) {
        const file = fileForStubId.get(stub.id)
        if (!file) continue
        fileDefaultsByInstanceId.set(
          getFileInstanceId(file),
          stub.defaults || normalizedTypeDefaults
        )
      }

      // Convert local files to transferable payloads (ArrayBuffer)
      const fileLookup = new Map<string, File>()
      const fileIdByInstanceId = new Map<string, string>()
      const filesPayload = await Promise.all(
        attachedFiles.map(async (f) => {
          const defaultsForFile =
            fileDefaultsByInstanceId.get(getFileInstanceId(f)) || normalizedTypeDefaults
          if (f.size && f.size > INLINE_FILE_WARN_BYTES) {
            const msg = `File "${f.name}" is too large for inline transfer (over ${formatBytes(INLINE_FILE_WARN_BYTES)}). Please upload a smaller file or process directly on the server.`
            messageApi.error(msg)
            throw new Error(msg)
          }
          // Guard again at runtime; oversized files should never be read into memory.
          if (f.size && f.size > MAX_LOCAL_FILE_BYTES) {
            throw new Error(
              `File "${f.name}" is too large to ingest (over ${formatBytes(MAX_LOCAL_FILE_BYTES)}).`
            )
          }
          const id = crypto.randomUUID()
          fileLookup.set(id, f)
          fileIdByInstanceId.set(getFileInstanceId(f), id)
          // Use a plain array so runtime message cloning (MV3 SW) preserves bytes
          const data = Array.from(new Uint8Array(await f.arrayBuffer()))
          return {
            id,
            name: f.name,
            type: f.type,
            data,
            defaults: defaultsForFile
          }
        })
      )
      lastFileLookupRef.current = fileLookup
      lastFileIdByInstanceIdRef.current = fileIdByInstanceId

      const resp = (await browser.runtime.sendMessage({
        type: "tldw:quick-ingest-batch",
        payload: {
          entries,
          files: filesPayload,
          storeRemote,
          processOnly,
          common,
          advancedValues,
          fileDefaults
        }
      })) as { ok: boolean; error?: string; results?: ResultItem[] } | undefined

      if (unmountedRef.current) {
        return
      }

      if (!resp?.ok) {
        const msg = resp?.error || "Quick ingest failed. Check tldw server settings and try again."
        messageApi.error(msg)
        if (unmountedRef.current) {
          return
        }
        setLastRunError(msg)
        markFailure()
        setRunning(false)
        setRunStartedAt(null)
        return
      }

      const out = resp.results || []
      if (unmountedRef.current) {
        return
      }
      setResults(out)
      setRunning(false)
      setRunStartedAt(null)
      const hasOkResults = out.some((r) => r.status === "ok")
      let createdDraftBatch: {
        batchId: string
        draftIds: string[]
        skippedAssets: number
      } | null = null
      if (reviewBeforeStorage && hasOkResults) {
        let draftErrorMessage: string | null = null
        try {
          createdDraftBatch = await createDraftsFromResults(out, fileLookup)
          if (createdDraftBatch?.batchId) {
            setReviewBatchId(createdDraftBatch.batchId)
          }
        } catch (err) {
          console.error("[quickIngest] Failed to create review drafts", err)
          draftErrorMessage = qi(
            "reviewDraftsFailedFallback",
            "Failed to create review drafts."
          )
        }
        if (!createdDraftBatch?.batchId) {
          const msg =
            draftErrorMessage ||
            qi("reviewDraftsFailedFallback", "Failed to create review drafts.")
          messageApi.error(msg)
          setDraftCreationError(msg)
          return
        }
      }

      if (processOnly && !reviewBeforeStorage && out.length > 0) {
        messageApi.info(
          qi(
            "processingComplete",
            "Processing complete. Use \"Download JSON\" below to save results locally."
          )
        )
      }
      if (out.length > 0) {
        const successCount = out.filter((r) => r.status === 'ok').length
        const failCount = out.length - successCount
        const summary = `${successCount} succeeded · ${failCount} failed`
        if (failCount > 0) messageApi.warning(summary)
        else messageApi.success(summary)
      }
      if (createdDraftBatch?.batchId) {
        await handleReviewBatchReady(createdDraftBatch)
      }
      // Successful run (even with some item-level failures) clears the global failure flag.
      clearFailure()
      setLastRunError(null)
    } catch (e: any) {
      const msg = e?.message || "Quick ingest failed."
      messageApi.error(msg)
      if (unmountedRef.current) {
        return
      }
      setRunning(false)
      setRunStartedAt(null)
      setLastRunError(msg)
      markFailure()
    }
  }, [
    advancedValues,
    clearFailure,
    common,
    createDraftsFromResults,
    handleReviewBatchReady,
    ingestBlocked,
    ingestConnectionStatus,
    attachedFiles,
    attachedFileStubs,
    fileForStubId,
    formatBytes,
    markFailure,
    messageApi,
    mergeDefaults,
    processOnly,
    qi,
    reviewBeforeStorage,
    rows,
    storeRemote,
    t,
    normalizedTypeDefaults,
    missingFileStubs.length
  ])

  const hasReviewableResults = React.useMemo(
    () => results.some((r) => r.status === "ok"),
    [results]
  )

  const retryDraftCreation = React.useCallback(async () => {
    if (draftCreationRetrying || running || !hasReviewableResults) return
    const fileLookup = lastFileLookupRef.current || new Map<string, File>()
    setDraftCreationRetrying(true)
    setDraftCreationError(null)
    try {
      const created = await createDraftsFromResults(results, fileLookup)
      if (unmountedRef.current) return
      if (!created?.batchId) {
        const msg = qi("reviewDraftsFailedFallback", "Failed to create review drafts.")
        messageApi.error(msg)
        setDraftCreationError(msg)
        return
      }
      setReviewBatchId(created.batchId)
      await handleReviewBatchReady(created)
    } catch (err) {
      console.error("[quickIngest] Failed to retry review draft creation", err)
      const msg = qi(
        "reviewDraftsFailedFallback",
        "Failed to create review drafts."
      )
      messageApi.error(msg)
      if (!unmountedRef.current) {
        setDraftCreationError(msg)
      }
    } finally {
      if (!unmountedRef.current) {
        setDraftCreationRetrying(false)
      }
    }
  }, [
    createDraftsFromResults,
    draftCreationRetrying,
    handleReviewBatchReady,
    hasReviewableResults,
    messageApi,
    qi,
    results,
    running
  ])

  const proceedWithoutReview = React.useCallback(() => {
    if (running) return
    // Signal that we want to re-run with storage after disabling review mode.
    pendingStoreWithoutReviewRef.current = true
    setDraftCreationError(null)
    setReviewBeforeStorage(false)
    setStoreRemote(true)
  }, [running, setReviewBeforeStorage, setStoreRemote])

  React.useEffect(() => {
    if (!open) {
      autoProcessedRef.current = false
      setReviewBatchId(null)
      setDraftCreationError(null)
      setDraftCreationRetrying(false)
      setReviewNavigationError(null)
      lastFileLookupRef.current = null
      lastFileIdByInstanceIdRef.current = null
      pendingStoreWithoutReviewRef.current = false
      return
    }
    if (autoProcessedRef.current) return
    if (!autoProcessQueued) return
    if (running || ingestBlocked || plannedCount <= 0) return
    autoProcessedRef.current = true
    void run()
  }, [autoProcessQueued, open, run, running, ingestBlocked, plannedCount])

  // Auto-run after "store without review" is triggered.
  React.useEffect(() => {
    if (!pendingStoreWithoutReviewRef.current) return
    if (reviewBeforeStorage) return
    // reviewBeforeStorage is now false, so re-run with storage enabled.
    pendingStoreWithoutReviewRef.current = false
    void run()
  }, [reviewBeforeStorage, run])

  const RECOMMENDED_FIELD_NAMES = new Set<string>([
    "cookies",
    "cookie",
    "headers",
    "custom_headers",
    "custom_cookies",
    "user_agent",
    "authorization",
    "auth_header",
    "embedding_model",
    "default_embedding_model",
    "context_strategy",
    "perform_chunking",
    "perform_analysis",
    "overwrite_existing",
    "system_prompt",
    "custom_prompt",
    "scrape_method",
    "crawl_strategy",
    "include_external",
    "score_threshold",
    "max_pages",
    "max_depth",
    "url_level"
  ])

  // Load OpenAPI schema to build advanced fields (best-effort)
  const logicalGroupForField = (name: string): string => {
    const n = name.toLowerCase()
    if (n.startsWith('transcription_') || ['diarize', 'vad_use', 'chunk_language'].includes(n)) return 'Transcription'
    if (n.startsWith('chunk_') || ['use_adaptive_chunking', 'enable_contextual_chunking', 'use_multi_level_chunking', 'perform_chunking', 'contextual_llm_model'].includes(n)) return 'Chunking'
    if (n.includes('embedding')) return 'Embeddings'
    if (n.startsWith('context_')) return 'Context'
    if (n.includes('summarization') || n.includes('analysis') || n === 'system_prompt' || n === 'custom_prompt') return 'Analysis/Summarization'
    if (n.includes('pdf') || n.includes('ocr')) return 'Document/PDF'
    if (n.includes('video')) return 'Video'
    if (n.includes('cookie') || n === 'cookies' || n === 'headers' || n === 'authorization' || n === 'auth_header' || n.includes('user_agent')) {
      return 'Cookies/Auth'
    }
    if (['author', 'title', 'keywords', 'api_name'].includes(n)) return 'Metadata'
    if (['start_time', 'end_time'].includes(n)) return 'Timing'
    return 'Other'
  }

  const isRecommendedField = (name: string, logicalGroup: string): boolean => {
    const n = name.toLowerCase()
    if (RECOMMENDED_FIELD_NAMES.has(n)) return true
    if (n.includes('embedding')) return true
    if (
      logicalGroup === 'Analysis/Summarization' &&
      (n.includes('summary') || n.includes('summarization') || n.includes('analysis'))
    ) {
      return true
    }
    return false
  }

  const iconForGroup = (group: string) => {
    const cls = 'w-4 h-4 mr-1 text-text-subtle'
    switch (group) {
      case 'Recommended':
        return <Star className={cls} />
      case 'Transcription':
        return <Headphones className={cls} />
      case 'Chunking':
        return <Layers className={cls} />
      case 'Embeddings':
        return <Database className={cls} />
      case 'Context':
        return <Layers className={cls} />
      case 'Analysis/Summarization':
        return <BookText className={cls} />
      case 'Document/PDF':
        return <FileText className={cls} />
      case 'Video':
        return <Film className={cls} />
      case 'Cookies/Auth':
        return <Cookie className={cls} />
      case 'Metadata':
        return <Info className={cls} />
      case 'Timing':
        return <Clock className={cls} />
      default:
        return <Grid className={cls} />
    }
  }

  const parseSpec = React.useCallback((spec: any) => {
    const getByRef = (ref: string): any => {
      // Handles refs like '#/components/schemas/MediaIngestRequest'
      if (!ref || typeof ref !== 'string' || !ref.startsWith('#/')) return null
      const parts = ref.slice(2).split('/')
      let cur: any = spec
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
        else return null
      }
      return cur
    }

    const resolveRef = (schema: any, seen = new Set<string>()): any => {
      if (!schema) return {}
      if (schema.$ref) {
        const ref = String(schema.$ref)
        if (seen.has(ref)) {
          return { type: 'string', description: 'Unresolvable schema cycle' }
        }
        seen.add(ref)
        const target = getByRef(ref)
        return target ? resolveRef(target, seen) : {}
      }
      return schema
    }

    const mergeProps = (schema: any, stack: WeakSet<object>, allowVisited = false): Record<string, any> => {
      const s = resolveRef(schema)
      let props: Record<string, any> = {}
      if (!s || typeof s !== 'object' || Array.isArray(s)) return props

      const already = stack.has(s as object)
      if (already && !allowVisited) return props

      if (!already) {
        stack.add(s as object)
      }

      try {
        // Merge from compositions
        for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
          if (Array.isArray((s as any)[key])) {
            for (const sub of (s as any)[key]) {
              props = { ...props, ...mergeProps(sub, stack) }
            }
          }
        }
        if ((s as any).properties && typeof (s as any).properties === 'object') {
          for (const [k, v] of Object.entries<any>((s as any).properties)) {
            props[k] = resolveRef(v)
          }
        }
        return props
      } finally {
        if (!already) {
          stack.delete(s as object)
        }
      }
    }

    const flattenProps = (obj: Record<string, any>, parent = '', stack: WeakSet<object>): Array<[string, any]> => {
      const out: Array<[string, any]> = []
      for (const [k, v0] of Object.entries<any>(obj || {})) {
        const v = resolveRef(v0)
        const name = parent ? `${parent}.${k}` : k
        const isObj = (v?.type === 'object' && v?.properties && typeof v.properties === 'object')
        if (isObj) {
          const node = v as unknown
          if (!node || typeof node !== 'object' || Array.isArray(node) || stack.has(node as object)) {
            out.push([name, v])
            continue
          }

          stack.add(node as object)
          try {
            const child = mergeProps(v, stack, true)
            out.push(...flattenProps(child, name, stack))
          } finally {
            stack.delete(node as object)
          }
        } else {
          out.push([name, v])
        }
      }
      return out
    }

    const extractSchemaFromPath = (paths: Record<string, any>, candidates: string[]) => {
      for (const candidate of candidates) {
        const entry = paths?.[candidate]
        const content = entry?.post?.requestBody?.content
        if (!content) continue
        const schemaSource =
          content['multipart/form-data'] ||
          content['application/x-www-form-urlencoded'] ||
          content['application/json'] ||
          {}
        const schema = schemaSource?.schema
        if (schema) return schema
      }
      return null
    }

    const extractEntriesFromSchema = (rootSchema: any) => {
      if (!rootSchema) return []
      const stack = new WeakSet<object>()
      const rootResolved = resolveRef(rootSchema)
      if (rootResolved && typeof rootResolved === 'object' && !Array.isArray(rootResolved)) {
        stack.add(rootResolved)
      }

      let props: Record<string, any> = {}
      let flat: Array<[string, any]> = []
      try {
        props = mergeProps(rootSchema, stack, true)
        flat = flattenProps(props, '', stack)
      } finally {
        if (rootResolved && typeof rootResolved === 'object' && !Array.isArray(rootResolved)) {
          stack.delete(rootResolved)
        }
      }

      const entries: AdvSchemaEntry[] = []
      // Expose all available ingestion-time options, except input list and media type selector which are handled above
      const exclude = new Set([ 'urls', 'media_type' ])
      for (const [name, def0] of flat) {
        if (exclude.has(name)) continue
        const def = resolveRef(def0)
        // Infer a reasonable type
        let type: string = 'string'
        if (def.type) type = Array.isArray(def.type) ? String(def.type[0]) : String(def.type)
        else if (def.enum) type = 'string'
        else if (def.anyOf || def.oneOf) type = 'string'
        const en = Array.isArray(def?.enum) ? def.enum : undefined
        const description = def?.description || def?.title || undefined
        entries.push({ name, type, enum: en, description, title: def?.title })
      }
      return entries
    }

    const mergeSchemaEntries = (...lists: AdvSchemaEntry[][]) => {
      const byName = new Map<string, AdvSchemaEntry>()
      for (const list of lists) {
        for (const entry of list) {
          const existing = byName.get(entry.name)
          if (!existing) {
            byName.set(entry.name, { ...entry })
            continue
          }
          byName.set(entry.name, {
            ...existing,
            ...entry,
            type: entry.type || existing.type,
            enum: entry.enum ?? existing.enum,
            description: entry.description ?? existing.description,
            title: entry.title ?? existing.title
          })
        }
      }
      return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
    }

    const paths = spec?.paths || {}
    const mediaAddSchema = extractSchemaFromPath(paths, [
      '/api/v1/media/add',
      '/api/v1/media/add/'
    ])
    const webScrapeSchema = extractSchemaFromPath(paths, [
      '/api/v1/media/process-web-scraping',
      '/api/v1/media/process-web-scraping/',
      '/process-web-scraping',
      '/process-web-scraping/'
    ])

    const mediaAddEntries = extractEntriesFromSchema(mediaAddSchema)
    const webScrapeEntries = extractEntriesFromSchema(webScrapeSchema)
    const merged = mergeSchemaEntries(mediaAddEntries, webScrapeEntries)
    setAdvSchema(merged)
    return merged
  }, [])

  const loadSpec = React.useCallback(
    async (
      preferServer = true,
      options: { reportDiff?: boolean; persist?: boolean; forceFetch?: boolean } = {}
    ) => {
      const { reportDiff = false, persist = false, forceFetch = false } = options
      let used: 'server' | 'fallback' | 'none' = 'none'
      let remote: any | null = null
      const prevSchema = reportDiff ? [...(advSchemaRef.current || [])] : null

      const cached = !forceFetch ? readSpecCache(preferServer) : null
      if (cached) {
        setAdvSchema(cached.entries)
        setSpecSource(cached.source)
        return cached.source
      }

      if (!preferServer) {
        setAdvSchema(QUICK_INGEST_SCHEMA_FALLBACK)
        used = 'fallback'
        writeSpecCache({
          entries: QUICK_INGEST_SCHEMA_FALLBACK,
          source: 'fallback',
          version: fallbackSchemaVersion
        })
        setSpecSource(used)
        return used
      }

      try {
        remote = await tldwClient.getOpenAPISpec()
      } catch (e) {
        console.debug(
          "[QuickIngest] Failed to load OpenAPI spec from server; using bundled fallback.",
          (e as any)?.message || e
        )
      }

      if (remote) {
        const nextSchema = parseSpec(remote)
        used = 'server'
        writeSpecCache({
          entries: nextSchema,
          source: 'server',
          version: remote?.info?.version
        })

        try {
          const rVer = remote?.info?.version
          const prevVersion = specPrefs?.lastRemote?.version
          const prevCachedAt = specPrefs?.lastRemote?.cachedAt
          const now = Date.now()
          const shouldReuseCachedAt =
            prevVersion && prevVersion === rVer && typeof prevCachedAt === 'number'

          // For background auto-loads (persist === false), skip writing to
          // extension storage entirely to avoid hitting MAX_WRITE_OPERATIONS_PER_MINUTE.
          // We only persist when the user explicitly reloads or toggles settings.
          if (persist) {
            const payload = {
              ...(specPrefs || {}),
              preferServer: true,
              lastRemote: {
                version: rVer,
                cachedAt: shouldReuseCachedAt ? prevCachedAt : now
              }
            }
            // Log approximate size of what we persist for debugging quota issues
            try {
              const approxSize = JSON.stringify(payload).length
              // eslint-disable-next-line no-console
              console.info(
                "[QuickIngest] Persisting quickIngestSpecPrefs (~%d bytes)",
                approxSize
              )
            } catch (e) {
              console.debug(
                "[QuickIngest] Failed to estimate quickIngestSpecPrefs size:",
                (e as any)?.message || e
              )
            }
            persistSpecPrefs(payload)
          }
        } catch (e) {
          console.debug(
            "[QuickIngest] Failed to persist OpenAPI spec metadata:",
            (e as any)?.message || e
          )
        }

        if (reportDiff) {
          let added = 0
          let removed = 0
          try {
            const beforeNames = new Set((prevSchema || []).map((f) => f.name))
            const afterNames = new Set((nextSchema || []).map((f) => f.name))
            for (const name of afterNames) {
              if (!beforeNames.has(name)) added += 1
            }
            for (const name of beforeNames) {
              if (!afterNames.has(name)) removed += 1
            }
          } catch (e) {
            console.debug(
              "[QuickIngest] Failed to compute OpenAPI field diff:",
              (e as any)?.message || e
            )
            // Fall back to generic message if diff computation fails
          }
          messageApi.success(
            added || removed
              ? qi(
                  'specReloadedToastDiff',
                  'Advanced spec reloaded from server (fields added: {{added}}, removed: {{removed}})',
                  { added, removed }
                )
              : qi('specReloadedToast', 'Advanced spec reloaded from server')
          )
        }
      } else {
        // Use extracted schema fallback (no bundled openapi.json import)
        setAdvSchema(QUICK_INGEST_SCHEMA_FALLBACK)
        used = 'fallback'
        writeSpecCache({
          entries: QUICK_INGEST_SCHEMA_FALLBACK,
          source: 'fallback',
          version: fallbackSchemaVersion
        })

        // Warn when falling back to a bundled schema that may be stale.
        if (reportDiff) {
          messageApi.warning(
            qi(
              'specFallbackWarning',
              'Using bundled media.add schema fallback (v{{version}}); please verify against your tldw_server /openapi.json if fields look outdated.',
              { version: fallbackSchemaVersion }
            )
          )
        }
      }

      setSpecSource(used)
      return used
    },
    [persistSpecPrefs, specPrefs, messageApi, fallbackSchemaVersion, parseSpec, qi]
  )

  React.useEffect(() => {
    specPrefsCacheRef.current = JSON.stringify(specPrefs || {})
  }, [specPrefs])

  React.useEffect(() => {
    advSchemaRef.current = advSchema
  }, [advSchema])

  const preferServerSpec =
    typeof specPrefs?.preferServer === 'boolean' ? specPrefs.preferServer : true

  React.useEffect(() => {
    if (!open) return
    void (async () => {
      await loadSpec(preferServerSpec)
    })()
  }, [loadSpec, open, preferServerSpec])

  React.useEffect(() => {
    if (!open || ingestConnectionStatus !== "online") {
      setTranscriptionModelsLoading(false)
      if (ingestConnectionStatus !== "online") {
        setTranscriptionModelOptions([])
      }
      return
    }
    let cancelled = false
    const fetchModels = async () => {
      setTranscriptionModelsLoading(true)
      try {
        const res = await tldwClient.getTranscriptionModels()
        const all = Array.isArray(res?.all_models) ? res.all_models : []
        const seen = new Set<string>()
        const unique: string[] = []
        for (const model of all) {
          const value = String(model)
          if (!value || seen.has(value)) continue
          seen.add(value)
          unique.push(value)
        }
        if (!cancelled) setTranscriptionModelOptions(unique)
      } catch (e) {
        if ((import.meta as any)?.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn("Failed to load transcription models for Quick Ingest", e)
        }
      } finally {
        if (!cancelled) setTranscriptionModelsLoading(false)
      }
    }
    fetchModels()
    return () => {
      cancelled = true
      setTranscriptionModelsLoading(false)
    }
  }, [ingestConnectionStatus, open])

  React.useEffect(() => {
    lastSavedAdvValuesRef.current = JSON.stringify(savedAdvValues || {})
  }, [savedAdvValues])

  React.useEffect(() => {
    lastSavedUiPrefsRef.current = JSON.stringify(uiPrefs || {})
  }, [uiPrefs])

  // Load persisted advanced values on mount (once)
  React.useEffect(() => {
    if (advancedHydratedRef.current) return
    advancedHydratedRef.current = true
    if (savedAdvValues && typeof savedAdvValues === 'object') {
      setAdvancedValues((prev) => ({ ...prev, ...savedAdvValues }))
    }
  }, [savedAdvValues, advancedHydratedRef])

  // Restore UI prefs for Advanced section and details (once)
  React.useEffect(() => {
    if (uiPrefsHydratedRef.current) return
    uiPrefsHydratedRef.current = true
    if (uiPrefs?.advancedOpen !== undefined) setAdvancedOpen(Boolean(uiPrefs.advancedOpen))
    if (uiPrefs?.fieldDetailsOpen && typeof uiPrefs.fieldDetailsOpen === 'object') setFieldDetailsOpen(uiPrefs.fieldDetailsOpen)
  }, [uiPrefs])

  // Persist UI prefs
  React.useEffect(() => {
    const id = setTimeout(() => {
      const nextPrefs = { advancedOpen, fieldDetailsOpen }
      const serialized = JSON.stringify(nextPrefs)
      if (lastSavedUiPrefsRef.current === serialized) return
      lastSavedUiPrefsRef.current = serialized
      try { setUiPrefs(nextPrefs) } catch {}
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [SAVE_DEBOUNCE_MS, advancedOpen, fieldDetailsOpen, setUiPrefs])

  const openOptionsRoute = React.useCallback((hash: OptionsHash) => {
    try {
      const path = window.location.pathname || ""
      if (path.includes("options.html")) {
        window.location.hash = hash
        return
      }
      try {
        const url = browser.runtime.getURL(`/options.html${hash}`)
        if (browser?.tabs?.create) {
          browser.tabs.create({ url })
        } else {
          window.open(url, "_blank")
        }
        return
      } catch {
        // fall through to a plain window.open below
      }
      window.open(`/options.html${hash}`, "_blank")
    } catch {
      // best-effort; avoid throwing from modal
    }
  }, [])

  const openHealthDiagnostics = React.useCallback(() => {
    openOptionsRoute("#/settings/health")
  }, [openOptionsRoute])

  const openModelSettings = React.useCallback(() => {
    openOptionsRoute("#/settings/model")
  }, [openOptionsRoute])

  const downloadBlobAsJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadJson = (item: ResultItem) => {
    downloadBlobAsJson(item.data ?? {}, "processed.json")
  }

  const downloadResultsJson = () => {
    if (!results.length) return
    downloadBlobAsJson(results, "quick-ingest-results.json")
  }

  const openInMediaViewer = (item: ResultItem) => {
    try {
      const id = mediaIdFromPayload(item.data)
      if (id == null) {
        return
      }
      const idStr = String(id)
      void setSetting(LAST_MEDIA_ID_SETTING, idStr)
      openOptionsRoute("#/media-multi")
    } catch {
      // best-effort — do not crash modal
    }
  }

  const discussInChat = (item: ResultItem) => {
    try {
      const id = mediaIdFromPayload(item.data)
      if (id == null) {
        return
      }
      let sourceUrl: string | undefined
      if (item.data && typeof item.data === "object" && !Array.isArray(item.data)) {
        const payload = item.data as Record<string, unknown>
        sourceUrl =
          typeof payload.url === "string"
            ? payload.url
            : typeof payload.source_url === "string"
              ? payload.source_url
              : undefined
      }
      const payload = {
        mediaId: String(id),
        url: item.url || sourceUrl
      }
      void setSetting(DISCUSS_MEDIA_PROMPT_SETTING, payload)
      try {
        window.dispatchEvent(
          new CustomEvent("tldw:discuss-media", { detail: payload })
        )
      } catch {
        // ignore event errors
      }
      openOptionsRoute("#/")
    } catch {
      // swallow errors; logging not needed here
    }
  }

  const hasAudioItems = React.useMemo(
    () =>
      rows.some(
        (r) =>
          r.type === "audio" ||
          (r.type === "auto" && inferIngestTypeFromUrl(r.url) === "audio")
      ) ||
      queuedFileStubs.some((stub) => fileTypeFromName(stub) === "audio"),
    [fileTypeFromName, queuedFileStubs, rows]
  )

  const hasDocumentItems = React.useMemo(
    () =>
      rows.some(
        (r) =>
          r.type === "document" ||
          r.type === "pdf" ||
          (r.type === "auto" &&
            ["document", "pdf"].includes(inferIngestTypeFromUrl(r.url)))
      ) ||
      queuedFileStubs.some((stub) =>
        ["document", "pdf"].includes(fileTypeFromName(stub))
      ),
    [fileTypeFromName, queuedFileStubs, rows]
  )

  const hasVideoItems = React.useMemo(
    () =>
      rows.some(
        (r) =>
          r.type === "video" ||
          (r.type === "auto" && inferIngestTypeFromUrl(r.url) === "video")
      ) ||
      queuedFileStubs.some((stub) => fileTypeFromName(stub) === "video"),
    [fileTypeFromName, queuedFileStubs, rows]
  )

  const selectedRow = React.useMemo(
    () => rows.find((r) => r.id === selectedRowId) || null,
    [rows, selectedRowId]
  )

  const selectedFileStub = React.useMemo(
    () => queuedFileStubs.find((f) => f.id === selectedFileId) || null,
    [queuedFileStubs, selectedFileId]
  )

  const selectedFile = React.useMemo(() => {
    if (!selectedFileStub) return null
    return fileForStubId.get(selectedFileStub.id) || null
  }, [fileForStubId, selectedFileStub])
  const requestFileReattach = React.useCallback((stubId: string) => {
    setPendingReattachId(stubId)
    if (reattachInputRef.current) {
      reattachInputRef.current.click()
    }
  }, [setPendingReattachId])
  const handleReattachSelectedFile = React.useCallback(() => {
    if (!selectedFileStub) return
    requestFileReattach(selectedFileStub.id)
  }, [requestFileReattach, selectedFileStub])

  // Keep intro hidden if user dismissed previously
  React.useEffect(() => {
    if (inspectorIntroDismissed) {
      setShowInspectorIntro(false)
    }
  }, [inspectorIntroDismissed])

  // Track whether the Inspector has been used at least once so we can
  // tune future onboarding copy, but avoid auto-opening it so the queue
  // stays visually dominant until the user explicitly opts in.
  React.useEffect(() => {
    if ((selectedRow || selectedFileStub) && inspectorOpen && !hasOpenedInspector) {
      setHasOpenedInspector(true)
    }
  }, [hasOpenedInspector, inspectorOpen, selectedFileStub, selectedRow])

  React.useEffect(() => {
    setSelectedFileId((prev) => {
      if (queuedFileStubs.length === 0) return null
      if (prev && queuedFileStubs.some((f) => f.id === prev)) return prev
      return queuedFileStubs[0].id
    })

    if (selectedRowId && rows.some((r) => r.id === selectedRowId)) {
      return
    }
    if (rows.length > 0) {
      setSelectedRowId(rows[0].id)
      setSelectedFileId(null)
      return
    }
  }, [queuedFileStubs, rows, selectedRowId])

  React.useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setProgressTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const progressMeta = React.useMemo(() => {
    const total = liveTotalCount || totalPlanned || 0
    const done = processedCount || results.length || 0
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    const elapsedMs = runStartedAt ? Date.now() - runStartedAt : 0
    const elapsedLabel =
      elapsedMs > 0
        ? `${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`
        : null
    return { total, done, pct, elapsedLabel }
  }, [liveTotalCount, processedCount, progressTick, results.length, runStartedAt, totalPlanned])

  const doneCount = processedCount || results.length || 0
  const totalCount = liveTotalCount || totalPlanned || 0
  const missingFileCount = missingFileStubs.length
  const draftStorageCapLabel = formatBytes(DRAFT_STORAGE_CAP_BYTES)
  const resultsWithOutcome = React.useMemo(() => {
    if (!results || results.length === 0) return results
    return results.map((item) => ({
      ...item,
      outcome: deriveResultOutcome(item)
    }))
  }, [deriveResultOutcome, results])

  const resultSummary = React.useMemo(() => {
    if (!results || results.length === 0) {
      return null
    }
    const successCount = results.filter((r) => r.status === "ok").length
    const failCount = results.length - successCount
    return { successCount, failCount }
  }, [results])

  const storageLabel = React.useMemo(() => {
    if (!storeRemote) {
      return qi('process', 'Process locally')
    }
    if (reviewBeforeStorage) {
      return qi("storeAfterReview", "Store after review")
    }
    return qi('storeRemote', 'Store to remote DB')
  }, [qi, reviewBeforeStorage, storeRemote])

  const firstResultWithMedia = React.useMemo(
    () =>
      results.find(
        (r) => r.status === "ok" && mediaIdFromPayload(r.data)
      ),
    [results]
  )

  const [resultsFilter, setResultsFilter] =
    React.useState<ResultsFilter>(RESULT_FILTERS.ALL)

  const visibleResults = React.useMemo(() => {
    let items = resultsWithOutcome || []
    if (resultsFilter === RESULT_FILTERS.SUCCESS) {
      items = items.filter((r) => r.status === "ok")
    } else if (resultsFilter === RESULT_FILTERS.ERROR) {
      items = items.filter((r) => r.status === "error")
    }
    const ranked = [...items].sort((a, b) => {
      const rank = (s: ResultItem["status"]) =>
        s === "error" ? 0 : s === "ok" ? 1 : 2
      return rank(a.status) - rank(b.status)
    })
    return ranked
  }, [resultsFilter, resultsWithOutcome])

  const specSourceLabel = React.useMemo(() => {
    if (specSource === 'server') {
      return qi('specSourceLive', 'Live server spec')
    }
    if (specSource === 'fallback') {
      return qi('specSourceFallback', 'Fallback spec')
    }
    return null
  }, [qi, specSource])

  const resolvedAdvSchema = React.useMemo(() => {
    if (transcriptionModelOptions.length === 0) return advSchema
    return advSchema.map((field) =>
      field.name === "transcription_model"
        ? { ...field, enum: transcriptionModelOptions }
        : field
    )
  }, [advSchema, transcriptionModelOptions])
  const transcriptionModelChoices = React.useMemo(() => {
    const fallbackField = advSchema.find(
      (field) => field.name === "transcription_model"
    )
    const fallbackEnum = Array.isArray(fallbackField?.enum)
      ? fallbackField.enum.map((value) => String(value))
      : []
    const source =
      transcriptionModelOptions.length > 0
        ? transcriptionModelOptions
        : fallbackEnum
    const seen = new Set<string>()
    return source.reduce<string[]>((acc, value) => {
      const normalized = String(value)
      if (!normalized || seen.has(normalized)) return acc
      seen.add(normalized)
      acc.push(normalized)
      return acc
    }, [])
  }, [advSchema, transcriptionModelOptions])
  const transcriptionModelValue = React.useMemo(() => {
    const value = advancedValues?.transcription_model
    if (value === undefined || value === null || value === "") {
      return undefined
    }
    return String(value)
  }, [advancedValues])

  const setAdvancedValue = React.useCallback((name: string, value: any) => {
    setAdvancedValues((prev) => {
      const next = { ...(prev || {}) }
      if (value === undefined || value === null || value === '') {
        delete next[name]
      } else {
        next[name] = value
      }
      return next
    })
  }, [])
  const handleTranscriptionModelChange = React.useCallback(
    (value?: string) => {
      setAdvancedValue("transcription_model", value)
    },
    [setAdvancedValue]
  )

  const addLocalFiles = React.useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return
      if (ingestBlocked) {
        messageApi.warning(
          qi("queueBlocked", "Connect to your server to add items.")
        )
        return
      }
      const defaultsSnapshot = createDefaultsSnapshot()
      const attachedInstanceIds = new Set(
        localFiles.map((file) => getFileInstanceId(file))
      )
      const stubsByKey = new Map<string, QueuedFileStub[]>()
      for (const stub of queuedFiles || []) {
        const list = stubsByKey.get(stub.key) || []
        list.push(stub)
        stubsByKey.set(stub.key, list)
      }
      const claimedStubIds = new Set<string>()
      const seenInstanceIds = new Set<string>()
      const accepted: File[] = []
      const newStubs: QueuedFileStub[] = []
      const updatedStubs: Array<{ id: string; instanceId: string }> = []
      const skipped: string[] = []
      let firstSelectedId: string | null = null

      for (const file of incoming) {
        const name = file?.name || ""
        const instanceId = getFileInstanceId(file)
        if (seenInstanceIds.has(instanceId) || attachedInstanceIds.has(instanceId)) {
          skipped.push(name || "Unnamed file")
          continue
        }
        seenInstanceIds.add(instanceId)
        const key = buildLocalFileKey(file)
        const candidates = stubsByKey.get(key) || []
        const existingStub = candidates.find((stub) => {
          if (claimedStubIds.has(stub.id)) return false
          if (stub.instanceId && attachedInstanceIds.has(stub.instanceId)) return false
          return true
        })
        if (existingStub) {
          claimedStubIds.add(existingStub.id)
          accepted.push(file)
          if (existingStub.instanceId !== instanceId) {
            updatedStubs.push({ id: existingStub.id, instanceId })
          }
          if (!firstSelectedId) firstSelectedId = existingStub.id
          continue
        }
        const stub = buildQueuedFileStub(file, defaultsSnapshot)
        newStubs.push(stub)
        accepted.push(file)
        if (!firstSelectedId) firstSelectedId = stub.id
      }

      if (skipped.length > 0) {
        const uniqueNames = Array.from(new Set(skipped))
        const label = uniqueNames.slice(0, 3).join(", ")
        const suffix = uniqueNames.length > 3 ? "..." : ""
        messageApi.warning(
          qi(
            "duplicateFiles",
            "Skipped {{count}} duplicate file(s): {{names}}",
            {
              count: skipped.length,
              names: `${label}${suffix}`
            }
          )
        )
      }

      if (newStubs.length > 0 || updatedStubs.length > 0) {
        setQueuedFiles((prev) => {
          const base = prev || []
          let changed = false
          const updates = new Map(
            updatedStubs.map((item) => [item.id, item.instanceId])
          )
          const next = base.map((stub) => {
            const nextInstanceId = updates.get(stub.id)
            if (!nextInstanceId || stub.instanceId === nextInstanceId) return stub
            changed = true
            return { ...stub, instanceId: nextInstanceId }
          })
          if (newStubs.length > 0) {
            changed = true
            return [...next, ...newStubs]
          }
          return changed ? next : prev
        })
      }
      if (accepted.length === 0) return
      setLocalFiles((prev) => [...prev, ...accepted])
      if (firstSelectedId) {
        setSelectedFileId(firstSelectedId)
      }
      setSelectedRowId(null)
    },
    [
      createDefaultsSnapshot,
      ingestBlocked,
      localFiles,
      messageApi,
      qi,
      queuedFiles,
      setQueuedFiles
    ]
  )

  const handleReattachChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.currentTarget.value = ''
      const stubId = pendingReattachId
      setPendingReattachId(null)
      if (!file || !stubId) return
      const stub = queuedFileStubs.find((item) => item.id === stubId)
      if (!stub) return
      const instanceId = getFileInstanceId(file)
      if (buildLocalFileKey(file) !== stub.key) {
        messageApi.error(
          qi(
            "reattachMismatch",
            "That file does not match {{name}}. Choose the original file or remove this item.",
            { name: stub.name || "this file" }
          )
        )
        return
      }
      setLocalFiles((prev) => {
        if (
          stub.instanceId &&
          prev.some((existing) => getFileInstanceId(existing) === stub.instanceId)
        ) {
          return prev
        }
        return [...prev, file]
      })
      if (stub.instanceId !== instanceId) {
        setQueuedFiles((prev) => {
          if (!prev) return prev
          return prev.map((item) =>
            item.id === stub.id ? { ...item, instanceId } : item
          )
        })
      }
      setSelectedFileId(stub.id)
      setSelectedRowId(null)
      messageApi.success(
        qi("reattachSuccess", "Reattached {{name}}.", {
          name: stub.name || "file"
        })
      )
    },
    [
      messageApi,
      pendingReattachId,
      qi,
      queuedFileStubs,
      setLocalFiles,
      setQueuedFiles,
      setSelectedFileId,
      setSelectedRowId
    ]
  )

  const handleFileDrop = React.useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault()
      ev.stopPropagation()
      const files = Array.from(ev.dataTransfer?.files || [])
      addLocalFiles(files)
    },
    [addLocalFiles]
  )

  const handleModalDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (activeTab !== "queue" && event.dataTransfer) {
        event.dataTransfer.dropEffect = "none"
      }
    },
    [activeTab]
  )

  const handleModalDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (activeTab !== "queue") {
        event.stopPropagation()
      }
    },
    [activeTab]
  )

  const retryFailedUrls = React.useCallback(() => {
    const failedByUrl = results.filter((r) => r.status === "error" && r.url)
    const rowsById = new Map(rows.map((row) => [row.id, row]))
    const rowsByUrl = new Map(rows.map((row) => [row.url.trim(), row]))
    const failedUrls = failedByUrl.map((r) => {
      const key = (r.url || "").trim()
      const existing =
        (r.id && rowsById.get(r.id)) || (key ? rowsByUrl.get(key) : undefined)
      if (existing) {
        return {
          ...existing,
          id: crypto.randomUUID(),
          defaults: existing.defaults || createDefaultsSnapshot()
        }
      }
      return buildRowEntry(r.url || "", "auto")
    })
    if (failedUrls.length === 0) {
      messageApi.info(qi("noFailedUrlToRetry", "No failed URL items to retry."))
      return
    }
    setRows(failedUrls)
    setQueuedFiles([])
    setLocalFiles([])
    setResults([])
    setProcessedCount(0)
    setTotalPlanned(failedUrls.length)
    setLiveTotalCount(failedUrls.length)
    setRunStartedAt(null)
    messageApi.info(
      qi(
        "queuedFailedUrls",
        "Queued {{count}} failed URL(s) to retry.",
        { count: failedUrls.length }
      )
    )
  }, [
    buildRowEntry,
    createDefaultsSnapshot,
    messageApi,
    qi,
    results,
    rows,
    setQueuedFiles
  ])

  const requeueFailed = React.useCallback(() => {
    const failedItems = results.filter((r) => r.status === "error")
    const rowsById = new Map(rows.map((row) => [row.id, row]))
    const rowsByUrl = new Map(rows.map((row) => [row.url.trim(), row]))
    const fileIdByInstanceId = lastFileIdByInstanceIdRef.current
    const fileIdToStub = new Map<string, QueuedFileStub>()
    if (fileIdByInstanceId) {
      for (const stub of queuedFileStubs) {
        if (!stub.instanceId) continue
        const fileId = fileIdByInstanceId.get(stub.instanceId)
        if (fileId) fileIdToStub.set(fileId, stub)
      }
    }
    const stubsByName = new Map<string, QueuedFileStub[]>()
    for (const stub of queuedFileStubs) {
      const name = stub.name || ""
      if (!name) continue
      const list = stubsByName.get(name) || []
      list.push(stub)
      stubsByName.set(name, list)
    }

    const failedUrls: Entry[] = []
    const failedFileStubs: QueuedFileStub[] = []
    let failedFileCount = 0

    for (const item of failedItems) {
      if (item.url) {
        const key = (item.url || "").trim()
        const existing =
          (item.id && rowsById.get(item.id)) ||
          (key ? rowsByUrl.get(key) : undefined)
        if (existing) {
          failedUrls.push({
            ...existing,
            id: crypto.randomUUID(),
            defaults: existing.defaults || createDefaultsSnapshot()
          })
        } else {
          failedUrls.push(buildRowEntry(item.url || "", "auto"))
        }
        continue
      }
      if (item.fileName) {
        failedFileCount += 1
        const byId = item.id ? fileIdToStub.get(item.id) : undefined
        const byName = stubsByName.get(item.fileName) || []
        const existingStub =
          byId || (byName.length === 1 ? byName[0] : undefined)
        if (existingStub) {
          failedFileStubs.push({
            ...existingStub,
            id: crypto.randomUUID(),
            defaults:
              existingStub.defaults || createDefaultsSnapshot()
          })
        }
      }
    }

    if (failedUrls.length === 0 && failedFileCount === 0) {
      messageApi.info(qi("noFailedToRequeue", "No failed items to requeue."))
      return
    }

    // Add URLs back to queue
    if (failedUrls.length > 0) {
      setRows((prev) => [...prev, ...failedUrls])
    }
    if (failedFileStubs.length > 0) {
      setQueuedFiles((prev) => [...(prev || []), ...failedFileStubs])
    }
    setResults([])

    const message = failedFileCount > 0
      ? qi(
          "requeuedFailedWithFiles",
          "Requeued {{urlCount}} URL(s). Re-upload {{fileCount}} file(s) if needed.",
          { urlCount: failedUrls.length, fileCount: failedFileCount }
        )
      : qi(
          "requeuedFailed",
          "Requeued {{count}} failed item(s).",
          { count: failedUrls.length }
        )
    messageApi.success(message)
  }, [
    buildRowEntry,
    createDefaultsSnapshot,
    messageApi,
    qi,
    queuedFileStubs,
    results,
    rows,
    setQueuedFiles
  ])

  const exportFailedList = React.useCallback(() => {
    const failedItems = results.filter((r) => r.status === "error")
    const lines = failedItems.map((item) => {
      if (item.url) return `URL: ${item.url}`
      if (item.fileName) return `File: ${item.fileName}`
      return `Unknown: ${item.id}`
    })

    if (lines.length === 0) {
      messageApi.info(qi("noFailedToExport", "No failed items to export."))
      return
    }

    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      messageApi.success(
        qi("exportedToClipboard", "Copied {{count}} failed item(s) to clipboard.", {
          count: lines.length
        })
      )
    }).catch(() => {
      // Fallback: download as file
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'failed-items.txt'
      a.click()
      URL.revokeObjectURL(url)
      messageApi.success(
        qi("exportedToFile", "Downloaded {{count}} failed item(s) as file.", {
          count: lines.length
        })
      )
    })
  }, [messageApi, qi, results])

  const confirmReplaceQueue = React.useCallback(
    async (otherCount: number) => {
      if (otherCount <= 0) return true
      return await confirmDanger({
        title: qi("retryReplaceQueueTitle", "Replace current queue?"),
        content: qi(
          "retryReplaceQueueBody",
          "Retrying this item will replace the current queue and remove {{count}} other item(s). Continue?",
          { count: otherCount }
        ),
        okText: qi("retryReplaceQueueConfirm", "Replace and retry"),
        cancelText: qi("cancel", "Cancel"),
        danger: false
      })
    },
    [confirmDanger, qi]
  )

  const resetQueueForRetry = React.useCallback(
    (nextRows: Entry[], nextFiles: File[], message: string) => {
      const defaultsSnapshot = createDefaultsSnapshot()
      const nextFileStubs = nextFiles.map((file) =>
        buildQueuedFileStub(file, defaultsSnapshot)
      )
      setRows(nextRows)
      setQueuedFiles(nextFileStubs)
      setLocalFiles(nextFiles)
      setSelectedRowId(nextRows[0]?.id ?? null)
      setSelectedFileId(nextFileStubs[0]?.id ?? null)
      setResults([])
      setProcessedCount(0)
      const total =
        nextRows.filter((r) => r.url.trim().length > 0).length +
        nextFiles.length
      setTotalPlanned(total)
      setLiveTotalCount(total)
      setRunStartedAt(null)
      if (message) {
        messageApi.info(message)
      }
    },
    [createDefaultsSnapshot, messageApi, setQueuedFiles, setRows]
  )

  const retrySingleRow = React.useCallback(
    async (row: Entry) => {
      if (running) return
      const totalItems =
        rows.filter((r) => r.url.trim().length > 0).length +
        queuedFileStubs.length
      const otherCount = totalItems - (row.url.trim() ? 1 : 0)
      const ok = await confirmReplaceQueue(otherCount)
      if (!ok) return
      const nextRow = { ...row, id: crypto.randomUUID() }
      resetQueueForRetry(
        [nextRow],
        [],
        qi("queuedRetrySingle", "Queued 1 item to retry. Click Run to start.")
      )
    },
    [confirmReplaceQueue, qi, queuedFileStubs.length, resetQueueForRetry, rows, running]
  )

  const retrySingleFile = React.useCallback(
    async (file: File) => {
      if (running) return
      const totalItems =
        rows.filter((r) => r.url.trim().length > 0).length +
        queuedFileStubs.length
      const otherCount = Math.max(0, totalItems - 1)
      const ok = await confirmReplaceQueue(otherCount)
      if (!ok) return
      resetQueueForRetry(
        [],
        [file],
        qi(
          "queuedRetryFile",
          "Queued {{name}} for retry. Click Run to start.",
          { name: file.name || "file" }
        )
      )
    },
    [confirmReplaceQueue, qi, queuedFileStubs.length, resetQueueForRetry, rows, running]
  )

  // Live progress updates from background batch processor
  React.useEffect(() => {
    const handler = (message: any) => {
      if (!message || message.type !== "tldw:quick-ingest-progress") return
      const payload = message.payload || {}
      const result = payload.result as ResultItem | undefined
      if (typeof payload.processedCount === "number") {
        setProcessedCount(payload.processedCount)
        if (
          typeof payload.totalCount === "number" &&
          payload.processedCount >= payload.totalCount
        ) {
          setRunning(false)
          setRunStartedAt(null)
        }
      }
      if (typeof payload.totalCount === "number") {
        setLiveTotalCount(payload.totalCount)
        setTotalPlanned(payload.totalCount)
      }
      if (!result || !result.id) return

      setResults((prev) => {
        const map = new Map<string, ResultItem>()
        for (const r of prev) {
          if (r.id) map.set(r.id, r)
        }
        const existing = map.get(result.id)
        map.set(result.id, { ...(existing || {}), ...result })
        return Array.from(map.values())
      })
    }

    try {
      if (browser?.runtime?.onMessage?.addListener) {
        browser.runtime.onMessage.addListener(handler)
      }
    } catch {}

    return () => {
      try {
        if (browser?.runtime?.onMessage?.removeListener) {
          browser.runtime.onMessage.removeListener(handler)
        }
      } catch {}
    }
  }, [])

  React.useEffect(() => {
    const forceIntro = () => {
      setShowInspectorIntro(true)
      setInspectorOpen(true)
      try {
        setInspectorIntroDismissed(false)
      } catch {}
    }
    window.addEventListener('tldw:quick-ingest-force-intro', forceIntro)
    return () => window.removeEventListener('tldw:quick-ingest-force-intro', forceIntro)
  }, [setInspectorIntroDismissed])

  React.useEffect(() => {
    if (!open) return
    window.dispatchEvent(new CustomEvent("tldw:quick-ingest-ready"))
  }, [open])

  // Simplified connection states: Ready, Not Connected, or Configuring
  const isOnlineForIngest = ingestConnectionStatus === "online"
  const isConfiguring = ingestConnectionStatus === "unknown"
  let connectionBannerTitle: string | null = null
  let connectionBannerBody: string | null = null

  if (!isOnlineForIngest) {
    if (isConfiguring) {
      connectionBannerTitle = t(
        "quickIngest.connectingTitle",
        "Checking connection..."
      )
      connectionBannerBody = t(
        "quickIngest.connectingBody",
        "Verifying your tldw server is reachable."
      )
    } else {
      connectionBannerTitle = t(
        "quickIngest.notConnectedTitle",
        "Not connected to server"
      )
      connectionBannerBody = t(
        "quickIngest.notConnectedBody",
        "Configure your server to process content. Inputs are disabled until connected."
      )
    }
  }

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <span>
            {t('quickIngest.title', 'Quick Ingest')}
            {plannedCount > 0 && (
              <span className="ml-1.5 text-text-muted font-normal text-sm">
                ({plannedCount})
              </span>
            )}
          </span>
          <Button
            size="small"
            type="text"
            icon={<HelpCircle className="w-4 h-4" />}
            aria-label={qi('openInspectorIntro', 'Open Inspector intro')}
            title={qi('openInspectorIntro', 'Open Inspector intro')}
            onClick={() => {
              setShowInspectorIntro(true)
              try { setInspectorIntroDismissed(false) } catch {}
              setInspectorOpen(true)
            }}
          />
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      style={{ maxWidth: "calc(100vw - 32px)" }}
      destroyOnHidden
      rootClassName="quick-ingest-modal"
      maskClosable={!running}
    >
      {contextHolder}
      <div
        className="relative"
        data-state={modalReady ? 'ready' : 'loading'}
        onDragOver={handleModalDragOver}
        onDrop={handleModalDrop}
      >
      {/* Tab Navigation */}
      <QuickIngestTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badges={tabBadges}
      />

      <Space direction="vertical" className="w-full">
        {/* Connection/Onboarding banners shown on all tabs */}
        {!isOnlineForIngest && connectionBannerTitle && (
          <div className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            <div className="font-medium">{connectionBannerTitle}</div>
            {connectionBannerBody && (
              <div className="mt-0.5">{connectionBannerBody}</div>
            )}
            {!isConfiguring && (
              <Button
                size="small"
                className="mt-2"
                onClick={openHealthDiagnostics}
              >
                {t("quickIngest.configureServer", "Configure server")}
              </Button>
            )}
          </div>
        )}
        {!onboardingDismissed && isOnlineForIngest && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-text">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium mb-1">
                  {qi("onboardingTitle", "Add content to your knowledge base")}
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-text-muted">
                  <li>{qi("onboardingStep1", "Paste URLs or drop files above")}</li>
                  <li>{qi("onboardingStep2", "Configure options (or use defaults)")}</li>
                  <li>{qi("onboardingStep3", "Click Process to start ingestion")}</li>
                </ul>
              </div>
              <Button
                type="text"
                size="small"
                icon={<X className="w-3.5 h-3.5" />}
                onClick={() => {
                  try { setOnboardingDismissed(true) } catch {}
                }}
                aria-label={qi("dismissOnboarding", "Dismiss onboarding")}
              />
            </div>
          </div>
        )}
        {lastRunError && (
          <div className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <div className="font-medium">
              {t(
                "quickIngest.errorSummary",
                "We couldn’t process ingest items right now."
              )}
            </div>
            <div className="mt-1">
              {t(
                "quickIngest.errorHint",
                "Try again after checking your tldw server. Health & diagnostics can help troubleshoot ingest issues."
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="small"
                type="primary"
                onClick={openHealthDiagnostics}
                data-testid="quick-ingest-open-health"
              >
                {t(
                  "settings:healthSummary.diagnostics",
                  "Health & diagnostics"
                )}
              </Button>
              <Typography.Text className="text-[11px] text-danger">
                {lastRunError}
              </Typography.Text>
            </div>
          </div>
        )}
        {draftCreationError && (
          <div className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <div className="font-medium">
              {qi(
                "reviewDraftsFailedTitle",
                "Review drafts couldn't be created."
              )}
            </div>
            <div className="mt-1">{draftCreationError}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="small"
                type="primary"
                onClick={retryDraftCreation}
                loading={draftCreationRetrying}
                disabled={draftCreationRetrying || running || !hasReviewableResults}
              >
                {qi("reviewDraftsRetry", "Retry draft creation")}
              </Button>
              <Button
                size="small"
                onClick={downloadResultsJson}
                disabled={results.length === 0}
              >
                {t("quickIngest.downloadJson") || "Download JSON"}
              </Button>
              <Button
                size="small"
                onClick={proceedWithoutReview}
                disabled={running}
              >
                {qi("reviewDraftsStoreWithoutReview", "Store without review")}
              </Button>
            </div>
          </div>
        )}
        {reviewNavigationError && (
          <div className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <div className="font-medium">{reviewNavigationError}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  if (!reviewBatchId) return
                  void tryOpenContentReview(reviewBatchId, {
                    closeOnSuccess: true,
                    closeDelayMs: 250
                  })
                }}
                disabled={!reviewBatchId}
              >
                {qi("reviewNavigationRetry", "Retry opening Content Review")}
              </Button>
            </div>
          </div>
        )}

        {/* QUEUE TAB CONTENT */}
        <QueueTab isActive={activeTab === "queue"}>
        <div className="flex flex-col gap-1">
          <Typography.Text strong>{t('quickIngest.howItWorks', 'How this works')}</Typography.Text>
          <Typography.Paragraph type="secondary" className="!mb-1 text-sm text-text-muted">
            {t(
              'quickIngest.howItWorksDesc',
              'Add URLs or files, pick processing mode (store vs process-only), tweak options, then run Ingest/Process.'
            )}
          </Typography.Paragraph>
        </div>
        <div className="rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-text">
          <div className="font-medium mb-1">
            {qi('tipsTitle', 'Tips')}
          </div>
          <ul className="list-disc list-inside space-y-1">
            <li>
              {qi(
                'tipsHybrid',
                'Hybrid input: drop files or paste URLs (comma/newline separated) to build the queue.'
              )}
            </li>
            <li>
              {qi(
                'tipsPerType',
                'Per-type settings (Audio/PDF/Video) apply to new items of that type.'
              )}
            </li>
            <li>
              {qi(
                'tipsInspector',
                'Use the Inspector to see status, type, and quick checks before ingesting.'
              )}
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Typography.Title level={5} className="!mb-1">
                  {t('quickIngest.sourceHeading') || 'Input'}
                </Typography.Title>
                <Typography.Text>
                  {t('quickIngest.subtitle') || 'Drop files or paste URLs; items immediately join the queue.'}
                </Typography.Text>
                <div className="text-xs text-text-subtle mt-1">
                  {qi(
                    'supportedFormats',
                    'Supported: docs, PDFs, audio, video, and web URLs.'
                  )}
                </div>
              </div>
              <Tag color="blue">
                {qi(
                  'itemsReady',
                  '{{count}} item(s) ready',
                  { count: plannedCount || 0 }
                )}
              </Tag>
            </div>
            <input
              type="file"
              style={{ display: 'none' }}
              ref={reattachInputRef}
              onChange={handleReattachChange}
              accept={QUICK_INGEST_ACCEPT_STRING}
            />
            <FileDropZone
              onFilesAdded={addLocalFiles}
              onFilesRejected={(errors) => {
                messageApi.error(
                  errors.length === 1
                    ? errors[0]
                    : qi('filesRejected', '{{count}} files rejected', { count: errors.length }),
                  errors.length > 1 ? 5 : 3
                )
              }}
              running={running}
              isOnlineForIngest={isOnlineForIngest}
            />
            <div className="mt-2 flex justify-center">
              <Button
                onClick={pasteFromClipboard}
                disabled={running || !isOnlineForIngest}
                aria-label={qi('pasteFromClipboard', 'Paste URLs from clipboard')}
                title={qi('pasteFromClipboard', 'Paste URLs from clipboard')}
              >
                {qi('pasteFromClipboard', 'Paste URLs from clipboard')}
              </Button>
            </div>
            {queuedFileStubs.length > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>
                  {qi(
                    "localFilesWarning",
                    "Local files stay attached only while this modal is open. Keep it open until you click Run, or reattach files after reopening."
                  )}
                </span>
              </div>
            )}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Typography.Text strong>
                  {qi('pasteUrlsTitle', 'Paste URLs')}
                </Typography.Text>
                <Typography.Text className="text-xs text-text-subtle">
                  {qi('pasteUrlsHint', 'Separate with commas or new lines')}
                </Typography.Text>
              </div>
              <label
                htmlFor="quick-ingest-url-input"
                className="text-xs font-medium text-text"
              >
                {qi('urlsLabel', 'URLs to ingest')}
              </label>
              <Space.Compact className="w-full">
                  <Input
                    id="quick-ingest-url-input"
                    placeholder={qi('urlsPlaceholder', 'https://example.com, https://...')}
                    value={pendingUrlInput}
                    onChange={(e) => setPendingUrlInput(e.target.value)}
                    disabled={running || !isOnlineForIngest}
                    aria-label={qi('urlsInputAria', 'Paste URLs input')}
                    title={qi('urlsInputAria', 'Paste URLs input')}
                  />
                  <Button
                    type="primary"
                    onClick={() => void addUrlsFromInput(pendingUrlInput)}
                    disabled={running || !isOnlineForIngest}
                    aria-label={qi('addUrlsAria', 'Add URLs to queue')}
                    title={qi('addUrlsAria', 'Add URLs to queue')}
                  >
                    {qi('addUrls', 'Add URLs')}
                  </Button>
                </Space.Compact>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <AlertTriangle className="w-4 h-4 text-text-subtle" />
                <span>
                  {qi(
                    'authRequiredHint',
                    'Authentication-required pages may need cookies set in Advanced.'
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Typography.Title level={5} className="!mb-0">
                {qi('queueTitle', 'Queue')}
              </Typography.Title>
                <div className="flex items-center gap-2">
                <Button
                  size="small"
                  onClick={clearAllQueues}
                  disabled={running && plannedCount > 0}
                  aria-label={qi('clearAllAria', 'Clear all queued items')}
                  title={qi('clearAllAria', 'Clear all queued items')}
                >
                  {qi('clearAll', 'Clear all')}
                </Button>
                <Button
                  size="small"
                  onClick={addRow}
                  disabled={running || !isOnlineForIngest}
                  aria-label={qi('addBlankRowAria', 'Add blank URL row')}
                  title={qi('addBlankRowAria', 'Add blank URL row')}
                >
                  {qi('addBlankRow', 'Add blank row')}
                </Button>
                  <Button
                    size="small"
                    aria-label={qi('openInspector', 'Open Inspector')}
                    title={qi('openInspector', 'Open Inspector')}
                    onClick={() => setInspectorOpen(true)}
                    disabled={!(selectedRow || selectedFileStub)}>
                    {qi('openInspector', 'Open Inspector')}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-text-subtle mb-2">
              {qi(
                'queueDescription',
                'Queued items appear here. Click a row to open the Inspector; badges show defaults, custom edits, or items needing attention.'
              )}
            </div>
            {missingFileStubs.length > 0 && (
              <div className="mb-2 flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 px-2 py-1 text-xs text-warn">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>
                  {qi(
                    "missingFilesQueueNotice",
                    "{{count}} local file(s) need reattachment. Add the files again or remove them before running ingest.",
                    { count: missingFileStubs.length }
                  )}
                </span>
              </div>
            )}
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              <React.Suspense fallback={null}>
                {rows.map((row) => {
                  const status = statusForUrlRow(row)
                  const isSelected = selectedRowId === row.id
                  const detected =
                    row.type === "auto"
                      ? inferIngestTypeFromUrl(row.url)
                      : row.type
                  const res = resultById.get(row.id)
                  const isProcessing = running && !res?.status
                  let runTag: React.ReactNode = null
                  if (res?.status === "ok") {
                    runTag = <Tag color="green">{qi("statusDone", "Done")}</Tag>
                  } else if (res?.status === "error") {
                    runTag = (
                      <AntTooltip
                        title={res.error || qi("statusFailed", "Failed")}
                      >
                        <Tag color="red">{qi("statusFailed", "Failed")}</Tag>
                      </AntTooltip>
                    )
                  } else if (running) {
                    runTag = (
                      <Tag icon={<Spin size="small" />} color="blue">
                        {qi("statusRunning", "Running")}
                      </Tag>
                    )
                  }
                  const pendingTag =
                    ingestBlocked &&
                    !running &&
                    row.url.trim().length > 0 &&
                    (!res || !res.status) ? (
                      <Tag>{pendingLabel}</Tag>
                    ) : null
                  const processingIndicator = isProcessing ? (
                    <div className="mt-1">
                      <ProcessingIndicator
                        label={qi("processingItem", "Processing...")}
                      />
                    </div>
                  ) : null

                  return (
                    <QueuedItemRow
                      key={row.id}
                      row={row}
                      isSelected={isSelected}
                      detectedType={detected}
                      status={status}
                      runTag={runTag}
                      pendingTag={pendingTag}
                      processingIndicator={processingIndicator}
                      running={running}
                      queueDisabled={ingestBlocked}
                      canRetry={res?.status === "error"}
                      qi={qi}
                      typeIcon={typeIcon}
                      onSelect={() => {
                        setSelectedRowId(row.id)
                        setSelectedFileId(null)
                        setInspectorOpen(true)
                      }}
                      onOpenInspector={() => {
                        setSelectedRowId(row.id)
                        setSelectedFileId(null)
                        setInspectorOpen(true)
                      }}
                      onUpdateRow={(updates) => updateRow(row.id, updates)}
                      onRetry={() => {
                        void retrySingleRow(row)
                      }}
                      onRemove={() => removeRow(row.id)}
                    />
                  )
                })}

                {queuedFileStubs.map((stub) => {
                  const attachedFile = fileForStubId.get(stub.id)
                  const status = statusForFile(
                    attachedFile || stub,
                    Boolean(attachedFile)
                  )
                  const isSelected = selectedFileId === stub.id
                  const type = fileTypeFromName(stub)
                  const match = attachedFile
                    ? getResultForFile(attachedFile)
                    : null
                  const runStatus = match?.status
                  const isProcessing = !!attachedFile && running && !runStatus
                  let runTag: React.ReactNode = null
                  if (runStatus === "ok") {
                    runTag = <Tag color="green">{qi("statusDone", "Done")}</Tag>
                  } else if (runStatus === "error") {
                    runTag = (
                      <AntTooltip
                        title={match?.error || qi("statusFailed", "Failed")}
                      >
                        <Tag color="red">{qi("statusFailed", "Failed")}</Tag>
                      </AntTooltip>
                    )
                  } else if (running && attachedFile) {
                    runTag = (
                      <Tag icon={<Spin size="small" />} color="blue">
                        {qi("statusRunning", "Running")}
                      </Tag>
                    )
                  }
                  const pendingTag =
                    ingestBlocked && !running && attachedFile && !runStatus ? (
                      <Tag>{pendingLabel}</Tag>
                    ) : null
                  const processingIndicator = isProcessing ? (
                    <div className="mt-1">
                      <ProcessingIndicator
                        label={qi("processingItem", "Processing...")}
                      />
                    </div>
                  ) : null
                  const handleRemove = () => {
                    setQueuedFiles((prev) =>
                      (prev || []).filter((file) => file.id !== stub.id)
                    )
                    if (attachedFile) {
                      const instanceId = getFileInstanceId(attachedFile)
                      setLocalFiles((prev) =>
                        prev.filter(
                          (file) => getFileInstanceId(file) !== instanceId
                        )
                      )
                    }
                    if (selectedFileId === stub.id) {
                      setSelectedFileId(null)
                    }
                  }

                  return (
                    <QueuedFileRow
                      key={stub.id}
                      stub={stub}
                      isSelected={isSelected}
                      status={status}
                      fileType={type}
                      sizeLabel={formatBytes(stub.size)}
                      runTag={runTag}
                      pendingTag={pendingTag}
                      processingIndicator={processingIndicator}
                      running={running}
                      queueDisabled={ingestBlocked}
                      showReattach={!attachedFile}
                      canRetry={runStatus === "error" && Boolean(attachedFile)}
                      qi={qi}
                      typeIcon={typeIcon}
                      onSelect={() => {
                        setSelectedFileId(stub.id)
                        setSelectedRowId(null)
                        setInspectorOpen(true)
                      }}
                      onOpenInspector={() => {
                        setSelectedFileId(stub.id)
                        setSelectedRowId(null)
                        setInspectorOpen(true)
                      }}
                      onReattach={() => requestFileReattach(stub.id)}
                      onRetry={() => {
                        if (attachedFile) {
                          void retrySingleFile(attachedFile)
                        }
                      }}
                      onRemove={handleRemove}
                    />
                  )
                })}
              </React.Suspense>

              {rows.length === 0 && queuedFileStubs.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-text-muted space-y-1.5">
                  <div>{qi("emptyQueue", "No items queued yet.")}</div>
                  <div className="text-xs">
                    {qi("emptyQueueHint", "Paste URLs (one per line) or drop files here.")}
                  </div>
                  <div className="text-xs text-text-subtle">
                    {qi("emptyQueueExample", "Try a YouTube URL, PDF, or article link.")}
                  </div>
                  <div className="text-[11px] text-text-subtle pt-1">
                    {qi("emptyQueueShortcut", "Tip: Use Ctrl+V to paste from clipboard")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <ProcessButton
            plannedCount={plannedCount}
            running={running}
            ingestBlocked={ingestBlocked}
            hasMissingFiles={hasMissingFiles}
            missingFileCount={missingFileCount}
            onRun={run}
            storeRemote={storeRemote}
            reviewBeforeStorage={reviewBeforeStorage}
          />
        </div>
        </QueueTab>

        {/* OPTIONS TAB CONTENT */}
        <OptionsTab
          isActive={activeTab === "options"}
          qi={qi}
          t={t}
          activePreset={activePreset ?? DEFAULT_PRESET}
          onPresetChange={handlePresetChange}
          onPresetReset={handlePresetReset}
          hasAudioItems={hasAudioItems}
          hasDocumentItems={hasDocumentItems}
          hasVideoItems={hasVideoItems}
          running={running}
          ingestBlocked={ingestBlocked}
          common={common}
          setCommon={setCommon}
          normalizedTypeDefaults={normalizedTypeDefaults}
          setTypeDefaults={setTypeDefaults}
          transcriptionModelOptions={transcriptionModelChoices}
          transcriptionModelsLoading={transcriptionModelsLoading}
          transcriptionModelValue={transcriptionModelValue}
          onTranscriptionModelChange={handleTranscriptionModelChange}
          ragEmbeddingLabel={ragEmbeddingLabel}
          openModelSettings={openModelSettings}
          storeRemote={storeRemote}
          setStoreRemote={setStoreRemote}
          reviewBeforeStorage={reviewBeforeStorage}
          handleReviewToggle={handleReviewToggle}
          storageLabel={storageLabel}
          storageHintSeen={storageHintSeen}
          setStorageHintSeen={setStorageHintSeen}
          draftStorageCapLabel={draftStorageCapLabel}
          doneCount={doneCount}
          totalCount={totalCount}
          plannedCount={plannedCount}
          progressMeta={progressMeta}
          run={run}
          hasMissingFiles={hasMissingFiles}
          missingFileCount={missingFileCount}
          ingestConnectionStatus={ingestConnectionStatus}
          checkOnce={checkOnce}
          onClose={onClose}
        />

        {/* Inspector drawer glow and drawer - visible when queue tab active */}
        {activeTab === 'queue' && (
        <React.Fragment>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out ${inspectorOpen && (selectedRow || selectedFileStub) ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="absolute right-0 top-0 h-full w-40 bg-gradient-to-l from-primary/30 via-primary/10 to-transparent blur-md" />
        </div>

        <QuickIngestInspectorDrawer
          open={inspectorOpen && (!!selectedRow || !!selectedFileStub)}
          onClose={handleCloseInspector}
          showIntro={showInspectorIntro}
          onDismissIntro={handleDismissInspectorIntro}
          qi={qi}
          selectedRow={selectedRow}
          selectedFile={selectedFile || selectedFileStub}
          selectedFileAttached={Boolean(selectedFile)}
          typeIcon={typeIcon}
          inferIngestTypeFromUrl={inferIngestTypeFromUrl}
          fileTypeFromName={fileTypeFromName}
          statusForUrlRow={statusForUrlRow}
          statusForFile={statusForFile}
          formatBytes={formatBytes}
          onReattachFile={handleReattachSelectedFile}
        />
        </React.Fragment>
        )}

        {/* Advanced options - visible when options tab active */}
        {activeTab === 'options' && (
        <Collapse
          className="mt-3"
          activeKey={advancedOpen ? ['adv'] : []}
          onChange={(k) =>
            setAdvancedOpen(Array.isArray(k) ? k.includes('adv') : Boolean(k))
          }
          items={[{
          key: 'adv',
          label: (
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2">
                <span>{qi('advancedOptionsTitle', 'Advanced options')}</span>
                <Tag color="blue">{t('quickIngest.advancedSummary', '{{count}} advanced fields loaded', { count: resolvedAdvSchema.length })}</Tag>
                {modifiedAdvancedCount > 0 && (
                  <Tag color="gold">{t('quickIngest.modifiedCount', '{{count}} modified', { count: modifiedAdvancedCount })}</Tag>
                )}
                {specSourceLabel && <Tag color="geekblue">{specSourceLabel}</Tag>}
                {lastRefreshedLabel && (
                  <Typography.Text className="text-[11px] text-text-subtle">
                    {t('quickIngest.advancedRefreshed', 'Refreshed {{time}}', { time: lastRefreshedLabel })}
                  </Typography.Text>
                )}
                {specSource !== 'none' && (
                  <AntTooltip
                    title={
                      <div className="max-w-80 text-xs">
                        {specSource === 'server'
                          ? qi('specTooltipLive', 'Using live server OpenAPI spec')
                          : qi('specTooltipFallback', 'No spec detected; using fallback fields')}
                      </div>
                    }
                  >
                    <Info className="w-4 h-4 text-text-subtle" />
                  </AntTooltip>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle ml-auto">
                {ragEmbeddingLabel && (
                  <Typography.Text className="text-[11px] text-text-subtle">
                    {t(
                      'quickIngest.ragEmbeddingHint',
                      'RAG embedding model: {{label}}',
                      { label: ragEmbeddingLabel }
                    )}
                  </Typography.Text>
                )}
                <Button
                  size="small"
                  type="default"
                  aria-label={qi('resetInspectorIntro', 'Reset Inspector intro helper')}
                  title={qi('resetInspectorIntro', 'Reset Inspector intro helper')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setInspectorIntroDismissed(false)
                    setShowInspectorIntro(true)
                    setInspectorOpen(true)
                  }}>
                  {qi('resetInspectorIntro', 'Reset Inspector Intro')}
                </Button>
                <Space size="small" align="center">
                  <span className="text-xs text-text-subtle">
                    {qi('preferServerLabel', 'Prefer server')}
                  </span>
                  <Switch
                    size="small"
                    aria-label={qi('preferServerAria', 'Advanced options – prefer server OpenAPI spec')}
                    title={qi('preferServerTitle', 'Prefer server OpenAPI spec')}
                    checked={!!specPrefs?.preferServer}
                    onChange={async (v) => {
                      persistSpecPrefs({ ...(specPrefs || {}), preferServer: v })
                      await loadSpec(v, { reportDiff: true, persist: true, forceFetch: v })
                    }}
                  />
                </Space>
                <Button
                  size="small"
                  aria-label={qi('reloadSpecAria', 'Reload advanced spec from server')}
                  title={qi('reloadSpecAria', 'Reload advanced spec from server')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void loadSpec(true, { reportDiff: true, persist: true, forceFetch: true })
                  }}>
                  {qi('reloadFromServer', 'Reload from server')}
                </Button>
                <span className="h-4 border-l border-border" aria-hidden />
                <Button
                  size="small"
                  aria-label={qi('saveAdvancedDefaultsAria', 'Save current advanced options as defaults')}
                  title={qi('saveAdvancedDefaultsAria', 'Save current advanced options as defaults')}
                  disabled={!advancedDefaultsDirty}
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      setSavedAdvValues(advancedValues)
                      lastSavedAdvValuesRef.current = JSON.stringify(
                        advancedValues || {}
                      )
                      messageApi.success(
                        qi(
                          'advancedSaved',
                          'Advanced options saved as defaults for future sessions.'
                        )
                      )
                    } catch {
                      messageApi.error(
                        qi(
                          'advancedSaveFailed',
                          'Could not save advanced defaults — storage quota may be limited.'
                        )
                      )
                    }
                  }}
                >
                  {qi('saveAdvancedDefaults', 'Save as default')}
                </Button>
                <span className="h-4 border-l border-border" aria-hidden />
                <Button
                  size="small"
                  danger
                  aria-label={qi('resetAdvancedAria', 'Reset advanced options and UI state')}
                  title={qi('resetAdvancedAria', 'Reset advanced options and UI state')}
                  onClick={async (e) => {
                    e.stopPropagation()
                    const ok = await confirmDanger({
                      title: qi('confirmResetTitle', 'Please confirm'),
                      content:
                        qi('confirmResetContent', 'Reset all advanced options and UI state?'),
                      okText: qi('reset', 'Reset'),
                      cancelText: qi('cancel', 'Cancel')
                    })
                    if (!ok) return
                    setAdvancedValues({})
                    setSavedAdvValues({})
                    setFieldDetailsOpen({})
                    setUiPrefs({
                      advancedOpen: false,
                      fieldDetailsOpen: {}
                    })
                    setAdvSearch('')
                    setAdvancedOpen(false)
                    messageApi.success(qi('advancedReset', 'Advanced options reset'))
                  }}>
                  {qi('resetAdvanced', 'Reset Advanced')}
                </Button>
              </div>
            </div>
          ),
          children: (
        <Space direction="vertical" className="w-full">
              <div className="flex items-center gap-2">
                <Input
                  allowClear
                  placeholder={qi('searchAdvanced', 'Search advanced fields...')}
                  value={advSearch}
                  onChange={(e) => setAdvSearch(e.target.value)}
                  className="max-w-80"
                  aria-label={qi('searchAdvanced', 'Search advanced fields...')}
                  title={qi('searchAdvanced', 'Search advanced fields...')}
                />
                {modifiedAdvancedCount > 0 && (
                  <Tag color="gold">{t('quickIngest.modifiedCount', '{{count}} modified', { count: modifiedAdvancedCount })}</Tag>
                )}
              </div>
              {resolvedAdvSchema.length === 0 ? (
                <Typography.Text type="secondary">{t('quickIngest.advancedEmpty', 'No advanced options detected — try reloading the spec.')}</Typography.Text>
              ) : (
                (() => {
                  const grouped: Record<string, typeof resolvedAdvSchema> = {}
                  const recommended: typeof resolvedAdvSchema = []
                  const q = advSearch.trim().toLowerCase()
                  const match = (f: { name: string; title?: string; description?: string }) => {
                    if (!q) return true
                    return (
                      f.name.toLowerCase().includes(q) ||
                      (f.title || '').toLowerCase().includes(q) ||
                      (f.description || '').toLowerCase().includes(q)
                    )
                  }
                  const allMatched = resolvedAdvSchema
                    .filter(match)
                    .filter((field) => field.name !== "transcription_model")

                  // Build a small "Recommended fields" subset for common
                  // parameters, while intentionally duplicating those fields
                  // in their logical groups (they get a "Recommended" badge there).
                  for (const f of allMatched) {
                    const logical = logicalGroupForField(f.name)
                    const isRecommended = isRecommendedField(f.name, logical)

                    if (isRecommended && recommended.length < MAX_RECOMMENDED_FIELDS) {
                      recommended.push(f)
                    }

                    const groupKey = logical
                    if (!grouped[groupKey]) grouped[groupKey] = []
                    grouped[groupKey].push(f)
                  }

                  const recommendedNameSet = new Set(
                    recommended.map((f) => f.name)
                  )

                  const order: string[] = []
                  if (recommended.length > 0) {
                    order.push('Recommended')
                  }
                  order.push(
                    ...Object.keys(grouped)
                      .filter((g) => g !== 'Recommended')
                      .sort()
                  )

                  return order.map((g) => (
                    <div key={g} className="mb-2">
                      <Typography.Title level={5} className="!mb-2 flex items-center">
                        {iconForGroup(g)}
                        {g === 'Recommended'
                          ? t(
                              'quickIngest.recommendedGroup',
                              'Recommended fields'
                            )
                          : g}
                      </Typography.Title>
                      <Space direction="vertical" className="w-full">
                        {(g === "Recommended"
                          ? recommended
                          : grouped[g]
                        ).map((f) => {
                          const v = advancedValues[f.name]
                          const setV = (nv: any) => setAdvancedValue(f.name, nv)
                          const isOpen = fieldDetailsOpen[f.name]
                          const setOpen = (open: boolean) =>
                            setFieldDetailsOpen((prev) => ({
                              ...prev,
                              [f.name]: open
                            }))
                          const isTranscriptionModel =
                            f.name === "transcription_model"
                          const isContextualModel =
                            f.name === "contextual_llm_model"
                          const isEmbeddingModel = f.name === "embedding_model"
                          const ariaLabel = `${g} \u2013 ${f.title || f.name}`
                          const isAlsoRecommended =
                            g !== "Recommended" &&
                            recommendedNameSet.has(f.name)
                          const canShowDetailsHere =
                            !!f.description &&
                            (g === "Recommended" ||
                              !recommendedNameSet.has(f.name))
                          const selectOptions = getAdvancedFieldSelectOptions({
                            fieldName: f.name,
                            fieldEnum: f.enum,
                            t,
                            chatModels,
                            embeddingModels
                          })
                          const fallbackEnumOptions =
                            f.enum && f.enum.length > 0
                              ? f.enum.map((entry) => ({
                                  value: String(entry),
                                  label: String(entry)
                                }))
                              : null
                          const selectValue =
                            v === undefined || v === null || v === ""
                              ? undefined
                              : String(v)
                          const resolvedSelectOptions = selectOptions
                            ? ensureSelectOption(selectOptions, selectValue)
                            : fallbackEnumOptions
                              ? ensureSelectOption(
                                  fallbackEnumOptions,
                                  selectValue
                                )
                              : null
                          const Label = (
                            <div className="flex items-center gap-1">
                              <span className="min-w-60 text-sm">{f.title || f.name}</span>
                              {isAlsoRecommended && (
                                <Tag
                                  color="blue"
                                  className="border-0 text-[10px] leading-none px-1 py-0"
                                >
                                  {qi('recommendedBadge', 'Recommended')}
                                </Tag>
                              )}
                              {f.description ? (
                                <AntTooltip placement="right" trigger={["hover","click"]} title={<div className="max-w-96 text-xs">{f.description}</div>}>
                                  <HelpCircle className="w-3.5 h-3.5 text-text-subtle cursor-help" />
                                </AntTooltip>
                              ) : null}
                            </div>
                          )
                          if (resolvedSelectOptions) {
                            return (
                              <div key={f.name} className="flex items-center gap-2">
                                {Label}
                                <Select
                                  className="w-72"
                                  allowClear
                                  showSearch={
                                    isTranscriptionModel ||
                                    isContextualModel ||
                                    isEmbeddingModel ||
                                    resolvedSelectOptions.length > 6
                                  }
                                  loading={
                                    (isTranscriptionModel &&
                                      transcriptionModelsLoading) ||
                                    (isContextualModel && chatModelsLoading) ||
                                    (isEmbeddingModel && embeddingModelsLoading)
                                  }
                                  aria-label={ariaLabel}
                                  value={selectValue}
                                  onChange={setV as any}
                                  options={resolvedSelectOptions}
                                />
                                {canShowDetailsHere && (
                                  <button
                                    className="text-xs underline text-text-subtle"
                                    onClick={() => setOpen(!isOpen)}
                                  >
                                    {isOpen
                                      ? qi('hideDetails', 'Hide details')
                                      : qi('showDetails', 'Show details')}
                                  </button>
                                )}
                              </div>
                            )
                          }
                          if (f.type === 'boolean') {
                            const boolState = v === true || v === 'true' ? 'true' : v === false || v === 'false' ? 'false' : 'unset'
                            return (
                              <div key={f.name} className="flex items-center gap-2">
                                {Label}
                                <Switch
                                  checked={boolState === 'true'}
                                  onChange={(checked) => setAdvancedValue(f.name, checked)}
                                  aria-label={ariaLabel}
                                />
                                <Button
                                  size="small"
                                  onClick={() => setAdvancedValue(f.name, undefined)}
                                  disabled={boolState === 'unset'}>
                                  {qi('unset', 'Unset')}
                                </Button>
                                <Typography.Text type="secondary" className="text-[11px] text-text-subtle">
                                  {boolState === 'unset'
                                    ? qi('unsetLabel', 'Currently unset (server defaults)')
                                    : boolState === 'true'
                                      ? qi('onLabel', 'On')
                                      : qi('offLabel', 'Off')}
                                </Typography.Text>
                                {canShowDetailsHere && (
                                  <button
                                    className="text-xs underline text-text-subtle"
                                    onClick={() => setOpen(!isOpen)}
                                  >
                                    {isOpen
                                      ? qi('hideDetails', 'Hide details')
                                      : qi('showDetails', 'Show details')}
                                  </button>
                                )}
                              </div>
                            )
                          }
                          if (f.type === 'integer' || f.type === 'number') {
                            return (
                              <div key={f.name} className="flex items-center gap-2">
                                {Label}
                                <InputNumber
                                  className="w-40"
                                  aria-label={ariaLabel}
                                  value={v}
                                  onChange={setV as any}
                                />
                                {canShowDetailsHere && (
                                  <button
                                    className="text-xs underline text-text-subtle"
                                    onClick={() => setOpen(!isOpen)}
                                  >
                                    {isOpen
                                      ? qi('hideDetails', 'Hide details')
                                      : qi('showDetails', 'Show details')}
                                  </button>
                                )}
                              </div>
                            )
                          }
                          return (
                            <div key={f.name} className="flex items-center gap-2">
                              {Label}
                              <Input
                                className="w-96"
                                aria-label={ariaLabel}
                                value={v}
                                onChange={(e) => setV(e.target.value)}
                              />
                              {canShowDetailsHere && (
                                <button
                                  className="text-xs underline text-text-subtle"
                                  onClick={() => setOpen(!isOpen)}
                                >
                                  {isOpen
                                    ? qi('hideDetails', 'Hide details')
                                    : qi('showDetails', 'Show details')}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      {/* details sections */}
                      {(g === "Recommended" ? recommended : grouped[g]).map(
                        (f) => {
                          const showHere =
                            !!f.description &&
                            fieldDetailsOpen[f.name] &&
                            (g === "Recommended" ||
                              !recommendedNameSet.has(f.name))
                          return showHere ? (
                            <div
                              key={`${f.name}-details`}
                              className="ml-4 mt-1 p-2 rounded bg-surface2 text-xs text-text-muted max-w-[48rem]"
                            >
                              {f.description}
                            </div>
                          ) : null
                        }
                      )}
                      </Space>
                    </div>
                  ))
                })()
              )}
            </Space>
          )
        }]} />
        )}

        {/* RESULTS TAB CONTENT */}
        <ResultsTab
          isActive={activeTab === "results"}
          processButton={
            <ProcessButton
              plannedCount={plannedCount}
              running={running}
              ingestBlocked={ingestBlocked}
              hasMissingFiles={hasMissingFiles}
              missingFileCount={missingFileCount}
              onRun={run}
              storeRemote={storeRemote}
              reviewBeforeStorage={reviewBeforeStorage}
            />
          }
          data={{
            results: resultsWithOutcome,
            visibleResults,
            resultSummary,
            running,
            progressMeta,
            filters: {
              value: resultsFilter,
              options: RESULT_FILTERS,
              onChange: (value) => setResultsFilter(value as ResultsFilter)
            }
          }}
          context={{
            shouldStoreRemote,
            firstResultWithMedia,
            reviewBatchId,
            processOnly,
            mediaIdFromPayload
          }}
          actions={{
            retryFailedUrls,
            requeueFailed,
            exportFailedList,
            tryOpenContentReview: (batchId) => {
              void tryOpenContentReview(batchId)
            },
            openInMediaViewer,
            discussInChat,
            downloadJson,
            openHealthDiagnostics
          }}
          i18n={{ qi, t }}
        />
      </Space>
      </div>
    </Modal>
  )
}

export default QuickIngestModal
