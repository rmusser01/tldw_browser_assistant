/**
 * Chunking service - API client for tldw_server chunking endpoints
 */

import { bgRequest, bgUpload } from "./background-proxy"

// Types for chunking API

export interface ChunkMetadata {
  index: number
  start_char: number
  end_char: number
  word_count: number
  char_count?: number
  token_count?: number
  language?: string
  method?: string
  overlap_with_previous?: number
  overlap_with_next?: number
  section?: string
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
  adaptive?: boolean
  multi_level?: boolean
  code_mode?: "auto" | "ast" | "heuristic"
  semantic_similarity_threshold?: number
  semantic_overlap_sentences?: number
  custom_chapter_pattern?: string
  template_name?: string
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
  if (options?.adaptive != null) fields.adaptive = options.adaptive
  if (options?.multi_level != null) fields.multi_level = options.multi_level
  if (options?.code_mode) fields.code_mode = options.code_mode

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

// Default chunking options for the playground
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  method: "words",
  max_size: 400,
  overlap: 200,
  language: "en"
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
