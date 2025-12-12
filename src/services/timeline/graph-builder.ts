/**
 * Timeline Graph Builder Service
 *
 * Builds a directed acyclic graph (DAG) from chat conversation data
 * for visualization in the timeline view.
 *
 * Key concepts:
 * - Nodes represent messages in conversations
 * - Edges represent parent-child relationships
 * - Messages with identical content at the same depth merge into single nodes
 * - Swipes (multiple AI responses to same parent) shown as expandable node groups
 */

import { Message, HistoryInfo } from '@/db/dexie/types'
import { db } from '@/db/dexie/schema'

// ============================================================================
// Types
// ============================================================================

export type TimelineNodeType = 'root' | 'message' | 'swipe'

export type TimelineNode = {
  id: string
  type: TimelineNodeType
  depth: number
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: number
  history_ids: string[]       // Which conversations contain this node
  message_ids: string[]       // Original message IDs (can be multiple if merged)
  is_current: boolean         // Is this the currently viewed message
  sender_name?: string
  has_swipes: boolean         // Does this node have alternative responses
  swipe_count: number         // Number of swipes/alternatives
  is_swipe: boolean           // Is this node itself a swipe (not primary path)
  parent_message_id?: string  // For building tree structure
}

export type TimelineEdge = {
  id: string
  source: string             // Source node ID
  target: string             // Target node ID
  history_ids: string[]      // Which conversations this edge belongs to
  is_swipe_edge: boolean     // Is this edge to a swipe node
}

export type TimelineGraph = {
  nodes: TimelineNode[]
  edges: TimelineEdge[]
  root_id: string            // The conversation tree root ID
  current_history_id: string // Currently viewed conversation
}

export type SwipeGroup = {
  parent_message_id: string
  messages: Message[]        // All messages sharing same parent
  active_index: number       // Currently displayed swipe (0 = primary)
}

// ============================================================================
// Graph Builder Class
// ============================================================================

export class TimelineGraphBuilder {
  /**
   * Build graph for current conversation and all its branches (same root_id)
   * This is the primary method - scoped to current conversation tree only
   */
  async buildGraphForConversation(historyId: string): Promise<TimelineGraph> {
    // 1. Get the current conversation to find its root_id
    const currentHistory = await db.chatHistories.get(historyId)
    if (!currentHistory) {
      throw new Error(`Conversation ${historyId} not found`)
    }

    // Use root_id if available, otherwise this conversation is the root
    const rootId = currentHistory.root_id || historyId

    // 2. Get all conversations in this tree (same root_id)
    const relatedHistories = await this.getConversationTree(rootId)

    // 3. Get all messages from all related conversations
    const allMessages = await this.getAllMessagesFromHistories(
      relatedHistories.map(h => h.id)
    )

    // 4. Build the graph structure
    const graph = this.buildGraph(
      allMessages,
      relatedHistories,
      rootId,
      historyId
    )

    return graph
  }

  /**
   * Get all conversations that share the same root_id
   */
  private async getConversationTree(rootId: string): Promise<HistoryInfo[]> {
    // Get conversations where root_id matches
    const byRootId = await db.chatHistories
      .where('root_id')
      .equals(rootId)
      .toArray()

    // Also get the root conversation itself (may have root_id === id)
    const rootConv = await db.chatHistories.get(rootId)

    const conversations = [...byRootId]
    if (rootConv && !conversations.find(c => c.id === rootConv.id)) {
      conversations.push(rootConv)
    }

    return conversations
  }

  /**
   * Get all messages from multiple conversation histories
   */
  private async getAllMessagesFromHistories(
    historyIds: string[]
  ): Promise<Message[]> {
    const allMessages: Message[] = []

    for (const historyId of historyIds) {
      const messages = await db.messages
        .where('history_id')
        .equals(historyId)
        .toArray()
      allMessages.push(...messages)
    }

    // Sort by timestamp to maintain order
    return allMessages.sort((a, b) => a.createdAt - b.createdAt)
  }

  /**
   * Build the graph from messages and conversations
   */
  private buildGraph(
    messages: Message[],
    histories: HistoryInfo[],
    rootId: string,
    currentHistoryId: string
  ): TimelineGraph {
    const nodes: TimelineNode[] = []
    const edges: TimelineEdge[] = []

    // Track message ID -> node ID mapping (for deduplication)
    const messageToNodeMap = new Map<string, string>()

    // Track content+depth -> node ID (for merging identical messages)
    const contentDepthToNodeMap = new Map<string, string>()

    // Create root node
    const rootNode: TimelineNode = {
      id: 'root',
      type: 'root',
      depth: 0,
      content: '',
      role: 'system',
      timestamp: Math.min(...messages.map(m => m.createdAt)),
      history_ids: histories.map(h => h.id),
      message_ids: [],
      is_current: false,
      sender_name: 'Conversation Start',
      has_swipes: false,
      swipe_count: 0,
      is_swipe: false
    }
    nodes.push(rootNode)

    // Group messages by parent_message_id to identify swipes
    const swipeGroups = this.identifySwipeGroups(messages)

    // Process messages to build nodes
    for (const message of messages) {
      // Compute depth (distance from root)
      const depth = this.computeDepth(message, messages) + 1

      // Check if we should merge with existing node (same content at same depth)
      const contentKey = `${message.content.trim()}:${depth}`
      const existingNodeId = contentDepthToNodeMap.get(contentKey)

      if (existingNodeId) {
        // Merge: add this message to existing node
        const existingNode = nodes.find(n => n.id === existingNodeId)
        if (existingNode) {
          existingNode.message_ids.push(message.id)
          if (!existingNode.history_ids.includes(message.history_id)) {
            existingNode.history_ids.push(message.history_id)
          }
          messageToNodeMap.set(message.id, existingNodeId)
        }
        continue
      }

      // Check if this is a swipe (non-primary response to same parent)
      const isSwipe = this.isSwipeMessage(message, swipeGroups)

      // Create new node
      const nodeId = `node-${message.id}`
      const node: TimelineNode = {
        id: nodeId,
        type: isSwipe ? 'swipe' : 'message',
        depth,
        content: message.content,
        role: message.role as 'user' | 'assistant' | 'system',
        timestamp: message.createdAt,
        history_ids: [message.history_id],
        message_ids: [message.id],
        is_current: message.history_id === currentHistoryId,
        sender_name: message.name,
        has_swipes: this.hasSwipes(message.id, swipeGroups),
        swipe_count: this.getSwipeCount(message.id, swipeGroups),
        is_swipe: isSwipe,
        parent_message_id: message.parent_message_id || undefined
      }

      nodes.push(node)
      messageToNodeMap.set(message.id, nodeId)
      contentDepthToNodeMap.set(contentKey, nodeId)
    }

    // Build edges
    for (const message of messages) {
      const targetNodeId = messageToNodeMap.get(message.id)
      if (!targetNodeId) continue

      let sourceNodeId: string

      if (message.parent_message_id) {
        // Edge from parent message
        sourceNodeId = messageToNodeMap.get(message.parent_message_id) || 'root'
      } else {
        // No parent - connect to root
        sourceNodeId = 'root'
      }

      // Check if edge already exists (from merged nodes)
      const edgeId = `edge-${sourceNodeId}-${targetNodeId}`
      if (!edges.find(e => e.id === edgeId)) {
        const targetNode = nodes.find(n => n.id === targetNodeId)
        edges.push({
          id: edgeId,
          source: sourceNodeId,
          target: targetNodeId,
          history_ids: [message.history_id],
          is_swipe_edge: targetNode?.is_swipe || false
        })
      } else {
        // Add history_id to existing edge
        const existingEdge = edges.find(e => e.id === edgeId)
        if (existingEdge && !existingEdge.history_ids.includes(message.history_id)) {
          existingEdge.history_ids.push(message.history_id)
        }
      }
    }

    return {
      nodes,
      edges,
      root_id: rootId,
      current_history_id: currentHistoryId
    }
  }

  /**
   * Compute the depth of a message in the conversation tree
   */
  private computeDepth(message: Message, allMessages: Message[]): number {
    let depth = 0
    let currentMsg = message

    while (currentMsg.parent_message_id) {
      const parent = allMessages.find(m => m.id === currentMsg.parent_message_id)
      if (!parent) break
      depth++
      currentMsg = parent
    }

    return depth
  }

  /**
   * Identify groups of messages that are swipes (same parent, different responses)
   */
  private identifySwipeGroups(messages: Message[]): Map<string, SwipeGroup> {
    const groups = new Map<string, SwipeGroup>()

    // Group messages by parent_message_id
    for (const message of messages) {
      const parentId = message.parent_message_id || 'root'

      if (!groups.has(parentId)) {
        groups.set(parentId, {
          parent_message_id: parentId,
          messages: [],
          active_index: 0
        })
      }

      groups.get(parentId)!.messages.push(message)
    }

    // Only keep groups with multiple messages (actual swipes)
    for (const [key, group] of groups.entries()) {
      if (group.messages.length <= 1) {
        groups.delete(key)
      } else {
        // Sort by timestamp - first one is "primary"
        group.messages.sort((a, b) => a.createdAt - b.createdAt)
      }
    }

    return groups
  }

  /**
   * Check if a message is a swipe (not the primary response to its parent)
   */
  private isSwipeMessage(
    message: Message,
    swipeGroups: Map<string, SwipeGroup>
  ): boolean {
    const parentId = message.parent_message_id || 'root'
    const group = swipeGroups.get(parentId)

    if (!group || group.messages.length <= 1) {
      return false
    }

    // First message in group (by timestamp) is primary, rest are swipes
    return group.messages[0].id !== message.id
  }

  /**
   * Check if a message has swipes (alternative responses)
   */
  private hasSwipes(
    messageId: string,
    swipeGroups: Map<string, SwipeGroup>
  ): boolean {
    const group = swipeGroups.get(messageId)
    return group ? group.messages.length > 1 : false
  }

  /**
   * Get the number of swipes for a message
   */
  private getSwipeCount(
    messageId: string,
    swipeGroups: Map<string, SwipeGroup>
  ): number {
    const group = swipeGroups.get(messageId)
    return group ? group.messages.length - 1 : 0  // -1 because first is primary
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const timelineGraphBuilder = new TimelineGraphBuilder()
