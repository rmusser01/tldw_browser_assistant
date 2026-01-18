/**
 * Collections Types
 * Types for the Collections Playground feature - reading list, highlights, templates, and import/export
 */

// ─────────────────────────────────────────────────────────────────────────────
// Reading List Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReadingStatus = "saved" | "reading" | "read" | "archived"

export interface ReadingItem {
  id: string
  media_id?: string
  media_uuid?: string
  title: string
  url?: string
  canonical_url?: string
  domain?: string
  summary?: string
  notes?: string
  published_at?: string
  status?: ReadingStatus
  processing_status?: string
  favorite: boolean
  tags: string[]
  created_at?: string
  updated_at?: string
  read_at?: string
  text?: string
  clean_html?: string
  metadata?: Record<string, unknown>
  reading_time_minutes?: number
  tts_audio_url?: string
}

export interface ReadingItemSummary {
  id: string
  title: string
  url?: string
  canonical_url?: string
  domain?: string
  summary?: string
  notes?: string
  status?: ReadingStatus
  favorite: boolean
  tags: string[]
  reading_time_minutes?: number
  created_at?: string
  updated_at?: string
  published_at?: string
}

export interface AddReadingItemRequest {
  url: string
  title?: string
  tags?: string[]
  notes?: string
  status?: ReadingStatus
  favorite?: boolean
  summary?: string
  content?: string
}

export interface UpdateReadingItemRequest {
  status?: ReadingStatus
  favorite?: boolean
  tags?: string[]
  notes?: string
  title?: string
}

export interface ReadingListParams {
  page?: number
  size?: number
  q?: string
  status?: ReadingStatus | ReadingStatus[]
  tags?: string[]
  domain?: string
  favorite?: boolean
  sort?: "updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "title_asc" | "title_desc" | "relevance"
  date_from?: string
  date_to?: string
}

export interface ReadingListResponse {
  items: ReadingItemSummary[]
  total: number
  page: number
  size: number
  offset?: number
  limit?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlights Types
// ─────────────────────────────────────────────────────────────────────────────

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple"
export type HighlightState = "active" | "stale"
export type AnchoringStrategy = "fuzzy_quote" | "exact_offset"

export interface Highlight {
  id: string
  item_id: string
  item_title?: string
  quote: string
  note?: string
  color?: HighlightColor
  state: HighlightState
  anchor_strategy: AnchoringStrategy
  start_offset?: number
  end_offset?: number
  context_before?: string
  context_after?: string
  created_at: string
}

export interface CreateHighlightRequest {
  item_id: string
  quote: string
  note?: string
  color?: HighlightColor
  anchor_strategy?: AnchoringStrategy
  start_offset?: number
  end_offset?: number
  context_before?: string
  context_after?: string
}

export interface UpdateHighlightRequest {
  note?: string
  color?: HighlightColor
  state?: HighlightState
}

export type HighlightsListResponse = Highlight[]

// ─────────────────────────────────────────────────────────────────────────────
// Output Templates Types
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateType =
  | "newsletter_markdown"
  | "briefing_markdown"
  | "mece_markdown"
  | "newsletter_html"
  | "tts_audio"

export type TemplateFormat = "md" | "html" | "mp3"

export interface OutputTemplate {
  id: string
  name: string
  description?: string
  type: TemplateType
  format: TemplateFormat
  body: string // Jinja2 template content
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateTemplateRequest {
  name: string
  description?: string
  type: TemplateType
  format: TemplateFormat
  body: string
  is_default?: boolean
}

export interface UpdateTemplateRequest {
  name?: string
  description?: string
  body?: string
  is_default?: boolean
  type?: TemplateType
  format?: TemplateFormat
}

export interface TemplatePreviewRequest {
  template_id: string
  item_ids?: string[]
  run_id?: string
  limit?: number
  data?: Record<string, object>
}

export interface TemplatePreviewResponse {
  rendered: string
  format: "md" | "html"
}

export interface GenerateOutputRequest {
  template_id: string
  item_ids?: string[]
  run_id?: string
  title?: string
  data?: Record<string, object>
}

export interface OutputArtifact {
  id: string
  title: string
  type: string
  format: TemplateFormat
  storage_path: string
  media_item_id?: string
  created_at: string
}

export interface TemplatesListParams {
  q?: string
  limit?: number
  offset?: number
}

export interface TemplatesListResponse {
  items: OutputTemplate[]
  total: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Import/Export Types
// ─────────────────────────────────────────────────────────────────────────────

export type ImportSource = "auto" | "pocket" | "instapaper"
export type ExportFormat = "jsonl" | "zip"

export interface ImportRequest {
  source: ImportSource
  file: File
}

export interface ImportResult {
  source: string
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

export interface ExportRequest {
  format: ExportFormat
  status?: string[]
  tags?: string[]
  favorite?: boolean
  q?: string
  domain?: string
  page?: number
  size?: number
}

export type ExportResponse = Blob

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Collections Types (minimal for now)
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptCollection {
  id: string
  name: string
  description?: string
  prompt_count: number
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Types
// ─────────────────────────────────────────────────────────────────────────────

export type CollectionsTab = "reading" | "highlights" | "templates" | "import-export"

export interface CollectionsFilterState {
  status: ReadingStatus | "all"
  tags: string[]
  search: string
  sortBy: "created_at" | "updated_at" | "title" | "relevance"
  sortOrder: "asc" | "desc"
  isFavorite: boolean | null
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Feature Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SummarizeRequest {
  item_id: string
  model?: string
  max_length?: number
}

export interface SummarizeResponse {
  summary: string
  provider: string
  model?: string
}

export interface GenerateTTSRequest {
  item_id: string
  voice?: string
}

export interface GenerateTTSResponse {
  audio_url: string
}
