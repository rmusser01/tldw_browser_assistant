/**
 * Folder System API Service
 *
 * Handles communication with tldw_server for folder (keyword_collections)
 * and keyword management. Uses bgRequest for proper auth handling.
 */

import { bgRequest } from "./background-proxy"
import type { Folder, Keyword, FolderKeywordLink, ConversationKeywordLink } from "@/db/dexie/types"

// ─────────────────────────────────────────────────────────────────────────────
// Folder (keyword_collections) API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all folders from server
 */
export const fetchFolders = async (): Promise<Folder[]> => {
  try {
    const response = await bgRequest<{ collections: Folder[] } | Folder[]>({
      path: '/api/v1/notes/collections/',
      method: 'GET'
    })
    // Handle both array and object response formats
    return Array.isArray(response) ? response : (response?.collections || [])
  } catch (error) {
    console.error('Failed to fetch folders:', error)
    return []
  }
}

/**
 * Create a new folder
 */
export const createFolder = async (
  name: string,
  parentId?: number | null
): Promise<Folder | null> => {
  try {
    return await bgRequest<Folder>({
      path: '/api/v1/notes/collections/',
      method: 'POST',
      body: { name, parent_id: parentId ?? null }
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
  data: { name?: string; parent_id?: number | null }
): Promise<Folder | null> => {
  try {
    return await bgRequest<Folder>({
      path: `/api/v1/notes/collections/${id}`,
      method: 'PATCH',
      body: data
    })
  } catch (error) {
    console.error('Failed to update folder:', error)
    return null
  }
}

/**
 * Delete a folder (soft delete on server)
 */
export const deleteFolder = async (id: number): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/collections/${id}`,
      method: 'DELETE'
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
  try {
    const response = await bgRequest<{ keywords: Keyword[] } | Keyword[]>({
      path: '/api/v1/notes/keywords/',
      method: 'GET'
    })
    return Array.isArray(response) ? response : (response?.keywords || [])
  } catch (error) {
    console.error('Failed to fetch keywords:', error)
    return []
  }
}

/**
 * Create a new keyword
 */
export const createKeyword = async (keyword: string): Promise<Keyword | null> => {
  try {
    return await bgRequest<Keyword>({
      path: '/api/v1/notes/keywords/',
      method: 'POST',
      body: { keyword }
    })
  } catch (error) {
    console.error('Failed to create keyword:', error)
    return null
  }
}

/**
 * Delete a keyword (soft delete on server)
 */
export const deleteKeyword = async (id: number): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/keywords/${id}`,
      method: 'DELETE'
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
  keywordId: number
): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/collections/${folderId}/keywords/${keywordId}`,
      method: 'POST'
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
  keywordId: number
): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/collections/${folderId}/keywords/${keywordId}`,
      method: 'DELETE'
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
    const response = await bgRequest<{ keywords: Keyword[] } | Keyword[]>({
      path: `/api/v1/notes/collections/${folderId}/keywords`,
      method: 'GET'
    })
    return Array.isArray(response) ? response : (response?.keywords || [])
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
  keywordId: number
): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/conversations/${conversationId}/keywords/${keywordId}`,
      method: 'POST'
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
  keywordId: number
): Promise<boolean> => {
  try {
    await bgRequest({
      path: `/api/v1/notes/conversations/${conversationId}/keywords/${keywordId}`,
      method: 'DELETE'
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
    const response = await bgRequest<{ keywords: Keyword[] } | Keyword[]>({
      path: `/api/v1/notes/conversations/${conversationId}/keywords`,
      method: 'GET'
    })
    return Array.isArray(response) ? response : (response?.keywords || [])
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
export const fetchFolderKeywordLinks = async (): Promise<FolderKeywordLink[]> => {
  try {
    const response = await bgRequest<{ links: FolderKeywordLink[] } | FolderKeywordLink[]>({
      path: '/api/v1/notes/collections/keyword-links',
      method: 'GET'
    })
    return Array.isArray(response) ? response : (response?.links || [])
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
      ? `/api/v1/notes/conversations/keyword-links?ids=${conversationIds.join(',')}`
      : '/api/v1/notes/conversations/keyword-links') as `/${string}`

    const response = await bgRequest<{ links: ConversationKeywordLink[] } | ConversationKeywordLink[]>({
      path,
      method: 'GET'
    })
    return Array.isArray(response) ? response : (response?.links || [])
  } catch (error) {
    // This endpoint might not exist yet - return empty array
    console.debug('Conversation-keyword links endpoint not available:', error)
    return []
  }
}
