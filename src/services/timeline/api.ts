/**
 * Timeline API Service
 *
 * Handles communication with tldw_server for timeline/branching operations.
 * Leverages existing TldwApiClient and bgRequest infrastructure.
 */

import { bgRequest } from '@/services/background-proxy'
import type { ServerChatSummary, ServerChatMessage } from '@/services/tldw/TldwApiClient'

// ============================================================================
// Types
// ============================================================================

export interface ConversationTreeResponse {
  conversations: ServerChatSummary[]
  root_id: string
}

export interface ForkRequest {
  parent_conversation_id: string
  forked_from_message_id?: string
  title?: string
  character_id?: number
}

export interface ForkResponse {
  id: string
  root_id: string
  parent_conversation_id: string
  forked_from_message_id?: string
  title?: string
  created_at: string
}

export interface MessageWithParent extends ServerChatMessage {
  parent_message_id?: string | null
  conversation_id: string
}

export interface SearchResult {
  message_id: string
  conversation_id: string
  content: string
  role: string
  timestamp: string
  match_score?: number
}

// ============================================================================
// Timeline API Service
// ============================================================================

export class TimelineApiService {
  /**
   * Fetch all conversations that share the same root_id as the given conversation
   * This returns the complete conversation tree for timeline visualization
   */
  async fetchConversationTree(conversationId: string): Promise<ConversationTreeResponse> {
    // First, get the conversation to find its root_id
    const conversation = await this.getConversation(conversationId)

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    const rootId = conversation.root_id || conversationId

    // Fetch all conversations with this root_id
    const conversations = await this.listConversationsByRoot(rootId)

    return {
      conversations,
      root_id: rootId
    }
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(conversationId: string): Promise<ServerChatSummary | null> {
    try {
      const data = await bgRequest<any>({
        path: `/api/v1/chats/${conversationId}`,
        method: 'GET'
      })
      return this.normalizeChatSummary(data)
    } catch (error) {
      console.error('Failed to get conversation:', error)
      return null
    }
  }

  /**
   * List all conversations with a specific root_id
   */
  async listConversationsByRoot(rootId: string): Promise<ServerChatSummary[]> {
    try {
      // Try with root_id filter parameter
      const data = await bgRequest<any>({
        path: `/api/v1/chats/?root_id=${encodeURIComponent(rootId)}`,
        method: 'GET'
      })

      let list: any[] = []

      if (Array.isArray(data)) {
        list = data
      } else if (data && typeof data === 'object') {
        const obj: any = data
        if (Array.isArray(obj.chats)) list = obj.chats
        else if (Array.isArray(obj.items)) list = obj.items
        else if (Array.isArray(obj.results)) list = obj.results
        else if (Array.isArray(obj.data)) list = obj.data
      }

      // Filter to only conversations with matching root_id
      return list
        .map((c) => this.normalizeChatSummary(c))
        .filter((c) => c.root_id === rootId || c.id === rootId)
    } catch (error) {
      console.error('Failed to list conversations by root:', error)
      // Fallback: get single conversation
      const conv = await this.getConversation(rootId)
      return conv ? [conv] : []
    }
  }

  /**
   * Get all messages from a conversation, including parent_message_id
   */
  async getConversationMessages(conversationId: string): Promise<MessageWithParent[]> {
    try {
      const data = await bgRequest<any>({
        path: `/api/v1/chats/${conversationId}/messages`,
        method: 'GET'
      })

      let messages: any[] = []

      if (Array.isArray(data)) {
        messages = data
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.messages)) messages = data.messages
        else if (Array.isArray(data.items)) messages = data.items
        else if (Array.isArray(data.data)) messages = data.data
      }

      return messages.map((m) => this.normalizeMessage(m, conversationId))
    } catch (error) {
      console.error('Failed to get conversation messages:', error)
      return []
    }
  }

  /**
   * Create a fork (new branch) from an existing conversation
   */
  async createFork(request: ForkRequest): Promise<ForkResponse> {
    const body: Record<string, any> = {
      parent_conversation_id: request.parent_conversation_id
    }

    if (request.forked_from_message_id) {
      body.forked_from_message_id = request.forked_from_message_id
    }

    if (request.title) {
      body.title = request.title
    }

    if (request.character_id) {
      body.character_id = request.character_id
    }

    const data = await bgRequest<any>({
      path: '/api/v1/chats/',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })

    return {
      id: data.id,
      root_id: data.root_id || request.parent_conversation_id,
      parent_conversation_id: request.parent_conversation_id,
      forked_from_message_id: request.forked_from_message_id,
      title: data.title,
      created_at: data.created_at
    }
  }

  /**
   * Add a message to a conversation with optional parent_message_id
   * This enables creating swipes (alternative responses)
   */
  async addMessage(
    conversationId: string,
    content: string,
    role: 'user' | 'assistant' | 'system',
    parentMessageId?: string
  ): Promise<MessageWithParent> {
    const body: Record<string, any> = {
      content,
      role
    }

    if (parentMessageId) {
      body.parent_message_id = parentMessageId
    }

    const data = await bgRequest<any>({
      path: `/api/v1/chats/${conversationId}/messages`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })

    return this.normalizeMessage(data, conversationId)
  }

  /**
   * Search messages across conversations
   * Uses server-side FTS5 full-text search
   */
  async searchMessages(
    query: string,
    conversationId?: string
  ): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({ q: query })
      if (conversationId) {
        params.append('conversation_id', conversationId)
      }

      const data = await bgRequest<any>({
        path: `/api/v1/chats/search?${params.toString()}`,
        method: 'GET'
      })

      let results: any[] = []

      if (Array.isArray(data)) {
        results = data
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.results)) results = data.results
        else if (Array.isArray(data.messages)) results = data.messages
        else if (Array.isArray(data.items)) results = data.items
      }

      return results.map((r) => ({
        message_id: r.id || r.message_id,
        conversation_id: r.conversation_id || r.chat_id,
        content: r.content || r.text || '',
        role: r.role || r.sender || 'user',
        timestamp: r.created_at || r.timestamp || '',
        match_score: r.score || r.bm25_norm || r.match_score
      }))
    } catch (error) {
      console.error('Failed to search messages:', error)
      return []
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private normalizeChatSummary(input: any): ServerChatSummary {
    const created_at = String(input?.created_at || input?.createdAt || '')
    const updated_at =
      input?.updated_at ??
      input?.updatedAt ??
      input?.last_modified ??
      input?.lastModified ??
      null

    return {
      id: String(input?.id ?? ''),
      title: String(input?.title || ''),
      created_at,
      updated_at: updated_at ? String(updated_at) : null,
      source: input?.source ?? null,
      state: input?.state ?? input?.conversation_state ?? null,
      topic_label: input?.topic_label ?? input?.topicLabel ?? null,
      cluster_id: input?.cluster_id ?? input?.clusterId ?? null,
      external_ref: input?.external_ref ?? input?.externalRef ?? null,
      bm25_norm: typeof input?.bm25_norm === 'number' ? input?.bm25_norm : null,
      character_id: input?.character_id ?? input?.characterId ?? null,
      parent_conversation_id:
        input?.parent_conversation_id ?? input?.parentConversationId ?? null,
      root_id: input?.root_id ?? input?.rootId ?? null
    }
  }

  private normalizeMessage(input: any, conversationId: string): MessageWithParent {
    return {
      id: String(input?.id ?? ''),
      role: input?.role || input?.sender || 'user',
      content: input?.content || input?.text || '',
      created_at: input?.created_at || input?.timestamp || input?.createdAt || '',
      version: input?.version,
      parent_message_id: input?.parent_message_id ?? input?.parentMessageId ?? null,
      conversation_id: conversationId
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const timelineApi = new TimelineApiService()
