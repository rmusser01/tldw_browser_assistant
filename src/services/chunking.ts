/**
 * Chunking service - API client for tldw_server chunking endpoints
 */

import { bgRequest, bgUpload } from "./background-proxy"

// Types for chunking API

export interface ChunkMetadata {
  index?: number
  chunk_index?: number
  total_chunks?: number
  start_char?: number
  end_char?: number
  start_index?: number
  end_index?: number
  word_count?: number
  char_count?: number
  token_count?: number
  language?: string
  method?: string
  chunk_method?: string
  overlap_with_previous?: number
  overlap_with_next?: number
  relative_position?: number
  header_text?: string
  section?: string
  code_mode_used?: string
  [key: string]: any
}

export interface Chunk {
  text: string
  metadata: ChunkMetadata
}

export interface ChunkingOptions {
  method?: string
  max_size?: number
  overlap?: number
  language?: string
  tokenizer_name_or_path?: string
  adaptive?: boolean
  multi_level?: boolean
  code_mode?: "auto" | "ast" | "heuristic"
  semantic_similarity_threshold?: number
  semantic_overlap_sentences?: number
  custom_chapter_pattern?: string
  template_name?: string
  json_chunkable_data_key?: string
  enable_frontmatter_parsing?: boolean
  frontmatter_sentinel_key?: string
  summarization_detail?: number
  proposition_engine?: "heuristic" | "spacy" | "llm" | "auto" | string
  proposition_aggressiveness?: number
  proposition_min_proposition_length?: number
  proposition_prompt_profile?: "generic" | "claimify" | "gemma_aps" | string
  llm_options_for_internal_steps?: LLMOptionsForInternalSteps
}

export interface LLMOptionsForInternalSteps {
  temperature?: number
  system_prompt_for_step?: string
  max_tokens_per_step?: number
}

export interface ChunkTextRequest {
  text_content: string
  file_name?: string
  options?: ChunkingOptions
}

export interface ChunkingResponse {
  chunks: Chunk[]
  original_file_name?: string
  applied_options: ChunkingOptions
}

export interface ChunkingCapabilities {
  methods: string[]
  default_options: Record<string, any>
  llm_required_methods: string[]
  hierarchical_support: boolean
  notes?: string
  method_specific_options?: {
    code?: {
      code_mode: string[]
      language_hints: Record<string, string>
    }
  }
}

export interface ChunkingTemplateResponse {
  id: number
  uuid: string
  name: string
  description?: string | null
  template_json: string
  is_builtin: boolean
  tags: string[]
  created_at: string
  updated_at: string
  version: number
  user_id?: string | null
}

export interface ChunkingTemplateListResponse {
  templates: ChunkingTemplateResponse[]
  total: number
}

export interface TemplateConfig {
  preprocessing?: Array<Record<string, any>>
  chunking: Record<string, any>
  postprocessing?: Array<Record<string, any>>
  classifier?: Record<string, any>
}

export interface ChunkingTemplateCreateRequest {
  name: string
  description?: string
  tags?: string[]
  user_id?: string
  template: TemplateConfig
}

export interface ChunkingTemplateUpdateRequest {
  description?: string
  tags?: string[]
  template?: TemplateConfig
}

export interface ApplyTemplateRequest {
  template_name: string
  text: string
  override_options?: Record<string, any>
}

export interface ApplyTemplateResponse {
  template_name: string
  chunks: Array<any>
  metadata?: Record<string, any>
}

export interface TemplateValidationResponse {
  valid: boolean
  errors?: Array<{ field: string; message: string }>
  warnings?: Array<{ field: string; message: string } | string>
}

export interface TemplateMatchResponse {
  matches: Array<{ name: string; score: number; priority?: number }>
}

export interface TemplateLearnRequest {
  name: string
  example_text?: string
  description?: string
  save?: boolean
  classifier?: Record<string, any>
}

export interface TemplateLearnResponse {
  template: Record<string, any>
  saved: boolean
}

export interface TemplateDiagnosticsResponse {
  db_class: string
  capability: "native" | "fallback"
  missing_methods: string[]
  fallback_enabled: boolean
  hint?: string
}

/**
 * Get available chunking methods and capabilities
 */
export async function getChunkingCapabilities(): Promise<ChunkingCapabilities> {
  return await bgRequest<ChunkingCapabilities>({
    path: "/api/v1/chunking/capabilities",
    method: "GET"
  })
}

/**
 * Chunk text using the server-side chunking API
 */
export async function chunkText(
  textContent: string,
  options?: ChunkingOptions,
  fileName?: string
): Promise<ChunkingResponse> {
  const request: ChunkTextRequest = {
    text_content: textContent,
    file_name: fileName,
    options
  }

  return await bgRequest<ChunkingResponse>({
    path: "/api/v1/chunking/chunk_text",
    method: "POST",
    body: request
  })
}

/**
 * Chunk an uploaded file using the server-side chunking API
 */
export async function chunkFile(
  file: File,
  options?: ChunkingOptions
): Promise<ChunkingResponse> {
  const fields: Record<string, string | boolean | number> = {}

  if (options?.method) fields.method = options.method
  if (options?.max_size != null) fields.max_size = options.max_size
  if (options?.overlap != null) fields.overlap = options.overlap
  if (options?.language) fields.language = options.language
  if (options?.tokenizer_name_or_path) {
    fields.tokenizer_name_or_path = options.tokenizer_name_or_path
  }
  if (options?.adaptive != null) fields.adaptive = options.adaptive
  if (options?.multi_level != null) fields.multi_level = options.multi_level
  if (options?.code_mode) fields.code_mode = options.code_mode
  if (options?.custom_chapter_pattern) {
    fields.custom_chapter_pattern = options.custom_chapter_pattern
  }
  if (options?.semantic_similarity_threshold != null) {
    fields.semantic_similarity_threshold = options.semantic_similarity_threshold
  }
  if (options?.semantic_overlap_sentences != null) {
    fields.semantic_overlap_sentences = options.semantic_overlap_sentences
  }
  if (options?.json_chunkable_data_key) {
    fields.json_chunkable_data_key = options.json_chunkable_data_key
  }
  if (options?.summarization_detail != null) {
    fields.summarization_detail = options.summarization_detail
  }
  if (options?.llm_options_for_internal_steps?.temperature != null) {
    fields.llm_step_temperature = options.llm_options_for_internal_steps.temperature
  }
  if (options?.llm_options_for_internal_steps?.system_prompt_for_step) {
    fields.llm_step_system_prompt =
      options.llm_options_for_internal_steps.system_prompt_for_step
  }
  if (options?.llm_options_for_internal_steps?.max_tokens_per_step != null) {
    fields.llm_step_max_tokens =
      options.llm_options_for_internal_steps.max_tokens_per_step
  }

  // Convert file to array buffer for upload
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)

  return await bgUpload<ChunkingResponse>({
    path: "/api/v1/chunking/chunk_file",
    method: "POST",
    fields,
    file: {
      name: file.name,
      type: file.type || "text/plain",
      data
    }
  })
}

/**
 * Chunking templates API
 */
export async function listChunkingTemplates(params: {
  includeBuiltin?: boolean
  includeCustom?: boolean
  tags?: string[]
  userId?: string
}): Promise<ChunkingTemplateListResponse> {
  const query = new URLSearchParams()
  if (params.includeBuiltin != null) {
    query.set("include_builtin", String(params.includeBuiltin))
  }
  if (params.includeCustom != null) {
    query.set("include_custom", String(params.includeCustom))
  }
  if (params.userId) {
    query.set("user_id", params.userId)
  }
  if (params.tags?.length) {
    params.tags.forEach((tag) => query.append("tags", tag))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return await bgRequest<ChunkingTemplateListResponse>({
    path: `/api/v1/chunking/templates${suffix}`,
    method: "GET"
  })
}

export async function getChunkingTemplate(
  templateName: string
): Promise<ChunkingTemplateResponse> {
  return await bgRequest<ChunkingTemplateResponse>({
    path: `/api/v1/chunking/templates/${encodeURIComponent(templateName)}`,
    method: "GET"
  })
}

export async function createChunkingTemplate(
  payload: ChunkingTemplateCreateRequest
): Promise<ChunkingTemplateResponse> {
  return await bgRequest<ChunkingTemplateResponse>({
    path: "/api/v1/chunking/templates",
    method: "POST",
    body: payload
  })
}

export async function updateChunkingTemplate(
  templateName: string,
  payload: ChunkingTemplateUpdateRequest
): Promise<ChunkingTemplateResponse> {
  return await bgRequest<ChunkingTemplateResponse>({
    path: `/api/v1/chunking/templates/${encodeURIComponent(templateName)}`,
    method: "PUT",
    body: payload
  })
}

export async function deleteChunkingTemplate(
  templateName: string,
  hardDelete: boolean
): Promise<void> {
  const query = hardDelete ? "?hard_delete=true" : ""
  await bgRequest<void>({
    path: `/api/v1/chunking/templates/${encodeURIComponent(templateName)}${query}`,
    method: "DELETE"
  })
}

export async function applyChunkingTemplate(
  payload: ApplyTemplateRequest,
  includeMetadata: boolean
): Promise<ApplyTemplateResponse> {
  const query = includeMetadata ? "?include_metadata=true" : ""
  return await bgRequest<ApplyTemplateResponse>({
    path: `/api/v1/chunking/templates/apply${query}`,
    method: "POST",
    body: payload
  })
}

export async function validateChunkingTemplate(
  templateConfig: Record<string, any>
): Promise<TemplateValidationResponse> {
  return await bgRequest<TemplateValidationResponse>({
    path: "/api/v1/chunking/templates/validate",
    method: "POST",
    body: templateConfig
  })
}

export async function matchChunkingTemplates(params: {
  mediaType?: string
  title?: string
  url?: string
  filename?: string
}): Promise<TemplateMatchResponse> {
  const query = new URLSearchParams()
  if (params.mediaType) query.set("media_type", params.mediaType)
  if (params.title) query.set("title", params.title)
  if (params.url) query.set("url", params.url)
  if (params.filename) query.set("filename", params.filename)
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return await bgRequest<TemplateMatchResponse>({
    path: `/api/v1/chunking/templates/match${suffix}`,
    method: "POST"
  })
}

export async function learnChunkingTemplate(
  payload: TemplateLearnRequest
): Promise<TemplateLearnResponse> {
  return await bgRequest<TemplateLearnResponse>({
    path: "/api/v1/chunking/templates/learn",
    method: "POST",
    body: payload
  })
}

export async function getChunkingTemplateDiagnostics(): Promise<TemplateDiagnosticsResponse> {
  return await bgRequest<TemplateDiagnosticsResponse>({
    path: "/api/v1/chunking/templates/diagnostics",
    method: "GET"
  })
}

// Default chunking options for the playground
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  method: "words",
  max_size: 400,
  overlap: 200,
  language: "en",
  tokenizer_name_or_path: "gpt2",
  adaptive: false,
  multi_level: false,
  semantic_similarity_threshold: 0.7,
  semantic_overlap_sentences: 2,
  json_chunkable_data_key: "data",
  enable_frontmatter_parsing: true,
  frontmatter_sentinel_key: "__tldw_frontmatter__",
  summarization_detail: 0.5,
  proposition_engine: "heuristic",
  proposition_aggressiveness: 1,
  proposition_min_proposition_length: 15,
  proposition_prompt_profile: "generic"
}

// Color palette for chunk visualization
export const CHUNK_COLORS = [
  "rgba(59, 130, 246, 0.3)", // blue
  "rgba(16, 185, 129, 0.3)", // green
  "rgba(249, 115, 22, 0.3)", // orange
  "rgba(139, 92, 246, 0.3)", // purple
  "rgba(236, 72, 153, 0.3)", // pink
  "rgba(234, 179, 8, 0.3)", // yellow
  "rgba(20, 184, 166, 0.3)", // teal
  "rgba(244, 63, 94, 0.3)" // rose
]

// Dark mode color palette with higher opacity
export const CHUNK_COLORS_DARK = [
  "rgba(96, 165, 250, 0.4)", // blue
  "rgba(52, 211, 153, 0.4)", // green
  "rgba(251, 146, 60, 0.4)", // orange
  "rgba(167, 139, 250, 0.4)", // purple
  "rgba(244, 114, 182, 0.4)", // pink
  "rgba(250, 204, 21, 0.4)", // yellow
  "rgba(45, 212, 191, 0.4)", // teal
  "rgba(251, 113, 133, 0.4)" // rose
]

/**
 * Get the color for a chunk based on its index
 */
export function getChunkColor(index: number, isDarkMode: boolean = false): string {
  const palette = isDarkMode ? CHUNK_COLORS_DARK : CHUNK_COLORS
  return palette[index % palette.length]
}

/**
 * Calculate chunk statistics
 */
export function calculateChunkStats(chunks: Chunk[]): {
  count: number
  avgCharCount: number
  avgWordCount: number
  totalCharCount: number
  totalWordCount: number
} {
  if (chunks.length === 0) {
    return {
      count: 0,
      avgCharCount: 0,
      avgWordCount: 0,
      totalCharCount: 0,
      totalWordCount: 0
    }
  }

  let totalCharCount = 0
  let totalWordCount = 0

  for (const chunk of chunks) {
    totalCharCount += chunk.metadata.char_count ?? chunk.text.length
    totalWordCount += chunk.metadata.word_count ?? 0
  }

  return {
    count: chunks.length,
    avgCharCount: Math.round(totalCharCount / chunks.length),
    avgWordCount: Math.round(totalWordCount / chunks.length),
    totalCharCount,
    totalWordCount
  }
}
