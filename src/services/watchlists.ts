/**
 * Watchlists API service layer
 * Provides typed access to tldw_server2 /api/v1/watchlists endpoints
 */

import { bgRequest, bgUpload } from "@/services/background-proxy"
import type {
  ClaimCluster,
  JobPreviewResult,
  PaginatedResponse,
  RunDetailResponse,
  ScrapedItem,
  ScrapedItemUpdate,
  SourcesBulkCreateResponse,
  SourcesImportResponse,
  WatchlistClusterSubscription,
  WatchlistFilter,
  WatchlistGroup,
  WatchlistGroupCreate,
  WatchlistJob,
  WatchlistJobCreate,
  WatchlistJobUpdate,
  WatchlistOutput,
  WatchlistOutputCreate,
  WatchlistRun,
  WatchlistSettings,
  WatchlistSource,
  WatchlistSourceCreate,
  WatchlistSourceUpdate,
  WatchlistTag,
  WatchlistTemplate,
  WatchlistTemplateCreate
} from "@/types/watchlists"

// Helper to build query string (supports array params)
const buildQuery = (params?: Record<string, unknown> | object | null): string => {
  if (!params) return ""
  const query = new URLSearchParams()
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value == null) return
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry != null) query.append(key, String(entry))
      })
      return
    }
    query.set(key, String(value))
  })
  const str = query.toString()
  return str ? `?${str}` : ""
}

// ─────────────────────────────────────────────────────────────────────────────
// Sources API
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchSourcesParams {
  q?: string
  tags?: string[]
  page?: number
  size?: number
}

export const fetchWatchlistSources = async (
  params?: FetchSourcesParams
): Promise<PaginatedResponse<WatchlistSource>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<WatchlistSource>>({
    path: `/api/v1/watchlists/sources${qs}` as any,
    method: "GET"
  })
}

export const getWatchlistSource = async (sourceId: number): Promise<WatchlistSource> => {
  return bgRequest<WatchlistSource>({
    path: `/api/v1/watchlists/sources/${sourceId}` as any,
    method: "GET"
  })
}

export const createWatchlistSource = async (
  source: WatchlistSourceCreate
): Promise<WatchlistSource> => {
  return bgRequest<WatchlistSource>({
    path: "/api/v1/watchlists/sources",
    method: "POST",
    body: source
  })
}

export const updateWatchlistSource = async (
  sourceId: number,
  updates: WatchlistSourceUpdate
): Promise<WatchlistSource> => {
  return bgRequest<WatchlistSource>({
    path: `/api/v1/watchlists/sources/${sourceId}` as any,
    method: "PATCH",
    body: updates
  })
}

export const deleteWatchlistSource = async (sourceId: number): Promise<void> => {
  return bgRequest<void>({
    path: `/api/v1/watchlists/sources/${sourceId}` as any,
    method: "DELETE"
  })
}

export const bulkCreateSources = async (
  sources: WatchlistSourceCreate[]
): Promise<SourcesBulkCreateResponse> => {
  return bgRequest<SourcesBulkCreateResponse>({
    path: "/api/v1/watchlists/sources/bulk",
    method: "POST",
    body: { sources }
  })
}

export const importOpml = async (
  file: File,
  options?: { active?: boolean; tags?: string[]; group_id?: number }
): Promise<SourcesImportResponse> => {
  const data = await file.arrayBuffer()
  const fields: Record<string, unknown> = {}
  if (options?.active != null) fields.active = String(options.active)
  if (options?.group_id != null) fields.group_id = String(options.group_id)
  if (options?.tags?.length) fields.tags = options.tags
  return bgUpload<SourcesImportResponse>({
    path: "/api/v1/watchlists/sources/import",
    method: "POST",
    file: { name: file.name, type: file.type || "text/xml", data },
    fields: Object.keys(fields).length ? fields : undefined
  })
}

export const exportOpml = async (params?: {
  tag?: string[]
  group?: number[]
  type?: string
}): Promise<string> => {
  const qs = buildQuery(params || {})
  return bgRequest<string>({
    path: `/api/v1/watchlists/sources/export${qs}` as any,
    method: "GET"
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Groups API
// ─────────────────────────────────────────────────────────────────────────────

export const fetchWatchlistGroups = async (
  params?: { q?: string; page?: number; size?: number }
): Promise<PaginatedResponse<WatchlistGroup>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<WatchlistGroup>>({
    path: `/api/v1/watchlists/groups${qs}` as any,
    method: "GET"
  })
}

export const createWatchlistGroup = async (
  group: WatchlistGroupCreate
): Promise<WatchlistGroup> => {
  return bgRequest<WatchlistGroup>({
    path: "/api/v1/watchlists/groups",
    method: "POST",
    body: group
  })
}

export const updateWatchlistGroup = async (
  groupId: number,
  updates: Partial<WatchlistGroupCreate>
): Promise<WatchlistGroup> => {
  return bgRequest<WatchlistGroup>({
    path: `/api/v1/watchlists/groups/${groupId}` as any,
    method: "PATCH",
    body: updates
  })
}

export const deleteWatchlistGroup = async (groupId: number): Promise<void> => {
  return bgRequest<void>({
    path: `/api/v1/watchlists/groups/${groupId}` as any,
    method: "DELETE"
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tags API
// ─────────────────────────────────────────────────────────────────────────────

export const fetchWatchlistTags = async (
  params?: { q?: string; page?: number; size?: number }
): Promise<PaginatedResponse<WatchlistTag>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<WatchlistTag>>({
    path: `/api/v1/watchlists/tags${qs}` as any,
    method: "GET"
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Jobs API
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchJobsParams {
  q?: string
  page?: number
  size?: number
}

export const fetchWatchlistJobs = async (
  params?: FetchJobsParams
): Promise<PaginatedResponse<WatchlistJob>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<WatchlistJob>>({
    path: `/api/v1/watchlists/jobs${qs}` as any,
    method: "GET"
  })
}

export const getWatchlistJob = async (jobId: number): Promise<WatchlistJob> => {
  return bgRequest<WatchlistJob>({
    path: `/api/v1/watchlists/jobs/${jobId}` as any,
    method: "GET"
  })
}

export const createWatchlistJob = async (job: WatchlistJobCreate): Promise<WatchlistJob> => {
  return bgRequest<WatchlistJob>({
    path: "/api/v1/watchlists/jobs",
    method: "POST",
    body: job
  })
}

export const updateWatchlistJob = async (
  jobId: number,
  updates: WatchlistJobUpdate
): Promise<WatchlistJob> => {
  return bgRequest<WatchlistJob>({
    path: `/api/v1/watchlists/jobs/${jobId}` as any,
    method: "PATCH",
    body: updates
  })
}

export const deleteWatchlistJob = async (jobId: number): Promise<void> => {
  return bgRequest<void>({
    path: `/api/v1/watchlists/jobs/${jobId}` as any,
    method: "DELETE"
  })
}

export const previewWatchlistJob = async (
  jobId: number,
  params?: { limit?: number; per_source?: number }
): Promise<JobPreviewResult> => {
  const qs = buildQuery(params || {})
  return bgRequest<JobPreviewResult>({
    path: `/api/v1/watchlists/jobs/${jobId}/preview${qs}` as any,
    method: "POST"
  })
}

export const updateJobFilters = async (
  jobId: number,
  filters: WatchlistFilter[]
): Promise<WatchlistJob> => {
  return bgRequest<WatchlistJob>({
    path: `/api/v1/watchlists/jobs/${jobId}/filters` as any,
    method: "PATCH",
    body: { filters }
  })
}

export const addJobFilters = async (
  jobId: number,
  filters: WatchlistFilter[]
): Promise<WatchlistJob> => {
  return bgRequest<WatchlistJob>({
    path: `/api/v1/watchlists/jobs/${jobId}/filters:add` as any,
    method: "POST",
    body: { filters }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs API
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchRunsParams {
  q?: string
  page?: number
  size?: number
}

export const fetchWatchlistRuns = async (
  params?: FetchRunsParams
): Promise<PaginatedResponse<WatchlistRun>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<WatchlistRun>>({
    path: `/api/v1/watchlists/runs${qs}` as any,
    method: "GET"
  })
}

export const fetchJobRuns = async (
  jobId: number,
  params?: { page?: number; size?: number }
): Promise<PaginatedResponse<WatchlistRun>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<WatchlistRun>>({
    path: `/api/v1/watchlists/jobs/${jobId}/runs${qs}` as any,
    method: "GET"
  })
}

export const getWatchlistRun = async (runId: number): Promise<WatchlistRun> => {
  return bgRequest<WatchlistRun>({
    path: `/api/v1/watchlists/runs/${runId}` as any,
    method: "GET"
  })
}

export const getRunDetails = async (runId: number): Promise<RunDetailResponse> => {
  return bgRequest<RunDetailResponse>({
    path: `/api/v1/watchlists/runs/${runId}/details?include_tallies=true` as any,
    method: "GET"
  })
}

export const triggerWatchlistRun = async (jobId: number): Promise<WatchlistRun> => {
  return bgRequest<WatchlistRun>({
    path: `/api/v1/watchlists/jobs/${jobId}/run` as any,
    method: "POST"
  })
}

export const exportRunsCsv = async (params?: FetchRunsParams): Promise<string> => {
  const qs = buildQuery(params || {})
  return bgRequest<string>({
    path: `/api/v1/watchlists/runs/export.csv${qs}` as any,
    method: "GET"
  })
}

export const exportRunTalliesCsv = async (runId: number): Promise<string> => {
  return bgRequest<string>({
    path: `/api/v1/watchlists/runs/${runId}/tallies.csv` as any,
    method: "GET"
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Scraped Items API
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchItemsParams {
  run_id?: number
  job_id?: number
  source_id?: number
  status?: string
  reviewed?: boolean
  q?: string
  since?: string
  until?: string
  page?: number
  size?: number
}

export const fetchScrapedItems = async (
  params?: FetchItemsParams
): Promise<PaginatedResponse<ScrapedItem>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<ScrapedItem>>({
    path: `/api/v1/watchlists/items${qs}` as any,
    method: "GET"
  })
}

export const getScrapedItem = async (itemId: number): Promise<ScrapedItem> => {
  return bgRequest<ScrapedItem>({
    path: `/api/v1/watchlists/items/${itemId}` as any,
    method: "GET"
  })
}

export const updateScrapedItem = async (
  itemId: number,
  updates: ScrapedItemUpdate
): Promise<ScrapedItem> => {
  return bgRequest<ScrapedItem>({
    path: `/api/v1/watchlists/items/${itemId}` as any,
    method: "PATCH",
    body: updates
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs API
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchOutputsParams {
  job_id?: number
  run_id?: number
  page?: number
  size?: number
}

export const fetchWatchlistOutputs = async (
  params?: FetchOutputsParams
): Promise<PaginatedResponse<WatchlistOutput>> => {
  const qs = buildQuery(params || {})
  return bgRequest<PaginatedResponse<WatchlistOutput>>({
    path: `/api/v1/watchlists/outputs${qs}` as any,
    method: "GET"
  })
}

export const getWatchlistOutput = async (outputId: number): Promise<WatchlistOutput> => {
  return bgRequest<WatchlistOutput>({
    path: `/api/v1/watchlists/outputs/${outputId}` as any,
    method: "GET"
  })
}

export const createWatchlistOutput = async (
  output: WatchlistOutputCreate
): Promise<WatchlistOutput> => {
  return bgRequest<WatchlistOutput>({
    path: "/api/v1/watchlists/outputs",
    method: "POST",
    body: output
  })
}

export const downloadWatchlistOutput = async (outputId: number): Promise<string> => {
  return bgRequest<string>({
    path: `/api/v1/watchlists/outputs/${outputId}/download` as any,
    method: "GET"
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates API
// ─────────────────────────────────────────────────────────────────────────────

export const fetchWatchlistTemplates = async (): Promise<{ items: WatchlistTemplate[] }> => {
  return bgRequest<{ items: WatchlistTemplate[] }>({
    path: "/api/v1/watchlists/templates",
    method: "GET"
  })
}

export const getWatchlistTemplate = async (
  templateName: string
): Promise<WatchlistTemplate> => {
  return bgRequest<WatchlistTemplate>({
    path: `/api/v1/watchlists/templates/${encodeURIComponent(templateName)}` as any,
    method: "GET"
  })
}

export const createWatchlistTemplate = async (
  template: WatchlistTemplateCreate
): Promise<WatchlistTemplate> => {
  return bgRequest<WatchlistTemplate>({
    path: "/api/v1/watchlists/templates",
    method: "POST",
    body: template
  })
}

export const deleteWatchlistTemplate = async (templateName: string): Promise<void> => {
  return bgRequest<void>({
    path: `/api/v1/watchlists/templates/${encodeURIComponent(templateName)}` as any,
    method: "DELETE"
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings API
// ─────────────────────────────────────────────────────────────────────────────

export const getWatchlistSettings = async (): Promise<WatchlistSettings> => {
  return bgRequest<WatchlistSettings>({
    path: "/api/v1/watchlists/settings",
    method: "GET"
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim Clusters API
// ─────────────────────────────────────────────────────────────────────────────

export const fetchJobClaimClusters = async (
  jobId: number
): Promise<WatchlistClusterSubscription[]> => {
  const response = await bgRequest<{ clusters: WatchlistClusterSubscription[] }>({
    path: `/api/v1/watchlists/${jobId}/clusters` as any,
    method: "GET"
  })
  return response.clusters
}

export const subscribeJobToCluster = async (
  jobId: number,
  clusterId: number
): Promise<void> => {
  return bgRequest<void>({
    path: `/api/v1/watchlists/${jobId}/clusters` as any,
    method: "POST",
    body: { cluster_id: clusterId }
  })
}

export const unsubscribeJobFromCluster = async (
  jobId: number,
  clusterId: number
): Promise<void> => {
  return bgRequest<void>({
    path: `/api/v1/watchlists/${jobId}/clusters/${clusterId}` as any,
    method: "DELETE"
  })
}

export const fetchClaimClusters = async (params?: {
  limit?: number
  offset?: number
  keyword?: string
  since?: string
  min_size?: number
  watchlisted?: boolean
}): Promise<ClaimCluster[]> => {
  const qs = buildQuery(params || {})
  return bgRequest<ClaimCluster[]>({
    path: `/api/v1/claims/clusters${qs}` as any,
    method: "GET"
  })
}
