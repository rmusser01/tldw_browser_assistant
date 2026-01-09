// Type-level guard to keep the extension's API usage aligned with the
// server's OpenAPI spec. This file only exports types and helper
// functions, so it does not increase the runtime bundle size.
//
// NOTE: The openapi.json import was removed to eliminate the 1.4 MB
// JSON from the initial bundle. The ClientPath union below is manually
// maintained. QuickIngestModal dynamically imports the spec when needed.
//
// Maintenance:
// - When you add a new server endpoint that the extension calls (via bgRequest,
//   bgStream, or direct fetch), add its relative path to ClientPath so TS can
//   type-check it against the OpenAPI spec.
// - When you remove or rename an endpoint, update ClientPath (and any entries
//   in API_PATHS) to match the current server API.
// - To verify that ClientPath and MEDIA_ADD_SCHEMA_FALLBACK stay in sync with
//   openapi.json, run:
//     npm run verify:openapi
//     bun run verify:openapi
//   If verification fails, reconcile the differences by updating ClientPath
//   (or, if the spec is stale, regenerate / update openapi.json) until the
//   check passes.

// Union of relative API paths that the web UI calls via bgRequest/bgStream
// or direct fetch. If a new endpoint is added in the UI, it should be
// added here so TypeScript can verify it exists in the spec.
export type ClientPath =
  | "/api/v1/health"
  | "/api/v1/llm/models"
  | "/api/v1/llm/models/metadata"
  | "/api/v1/llm/providers"
  | "/api/v1/chat/completions"
  | "/api/v1/feedback/explicit"
  | "/api/v1/rag/health"
  | "/api/v1/rag/search"
  | "/api/v1/rag/search/stream"
  | "/api/v1/rag/simple"
  | "/api/v1/rag/feedback/implicit"
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
  | "/api/v1/notes/collections"
  | "/api/v1/notes/collections/{collection_id}"
  | "/api/v1/notes/collections/{collection_id}/keywords"
  | "/api/v1/notes/collections/{collection_id}/keywords/{keyword_id}"
  | "/api/v1/notes/collections/keyword-links"
  | "/api/v1/notes/keywords"
  | "/api/v1/notes/keywords/search"
  | "/api/v1/notes/keywords/{keyword_id}"
  | "/api/v1/notes/conversations/{conversation_id}/keywords"
  | "/api/v1/notes/conversations/{conversation_id}/keywords/{keyword_id}"
  | "/api/v1/notes/conversations/keyword-links"
  | "/api/v1/prompts"
  | "/api/v1/prompts/search"
  | "/api/v1/chat/dictionaries"
  | "/api/v1/chat/dictionaries/import/json"
  | "/api/v1/chat/dictionaries/validate"
  | "/api/v1/chat/dictionaries/process"
  | "/api/v1/chat/knowledge/save"
  | "/api/v1/chat/documents"
  | "/api/v1/chat/documents/generate"
  | "/api/v1/chat/documents/bulk"
  | "/api/v1/chat/documents/{document_id}"
  | "/api/v1/chat/documents/jobs/{job_id}"
  | "/api/v1/chat/documents/prompts"
  | "/api/v1/chat/documents/prompts/{document_type}"
  | "/api/v1/chat/documents/statistics"
  | "/api/v1/chat/queue/status"
  | "/api/v1/chat/queue/activity"
  | "/api/v1/chats"
  | "/api/v1/chats/{chat_id}/completions"
  | "/api/v1/chats/{chat_id}/completions/persist"
  | "/api/v1/chats/{chat_id}/complete-v2"
  | "/api/v1/characters"
  | "/api/v1/characters/import"
  | "/api/v1/characters/world-books"
  | "/api/v1/characters/world-books/import"
  | "/api/v1/audio/providers"
  | "/api/v1/audio/speech"
  | "/api/v1/audio/transcriptions"
  | "/api/v1/audio/voices"
  | "/api/v1/audio/voices/catalog"
  | "/api/v1/audio/health"
  | "/api/v1/embeddings/models"
  | "/api/v1/embeddings/providers-config"
  | "/api/v1/embeddings/health"
  | "/api/v1/metrics/health"
  | "/api/v1/metrics/chat"
  | "/api/v1/evaluations"
  | "/api/v1/evaluations/datasets"
  | "/api/v1/evaluations/rate-limits"
  | "/api/v1/evaluations/history"
  | "/api/v1/evaluations/webhooks"
  | "/api/v1/mcp/health"
  | "/api/v1/mcp/tools"
  | "/api/v1/mcp/status"
  | "/api/v1/mcp/tools/execute"
  | "/api/v1/reading/items"
  | "/api/v1/reading/save"
  | "/api/v1/flashcards"
  | "/api/v1/flashcards/decks"
  | "/api/v1/flashcards/review"
  | "/api/v1/flashcards/import"
  | "/api/v1/flashcards/export"
  | "/api/v1/chatbooks/export"
  | "/api/v1/chatbooks/preview"
  | "/api/v1/chatbooks/import"
  | "/api/v1/chatbooks/export/jobs"
  | "/api/v1/chatbooks/export/jobs/{job_id}"
  | "/api/v1/chatbooks/import/jobs"
  | "/api/v1/chatbooks/import/jobs/{job_id}"
  | "/api/v1/chatbooks/download/{job_id}"
  | "/api/v1/chatbooks/cleanup"
  | "/api/v1/chatbooks/health"
  | "/api/v1/auth/login"
  | "/api/v1/auth/logout"
  | "/api/v1/auth/me"
  | "/api/v1/auth/refresh"
  | "/api/v1/auth/register"
  | "/api/v1/chunking/chunk_text"
  | "/api/v1/chunking/chunk_file"
  | "/api/v1/chunking/capabilities"

type ReplacePathParams<Path extends string> =
  Path extends `${infer Head}{${string}}${infer Tail}`
    ? ReplacePathParams<`${Head}${string}${Tail}`>
    : Path

// Runtime path form: replaces OpenAPI-style "{param}" segments with "${string}".
export type ClientPathRuntime = ReplacePathParams<ClientPath>

// OpenAPI paths don't include query strings, but the UI appends them at runtime.
export type ClientPathRuntimeWithQuery = ClientPathRuntime | `${ClientPathRuntime}?${string}`

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

export type ClientPathOrUrl = ClientPathRuntime | AbsoluteURL

export type ClientPathOrUrlWithQuery = ClientPathRuntimeWithQuery | AbsoluteURL

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
