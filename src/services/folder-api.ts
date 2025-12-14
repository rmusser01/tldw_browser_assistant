/**
 * Folder System API Service
 *
 * Handles communication with tldw_server for folder (keyword_collections)
 * and keyword management. Uses bgRequestClient for proper auth handling.
 *
 * All methods in this file return a typed response envelope and use a
 * single-flight pattern to deduplicate concurrent identical requests.
 */

import { bgRequestClient } from "@/services/background-proxy"
import type { ClientPathOrUrlWithQuery } from "@/services/tldw/openapi-guard"
import type { Folder, Keyword, FolderKeywordLink, ConversationKeywordLink } from "@/db/dexie/types"

type ArrayOrWrapped<T, K extends string> = T[] | { [key in K]: T[] } | null | undefined

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
  status?: number
}

const inFlightRequests = new Map<string, Promise<ApiResult<unknown>>>()

const normalizeArrayResponse = <T, K extends string>(
  response: ArrayOrWrapped<T, K>,
  key: K
): T[] => {
  if (!response) return []
  if (Array.isArray(response)) return response

  const wrapped = (response as Record<string, unknown>)?.[key]
  if (Array.isArray(wrapped)) return wrapped

  throw new Error(`Unexpected response shape (expected array or { ${key}: [] })`)
}

const buildRequestKey = (method: string, path: string, body?: any): string => {
  const m = method.toUpperCase()
  if (body === undefined || body === null) {
    return `${m} ${path}`
  }
  try {
    return `${m} ${path} ${JSON.stringify(body)}`
  } catch {
    return `${m} ${path} ${String(body)}`
  }
}

const extractStatusFromError = (error: unknown): number | undefined => {
  const msg = error instanceof Error ? error.message : String(error)
  const match = msg.match(/(\d{3})/)
  if (!match) return undefined
  const code = Number(match[1])
  return Number.isFinite(code) ? code : undefined
}

const singleFlight = async <T>(
  key: string,
  executor: () => Promise<T>
): Promise<ApiResult<T>> => {
  const existing = inFlightRequests.get(key) as Promise<ApiResult<T>> | undefined
  if (existing) return existing

  const promise: Promise<ApiResult<T>> = (async () => {
    try {
      const data = await executor()
      return {
        ok: true,
        data,
        // bgRequest/bgRequestClient does not currently expose HTTP status on success;
        // use 200 as a generic success indicator.
        status: 200
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: message,
        status: extractStatusFromError(error)
      }
    }
  })()

  inFlightRequests.set(key, promise as Promise<ApiResult<unknown>>)

  const cleanup = () => {
    const current = inFlightRequests.get(key)
    if (current === promise) {
      inFlightRequests.delete(key)
    }
  }

  promise.then(cleanup, cleanup)

  return promise
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder (keyword_collections) API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all folders from server
 */
export const fetchFolders = async (
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<Folder[]>> => {
  const path = '/api/v1/notes/collections' as ClientPathOrUrlWithQuery
  const key = buildRequestKey('GET', path)
  return singleFlight<Folder[]>(key, async () => {
    const response = await bgRequestClient<ArrayOrWrapped<Folder, "collections">>({
      path,
      method: 'GET',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return normalizeArrayResponse(response, "collections")
  })
}

/**
 * Create a new folder
 */
export const createFolder = async (
  name: string,
  parentId?: number | null,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<Folder>> => {
  const path = '/api/v1/notes/collections' as ClientPathOrUrlWithQuery
  const body = { name, parent_id: parentId ?? null }
  const key = buildRequestKey('POST', path, body)
  return singleFlight<Folder>(key, async () => {
    return await bgRequestClient<Folder>({
      path,
      method: 'POST',
      body,
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

/**
 * Update an existing folder
 */
export const updateFolder = async (
  id: number,
  data: { name?: string; parent_id?: number | null },
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<Folder>> => {
  const path = `/api/v1/notes/collections/${id}` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('PATCH', path, data)
  return singleFlight<Folder>(key, async () => {
    return await bgRequestClient<Folder>({
      path,
      method: 'PATCH',
      body: data,
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

/**
 * Delete a folder (soft delete on server)
 */
export const deleteFolder = async (
  id: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<void>> => {
  const path = `/api/v1/notes/collections/${id}` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('DELETE', path)
  return singleFlight<void>(key, async () => {
    await bgRequestClient({
      path,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all keywords from server
 */
export const fetchKeywords = async (
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<Keyword[]>> => {
  const path = '/api/v1/notes/keywords' as ClientPathOrUrlWithQuery
  const key = buildRequestKey('GET', path)
  return singleFlight<Keyword[]>(key, async () => {
    const response = await bgRequestClient<ArrayOrWrapped<Keyword, "keywords">>({
      path,
      method: 'GET',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return normalizeArrayResponse(response, "keywords")
  })
}

/**
 * Create a new keyword
 */
export const createKeyword = async (
  keyword: string,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<Keyword>> => {
  const path = '/api/v1/notes/keywords' as ClientPathOrUrlWithQuery
  const body = { keyword }
  const key = buildRequestKey('POST', path, body)
  return singleFlight<Keyword>(key, async () => {
    return await bgRequestClient<Keyword>({
      path,
      method: 'POST',
      body,
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

/**
 * Delete a keyword (soft delete on server)
 */
export const deleteKeyword = async (
  id: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<void>> => {
  const path = `/api/v1/notes/keywords/${id}` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('DELETE', path)
  return singleFlight<void>(key, async () => {
    await bgRequestClient({
      path,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder-Keyword Linking API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Link a keyword to a folder
 */
export const linkKeywordToFolder = async (
  folderId: number,
  keywordId: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<void>> => {
  const path = `/api/v1/notes/collections/${folderId}/keywords/${keywordId}` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('POST', path)
  return singleFlight<void>(key, async () => {
    await bgRequestClient({
      path,
      method: 'POST',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

/**
 * Unlink a keyword from a folder
 */
export const unlinkKeywordFromFolder = async (
  folderId: number,
  keywordId: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<void>> => {
  const path = `/api/v1/notes/collections/${folderId}/keywords/${keywordId}` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('DELETE', path)
  return singleFlight<void>(key, async () => {
    await bgRequestClient({
      path,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

/**
 * Get all keywords for a folder
 */
export const getKeywordsForFolder = async (
  folderId: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<Keyword[]>> => {
  const path = `/api/v1/notes/collections/${folderId}/keywords` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('GET', path)
  return singleFlight<Keyword[]>(key, async () => {
    const response = await bgRequestClient<ArrayOrWrapped<Keyword, "keywords">>({
      path,
      method: 'GET',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return normalizeArrayResponse(response, "keywords")
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation-Keyword Linking API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Link a keyword to a conversation
 */
export const linkKeywordToConversation = async (
  conversationId: string,
  keywordId: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<void>> => {
  const cid = encodeURIComponent(conversationId)
  const path = `/api/v1/notes/conversations/${cid}/keywords/${keywordId}` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('POST', path)
  return singleFlight<void>(key, async () => {
    await bgRequestClient({
      path,
      method: 'POST',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

/**
 * Unlink a keyword from a conversation
 */
export const unlinkKeywordFromConversation = async (
  conversationId: string,
  keywordId: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<void>> => {
  const cid = encodeURIComponent(conversationId)
  const path = `/api/v1/notes/conversations/${cid}/keywords/${keywordId}` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('DELETE', path)
  return singleFlight<void>(key, async () => {
    await bgRequestClient({
      path,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  })
}

/**
 * Get all keywords for a conversation
 */
export const getKeywordsForConversation = async (
  conversationId: string,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<Keyword[]>> => {
  const cid = encodeURIComponent(conversationId)
  const path = `/api/v1/notes/conversations/${cid}/keywords` as ClientPathOrUrlWithQuery
  const key = buildRequestKey('GET', path)
  return singleFlight<Keyword[]>(key, async () => {
    const response = await bgRequestClient<ArrayOrWrapped<Keyword, "keywords">>({
      path,
      method: 'GET',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return normalizeArrayResponse(response, "keywords")
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all folder-keyword links (for building the tree)
 */
export const fetchFolderKeywordLinks = async (
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<FolderKeywordLink[]>> => {
  const path = '/api/v1/notes/collections/keyword-links' as ClientPathOrUrlWithQuery
  const key = buildRequestKey('GET', path)
  return singleFlight<FolderKeywordLink[]>(key, async () => {
    const response = await bgRequestClient<ArrayOrWrapped<FolderKeywordLink, "links">>({
      path,
      method: 'GET',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return normalizeArrayResponse(response, "links")
  })
}

/**
 * Fetch all conversation-keyword links for a set of conversations
 */
export const fetchConversationKeywordLinks = async (
  conversationIds?: string[],
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResult<ConversationKeywordLink[]>> => {
  const path = (conversationIds?.length
    ? (() => {
        const params = new URLSearchParams()
        params.set('ids', conversationIds.map((id) => encodeURIComponent(id)).join(','))
        return `/api/v1/notes/conversations/keyword-links?${params.toString()}` as `/api/v1/notes/conversations/keyword-links?${string}`
      })()
    : '/api/v1/notes/conversations/keyword-links') as ClientPathOrUrlWithQuery

  const key = buildRequestKey('GET', path)
  return singleFlight<ConversationKeywordLink[]>(key, async () => {
    const response = await bgRequestClient<ArrayOrWrapped<ConversationKeywordLink, "links">>({
      path,
      method: 'GET',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return normalizeArrayResponse(response, "links")
  })
}
