// Type-level guard to keep the extension's API usage aligned with the
// server's OpenAPI spec. This file only exports types and helper
// functions, so it does not increase the runtime bundle size.
//
// NOTE: The openapi.json import was removed to eliminate the 1.4 MB
// JSON from the initial bundle. The ClientPath union below is manually
// maintained. QuickIngestModal dynamically imports the spec when needed.
// To verify that ClientPath and MEDIA_ADD_SCHEMA_FALLBACK stay in sync
// with the OpenAPI spec, run:
//   npm run verify:openapi
//   bun run verify:openapi

// Union of relative API paths that the web UI calls via bgRequest/bgStream
// or direct fetch. If a new endpoint is added in the UI, it should be
// added here so TypeScript can verify it exists in the spec.
export type ClientPath =
  | "/api/v1/health"
  | "/api/v1/llm/models"
  | "/api/v1/llm/models/metadata"
  | "/api/v1/llm/providers"
  | "/api/v1/chat/completions"
  | "/api/v1/rag"
  | "/api/v1/rag/health"
  | "/api/v1/rag/search"
  | "/api/v1/rag/search/stream"
  | "/api/v1/rag/simple"
  | "/api/v1/media"
  | "/api/v1/media/add"
  | "/api/v1/media/process-audios"
  | "/api/v1/media/process-documents"
  | "/api/v1/media/process-ebooks"
  | "/api/v1/media/process-pdfs"
  | "/api/v1/media/process-videos"
  | "/api/v1/media/process-web-scraping"
  | "/api/v1/notes"
  | "/api/v1/notes/search"
  | "/api/v1/prompts"
  | "/api/v1/prompts/search"
  | "/api/v1/chat/dictionaries"
  | "/api/v1/chat/dictionaries/import/json"
  | "/api/v1/chats"
  | "/api/v1/characters"
  | "/api/v1/characters/world-books"
  | "/api/v1/characters/world-books/import"
  | "/api/v1/character_chat_sessions"
  | "/api/v1/character_messages"
  | "/api/v1/character_messages/stream"
  | "/api/v1/character-chat/sessions"
  | "/api/v1/character-messages"
  | "/api/v1/character-messages/stream"
  | "/api/v1/audio/speech"
  | "/api/v1/audio/transcriptions"
  | "/api/v1/audio/voices"
  | "/api/v1/audio/health"
  | "/api/v1/embeddings/models"
  | "/api/v1/embeddings/providers-config"
  | "/api/v1/embeddings/health"
  | "/api/v1/metrics/health"
  | "/api/v1/metrics/chat"
  | "/api/v1/evaluations"
  | "/api/v1/evaluations/runs"
  | "/api/v1/evaluations/datasets"
  | "/api/v1/evaluations/rate-limits"
  | "/api/v1/evaluations/history"
  | "/api/v1/evaluations/webhooks"
  | "/api/v1/mcp/health"
  | "/api/v1/reading/items"
  | "/api/v1/reading/save"
  | "/api/v1/flashcards"
  | "/api/v1/flashcards/decks"
  | "/api/v1/flashcards/review"
  | "/api/v1/flashcards/import"
  | "/api/v1/flashcards/export"
  | "/api/v1/auth/login"
  | "/api/v1/auth/logout"
  | "/api/v1/auth/me"
  | "/api/v1/auth/refresh"
  | "/api/v1/auth/register"

// Centralized, typed API paths for use across the extension. Values are
// checked against ClientPath so that any drift from the OpenAPI spec is
// caught at compile time.
export const API_PATHS = {
  MEDIA_ADD: "/api/v1/media/add" as const
} as const satisfies Record<string, ClientPath>

// Allowed relative API path: anything beginning with a slash. We keep
// this wide to avoid breaking existing call sites, while ClientPath
// provides a manually-maintained list of known endpoints.
export type AllowedPath = `/${string}`

// Absolute URL permitted in a few places
export type AbsoluteURL = `${'http' | 'https'}:${string}`

export type PathOrUrl = AllowedPath | AbsoluteURL

// Common HTTP methods accepted
export type AllowedHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'

// Any method is fine for absolute URLs; for paths, use the common set
export type AllowedMethodFor<P extends PathOrUrl> = P extends AbsoluteURL
  ? string
  : AllowedHttpMethod

// Convenience: accept lower/upper/mixed-case method annotations at call sites
export type UpperLower<M extends string> = Uppercase<M> | Lowercase<M> | M

export function normalizeMethod<M extends string>(method: M): Uppercase<M> {
  return String(method).toUpperCase() as Uppercase<M>
}
