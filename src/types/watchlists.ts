/**
 * Watchlists module types
 * Corresponds to tldw_server2 /api/v1/watchlists endpoints
 */

// ─────────────────────────────────────────────────────────────────────────────
// Source Types
// ─────────────────────────────────────────────────────────────────────────────

export type SourceType = "rss" | "site" | "forum"

export interface WatchlistSource {
  id: number
  name: string
  url: string
  source_type: SourceType
  active: boolean
  tags: string[]
  settings?: Record<string, unknown> | null
  last_scraped_at?: string | null
  status?: string | null
  created_at: string
  updated_at?: string | null
}

export interface WatchlistSourceCreate {
  name: string
  url: string
  source_type: SourceType
  active?: boolean
  tags?: string[]
  settings?: Record<string, unknown>
  group_ids?: number[]
}

export interface WatchlistSourceUpdate {
  name?: string
  url?: string
  source_type?: SourceType
  active?: boolean
  tags?: string[]
  settings?: Record<string, unknown>
  group_ids?: number[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WatchlistGroup {
  id: number
  name: string
  description?: string | null
  parent_group_id?: number | null
}

export interface WatchlistGroupCreate {
  name: string
  description?: string
  parent_group_id?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WatchlistTag {
  id: number
  name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Types
// ─────────────────────────────────────────────────────────────────────────────

export type FilterType = "keyword" | "author" | "date_range" | "regex" | "all"
export type FilterAction = "include" | "exclude" | "flag"

export interface WatchlistFilter {
  type: FilterType
  action: FilterAction
  value: Record<string, unknown>
  priority?: number
  is_active?: boolean
}

export interface WatchlistFiltersPayload {
  filters: WatchlistFilter[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JobScope {
  sources?: number[]
  groups?: number[]
  tags?: string[]
}

export interface JobOutputPrefs {
  retention_days?: number
  template_name?: string
  delivery_config?: {
    email_recipients?: string[]
    email_format?: "auto" | "text" | "html"
    create_chatbook?: boolean
  }
}

export interface WatchlistJob {
  id: number
  name: string
  description?: string | null
  scope: JobScope
  schedule_expr?: string | null
  timezone?: string | null
  active: boolean
  max_concurrency?: number | null
  per_host_delay_ms?: number | null
  retry_policy?: Record<string, unknown> | null
  output_prefs?: JobOutputPrefs | null
  job_filters?: WatchlistFiltersPayload | null
  created_at: string
  updated_at?: string | null
  last_run_at?: string | null
  next_run_at?: string | null
  wf_schedule_id?: string | null
}

export interface WatchlistJobCreate {
  name: string
  description?: string
  scope: JobScope
  schedule_expr?: string
  timezone?: string
  active?: boolean
  max_concurrency?: number
  per_host_delay_ms?: number
  retry_policy?: Record<string, unknown>
  output_prefs?: JobOutputPrefs
  job_filters?: WatchlistFiltersPayload
}

export interface WatchlistJobUpdate {
  name?: string
  description?: string
  scope?: JobScope
  schedule_expr?: string | null
  timezone?: string | null
  active?: boolean
  max_concurrency?: number | null
  per_host_delay_ms?: number | null
  retry_policy?: Record<string, unknown> | null
  output_prefs?: JobOutputPrefs | null
  job_filters?: WatchlistFiltersPayload | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Types
// ─────────────────────────────────────────────────────────────────────────────

export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface RunStats {
  items_found?: number
  items_ingested?: number
  items_filtered?: number
  items_errored?: number
  [key: string]: number | undefined
}

export interface WatchlistRun {
  id: number
  job_id: number
  status: RunStatus
  started_at?: string | null
  finished_at?: string | null
  stats?: RunStats | null
  error_msg?: string | null
  log_path?: string | null
}

export interface RunDetailResponse {
  id: number
  job_id: number
  status: string
  started_at?: string | null
  finished_at?: string | null
  stats: Record<string, number>
  filter_tallies?: Record<string, number> | null
  error_msg?: string | null
  log_text?: string | null
  log_path?: string | null
  truncated?: boolean
  filtered_sample?: Array<Record<string, unknown>> | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Scraped Item Types
// ─────────────────────────────────────────────────────────────────────────────

export type ItemStatus = "ingested" | "filtered"

export interface ScrapedItem {
  id: number
  run_id: number
  job_id: number
  source_id: number
  media_id?: number | null
  media_uuid?: string | null
  url?: string | null
  title?: string | null
  summary?: string | null
  published_at?: string | null
  tags: string[]
  status: ItemStatus
  reviewed: boolean
  created_at: string
}

export interface ScrapedItemUpdate {
  reviewed?: boolean
  status?: ItemStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────────────────────

export type OutputFormat = "md" | "html"

export interface WatchlistOutput {
  id: number
  run_id: number
  job_id: number
  type: string
  format: OutputFormat
  title?: string | null
  content?: string | null
  storage_path?: string | null
  metadata?: Record<string, unknown> | null
  media_item_id?: number | null
  chatbook_path?: string | null
  version: number
  expires_at?: string | null
  expired: boolean
  created_at: string
}

export interface WatchlistOutputCreate {
  run_id: number
  item_ids?: number[]
  title?: string
  type?: string
  format?: OutputFormat
  metadata?: Record<string, unknown>
  template_name?: string
  retention_seconds?: number
  temporary?: boolean
  deliveries?: {
    email?: {
      recipients?: string[]
      format?: "auto" | "text" | "html"
      subject?: string
      sender?: string
      reply_to?: string
    }
    chatbook?: {
      enabled?: boolean
      title?: string
      description?: string
      conversation_id?: number
      provider?: string
      model?: string
      metadata?: Record<string, unknown>
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WatchlistTemplate {
  name: string
  description?: string | null
  content?: string
  format: "md" | "html"
  updated_at?: string | null
}

export interface WatchlistTemplateCreate {
  name: string
  description?: string | null
  content: string
  format?: "md" | "html"
  overwrite?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WatchlistSettingsStats {
  sources_count?: number
  jobs_count?: number
  runs_count?: number
  items_count?: number
}

export interface WatchlistSettings {
  default_output_ttl_seconds?: number
  temporary_output_ttl_seconds?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim Cluster Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaimCluster {
  id: number
  canonical_claim_text?: string | null
  summary?: string | null
  member_count?: number
  updated_at?: string | null
  watchlist_count?: number
}

export interface WatchlistClusterSubscription {
  cluster_id: number
  created_at?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page?: number
  size?: number
  has_more?: boolean
}

export interface SourcesBulkCreateItem {
  name?: string | null
  url: string
  id?: number | null
  status: "created" | "error"
  error?: string | null
}

export interface SourcesBulkCreateResponse {
  items: SourcesBulkCreateItem[]
  total: number
  created: number
  errors: number
}

export interface SourcesImportItem {
  url: string
  name?: string | null
  id?: number | null
  status: "created" | "skipped" | "error"
  error?: string | null
}

export interface SourcesImportResponse {
  items: SourcesImportItem[]
  total: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewItem {
  source_id: number
  source_type: SourceType
  url?: string | null
  title?: string | null
  summary?: string | null
  published_at?: string | null
  decision: "ingest" | "filtered"
  matched_action: "include" | "exclude" | "flag"
  matched_filter_key?: string | null
  flagged?: boolean
}

export interface JobPreviewResult {
  items: PreviewItem[]
  total: number
  ingestable: number
  filtered: number
}

// ─────────────────────────────────────────────────────────────────────────────
// UI State Types
// ─────────────────────────────────────────────────────────────────────────────

export type WatchlistTab = "sources" | "jobs" | "runs" | "outputs" | "templates" | "settings"
