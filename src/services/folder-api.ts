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
import type {
  AllowedPath,
  ClientPathOrUrlWithQuery
} from "@/services/tldw/openapi-guard"
import type { Folder, Keyword, FolderKeywordLink, ConversationKeywordLink } from "@/db/dexie/types"
import {
  buildQuery,
  createResourceClient,
  type RequestFn
} from "@/services/resource-client"

const foldersClient = createResourceClient({
  basePath: "/api/v1/notes/collections" as AllowedPath,
  request: bgRequestClient as unknown as RequestFn
})

const keywordsClient = createResourceClient({
  basePath: "/api/v1/notes/keywords" as AllowedPath,
  request: bgRequestClient as unknown as RequestFn
})

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

  if (typeof response === 'object' && response !== null && key in response) {
    const wrapped = response[key]
    if (Array.isArray(wrapped)) return wrapped
  }

  const tag = Object.prototype.toString.call(response)
  const keys =
    typeof response === 'object' && response !== null ? Object.keys(response) : []
  const keysPart = keys.length
    ? ` keys=[${keys.slice(0, 8).join(', ')}${keys.length > 8 ? ', …' : ''}]`
    : ''
  throw new Error(`Unexpected response shape (expected array or { ${key}: [] }, got ${tag}${keysPart})`)
}

const buildRequestKey = (method: string, path: string, body?: unknown): string => {
  const m = method.toUpperCase()
  if (body === undefined || body === null) {
    return `${m} ${path}`
  }
  try {
    const json = JSON.stringify(body)
    if (json !== undefined) {
      return `${m} ${path} ${json}`
    }
  } catch {
    // ignore; fall back to a readable string representation
  }
  try {
    return `${m} ${path} ${String(body)}`
  } catch {
    try {
      return `${m} ${path} ${Object.prototype.toString.call(body)}`
    } catch {
      return `${m} ${path} [unstringifiable body]`
    }
  }
}

const extractStatusFromError = (error: unknown): number | undefined => {
  const asHttpStatus = (value: unknown): number | undefined => {
    const num =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value.trim())
          : NaN
    if (!Number.isFinite(num) || !Number.isInteger(num)) return undefined
    return num >= 100 && num <= 599 ? num : undefined
  }

  const fromRecord = (record: Record<string, unknown>): number | undefined => {
    return (
      asHttpStatus(record.status) ??
      asHttpStatus(record.statusCode) ??
      asHttpStatus(record.code)
    )
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const direct = fromRecord(record)
    if (direct !== undefined) return direct

    const response = record.response
    if (response && typeof response === 'object') {
      const nested = fromRecord(response as Record<string, unknown>)
      if (nested !== undefined) return nested
    }
  }

  const msg = error instanceof Error ? error.message : String(error)
  const matches = [
    msg.match(/\b(?:status|statusCode)\b\s*[:=]?\s*(\d{3})\b/i)?.[1],
    msg.match(/\bHTTP(?:\/\d(?:\.\d)?)?\s*(\d{3})\b/i)?.[1],
    msg.match(/\b(?:request|upload)\s+failed\b\s*[:(]\s*(\d{3})\b/i)?.[1],
    msg.match(/\((\d{3})\)/)?.[1]
  ]

  for (const match of matches) {
    const status = asHttpStatus(match)
    if (status !== undefined) return status
  }

  return undefined
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
        // bgRequest/bgRequestClient does not currently expose HTTP status on success,
        // so use 200 as a generic indicator (this will mask 201/204/etc until status is plumbed through).
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
    const response = await foldersClient.list<ArrayOrWrapped<Folder, "collections">>(
      undefined,
      options
    )
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
    return foldersClient.create<Folder>(body, options)
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
    return foldersClient.update<Folder>(id, data, options)
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
    await foldersClient.remove<void>(id, undefined, options)
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
    const response = await keywordsClient.list<ArrayOrWrapped<Keyword, "keywords">>(
      undefined,
      options
    )
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
    return keywordsClient.create<Keyword>(body, options)
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
    await keywordsClient.remove<void>(id, undefined, options)
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
  const query = conversationIds?.length
    ? buildQuery({ ids: conversationIds }, { arrayFormat: "comma" })
    : ""
  const path = `/api/v1/notes/conversations/keyword-links${query}` as ClientPathOrUrlWithQuery

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
