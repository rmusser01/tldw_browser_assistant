import React from 'react'
import { Modal, Button, Input, Select, Space, Switch, Typography, List, Tag, message, Collapse, InputNumber, Tooltip as AntTooltip, Spin, Progress } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from "react-router-dom"
import { browser } from "wxt/browser"
import { tldwClient } from '@/services/tldw/TldwApiClient'
import { MEDIA_ADD_SCHEMA_FALLBACK, MEDIA_ADD_SCHEMA_FALLBACK_VERSION } from '@/services/tldw/fallback-schemas'
import { HelpCircle, Headphones, Layers, Database, FileText, Film, Cookie, Info, Clock, Grid, BookText, Link2, File as FileIcon, AlertTriangle, Star } from 'lucide-react'
import { useStorage } from '@plasmohq/storage/hook'
import { useConfirmDanger } from '@/components/Common/confirm-danger'
import { QuickIngestInspectorDrawer } from "@/components/Common/QuickIngestInspectorDrawer"
import { defaultEmbeddingModelForRag } from '@/services/tldw-server'
import { tldwModels } from '@/services/tldw'
import {
  coerceDraftMediaType,
  inferIngestTypeFromFilename,
  inferIngestTypeFromUrl
} from "@/services/tldw/media-routing"
import { useConnectionActions, useConnectionState } from '@/hooks/useConnectionState'
import { useQuickIngestStore } from "@/store/quick-ingest"
import { ConnectionPhase } from "@/types/connection"
import { cleanUrl } from "@/libs/clean-url"
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

type Entry = {
  id: string
  url: string
  type: 'auto' | 'html' | 'pdf' | 'document' | 'audio' | 'video'
  // Simple per-type options; server can ignore unknown fields
  audio?: { language?: string; diarize?: boolean }
  document?: { ocr?: boolean }
  video?: { captions?: boolean }
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

const ProcessingIndicator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 text-[11px] text-text-subtle">
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
    </span>
    <span>{label}</span>
  </div>
)

const MAX_LOCAL_FILE_BYTES = 500 * 1024 * 1024 // 500MB soft cap for local file ingest
const INLINE_FILE_WARN_BYTES = 100 * 1024 * 1024 // warn/block before copying very large buffers in-memory
const MAX_RECOMMENDED_FIELDS = 12

const RESULT_FILTERS = {
  ALL: "all",
  SUCCESS: "success",
  ERROR: "error"
} as const

type ResultsFilter = (typeof RESULT_FILTERS)[keyof typeof RESULT_FILTERS]

const isLikelyUrl = (raw: string) => {
  const val = (raw || '').trim()
  if (!val) return false
  try {
    // eslint-disable-next-line no-new
    new URL(val)
    return true
  } catch {
    return false
  }
}

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
  const [storeRemote, setStoreRemote] = React.useState<boolean>(true)
  const [reviewBeforeStorage, setReviewBeforeStorage] = useStorage<boolean>(
    "quickIngestReviewBeforeStorage",
    false
  )
  const [rows, setRows] = React.useState<Entry[]>([
    { id: crypto.randomUUID(), url: '', type: 'auto' }
  ])
  // Common ingest options available across media types (promote booleans only; rely on Advanced for the rest)
  const [common, setCommon] = React.useState<{ perform_analysis: boolean; perform_chunking: boolean; overwrite_existing: boolean }>({
    perform_analysis: true,
    perform_chunking: true,
    overwrite_existing: false
  })
  const [running, setRunning] = React.useState<boolean>(false)
  const [results, setResults] = React.useState<ResultItem[]>([])
  const [localFiles, setLocalFiles] = React.useState<File[]>([])
  const [advancedOpen, setAdvancedOpen] = React.useState<boolean>(false)
  const [advancedValues, setAdvancedValues] = React.useState<Record<string, any>>({})
  const [advSchema, setAdvSchema] = React.useState<Array<{ name: string; type: string; enum?: any[]; description?: string; title?: string }>>([])
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
  const lastRefreshedLabel = React.useMemo(() => {
    const ts = specPrefs?.lastRemote?.cachedAt
    if (!ts) return null
    const d = new Date(ts)
    return d.toLocaleString()
  }, [specPrefs])

  const fallbackSchemaVersion = MEDIA_ADD_SCHEMA_FALLBACK_VERSION
  const SAVE_DEBOUNCE_MS = 2000
  const lastSavedAdvValuesRef = React.useRef<string | null>(null)
  const lastSavedUiPrefsRef = React.useRef<string | null>(null)
  const specPrefsCacheRef = React.useRef<string | null>(null)
  const [totalPlanned, setTotalPlanned] = React.useState<number>(0)
  const [processedCount, setProcessedCount] = React.useState<number>(0)
  const [liveTotalCount, setLiveTotalCount] = React.useState<number>(0)
  const [ragEmbeddingLabel, setRagEmbeddingLabel] = React.useState<string | null>(null)
  const [runStartedAt, setRunStartedAt] = React.useState<number | null>(null)
  const [pendingUrlInput, setPendingUrlInput] = React.useState<string>('')
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null)
  const [selectedFileIndex, setSelectedFileIndex] = React.useState<number | null>(null)
  const [inspectorOpen, setInspectorOpen] = React.useState<boolean>(false)
  const [hasOpenedInspector, setHasOpenedInspector] = React.useState<boolean>(false)
  const [showInspectorIntro, setShowInspectorIntro] = React.useState<boolean>(true)
  const [inspectorIntroDismissed, setInspectorIntroDismissed] = useStorage<boolean>('quickIngestInspectorIntroDismissed', false)
  const confirmDanger = useConfirmDanger()
  const introToast = React.useRef(false)
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
  const { phase, isConnected, offlineBypass, serverUrl, errorKind } =
    useConnectionState()
  const { checkOnce, disableOfflineBypass } = useConnectionActions?.() || {}

  type IngestConnectionStatus =
    | "online"
    | "offline"
    | "unconfigured"
    | "offlineBypass"
    | "unknown"

  const ingestConnectionStatus: IngestConnectionStatus = React.useMemo(() => {
    if (offlineBypass) {
      return "offlineBypass"
    }
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
  }, [phase, isConnected, offlineBypass])
  const ingestHost = React.useMemo(
    () => (serverUrl ? cleanUrl(serverUrl) : "tldw_server"),
    [serverUrl]
  )

  const ingestBlocked = ingestConnectionStatus !== "online"
  const ingestBlockedPrevRef = React.useRef(ingestBlocked)
  const hadOfflineQueuedRef = React.useRef(false)
  const { setQueuedCount, clearQueued, markFailure, clearFailure } =
    useQuickIngestStore((s) => ({
      setQueuedCount: s.setQueuedCount,
      clearQueued: s.clearQueued,
      markFailure: s.markFailure,
      clearFailure: s.clearFailure
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
  const lastFileIdByKeyRef = React.useRef<Map<string, string> | null>(null)
  const pendingStoreWithoutReviewRef = React.useRef(false)
  const unmountedRef = React.useRef(false)
  const processOnly = reviewBeforeStorage || !storeRemote
  const shouldStoreRemote = storeRemote && !processOnly

  React.useEffect(() => {
    return () => {
      unmountedRef.current = true
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
    (f: File): Entry['type'] => inferIngestTypeFromFilename(f.name || ''),
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

  const statusForUrlRow = React.useCallback((row: Entry) => {
    const raw = (row.url || '').trim()
    if (raw && !isLikelyUrl(raw)) {
      return { label: 'Needs review', color: 'orange', reason: 'Invalid URL format' }
    }
    const custom =
      row.type !== 'auto' ||
      (row.audio && Object.keys(row.audio).length > 0) ||
      (row.document && Object.keys(row.document).length > 0) ||
      (row.video && Object.keys(row.video).length > 0)
    return {
      label: custom ? 'Custom' : 'Default',
      color: custom ? 'blue' : 'default' as const,
      reason: custom ? 'Custom type or options' : undefined
    }
  }, [])

  const statusForFile = React.useCallback((file: File) => {
    if (file.size && file.size > MAX_LOCAL_FILE_BYTES) {
      return { label: 'Needs review', color: 'orange', reason: 'File is over 500MB' }
    }
    return { label: 'Default', color: 'default' as const }
  }, [])

  const addUrlsFromInput = React.useCallback(
    (text: string) => {
      const parts = text
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (parts.length === 0) return
      const entries = parts.map((u) => ({
        id: crypto.randomUUID(),
        url: u,
        type: inferIngestTypeFromUrl(u)
      }))
      setRows((prev) => [...prev, ...entries])
      setPendingUrlInput('')
      setSelectedRowId(entries[0].id)
      setSelectedFileIndex(null)
      messageApi.success(`Added ${entries.length} URL${entries.length === 1 ? '' : 's'} to the queue.`)
    },
    [messageApi]
  )

  const clearAllQueues = React.useCallback(() => {
    setRows([{ id: crypto.randomUUID(), url: '', type: 'auto' }])
    setLocalFiles([])
    setSelectedRowId(null)
    setSelectedFileIndex(null)
    setPendingUrlInput('')
  }, [])

  const pasteFromClipboard = React.useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        messageApi.info('Clipboard is empty.')
        return
      }
      addUrlsFromInput(text)
    } catch {
      messageApi.error('Unable to read from clipboard. Check browser permissions.')
    }
  }, [addUrlsFromInput, messageApi])

  const persistSpecPrefs = React.useCallback(
    (next: { preferServer?: boolean; lastRemote?: { version?: string; cachedAt?: number } }) => {
      const serialized = JSON.stringify(next || {})
      if (specPrefsCacheRef.current === serialized) return
      specPrefsCacheRef.current = serialized
      setSpecPrefs(next)
    },
    [setSpecPrefs]
  )

  const addRow = () => setRows((r) => [...r, { id: crypto.randomUUID(), url: '', type: 'auto' }])
  const removeRow = (id: string) => {
    setRows((r) => r.filter((x) => x.id !== id))
    if (selectedRowId === id) {
      setSelectedRowId(null)
    }
  }
  const updateRow = (id: string, patch: Partial<Entry>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  // Default OCR to on for document/PDF rows so users get best extraction without extra clicks
  React.useEffect(() => {
    let changed = false
    const next = rows.map((r) => {
      const isDocType =
        r.type === 'document' ||
        r.type === 'pdf' ||
        (r.type === 'auto' &&
          ['document', 'pdf'].includes(inferIngestTypeFromUrl(r.url)))
      if (isDocType && r.document?.ocr === undefined) {
        changed = true
        return { ...r, document: { ...(r.document || {}), ocr: true } }
      }
      return r
    })
    if (changed) setRows(next)
  }, [rows])

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

  const plannedCount = React.useMemo(() => {
    const valid = rows.filter((r) => r.url.trim().length > 0)
    return valid.length + localFiles.length
  }, [rows, localFiles])

  const resultById = React.useMemo(() => {
    const map = new Map<string, ResultItem>()
    for (const r of results) map.set(r.id, r)
    return map
  }, [results])

  const getResultForFile = React.useCallback(
    (file: File) => {
      const fileIdByKey = lastFileIdByKeyRef.current
      if (fileIdByKey) {
        const id = fileIdByKey.get(buildLocalFileKey(file))
        if (id) {
          return resultById.get(id) || null
        }
      }
      const fallbackMatches = results.filter((r) => r.fileName === file.name)
      return fallbackMatches.length === 1 ? fallbackMatches[0] : null
    },
    [resultById, results]
  )

  const stagedCount = React.useMemo(() => {
    let count = 0
    const trimmedRows = rows.filter((r) => r.url.trim().length > 0)
    for (const row of trimmedRows) {
      const res = resultById.get(row.id)
      if (!res || !res.status) {
        count += 1
      }
    }
    for (const file of localFiles) {
      const match = getResultForFile(file)
      if (!match || !match.status) {
        count += 1
      }
    }
    return count
  }, [rows, localFiles, resultById, getResultForFile])

  const pendingLabel = React.useMemo(() => {
    if (!ingestBlocked) {
      return ""
    }
    if (ingestConnectionStatus === "unconfigured") {
      return t(
        "quickIngest.pendingUnconfigured",
        "Pending — will run after you configure a server."
      )
    }
    if (ingestConnectionStatus === "offlineBypass") {
      return t(
        "quickIngest.pendingOfflineBypass",
        "Pending — will run when offline mode is disabled."
      )
    }
    return t(
      "quickIngest.pendingLabel",
      "Pending — will run when connected."
    )
  }, [ingestBlocked, ingestConnectionStatus, t])

  React.useEffect(() => {
    if (ingestBlocked && stagedCount > 0) {
      hadOfflineQueuedRef.current = true
    }
    if (ingestBlockedPrevRef.current && !ingestBlocked && stagedCount > 0) {
      messageApi.info(
        t(
          "quickIngest.readyToast",
          "Server back online — ready to process {{count}} queued items.",
          { count: stagedCount }
        )
      )
    }
    if (!ingestBlocked && stagedCount === 0) {
      hadOfflineQueuedRef.current = false
    }
    ingestBlockedPrevRef.current = ingestBlocked
  }, [ingestBlocked, stagedCount, messageApi, t])

  // Mark modal as ready once we have evaluated connection state at least once
  React.useEffect(() => {
    if (!modalReady) {
      setModalReady(true)
    }
  }, [modalReady, ingestBlocked])

  React.useEffect(() => {
    if (hadOfflineQueuedRef.current && stagedCount > 0) {
      setQueuedCount(stagedCount)
    } else {
      setQueuedCount(0)
    }
  }, [setQueuedCount, stagedCount])

  React.useEffect(() => {
    return () => {
      clearQueued()
    }
  }, [clearQueued])

  const showProcessQueuedButton =
    !ingestBlocked && stagedCount > 0 && hadOfflineQueuedRef.current

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
    lastFileIdByKeyRef.current = null
    clearFailure()

    if (ingestBlocked) {
      let key = "quickIngest.offlineQueueToast"
      let fallback =
        "Offline mode: items are queued here until your server is back online."

      if (ingestConnectionStatus === "unconfigured") {
        key = "quickIngest.unconfiguredQueueToast"
        fallback =
          "Server not configured: items are staged here and will not run until you configure a server under Settings → tldw server."
      } else if (ingestConnectionStatus === "offlineBypass") {
        key = "quickIngest.offlineBypassQueueToast"
        fallback =
          "Offline mode enabled: items are staged here and will process once you disable offline mode."
      }

      messageApi.warning(t(key, fallback))
      return
    }
    const valid = rows.filter((r) => r.url.trim().length > 0)
    if (valid.length === 0 && localFiles.length === 0) {
      messageApi.error('Please add at least one URL or file')
      return
    }
    const oversizedFiles = localFiles.filter(
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
    const total = valid.length + localFiles.length
    setTotalPlanned(total)
    setProcessedCount(0)
    setLiveTotalCount(total)
    setRunStartedAt(Date.now())
    setRunning(true)
    setResults([])
    setReviewBatchId(null)
    try {
      // Ensure tldwConfig is hydrated for background requests
      try {
        await tldwClient.initialize()
      } catch {}

      // Prepare entries payload (URLs + simple options)
      const entries = valid.map((r) => ({
        id: r.id,
        url: r.url,
        type: r.type,
        audio: r.audio,
        document: r.document,
        video: r.video
      }))

      // Convert local files to transferable payloads (ArrayBuffer)
      const fileLookup = new Map<string, File>()
      const fileIdByKey = new Map<string, string>()
      const filesPayload = await Promise.all(
        localFiles.map(async (f) => {
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
          fileIdByKey.set(buildLocalFileKey(f), id)
          // Use a plain array so runtime message cloning (MV3 SW) preserves bytes
          const data = Array.from(new Uint8Array(await f.arrayBuffer()))
          return {
            id,
            name: f.name,
            type: f.type,
            data
          }
        })
      )
      lastFileLookupRef.current = fileLookup
      lastFileIdByKeyRef.current = fileIdByKey

      const resp = (await browser.runtime.sendMessage({
        type: "tldw:quick-ingest-batch",
        payload: {
          entries,
          files: filesPayload,
          storeRemote,
          processOnly,
          common,
          advancedValues
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
    localFiles,
    formatBytes,
    messageApi,
    processOnly,
    qi,
    reviewBeforeStorage,
    rows,
    storeRemote,
    t
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
      lastFileIdByKeyRef.current = null
      pendingStoreWithoutReviewRef.current = false
      return
    }
    if (autoProcessedRef.current) return
    if (!showProcessQueuedButton) return
    if (running) return
    autoProcessedRef.current = true
    void run()
  }, [autoProcessQueued, open, run, running, showProcessQueuedButton])

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
    "authorization",
    "auth_header",
    "embedding_model",
    "default_embedding_model",
    "context_strategy",
    "perform_chunking",
    "perform_analysis",
    "overwrite_existing",
    "system_prompt",
    "custom_prompt"
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
    if (n.includes('cookie') || n === 'cookies' || n === 'headers' || n === 'authorization' || n === 'auth_header') return 'Cookies/Auth'
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

    const paths = spec?.paths || {}
    const mediaAdd = paths['/api/v1/media/add'] || paths['/api/v1/media/add/']
    const content = mediaAdd?.post?.requestBody?.content || {}
    const mp = content['multipart/form-data'] || content['application/x-www-form-urlencoded'] || content['application/json'] || {}
    const rootSchema = mp?.schema || {}
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

    const entries: Array<{ name: string; type: string; enum?: any[]; description?: string; title?: string }> = []
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
    entries.sort((a,b) => a.name.localeCompare(b.name))
    setAdvSchema(entries)
    return entries
  }, [])

  const loadSpec = React.useCallback(
    async (
      preferServer = true,
      options: { reportDiff?: boolean; persist?: boolean } = {}
    ) => {
      const { reportDiff = false, persist = false } = options
      let used: 'server' | 'fallback' | 'none' = 'none'
      let remote: any | null = null
      const prevSchema = reportDiff ? [...advSchema] : null

      if (preferServer) {
        try {
          const healthy = await tldwClient.healthCheck()
          if (healthy) remote = await tldwClient.getOpenAPISpec()
        } catch (e) {
          console.debug(
            "[QuickIngest] Failed to load OpenAPI spec from server; using bundled fallback.",
            (e as any)?.message || e
          )
        }
      }

      if (remote) {
        const nextSchema = parseSpec(remote)
        used = 'server'

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
        setAdvSchema(MEDIA_ADD_SCHEMA_FALLBACK)
        used = 'fallback'

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
    [persistSpecPrefs, specPrefs, messageApi, advSchema, fallbackSchemaVersion, parseSpec, qi]
  )

  React.useEffect(() => {
    specPrefsCacheRef.current = JSON.stringify(specPrefs || {})
  }, [specPrefs])

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
      return
    }
    let cancelled = false
    const fetchModels = async () => {
      setTranscriptionModelsLoading(true)
      try {
        const res = await tldwClient.getTranscriptionModels()
        const all = Array.isArray(res?.all_models) ? res.all_models : []
        if (!cancelled && all.length > 0) {
          const seen = new Set<string>()
          const unique: string[] = []
          for (const model of all) {
            const value = String(model)
            if (!value || seen.has(value)) continue
            seen.add(value)
            unique.push(value)
          }
          setTranscriptionModelOptions(unique)
        }
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

  const firstAudioRow = React.useMemo(
    () =>
      rows.find(
        (r) =>
          r.type === "audio" ||
          (r.type === "auto" && inferIngestTypeFromUrl(r.url) === "audio")
      ),
    [rows]
  )

  const firstDocumentRow = React.useMemo(
    () =>
      rows.find(
        (r) =>
          r.type === "document" ||
          r.type === "pdf" ||
          (r.type === "auto" &&
            ["document", "pdf"].includes(inferIngestTypeFromUrl(r.url)))
      ),
    [rows]
  )

  const firstVideoRow = React.useMemo(
    () =>
      rows.find(
        (r) =>
          r.type === "video" ||
          (r.type === "auto" && inferIngestTypeFromUrl(r.url) === "video")
      ),
    [rows]
  )

  const selectedRow = React.useMemo(
    () => rows.find((r) => r.id === selectedRowId) || null,
    [rows, selectedRowId]
  )

  const selectedFile = React.useMemo(() => {
    if (selectedFileIndex == null || selectedFileIndex < 0) return null
    return localFiles[selectedFileIndex] || null
  }, [localFiles, selectedFileIndex])

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
    if ((selectedRow || selectedFile) && inspectorOpen && !hasOpenedInspector) {
      setHasOpenedInspector(true)
    }
  }, [hasOpenedInspector, inspectorOpen, selectedFile, selectedRow])

  React.useEffect(() => {
    setSelectedFileIndex((prev) => {
      if (localFiles.length === 0) return null
      if (prev == null) return 0
      if (prev >= localFiles.length) return localFiles.length - 1
      return prev
    })

    if (selectedRowId && rows.some((r) => r.id === selectedRowId)) {
      return
    }
    if (rows.length > 0) {
      setSelectedRowId(rows[0].id)
      setSelectedFileIndex(null)
      return
    }
  }, [localFiles.length, rows, selectedRowId])

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
    let items = results || []
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
  }, [results, resultsFilter])

  const modifiedAdvancedCount = React.useMemo(
    () => Object.keys(advancedValues || {}).length,
    [advancedValues]
  )

  const advancedDefaultsDirty = React.useMemo(() => {
    const current = JSON.stringify(advancedValues || {})
    const saved = JSON.stringify(savedAdvValues || {})
    return current !== saved
  }, [advancedValues, savedAdvValues])
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

  const addLocalFiles = React.useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return
      const existingKeys = new Set(localFiles.map((file) => buildLocalFileKey(file)))
      const seenKeys = new Set<string>()
      const accepted: File[] = []
      const duplicates: string[] = []

      for (const file of incoming) {
        const name = file?.name || ""
        const key = buildLocalFileKey(file)
        if (existingKeys.has(key) || seenKeys.has(key)) {
          duplicates.push(name || "Unnamed file")
          continue
        }
        seenKeys.add(key)
        accepted.push(file)
      }

      if (duplicates.length > 0) {
        const uniqueNames = Array.from(new Set(duplicates))
        const label = uniqueNames.slice(0, 3).join(", ")
        const suffix = uniqueNames.length > 3 ? "..." : ""
        messageApi.warning(
          qi(
            "duplicateFiles",
            "Skipped {{count}} duplicate file(s): {{names}}",
            {
              count: duplicates.length,
              names: `${label}${suffix}`
            }
          )
        )
      }

      if (accepted.length === 0) return
      setLocalFiles((prev) => [...prev, ...accepted])
      setSelectedFileIndex((prev) => (prev == null ? 0 : prev))
      setSelectedRowId(null)
    },
    [localFiles, messageApi, qi]
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

  const retryFailedUrls = React.useCallback(() => {
    const failedByUrl = results.filter((r) => r.status === "error" && r.url)
    const byUrl = new Map(rows.map((row) => [row.url.trim(), row]))
    const failedUrls = failedByUrl.map((r) => {
      const key = (r.url || "").trim()
      const existing = byUrl.get(key)
      if (existing) {
        return { ...existing, id: crypto.randomUUID() }
      }
      return {
        id: crypto.randomUUID(),
        url: r.url || "",
        type: "auto" as Entry["type"]
      }
    })
    if (failedUrls.length === 0) {
      messageApi.info(qi("noFailedUrlToRetry", "No failed URL items to retry."))
      return
    }
    setRows(failedUrls)
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
  }, [messageApi, qi, results, rows])

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
      setRows(nextRows)
      setLocalFiles(nextFiles)
      setSelectedRowId(nextRows[0]?.id ?? null)
      setSelectedFileIndex(nextFiles.length > 0 ? 0 : null)
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
    [messageApi]
  )

  const retrySingleRow = React.useCallback(
    async (row: Entry) => {
      if (running) return
      const totalItems =
        rows.filter((r) => r.url.trim().length > 0).length + localFiles.length
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
    [confirmReplaceQueue, localFiles.length, qi, resetQueueForRetry, rows, running]
  )

  const retrySingleFile = React.useCallback(
    async (file: File) => {
      if (running) return
      const totalItems =
        rows.filter((r) => r.url.trim().length > 0).length + localFiles.length
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
    [confirmReplaceQueue, localFiles.length, qi, resetQueueForRetry, rows, running]
  )

  // Live progress updates from background batch processor
  React.useEffect(() => {
    const handler = (message: any) => {
      if (!message || message.type !== "tldw:quick-ingest-progress") return
      const payload = message.payload || {}
      const result = payload.result as ResultItem | undefined
      if (typeof payload.processedCount === "number") {
        setProcessedCount(payload.processedCount)
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

  // Derive a short, state-aware connectivity banner message so users
  // immediately understand whether Quick Ingest will run or only queue.
  const isOnlineForIngest = ingestConnectionStatus === "online"
  let connectionBannerTitle: string | null = null
  let connectionBannerBody: string | null = null
  let showHealthLink = false

  if (!isOnlineForIngest) {
    if (ingestConnectionStatus === "unconfigured") {
      connectionBannerTitle = t(
        "option:connectionCard.headlineError",
        "Can’t reach your tldw server"
      )
      connectionBannerBody = t(
        "quickIngest.unconfiguredDescription",
        "You can queue URLs and files now; ingestion will run after you configure a server URL and API key under Settings → tldw server."
      )
      showHealthLink = true
    } else if (ingestConnectionStatus === "offlineBypass") {
      connectionBannerTitle = t(
        "option:connectionCard.headlineError",
        "Can’t reach your tldw server"
      )
      connectionBannerBody = t(
        "quickIngest.offlineBypassDescription",
        "Items are staged here and will process once you disable offline mode or re-enable live server checks."
      )
      showHealthLink = true
    } else if (ingestConnectionStatus === "offline") {
      if ((errorKind as any) === "auth") {
        connectionBannerTitle = t(
          "option:connectionCard.headlineErrorAuth",
          "API key needs attention"
        )
        connectionBannerBody = t(
          "option:connectionCard.descriptionErrorAuth",
          "Your server is up but the API key is wrong or missing. Fix the key in Settings → tldw server, then retry."
        )
      } else {
        connectionBannerTitle = t(
          "option:connectionCard.headlineError",
          "Can’t reach your tldw server"
        )
        connectionBannerBody = t(
          "option:connectionCard.descriptionError",
          "We couldn’t reach {{host}}. Check that your tldw_server is running and that your browser can reach it, then open diagnostics or update the URL.",
          { host: ingestHost }
        )
      }
      showHealthLink = true
    } else {
      connectionBannerTitle = t(
        "quickIngest.checkingTitle",
        "Checking server connection…"
      )
      connectionBannerBody = t(
        "quickIngest.checkingDescription",
        "We’re checking your tldw server before running ingest. You can start queuing items while we confirm reachability."
      )
      showHealthLink = false
    }
  }

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <span>{t('quickIngest.title') || 'Quick Ingest Media'}</span>
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
      <div className="relative" data-state={modalReady ? 'ready' : 'loading'}>
      <Space direction="vertical" className="w-full">
        {!isOnlineForIngest && connectionBannerTitle && (
          <div className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            <div className="font-medium">{connectionBannerTitle}</div>
            {connectionBannerBody ? (
              <div className="mt-0.5">{connectionBannerBody}</div>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {showHealthLink && (
                <button
                  type="button"
                  onClick={openHealthDiagnostics}
                  className="inline-flex items-center text-[11px] font-medium text-warn underline underline-offset-2"
                >
                  {t(
                    "quickIngest.checkHealthLink",
                    "Check server health in Health & diagnostics"
                  )}
                </button>
              )}
              {ingestConnectionStatus === "offline" && checkOnce ? (
                <Button
                  size="small"
                  onClick={() => {
                    try {
                      checkOnce?.()
                    } catch {
                      // ignore retry failures
                    }
                  }}>
                  {qi("retryConnection", "Retry connection")}
                </Button>
              ) : null}
              {ingestConnectionStatus === "offlineBypass" &&
                disableOfflineBypass && (
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await disableOfflineBypass()
                      } catch {
                        // ignore disable errors; Quick Ingest will update when connection state changes
                      }
                    }}>
                    {t(
                      "quickIngest.disableOfflineMode",
                      "Disable offline mode"
                    )}
                  </Button>
                )}
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
                'Per-type settings (Audio/PDF/Video) apply to all items of that type.'
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
              multiple
              style={{ display: 'none' }}
              id="qi-file-input"
              data-testid="qi-file-input"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                addLocalFiles(files)
                e.currentTarget.value = ''
              }}
              accept=".pdf,.txt,.rtf,.doc,.docx,.md,.epub,application/pdf,text/plain,application/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,audio/*,video/*"
            />
            <div
              className="mt-3 w-full rounded-md border border-dashed border-border bg-surface2 px-4 py-4 text-center"
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={handleFileDrop}
            >
              <div className="flex flex-col gap-2 items-center justify-center">
                <Typography.Text className="text-base font-medium">
                  {qi('dragAndDrop', 'Drag and drop files')}
                </Typography.Text>
                <Typography.Text type="secondary" className="text-xs">
                  {qi('dragAndDropHint', 'Docs, PDFs, audio, and video are all welcome.')}
                </Typography.Text>
                <div className="flex items-center gap-2">
                  <Button onClick={() => document.getElementById('qi-file-input')?.click()} disabled={running}>
                    {t('quickIngest.addFiles') || 'Browse files'}
                  </Button>
                  <Button
                    onClick={pasteFromClipboard}
                    disabled={running}
                    aria-label={qi('pasteFromClipboard', 'Paste URLs from clipboard')}
                    title={qi('pasteFromClipboard', 'Paste URLs from clipboard')}
                  >
                    {qi('pasteFromClipboard', 'Paste URLs from clipboard')}
                  </Button>
                </div>
              </div>
            </div>
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
                  onPressEnter={(e) => {
                    e.preventDefault()
                    addUrlsFromInput(pendingUrlInput)
                  }}
                  disabled={running}
                  aria-label={qi('urlsInputAria', 'Paste URLs input')}
                  title={qi('urlsInputAria', 'Paste URLs input')}
                />
                  <Button
                    type="primary"
                    onClick={() => addUrlsFromInput(pendingUrlInput)}
                    disabled={running}
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
                  disabled={running}
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
                    disabled={!(selectedRow || selectedFile)}>
                    {qi('openInspector', 'Open Inspector')}
                  </Button>
                </div>
              </div>
            <div className="text-xs text-text-subtle mb-2">
              {qi(
                'queueDescription',
                'Staged items appear here. Click a row to open the Inspector; badges show defaults, custom edits, or items needing attention.'
              )}
            </div>
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {rows.map((row) => {
                const status = statusForUrlRow(row)
                const isSelected = selectedRowId === row.id
                const detected = row.type === 'auto' ? inferIngestTypeFromUrl(row.url) : row.type
                const res = resultById.get(row.id)
                const isProcessing = running && !res?.status
                let runTag: React.ReactNode = null
                if (res?.status === 'ok') runTag = <Tag color="green">{qi('statusDone', 'Done')}</Tag>
                else if (res?.status === 'error') runTag = (
                  <AntTooltip title={res.error || qi('statusFailed', 'Failed')}>
                    <Tag color="red">{qi('statusFailed', 'Failed')}</Tag>
                  </AntTooltip>
                )
                else if (running) runTag = <Tag icon={<Spin size="small" />} color="blue">{qi('statusRunning', 'Running')}</Tag>
                const pendingTag =
                  ingestBlocked && !running && (!res || !res.status)
                    ? (
                      <Tag>
                        {pendingLabel}
                      </Tag>
                    )
                    : null

                return (
                  <div
                    key={row.id}
                  className={`group relative rounded-md border px-3 py-2 transition hover:border-primary ${isSelected ? 'border-primary shadow-sm' : 'border-border'}`}
                  onClick={() => {
                    setSelectedRowId(row.id)
                    setSelectedFileIndex(null)
                    setInspectorOpen(true)
                  }}
                >
                    <Button
                      size="small"
                      type="text"
                      className={`absolute right-2 top-2 opacity-0 transition focus:opacity-100 group-hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`}
                      aria-label="Open Inspector for this item"
                      title="Open Inspector for this item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedRowId(row.id)
                        setSelectedFileIndex(null)
                        setInspectorOpen(true)
                      }}>
                      <Info className="w-4 h-4 text-text-subtle" />
                    </Button>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {typeIcon(detected)}
                        <div className="flex flex-col">
                          <Typography.Text className="text-sm font-medium">
                            {row.url ? row.url : qi('untitledUrl', 'Untitled URL')}
                          </Typography.Text>
                          <div className="flex items-center gap-2 text-[11px] text-text-subtle">
                            <Tag color="geekblue">{detected.toUpperCase()}</Tag>
                            {status.reason ? <span className="text-orange-600">{status.reason}</span> : (
                              <span>{qi('defaultsApplied', 'Defaults will be applied.')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag color={status.color === 'default' ? undefined : status.color}>{status.label}</Tag>
                        {runTag}
                        {pendingTag}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      <Input
                        placeholder={qi('urlPlaceholder', 'https://...')}
                        value={row.url}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateRow(row.id, { url: e.target.value })}
                        disabled={running}
                        aria-label={qi('sourceUrlAria', 'Source URL')}
                        title={qi('sourceUrlAria', 'Source URL')}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
                        <Select
                          className="min-w-32"
                          value={row.type}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(v) => updateRow(row.id, { type: v as Entry['type'] })}
                          aria-label={qi('forceMediaType', 'Force media type')}
                          title={qi('forceMediaType', 'Force media type')}
                          options={[
                            { label: qi('typeAuto', 'Auto'), value: 'auto' },
                            { label: qi('typeHtml', 'HTML'), value: 'html' },
                            { label: qi('typePdf', 'PDF'), value: 'pdf' },
                            { label: qi('typeDocument', 'Document'), value: 'document' },
                            { label: qi('typeAudio', 'Audio'), value: 'audio' },
                            { label: qi('typeVideo', 'Video'), value: 'video' }
                          ]}
                          disabled={running}
                        />
                        {res?.status === "error" && (
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              void retrySingleRow(row)
                            }}
                            disabled={running}
                            aria-label={qi("retryItemAria", "Retry this item")}
                            title={qi("retryItemAria", "Retry this item")}
                          >
                            {qi("retryItem", "Retry")}
                          </Button>
                        )}
                          <Button
                            size="small"
                            danger
                            onClick={(e) => { e.stopPropagation(); removeRow(row.id) }}
                            disabled={running}
                            aria-label="Remove this row from queue"
                            title="Remove this row from queue"
                          >
                            {t('quickIngest.remove') || 'Remove'}
                          </Button>
                      </div>
                      {isProcessing && (
                        <div className="mt-1">
                          <ProcessingIndicator
                            label={qi("processingItem", "Processing...")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {localFiles.map((f, idx) => {
                const status = statusForFile(f)
                const isSelected = selectedFileIndex === idx
                const type = fileTypeFromName(f)
                const match = getResultForFile(f)
                const runStatus = match?.status
                const isProcessing = running && !runStatus
                let runTag: React.ReactNode = null
                if (runStatus === 'ok') runTag = <Tag color="green">{qi('statusDone', 'Done')}</Tag>
                else if (runStatus === 'error') {
                  runTag = (
                    <AntTooltip title={match?.error || qi('statusFailed', 'Failed')}>
                      <Tag color="red">{qi('statusFailed', 'Failed')}</Tag>
                    </AntTooltip>
                  )
                } else if (running) runTag = <Tag icon={<Spin size="small" />} color="blue">{qi('statusRunning', 'Running')}</Tag>
                const pendingTag =
                  ingestBlocked && !running && !runStatus
                    ? (
                      <Tag>
                        {t(
                          "quickIngest.pendingLabel",
                          "Pending — will run when connected"
                        )}
                      </Tag>
                    )
                    : null

                return (
                  <div
                    key={`${f.name}-${idx}`}
                  className={`group relative rounded-md border px-3 py-2 transition hover:border-primary ${isSelected ? 'border-primary shadow-sm' : 'border-border'}`}
                  onClick={() => {
                    setSelectedFileIndex(idx)
                    setSelectedRowId(null)
                    setInspectorOpen(true)
                  }}
                >
                    <Button
                      size="small"
                      type="text"
                      className={`absolute right-2 top-2 opacity-0 transition focus:opacity-100 group-hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`}
                      aria-label="Open Inspector for this file"
                      title="Open Inspector for this file"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFileIndex(idx)
                        setSelectedRowId(null)
                        setInspectorOpen(true)
                      }}>
                      <Info className="w-4 h-4 text-text-subtle" />
                    </Button>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {typeIcon(type)}
                        <div className="flex flex-col">
                          <Typography.Text className="text-sm font-medium truncate max-w-[360px]">
                            {f.name}
                          </Typography.Text>
                          <div className="flex items-center gap-2 text-[11px] text-text-subtle">
                            <Tag color="geekblue">{type.toUpperCase()}</Tag>
                            <span>{formatBytes((f as any)?.size)} {f.type ? `· ${f.type}` : ''}</span>
                            {status.reason ? <span className="text-orange-600">{status.reason}</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag color={status.color === 'default' ? undefined : status.color}>{status.label}</Tag>
                        {runTag}
                        {pendingTag}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                        {runStatus === "error" && (
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              void retrySingleFile(f)
                            }}
                            disabled={running}
                            aria-label={qi("retryItemAria", "Retry this item")}
                            title={qi("retryItemAria", "Retry this item")}
                          >
                            {qi("retryItem", "Retry")}
                          </Button>
                        )}
                        <Button
                          size="small"
                          danger
                          aria-label="Remove this file from queue"
                          title="Remove this file from queue"
                          onClick={(e) => {
                            e.stopPropagation()
                            setLocalFiles((prev) => {
                              const next = prev.filter((_, i) => i !== idx)
                              if (selectedFileIndex === idx) {
                                setSelectedFileIndex(null)
                              }
                              return next
                            })
                          }}
                          disabled={running}
                        >
                          {t('quickIngest.remove') || 'Remove'}
                        </Button>
                      </div>
                      {isProcessing && (
                        <div className="mt-1">
                          <ProcessingIndicator
                            label={qi("processingItem", "Processing...")}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}

              {rows.length === 0 && localFiles.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-text-muted">
                  {qi('emptyQueue', 'No items queued yet. Drop files or add URLs to start.')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface p-3 space-y-3">
            <Typography.Title level={5} className="!mb-2">{t('quickIngest.commonOptions') || 'Ingestion options'}</Typography.Title>
            <Space wrap size="middle" align="center">
                <Space align="center">
                  <span>{qi('analysisLabel', 'Analysis')}</span>
                  <Switch
                    aria-label="Ingestion options \u2013 analysis"
                    title="Toggle analysis"
                    checked={common.perform_analysis}
                    onChange={(v) =>
                      setCommon((c) => ({ ...c, perform_analysis: v }))
                    }
                    disabled={running}
                />
              </Space>
                <Space align="center">
                  <span>{qi('chunkingLabel', 'Chunking')}</span>
                  <Switch
                    aria-label="Ingestion options \u2013 chunking"
                    title="Toggle chunking"
                    checked={common.perform_chunking}
                  onChange={(v) =>
                      setCommon((c) => ({ ...c, perform_chunking: v }))
                    }
                    disabled={running}
                />
              </Space>
                <Space align="center">
                  <span>{qi('overwriteLabel', 'Overwrite existing')}</span>
                  <Switch
                    aria-label="Ingestion options \u2013 overwrite existing"
                    title="Toggle overwrite existing"
                    checked={common.overwrite_existing}
                    onChange={(v) =>
                      setCommon((c) => ({ ...c, overwrite_existing: v }))
                    }
                    disabled={running}
                />
              </Space>
            </Space>

            {ragEmbeddingLabel && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-subtle">
                <span>
                  {t(
                    "quickIngest.ragEmbeddingHintInline",
                    "Uses {{label}} for RAG search.",
                    { label: ragEmbeddingLabel }
                  )}
                </span>
                <button
                  type="button"
                  onClick={openModelSettings}
                  className="text-primary underline underline-offset-2"
                >
                  {t("option:header.modelSettings", "Model settings")}
                </button>
              </div>
            )}

            {rows.some((r) => (r.type === 'audio' || (r.type === 'auto' && inferIngestTypeFromUrl(r.url) === 'audio'))) && (
              <div className="space-y-1">
                <Typography.Title level={5} className="!mb-1">{t('quickIngest.audioOptions') || 'Audio options'}</Typography.Title>
                <Space className="w-full">
                  <Input
                    placeholder={t('quickIngest.audioLanguage') || 'Language (e.g., en)'}
                    value={firstAudioRow?.audio?.language || ''}
                    onChange={(e) => setRows((rs) => rs.map((x) => {
                      const isAudio = x.type === 'audio' || (x.type === 'auto' && inferIngestTypeFromUrl(x.url) === 'audio')
                      if (!isAudio) return x
                      return { ...x, audio: { ...(x.audio || {}), language: e.target.value } }
                    }))}
                    disabled={running}
                    aria-label="Audio language"
                    title="Audio language"
                  />
                    <Select
                      className="min-w-40"
                    value={firstAudioRow?.audio?.diarize ?? false}
                    onChange={(v) => setRows((rs) => rs.map((x) => {
                      const isAudio = x.type === 'audio' || (x.type === 'auto' && inferIngestTypeFromUrl(x.url) === 'audio')
                      if (!isAudio) return x
                      return { ...x, audio: { ...(x.audio || {}), diarize: Boolean(v) } }
                    }))}
                    aria-label="Audio diarization toggle"
                    title="Audio diarization toggle"
                    options={[
                      { label: qi('audioDiarizationOff', 'Diarization: Off'), value: false },
                      { label: qi('audioDiarizationOn', 'Diarization: On'), value: true }
                    ]}
                    disabled={running}
                  />
                </Space>
                <Typography.Text type="secondary" className="text-xs">
                  {t('quickIngest.audioDiarizationHelp') || 'Turn on to separate speakers in transcripts; applies to all audio rows in this batch.'}
                </Typography.Text>
                <Typography.Text
                  className="text-[11px] text-text-subtle block"
                  title={qi('audioSettingsTitle', 'These audio settings apply to every audio item in this run.')}>
                  {qi('audioSettingsHint', 'These settings apply to every audio item in this run.')}
                </Typography.Text>
              </div>
            )}

            {rows.some((r) => (r.type === 'document' || r.type === 'pdf' || (r.type === 'auto' && ['document', 'pdf'].includes(inferIngestTypeFromUrl(r.url))))) && (
              <div className="space-y-1">
                <Typography.Title level={5} className="!mb-1">{t('quickIngest.documentOptions') || 'Document options'}</Typography.Title>
                  <Select
                    className="min-w-40"
                    value={firstDocumentRow?.document?.ocr ?? true}
                    onChange={(v) => setRows((rs) => rs.map((x) => {
                      const isDoc = x.type === 'document' || x.type === 'pdf' || (x.type === 'auto' && ['document', 'pdf'].includes(inferIngestTypeFromUrl(x.url)))
                      if (!isDoc) return x
                      return { ...x, document: { ...(x.document || {}), ocr: Boolean(v) } }
                    }))}
                    aria-label="OCR toggle"
                    title="OCR toggle"
                    options={[
                      { label: qi('ocrOff', 'OCR: Off'), value: false },
                      { label: qi('ocrOn', 'OCR: On'), value: true }
                    ]}
                    disabled={running}
                  />
                <Typography.Text type="secondary" className="text-xs">
                  {t('quickIngest.ocrHelp') || 'OCR helps extract text from scanned PDFs or images; applies to all document/PDF rows.'}
                </Typography.Text>
                <Typography.Text
                  className="text-[11px] text-text-subtle block"
                  title={qi('documentSettingsTitle', 'These document settings apply to every document/PDF in this run.')}>
                  {qi('documentSettingsHint', 'Applies to all document/PDF items in this batch.')}
                </Typography.Text>
              </div>
            )}

            {rows.some((r) => (r.type === 'video' || (r.type === 'auto' && inferIngestTypeFromUrl(r.url) === 'video'))) && (
              <div className="space-y-1">
                <Typography.Title level={5} className="!mb-1">{t('quickIngest.videoOptions') || 'Video options'}</Typography.Title>
                <Select
                  className="min-w-40"
                  value={firstVideoRow?.video?.captions ?? false}
                  onChange={(v) => setRows((rs) => rs.map((x) => {
                    const isVideo = x.type === 'video' || (x.type === 'auto' && inferIngestTypeFromUrl(x.url) === 'video')
                    if (!isVideo) return x
                    return { ...x, video: { ...(x.video || {}), captions: Boolean(v) } }
                  }))}
                  aria-label="Captions toggle"
                  title="Captions toggle"
                  options={[
                    { label: qi('captionsOff', 'Captions: Off'), value: false },
                    { label: qi('captionsOn', 'Captions: On'), value: true }
                  ]}
                  disabled={running}
                />
                <Typography.Text type="secondary" className="text-xs">
                  {t('quickIngest.captionsHelp') || 'Include timestamps/captions for all video rows; helpful for search and summaries.'}
                </Typography.Text>
                <Typography.Text
                  className="text-[11px] text-text-subtle block"
                  title={qi('videoSettingsTitle', 'These video settings apply to every video in this run.')}>
                  {qi('videoSettingsHint', 'Applies to all video items in this batch.')}
                </Typography.Text>
              </div>
            )}

            <div className="rounded-md border border-border bg-surface2 p-3">
              <div className="flex flex-col gap-2">
                {(() => {
                  const done = processedCount || results.length
                  const total = liveTotalCount || totalPlanned
                  return (
                    <>
                      <div className="sr-only" aria-live="polite" role="status">
                        {running && total > 0
                          ? t('quickIngest.progress', 'Processing {{done}} / {{total}} items…', {
                              done,
                              total
                            })
                          : qi('itemsReadySr', '{{count}} item(s) ready', {
                              count: plannedCount || 0
                            })}
                      </div>
                    </>
                  )
                })()}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between text-sm text-text">
                  <div className="flex-1">
                    <div className="rounded-md border border-border bg-surface2 p-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <Typography.Text strong>
                            {t(
                              'quickIngest.storageHeading',
                              'Where ingest results are stored'
                            )}
                          </Typography.Text>
                          <Space align="center" size="small">
                            <Switch
                              aria-label={
                                storeRemote
                                  ? t(
                                      'quickIngest.storeRemoteAria',
                                      'Store ingest results on your tldw server'
                                    )
                                  : t(
                                      'quickIngest.processOnlyAria',
                                      'Process ingest results locally only'
                                    )
                              }
                              title={
                                storeRemote
                                  ? t(
                                      'quickIngest.storeRemote',
                                      'Store to remote DB'
                                    )
                                  : t('quickIngest.process', 'Process locally')
                              }
                              checked={storeRemote}
                              onChange={setStoreRemote}
                              disabled={running || reviewBeforeStorage}
                            />
                            <Typography.Text>
                              {storageLabel}
                            </Typography.Text>
                          </Space>
                        </div>
                        <div className="mt-1 space-y-1 text-xs text-text-muted">
                          <div className="flex items-start gap-2">
                            <span className="mt-[2px]">•</span>
                            <span>
                              {t(
                                'quickIngest.storageServerDescription',
                                'Stored on your tldw server (recommended for RAG and shared workspaces).'
                              )}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-[2px]">•</span>
                            <span>
                              {t(
                                'quickIngest.storageLocalDescription',
                                'Kept in this browser only; no data written to your server.'
                              )}
                            </span>
                          </div>
                          {!storageHintSeen && (
                            <div className="pt-1">
                              <button
                                type="button"
                                className="text-xs underline text-primary hover:text-primaryStrong"
                                onClick={() => {
                                  try {
                                    const docsUrl =
                                      t(
                                        'quickIngest.storageDocsUrl',
                                        'https://github.com/rmusser01/tldw_browser_assistant'
                                      ) ||
                                      'https://github.com/rmusser01/tldw_browser_assistant'
                                    window.open(
                                      docsUrl,
                                      '_blank',
                                      'noopener,noreferrer'
                                    )
                                  } catch {
                                    // ignore navigation errors
                                  } finally {
                                    try {
                                      setStorageHintSeen(true)
                                    } catch {
                                      // ignore storage errors
                                    }
                                  }
                                }}
                              >
                                {t(
                                  'quickIngest.storageDocsLink',
                                  'Learn more about ingest & storage'
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
                          <div className="flex items-start justify-between gap-2">
                            <Space align="center" size="small">
                              <Switch
                                aria-label={qi(
                                  "reviewBeforeStorage",
                                  "Review before saving"
                                )}
                                checked={reviewBeforeStorage}
                                onChange={handleReviewToggle}
                                disabled={running}
                              />
                              <Typography.Text>
                                {qi(
                                  "reviewBeforeStorage",
                                  "Review before saving"
                                )}
                              </Typography.Text>
                            </Space>
                            {reviewBeforeStorage ? (
                              <Tag color="blue">
                                {qi("reviewEnabled", "Review mode")}
                              </Tag>
                            ) : null}
                          </div>
                          <div className="mt-2 flex items-start gap-2">
                            <span className="mt-[2px]">•</span>
                            <span>
                              {qi(
                                "reviewBeforeStorageHint",
                                "Process now, then edit drafts locally before committing to your server."
                              )}
                            </span>
                          </div>
                          <div className="mt-1 flex items-start gap-2">
                            <span className="mt-[2px]">•</span>
                            <span>
                              {qi(
                                "reviewStorageCap",
                                "Local drafts are capped at {{cap}}.",
                                { cap: formatBytes(DRAFT_STORAGE_CAP_BYTES) }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span
                    className="mt-2 text-xs text-text-subtle sm:mt-0"
                    title={
                      running && (liveTotalCount || totalPlanned) > 0
                        ? qi('ingestProgressTitle', 'Current ingest progress')
                        : qi('itemsReadyTitle', 'Items ready to ingest')
                    }
                  >
                    {(() => {
                      const done = processedCount || results.length
                      const total = liveTotalCount || totalPlanned
                      if (running && total > 0) {
                        return t('quickIngest.progress', 'Running quick ingest — processing {{done}} / {{total}} items…', {
                          done,
                          total
                        })
                      }
                      return qi('itemsReady', '{{count}} item(s) ready', {
                        count: plannedCount || 0
                      })
                    })()}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                {showProcessQueuedButton && (
                  <Button
                    onClick={run}
                    disabled={running || plannedCount === 0 || ingestBlocked}
                    aria-label={t(
                      "quickIngest.processQueuedItemsAria",
                      "Process queued Quick Ingest items"
                    )}
                    title={t(
                      "quickIngest.processQueuedItems",
                      "Process queued items"
                    )}>
                    {t(
                      "quickIngest.processQueuedItems",
                      "Process queued items"
                    )}
                  </Button>
                )}
                <Button
                  type="primary"
                  loading={running}
                  onClick={run}
                  disabled={plannedCount === 0 || running || ingestBlocked}
                  aria-label={
                    ingestBlocked
                      ? ingestConnectionStatus === "unconfigured"
                        ? t(
                            "quickIngest.queueOnlyUnconfiguredAria",
                            "Server not configured \u2014 queue items to process after you configure a server."
                          )
                        : ingestConnectionStatus === "offlineBypass"
                          ? t(
                              "quickIngest.queueOnlyOfflineBypassAria",
                              "Offline mode enabled \u2014 queue items to process after you disable offline mode."
                            )
                          : t(
                              "quickIngest.queueOnlyOfflineAria",
                              "Offline \u2014 queue items to process later"
                            )
                      : t("quickIngest.runAria", "Run quick ingest")
                  }
                  title={
                    ingestBlocked
                      ? ingestConnectionStatus === "unconfigured"
                        ? t(
                            "quickIngest.queueOnlyUnconfigured",
                            "Queue only \u2014 server not configured"
                          )
                        : ingestConnectionStatus === "offlineBypass"
                          ? t(
                              "quickIngest.queueOnlyOfflineBypass",
                              "Queue only \u2014 offline mode enabled"
                            )
                          : t(
                              "quickIngest.queueOnlyOffline",
                              "Queue only \u2014 server offline"
                            )
                      : t("quickIngest.runLabel", "Run quick ingest")
                  }>
                  {ingestBlocked
                    ? ingestConnectionStatus === "unconfigured"
                      ? t(
                          "quickIngest.queueOnlyUnconfigured",
                          "Queue only \u2014 server not configured"
                        )
                      : ingestConnectionStatus === "offlineBypass"
                        ? t(
                            "quickIngest.queueOnlyOfflineBypass",
                            "Queue only \u2014 offline mode enabled"
                          )
                        : t(
                            "quickIngest.queueOnlyOffline",
                            "Queue only \u2014 server offline"
                          )
                    : reviewBeforeStorage
                      ? qi("reviewRunLabel", "Review")
                      : storeRemote
                        ? t("quickIngest.ingest", "Ingest")
                        : t("quickIngest.process", "Process")}
                </Button>
                <Button
                  onClick={onClose}
                  disabled={running}
                  aria-label={qi('closeQuickIngest', 'Close quick ingest')}
                  title={qi('closeQuickIngest', 'Close quick ingest')}>
                  {t('quickIngest.cancel') || 'Cancel'}
                </Button>
              </div>
              {ingestBlocked && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-warn">
                  <span>
                    {ingestConnectionStatus === "unconfigured"
                      ? t(
                          "quickIngest.unconfiguredFooter",
                          "Server not configured: items are staged here and will process after you configure a server URL and API key under Settings \u2192 tldw server."
                        )
                      : ingestConnectionStatus === "offlineBypass"
                        ? t(
                            "quickIngest.offlineBypassFooter",
                            "Offline mode enabled: items are staged here and will process once you disable offline mode."
                          )
                        : t(
                            "quickIngest.offlineFooter",
                            "Offline mode: items are staged here and will process once your server reconnects."
                          )}
                  </span>
                  {ingestConnectionStatus === "offline" && checkOnce ? (
                    <Button
                      size="small"
                      onClick={() => {
                        try {
                          checkOnce?.()
                        } catch {
                          // ignore check errors; footer is informational
                        }
                      }}>
                      {qi("retryConnection", "Retry connection")}
                    </Button>
                  ) : null}
                  {ingestConnectionStatus === "offlineBypass" &&
                    disableOfflineBypass && (
                      <Button
                        size="small"
                        onClick={async () => {
                          try {
                            await disableOfflineBypass()
                          } catch {
                            // ignore disable errors; Quick Ingest will update when connection state changes
                          }
                        }}>
                        {t(
                          "quickIngest.disableOfflineMode",
                          "Disable offline mode"
                        )}
                      </Button>
                    )}
                </div>
              )}
              {progressMeta.total > 0 && (
                <div className="mt-2">
                  <Progress percent={progressMeta.pct} showInfo={false} size="small" />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>
                      {qi(
                        'processedCount',
                        '{{done}}/{{total}} processed',
                        { done: progressMeta.done, total: progressMeta.total }
                      )}
                    </span>
                    {progressMeta.elapsedLabel ? (
                      <span>
                        {qi('elapsedLabel', 'Elapsed {{time}}', {
                          time: progressMeta.elapsedLabel
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out ${inspectorOpen && (selectedRow || selectedFile) ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="absolute right-0 top-0 h-full w-40 bg-gradient-to-l from-primary/30 via-primary/10 to-transparent blur-md" />
        </div>

        <QuickIngestInspectorDrawer
          open={inspectorOpen && (!!selectedRow || !!selectedFile)}
          onClose={() => setInspectorOpen(false)}
          showIntro={showInspectorIntro}
          onDismissIntro={handleDismissInspectorIntro}
          qi={qi}
          selectedRow={selectedRow}
          selectedFile={selectedFile}
          typeIcon={typeIcon}
          inferIngestTypeFromUrl={inferIngestTypeFromUrl}
          fileTypeFromName={fileTypeFromName}
          statusForUrlRow={statusForUrlRow}
          statusForFile={statusForFile}
          formatBytes={formatBytes}
        />

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
                      await loadSpec(v, { reportDiff: true, persist: true })
                    }}
                  />
                </Space>
                <Button
                  size="small"
                  aria-label={qi('reloadSpecAria', 'Reload advanced spec from server')}
                  title={qi('reloadSpecAria', 'Reload advanced spec from server')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void loadSpec(true, { reportDiff: true, persist: true })
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
                  const allMatched = resolvedAdvSchema.filter(match)

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
                          const ariaLabel = `${g} \u2013 ${f.title || f.name}`
                          const isAlsoRecommended =
                            g !== "Recommended" &&
                            recommendedNameSet.has(f.name)
                          const canShowDetailsHere =
                            !!f.description &&
                            (g === "Recommended" ||
                              !recommendedNameSet.has(f.name))
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
                          if (f.enum && f.enum.length > 0) {
                            return (
                              <div key={f.name} className="flex items-center gap-2">
                                {Label}
                                <Select
                                  className="w-72"
                                  allowClear
                                  showSearch={isTranscriptionModel}
                                  loading={isTranscriptionModel && transcriptionModelsLoading}
                                  aria-label={ariaLabel}
                                  value={v}
                                  onChange={setV as any}
                                  options={f.enum.map((e) => ({ value: e, label: String(e) }))}
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

        {results.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
      <Typography.Title level={5} className="!mb-0">{t('quickIngest.results') || 'Results'}</Typography.Title>
              <div className="flex items-center gap-2 text-xs">
                <Tag color="blue">
                  {qi('resultsCount', '{{count}} item(s)', { count: results.length })}
                </Tag>
                <Button
                  size="small"
                  onClick={retryFailedUrls}
                  disabled={!results.some((r) => r.status === 'error')}>
                  {qi('retryFailedUrls', 'Retry failed URLs')}
                </Button>
                <Select
                  size="small"
                  className="w-32"
                  aria-label={t(
                    "quickIngest.resultsFilterAria",
                    "Filter results by status"
                  ) as string}
                  value={resultsFilter}
                  onChange={(value) =>
                    setResultsFilter(value as ResultsFilter)
                  }
                  options={[
                    {
                      value: RESULT_FILTERS.ALL,
                      label: t(
                        "quickIngest.resultsFilterAll",
                        "All"
                      )
                    },
                    {
                      value: RESULT_FILTERS.ERROR,
                      label: t(
                        "quickIngest.resultsFilterFailed",
                        "Failed only"
                      )
                    },
                    {
                      value: RESULT_FILTERS.SUCCESS,
                      label: t(
                        "quickIngest.resultsFilterSucceeded",
                        "Succeeded only"
                      )
                    }
                  ]}
                />
              </div>
            </div>
            {resultSummary && !running && (
              <div className="mt-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-text">
                <div className="font-medium">
                  {resultSummary.failCount === 0
                    ? t(
                        "quickIngest.summaryAllSucceeded",
                        "Quick ingest completed successfully."
                      )
                    : t(
                        "quickIngest.summarySomeFailed",
                        "Quick ingest completed with some errors."
                      )}
                </div>
                <div className="mt-1">
                  {t(
                    "quickIngest.summaryCounts",
                    "{{success}} succeeded \u00b7 {{failed}} failed",
                    {
                      success: resultSummary.successCount,
                      failed: resultSummary.failCount
                    }
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Primary next-step CTA: open the first successful media item in Review. */}
                  {shouldStoreRemote && firstResultWithMedia && (
                    <Button
                      size="small"
                      type="primary"
                      data-testid="quick-ingest-open-media-primary"
                      onClick={() => {
                        openInMediaViewer(firstResultWithMedia)
                      }}>
                      {t(
                        "quickIngest.openFirstInMedia",
                        "Open in Media viewer"
                      )}
                    </Button>
                  )}
                  {reviewBatchId ? (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => {
                        if (!reviewBatchId) return
                        void tryOpenContentReview(reviewBatchId)
                      }}
                    >
                      {qi("openContentReview", "Open Content Review")}
                    </Button>
                  ) : null}
                  {resultSummary.failCount > 0 && (
                    <Button
                      size="small"
                      onClick={retryFailedUrls}
                    >
                      {qi("retryFailedUrls", "Retry failed URLs")}
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="default"
                    onClick={openHealthDiagnostics}
                  >
                    {t(
                      "settings:healthSummary.diagnostics",
                      "Health & diagnostics"
                    )}
                  </Button>
                </div>
              </div>
            )}
            <List
              size="small"
              dataSource={visibleResults}
              renderItem={(item) => {
                const mediaId = item.status === "ok" && shouldStoreRemote ? mediaIdFromPayload(item.data) : null
                const hasMediaId = mediaId != null
                const actions: React.ReactNode[] = []
                if (processOnly && item.status === "ok") {
                  actions.push(
                    <button
                      key="dl"
                      type="button"
                      onClick={() => downloadJson(item)}
                      aria-label={`Download JSON for ${item.url || item.fileName || "item"}`}
                      className="text-primary hover:underline"
                    >
                      {t("quickIngest.downloadJson") || "Download JSON"}
                    </button>
                  )
                }
                if (hasMediaId) {
                  actions.push(
                    <button
                      key="open-media"
                      type="button"
                      onClick={() => openInMediaViewer(item)}
                      className="text-primary hover:underline"
                    >
                      {t("quickIngest.openInMedia", "Open in Media viewer")}
                    </button>
                  )
                  actions.push(
                    <button
                      key="discuss-chat"
                      type="button"
                      onClick={() => discussInChat(item)}
                      className="text-primary hover:underline"
                    >
                      {t("quickIngest.discussInChat", "Discuss in chat")}
                    </button>
                  )
                }
                return (
                  <List.Item actions={actions}>
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <Tag color={item.status === "ok" ? "green" : "red"}>
                          {item.status.toUpperCase()}
                        </Tag>
                        <span>{item.type.toUpperCase()}</span>
                      </div>
                      <div className="text-xs text-text-subtle break-all">
                        {item.url || item.fileName}
                      </div>
                      {hasMediaId ? (
                        <div className="text-[11px] text-text-subtle">
                          {t("quickIngest.savedAsMedia", "Saved as media {{id}}", {
                            id: String(mediaId)
                          })}
                        </div>
                      ) : null}
                      {item.error ? (
                        <div className="text-xs text-danger">{item.error}</div>
                      ) : null}
                    </div>
                  </List.Item>
                )
              }}
            />
          </div>
        )}
      </Space>
      </div>
    </Modal>
  )
}

export default QuickIngestModal
