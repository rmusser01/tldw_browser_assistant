/**
 * Represents a status summary for Quick Ingest items.
 * @property label - Display text for the status.
 * @property color - Color identifier for the status badge.
 * @property reason - Optional explanation for the status (e.g., error details).
 */
export type StatusSummary = {
  label: string
  color: string
  reason?: string
}

export type QueuedFileStub = {
  id: string
  name: string
  size: number
  type?: string
}

export type ResultItem = {
  id: string
  status: "ok" | "error"
  url?: string
  fileName?: string
  type: string
  data?: unknown
  error?: string
}

export type ResultItemWithMediaId = ResultItem & {
  mediaId: string | number | null
}

export type ResultSummary = {
  successCount: number
  failCount: number
}

export type ResultFilters = {
  ALL: string
  ERROR: string
  SUCCESS: string
}

export type ResultsFilter = ResultFilters[keyof ResultFilters]

/**
 * Tab identifiers for the Quick Ingest modal.
 */
export type QuickIngestTab = "queue" | "options" | "results"

/**
 * Common processing options shared across all media types.
 */
export type CommonOptions = {
  perform_analysis: boolean
  perform_chunking: boolean
  overwrite_existing: boolean
}

/**
 * Type-specific default options applied per media type.
 */
export type TypeDefaults = {
  audio?: { language?: string; diarize?: boolean }
  document?: { ocr?: boolean }
  video?: { captions?: boolean }
}

/**
 * Preset identifiers for Quick Ingest option configurations.
 */
export type IngestPreset = "quick" | "standard" | "deep" | "custom"

/**
 * Configuration for a preset, defining all option values.
 */
export type PresetConfig = {
  common: CommonOptions
  storeRemote: boolean
  reviewBeforeStorage: boolean
  typeDefaults: TypeDefaults
  advancedValues?: Record<string, any>
}

/**
 * Badge state for tab indicators.
 */
export type TabBadgeState = {
  /** Number of items in queue (for Queue tab) */
  queueCount: number
  /** Whether options have been modified from defaults (for Options tab) */
  optionsModified: boolean
  /** Whether processing is currently running (for Results tab) */
  isProcessing: boolean
}
