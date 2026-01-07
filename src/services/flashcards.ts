import { bgRequest } from "@/services/background-proxy"
import type { AllowedPath } from "@/services/tldw/openapi-guard"
import { createSafeStorage } from "@/utils/safe-storage"
import {
  buildQuery,
  createResourceClient
} from "@/services/resource-client"

const decksClient = createResourceClient({
  basePath: "/api/v1/flashcards/decks" as AllowedPath
})

const flashcardsClient = createResourceClient({
  basePath: "/api/v1/flashcards" as AllowedPath
})

// Minimal client types based on openapi.json
export type Deck = {
  id: number
  name: string
  description?: string | null
  deleted: boolean
  client_id: string
  version: number
  created_at?: string | null
  last_modified?: string | null
}

export type Flashcard = {
  uuid: string
  deck_id?: number | null
  front: string
  back: string
  notes?: string | null
  extra?: string | null
  is_cloze: boolean
  tags?: string[] | null
  ef: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at?: string | null
  last_reviewed_at?: string | null
  last_modified?: string | null
  deleted: boolean
  client_id: string
  version: number
  model_type: "basic" | "basic_reverse" | "cloze"
  reverse: boolean
}

export type FlashcardCreate = {
  deck_id?: number | null
  front: string
  back: string
  notes?: string | null
  extra?: string | null
  is_cloze?: boolean | null
  tags?: string[] | null
  source_ref_type?: "media" | "message" | "note" | "manual" | null
  source_ref_id?: string | null
  model_type?: Flashcard["model_type"] | null
  reverse?: boolean | null
}

export type FlashcardUpdate = {
  deck_id?: number | null
  front?: string | null
  back?: string | null
  notes?: string | null
  extra?: string | null
  is_cloze?: boolean | null
  tags?: string[] | null
  expected_version?: number | null
  model_type?: Flashcard["model_type"] | null
  reverse?: boolean | null
}

export type FlashcardListResponse = {
  items: Flashcard[]
  count: number
}

export type FlashcardReviewRequest = {
  card_uuid: string
  rating: number // 0-5
  answer_time_ms?: number | null
}

export type FlashcardReviewResponse = {
  uuid: string
  ef: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at?: string | null
  last_reviewed_at?: string | null
  last_modified?: string | null
  version: number
}

export type FlashcardsImportRequest = {
  content: string
  delimiter?: string | null
  has_header?: boolean | null
}

export type FlashcardsExportParams = {
  deck_id?: number | null
  tag?: string | null
  q?: string | null
  format?: "csv" | "apkg" | null
  include_reverse?: boolean | null
  delimiter?: string | null
  include_header?: boolean | null
  extended_header?: boolean | null
}

// Decks
export async function listDecks(): Promise<Deck[]> {
  return await decksClient.list<Deck[]>()
}

export async function createDeck(input: { name: string; description?: string | null }): Promise<Deck> {
  return await decksClient.create<Deck>(input)
}

// Flashcards CRUD
export async function listFlashcards(params: {
  deck_id?: number | null
  tag?: string | null
  due_status?: "new" | "learning" | "due" | "all" | null
  q?: string | null
  limit?: number
  offset?: number
  order_by?: "due_at" | "created_at" | null
}): Promise<FlashcardListResponse> {
  return await flashcardsClient.list<FlashcardListResponse>({
    deck_id: params.deck_id,
    tag: params.tag,
    due_status: params.due_status,
    q: params.q,
    limit: params.limit,
    offset: params.offset,
    order_by: params.order_by
  })
}

export async function createFlashcard(input: FlashcardCreate): Promise<Flashcard> {
  return await flashcardsClient.create<Flashcard>(input)
}

export async function getFlashcard(card_uuid: string): Promise<Flashcard> {
  return await flashcardsClient.get<Flashcard>(card_uuid)
}

export async function updateFlashcard(card_uuid: string, input: FlashcardUpdate): Promise<void> {
  await flashcardsClient.update<void>(card_uuid, input)
}

export async function deleteFlashcard(card_uuid: string, expected_version: number): Promise<void> {
  await flashcardsClient.remove<void>(card_uuid, {
    expected_version
  })
}

// Review
export async function reviewFlashcard(input: FlashcardReviewRequest): Promise<FlashcardReviewResponse> {
  return await bgRequest<FlashcardReviewResponse, AllowedPath, "POST">({
    path: "/api/v1/flashcards/review",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input
  })
}

// Import
export async function getFlashcardsImportLimits(): Promise<any> {
  return await bgRequest<any, AllowedPath, "GET">({
    path: "/api/v1/config/flashcards-import-limits",
    method: "GET"
  })
}

export async function importFlashcards(payload: FlashcardsImportRequest, overrides?: {
  max_lines?: number | null
  max_line_length?: number | null
  max_field_length?: number | null
}): Promise<any> {
  const query = buildQuery({
    max_lines: overrides?.max_lines,
    max_line_length: overrides?.max_line_length,
    max_field_length: overrides?.max_field_length
  })
  const path = `/api/v1/flashcards/import${query}` as AllowedPath
  return await bgRequest<any, AllowedPath, "POST">({
    path,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload
  })
}

// Export (returns text/csv or file-like payload)
export async function exportFlashcards(params: FlashcardsExportParams = {}): Promise<string> {
  const query = buildQuery({
    deck_id: params.deck_id,
    tag: params.tag,
    q: params.q,
    format: params.format,
    include_reverse: params.include_reverse,
    delimiter: params.delimiter,
    include_header: params.include_header,
    extended_header: params.extended_header
  })
  const path = `/api/v1/flashcards/export${query}` as AllowedPath
  // Force accept text so bgRequest returns text
  return await bgRequest<string, AllowedPath, "GET">({
    path,
    method: "GET",
    headers: { Accept: "text/plain, text/csv, application/octet-stream, application/json;q=0.5" }
  })
}

// Export binary (APKG). Uses direct fetch to preserve binary payload.
export async function exportFlashcardsFile(params: FlashcardsExportParams & { format: 'apkg' }): Promise<Blob> {
  const storage = createSafeStorage()
  const cfg = await storage.get<any>('tldwConfig').catch(() => null)
  const base = (cfg?.serverUrl || '').replace(/\/$/, '')
  if (!base) throw new Error('Server not configured')
  const query = buildQuery({
    deck_id: params.deck_id,
    tag: params.tag,
    q: params.q,
    format: "apkg",
    include_reverse: params.include_reverse,
    // CSV specific options ignored for apkg on server side, but safe to pass
    delimiter: params.delimiter,
    include_header: params.include_header,
    extended_header: params.extended_header
  })
  const url = `${base}/api/v1/flashcards/export${query}`

  const headers: Record<string, string> = { Accept: 'application/octet-stream' }
  // Auth
  if (cfg?.authMode === 'single-user' && cfg?.apiKey) headers['X-API-KEY'] = String(cfg.apiKey)
  else if (cfg?.authMode === 'multi-user' && cfg?.accessToken) headers['Authorization'] = `Bearer ${cfg.accessToken}`

  const res = await fetch(url, { method: 'GET', headers, credentials: 'include' })
  if (!res.ok) {
    let msg = res.statusText
    try { const j = await res.json(); msg = j?.detail || j?.error || j?.message || msg } catch {}
    throw new Error(msg || `Export failed: ${res.status}`)
  }
  return await res.blob()
}
