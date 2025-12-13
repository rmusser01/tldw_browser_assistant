/**
 * Folder System API Service
 *
 * Handles communication with tldw_server for folder (keyword_collections)
 * and keyword management. Uses bgRequest for proper auth handling.
 */

import { bgRequest } from "@/services/background-proxy"
import type { Folder, Keyword, FolderKeywordLink, ConversationKeywordLink } from "@/db/dexie/types"

type ArrayOrWrapped<T, K extends string> = T[] | { [key in K]: T[] } | null | undefined

const normalizeArrayResponse = <T, K extends string>(
  response: ArrayOrWrapped<T, K>,
  key: K
): T[] => {
  if (!response) return []
  if (Array.isArray(response)) return response

  const wrapped = (response as any)?.[key]
  if (Array.isArray(wrapped)) return wrapped

  throw new Error(`Unexpected response shape (expected array or { ${key}: [] })`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder (keyword_collections) API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all folders from server
 */
export const fetchFolders = async (options?: { abortSignal?: AbortSignal; timeoutMs?: number }): Promise<Folder[]> => {
  const response = await bgRequest<ArrayOrWrapped<Folder, "collections">>({
    path: '/api/v1/notes/collections/',
    method: 'GET',
    abortSignal: options?.abortSignal,
    timeoutMs: options?.timeoutMs
  })
  return normalizeArrayResponse(response, "collections")
}

/**
 * Create a new folder
 */
export const createFolder = async (
  name: string,
  parentId?: number | null,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<Folder | null> => {
  try {
    return await bgRequest<Folder>({
      path: '/api/v1/notes/collections/',
      method: 'POST',
      body: { name, parent_id: parentId ?? null },
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  } catch (error) {
    console.error('Failed to create folder:', error)
    return null
  }
}

/**
 * Update an existing folder
 */
export const updateFolder = async (
  id: number,
  data: { name?: string; parent_id?: number | null },
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<Folder | null> => {
  try {
    return await bgRequest<Folder>({
      path: `/api/v1/notes/collections/${id}`,
      method: 'PATCH',
      body: data,
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  } catch (error) {
    console.error('Failed to update folder:', error)
    return null
  }
}

/**
 * Delete a folder (soft delete on server)
 */
export const deleteFolder = async (id: number, options?: { abortSignal?: AbortSignal; timeoutMs?: number }): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/collections/${id}`,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return true
  } catch (error) {
    console.error('Failed to delete folder:', error)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all keywords from server
 */
export const fetchKeywords = async (): Promise<Keyword[]> => {
  const response = await bgRequest<ArrayOrWrapped<Keyword, "keywords">>({
    path: '/api/v1/notes/keywords/',
    method: 'GET'
  })
  return normalizeArrayResponse(response, "keywords")
}

/**
 * Create a new keyword
 */
export const createKeyword = async (keyword: string, options?: { abortSignal?: AbortSignal; timeoutMs?: number }): Promise<Keyword | null> => {
  try {
    return await bgRequest<Keyword>({
      path: '/api/v1/notes/keywords/',
      method: 'POST',
      body: { keyword },
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
  } catch (error) {
    console.error('Failed to create keyword:', error)
    return null
  }
}

/**
 * Delete a keyword (soft delete on server)
 */
export const deleteKeyword = async (id: number, options?: { abortSignal?: AbortSignal; timeoutMs?: number }): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/keywords/${id}`,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return true
  } catch (error) {
    console.error('Failed to delete keyword:', error)
    return false
  }
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
): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/collections/${folderId}/keywords/${keywordId}`,
      method: 'POST',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return true
  } catch (error) {
    console.error('Failed to link keyword to folder:', error)
    return false
  }
}

/**
 * Unlink a keyword from a folder
 */
export const unlinkKeywordFromFolder = async (
  folderId: number,
  keywordId: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/collections/${folderId}/keywords/${keywordId}`,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return true
  } catch (error) {
    console.error('Failed to unlink keyword from folder:', error)
    return false
  }
}

/**
 * Get all keywords for a folder
 */
export const getKeywordsForFolder = async (folderId: number): Promise<Keyword[]> => {
  try {
    const response = await bgRequest<ArrayOrWrapped<Keyword, "keywords">>({
      path: `/api/v1/notes/collections/${folderId}/keywords`,
      method: 'GET'
    })
    return normalizeArrayResponse(response, "keywords")
  } catch (error) {
    console.error('Failed to get keywords for folder:', error)
    return []
  }
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
): Promise<boolean> => {
  try {
    const cid = encodeURIComponent(conversationId)
    await bgRequest({
      path: `/api/v1/notes/conversations/${cid}/keywords/${keywordId}`,
      method: 'POST',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return true
  } catch (error) {
    console.error('Failed to link keyword to conversation:', error)
    return false
  }
}

/**
 * Unlink a keyword from a conversation
 */
export const unlinkKeywordFromConversation = async (
  conversationId: string,
  keywordId: number,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number }
): Promise<boolean> => {
  try {
    const cid = encodeURIComponent(conversationId)
    await bgRequest({
      path: `/api/v1/notes/conversations/${cid}/keywords/${keywordId}`,
      method: 'DELETE',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return true
  } catch (error) {
    console.error('Failed to unlink keyword from conversation:', error)
    return false
  }
}

/**
 * Get all keywords for a conversation
 */
export const getKeywordsForConversation = async (
  conversationId: string
): Promise<Keyword[]> => {
  try {
    const cid = encodeURIComponent(conversationId)
    const response = await bgRequest<ArrayOrWrapped<Keyword, "keywords">>({
      path: `/api/v1/notes/conversations/${cid}/keywords`,
      method: 'GET'
    })
    return normalizeArrayResponse(response, "keywords")
  } catch (error) {
    console.error('Failed to get keywords for conversation:', error)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all folder-keyword links (for building the tree)
 */
export const fetchFolderKeywordLinks = async (options?: { abortSignal?: AbortSignal; timeoutMs?: number }): Promise<FolderKeywordLink[]> => {
  try {
    const response = await bgRequest<ArrayOrWrapped<FolderKeywordLink, "links">>({
      path: '/api/v1/notes/collections/keyword-links',
      method: 'GET',
      abortSignal: options?.abortSignal,
      timeoutMs: options?.timeoutMs
    })
    return normalizeArrayResponse(response, "links")
  } catch (error) {
    // This endpoint might not exist yet - return empty array
    console.debug('Folder-keyword links endpoint not available:', error)
    return []
  }
}

/**
 * Fetch all conversation-keyword links for a set of conversations
 */
export const fetchConversationKeywordLinks = async (
  conversationIds?: string[]
): Promise<ConversationKeywordLink[]> => {
  try {
    const path = (conversationIds?.length
      ? `/api/v1/notes/conversations/keyword-links?ids=${conversationIds
          .map((id) => encodeURIComponent(id))
          .join(',')}`
      : '/api/v1/notes/conversations/keyword-links') as `/${string}`

    const response = await bgRequest<ArrayOrWrapped<ConversationKeywordLink, "links">>({
      path,
      method: 'GET'
    })
    return normalizeArrayResponse(response, "links")
  } catch (error) {
    // This endpoint might not exist yet - return empty array
    console.debug('Conversation-keyword links endpoint not available:', error)
    return []
  }
}
