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
  url: string
  title: string
  domain?: string
  author?: string
  published_date?: string
  excerpt?: string
  content?: string
  word_count?: number
  reading_time_minutes?: number
  status: ReadingStatus
  is_favorite: boolean
  tags: string[]
  notes?: string
  summary?: string
  tts_audio_url?: string
  created_at: string
  updated_at: string
  read_at?: string
  archived_at?: string
}

export interface ReadingItemSummary {
  id: string
  url: string
  title: string
  domain?: string
  excerpt?: string
  status: ReadingStatus
  is_favorite: boolean
  tags: string[]
  reading_time_minutes?: number
  created_at: string
  updated_at: string
}

export interface AddReadingItemRequest {
  url: string
  title?: string
  tags?: string[]
  notes?: string
}

export interface UpdateReadingItemRequest {
  status?: ReadingStatus
  is_favorite?: boolean
  tags?: string[]
  notes?: string
  title?: string
}

export interface ReadingListParams {
  page?: number
  page_size?: number
  search?: string
  status?: ReadingStatus | ReadingStatus[]
  tags?: string[]
  domain?: string
  is_favorite?: boolean
  sort_by?: "created_at" | "updated_at" | "title" | "relevance"
  sort_order?: "asc" | "desc"
  from_date?: string
  to_date?: string
}

export interface ReadingListResponse {
  items: ReadingItemSummary[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlights Types
// ─────────────────────────────────────────────────────────────────────────────

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple"
export type HighlightState = "active" | "stale"
export type AnchoringStrategy = "fuzzy_quote" | "exact_offset"

export interface Highlight {
  id: string
  reading_item_id: string
  reading_item_title?: string
  quote: string
  note?: string
  color: HighlightColor
  state: HighlightState
  anchoring_strategy: AnchoringStrategy
  start_offset?: number
  end_offset?: number
  context_before?: string
  context_after?: string
  created_at: string
  updated_at: string
}

export interface CreateHighlightRequest {
  reading_item_id: string
  quote: string
  note?: string
  color?: HighlightColor
  anchoring_strategy?: AnchoringStrategy
  start_offset?: number
  end_offset?: number
  context_before?: string
  context_after?: string
}

export interface UpdateHighlightRequest {
  note?: string
  color?: HighlightColor
}

export interface HighlightsListParams {
  page?: number
  page_size?: number
  reading_item_id?: string
  color?: HighlightColor
  state?: HighlightState
  search?: string
  sort_by?: "created_at" | "updated_at"
  sort_order?: "asc" | "desc"
}

export interface HighlightsListResponse {
  highlights: Highlight[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Templates Types
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateType =
  | "newsletter_markdown"
  | "briefing_markdown"
  | "mece_markdown"
  | "newsletter_html"
  | "tts_audio"

export type TemplateFormat = "markdown" | "html" | "mp3"

export interface OutputTemplate {
  id: string
  name: string
  description?: string
  template_type: TemplateType
  format: TemplateFormat
  body: string // Jinja2 template content
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateTemplateRequest {
  name: string
  description?: string
  template_type: TemplateType
  format: TemplateFormat
  body: string
}

export interface UpdateTemplateRequest {
  name?: string
  description?: string
  body?: string
  is_default?: boolean
}

export interface TemplatePreviewRequest {
  template_id?: string
  body?: string // Raw template body for preview without saving
  reading_item_ids: string[]
}

export interface TemplatePreviewResponse {
  rendered_content: string
  format: TemplateFormat
}

export interface GenerateOutputRequest {
  template_id: string
  reading_item_ids: string[]
}

export interface GenerateOutputResponse {
  content: string
  format: TemplateFormat
  download_url?: string // For MP3
}

export interface TemplatesListParams {
  page?: number
  page_size?: number
  template_type?: TemplateType
  format?: TemplateFormat
  search?: string
}

export interface TemplatesListResponse {
  templates: OutputTemplate[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Import/Export Types
// ─────────────────────────────────────────────────────────────────────────────

export type ImportSource = "pocket" | "kindle" | "instapaper" | "json" | "csv"
export type ExportFormat = "json" | "csv" | "markdown"

export interface ImportRequest {
  source: ImportSource
  file?: File
  api_key?: string // For services that support API import
}

export interface ImportPreviewItem {
  url: string
  title: string
  tags?: string[]
  notes?: string
  status?: ReadingStatus
}

export interface ImportPreviewResponse {
  items: ImportPreviewItem[]
  total: number
  warnings?: string[]
}

export interface ImportConfirmRequest {
  items: ImportPreviewItem[]
  default_status?: ReadingStatus
  default_tags?: string[]
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export interface ExportRequest {
  format: ExportFormat
  item_ids?: string[] // Specific items, or all if empty
  filters?: ReadingListParams // Or filter criteria
  include_content?: boolean
  include_highlights?: boolean
}

export interface ExportResponse {
  download_url: string
  filename: string
}

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
  reading_item_id: string
  model?: string
  max_length?: number
}

export interface SummarizeResponse {
  summary: string
  model_used: string
}

export interface GenerateTTSRequest {
  reading_item_id: string
  voice?: string
}

export interface GenerateTTSResponse {
  audio_url: string
  duration_seconds: number
}
