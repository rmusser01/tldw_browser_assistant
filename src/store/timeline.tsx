/**
 * Timeline Store
 *
 * Zustand store for managing timeline/graph visualization state.
 */

import { createWithEqualityFn } from 'zustand/traditional'
import { useShallow } from 'zustand/react/shallow'
import type {
  TimelineGraph,
  TimelineNode,
  SearchMatch
} from '@/services/timeline'
import { timelineGraphBuilder, timelineSearch } from '@/services/timeline'

// ============================================================================
// Types
// ============================================================================

export type LayoutDirection = 'TB' | 'LR'  // Top-Bottom or Left-Right

export interface TimelineSettings {
  // Layout
  layoutDirection: LayoutDirection
  nodeWidth: number
  nodeHeight: number
  nodeSeparation: number
  rankSeparation: number

  // Appearance
  nodeShape: 'ellipse' | 'rectangle' | 'roundrectangle'
  curveStyle: 'taxi' | 'bezier' | 'straight'
  userNodeColor: string
  assistantNodeColor: string
  systemNodeColor: string
  edgeColor: string

  // Behavior
  autoExpandSwipes: boolean
  showLegend: boolean
  zoomLevel: number
  minZoom: number
  maxZoom: number
}

export interface TimelineState {
  // View state
  isOpen: boolean
  isLoading: boolean
  error: string | null

  // Current context
  currentHistoryId: string | null
  currentMessageId: string | null

  // Graph state
  graph: TimelineGraph | null
  expandedSwipeNodes: Set<string>

  // Selection/highlight state
  selectedNodeId: string | null
  highlightedNodeIds: Set<string>
  hoveredNodeId: string | null

  // Search state
  searchQuery: string
  searchResults: SearchMatch[]
  searchMode: 'fragments' | 'substring' | 'regex'

  // Settings
  settings: TimelineSettings

  // Internal
  requestId: number

  // Actions
  openTimeline: (historyId: string, messageId?: string) => Promise<void>
  closeTimeline: () => void
  refreshGraph: () => Promise<void>

  // Node interactions
  selectNode: (nodeId: string | null) => void
  hoverNode: (nodeId: string | null) => void
  toggleSwipeExpansion: (nodeId: string) => void
  expandAllSwipes: () => void
  collapseAllSwipes: () => void

  // Search
  setSearchQuery: (query: string) => void
  setSearchMode: (mode: 'fragments' | 'substring' | 'regex') => void
  clearSearch: () => void

  // Settings
  updateSettings: (settings: Partial<TimelineSettings>) => void
  toggleLayoutDirection: () => void

  // Utilities
  getNodeById: (nodeId: string) => TimelineNode | undefined
  getVisibleNodes: () => TimelineNode[]
}

// ============================================================================
// Default Settings
// ============================================================================

const defaultSettings: TimelineSettings = {
  // Layout
  layoutDirection: 'TB',
  nodeWidth: 150,
  nodeHeight: 50,
  nodeSeparation: 50,
  rankSeparation: 80,

  // Appearance
  nodeShape: 'roundrectangle',
  curveStyle: 'bezier',
  userNodeColor: '#3b82f6',      // Blue
  assistantNodeColor: '#ffffff', // White
  systemNodeColor: '#6b7280',    // Gray
  edgeColor: '#9ca3af',          // Light gray

  // Behavior
  autoExpandSwipes: false,
  showLegend: true,
  zoomLevel: 1,
  minZoom: 0.1,
  maxZoom: 3
}

// ============================================================================
// Store Implementation
// ============================================================================

const SEARCH_DEBOUNCE_MS = 300
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const clearPendingSearch = () => {
  if (!searchTimeout) return
  clearTimeout(searchTimeout)
  searchTimeout = null
}

const applySearchResults = (
  set: (partial: Partial<TimelineState>) => void,
  graph: TimelineGraph | null,
  query: string,
  mode: TimelineState['searchMode']
) => {
  const trimmedQuery = query.trim()

  if (!graph || !trimmedQuery) {
    set({
      searchResults: [],
      highlightedNodeIds: new Set()
    })
    return
  }

  const results = timelineSearch.searchNodes(graph.nodes, trimmedQuery, { mode })
  set({
    searchResults: results,
    highlightedNodeIds: new Set(results.map((r) => r.node.id))
  })
}

const scheduleSearchFromState = (
  get: () => TimelineState,
  set: (partial: Partial<TimelineState>) => void
) => {
  clearPendingSearch()

  const { graph, searchQuery, searchMode } = get()
  if (!graph || !searchQuery.trim()) {
    applySearchResults(set, graph, searchQuery, searchMode)
    return
  }

  searchTimeout = setTimeout(() => {
    searchTimeout = null
    const { graph: latestGraph, searchQuery: latestQuery, searchMode: latestMode } =
      get()
    applySearchResults(set, latestGraph, latestQuery, latestMode)
  }, SEARCH_DEBOUNCE_MS)
}

export const useTimelineStore = createWithEqualityFn<TimelineState>((set, get) => ({
  // Initial state
  isOpen: false,
  isLoading: false,
  error: null,
  currentHistoryId: null,
  currentMessageId: null,
  graph: null,
  expandedSwipeNodes: new Set(),
  selectedNodeId: null,
  highlightedNodeIds: new Set(),
  hoveredNodeId: null,
  searchQuery: '',
  searchResults: [],
  searchMode: 'fragments',
  settings: defaultSettings,
  requestId: 0,

  // ============================================================================
  // Actions
  // ============================================================================

  openTimeline: async (historyId: string, messageId?: string) => {
    clearPendingSearch()
    const currentRequestId = get().requestId + 1

    set({
      requestId: currentRequestId,
      isOpen: true,
      isLoading: true,
      error: null,
      currentHistoryId: historyId,
      currentMessageId: messageId || null,
      searchQuery: '',
      searchResults: [],
      selectedNodeId: null,
      highlightedNodeIds: new Set()
    })

    try {
      const graph = await timelineGraphBuilder.buildGraphForConversation(historyId)

      if (get().requestId !== currentRequestId) {
        return
      }

      set({
        graph,
        isLoading: false
      })

      // If messageId provided, select that node
      if (messageId) {
        const nodeId = `node-${messageId}`
        set({ selectedNodeId: nodeId })
      }
    } catch (error) {
      console.error('Failed to load timeline:', error)
      if (get().requestId !== currentRequestId) {
        return
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to load timeline',
        isLoading: false
      })
    }
  },

  closeTimeline: () => {
    clearPendingSearch()
    set({
      isOpen: false,
      graph: null,
      currentHistoryId: null,
      currentMessageId: null,
      selectedNodeId: null,
      highlightedNodeIds: new Set(),
      hoveredNodeId: null,
      searchQuery: '',
      searchResults: [],
      error: null
    })
  },

  refreshGraph: async () => {
    const { currentHistoryId } = get()
    if (!currentHistoryId) return

    const currentRequestId = get().requestId + 1

    set({
      requestId: currentRequestId,
      isLoading: true,
      error: null
    })

    try {
      const graph = await timelineGraphBuilder.buildGraphForConversation(currentHistoryId)

      if (get().requestId !== currentRequestId) {
        return
      }

      set({ graph, isLoading: false })

      // Re-run search if active
      const { searchQuery, searchMode } = get()
      if (searchQuery.trim()) {
        applySearchResults(set, graph, searchQuery, searchMode)
      }
    } catch (error) {
      console.error('Failed to refresh timeline:', error)
      if (get().requestId !== currentRequestId) {
        return
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh',
        isLoading: false
      })
    }
  },

  // ============================================================================
  // Node Interactions
  // ============================================================================

  selectNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId })
  },

  hoverNode: (nodeId: string | null) => {
    set({ hoveredNodeId: nodeId })
  },

  toggleSwipeExpansion: (nodeId: string) => {
    const { expandedSwipeNodes } = get()
    const newExpanded = new Set(expandedSwipeNodes)

    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }

    set({ expandedSwipeNodes: newExpanded })
  },

  expandAllSwipes: () => {
    const { graph } = get()
    if (!graph) return

    const swipeParentIds = graph.nodes
      .filter((n) => n.has_swipes)
      .map((n) => n.id)

    set({ expandedSwipeNodes: new Set(swipeParentIds) })
  },

  collapseAllSwipes: () => {
    set({ expandedSwipeNodes: new Set() })
  },

  // ============================================================================
  // Search
  // ============================================================================

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    scheduleSearchFromState(get, set)
  },

  setSearchMode: (mode: 'fragments' | 'substring' | 'regex') => {
    set({ searchMode: mode })
    scheduleSearchFromState(get, set)
  },

  clearSearch: () => {
    clearPendingSearch()
    set({
      searchQuery: '',
      searchResults: [],
      highlightedNodeIds: new Set()
    })
  },

  // ============================================================================
  // Settings
  // ============================================================================

  updateSettings: (newSettings: Partial<TimelineSettings>) => {
    const { settings } = get()
    set({
      settings: { ...settings, ...newSettings }
    })
  },

  toggleLayoutDirection: () => {
    const { settings } = get()
    set({
      settings: {
        ...settings,
        layoutDirection: settings.layoutDirection === 'TB' ? 'LR' : 'TB'
      }
    })
  },

  // ============================================================================
  // Utilities
  // ============================================================================

  getNodeById: (nodeId: string) => {
    const { graph } = get()
    return graph?.nodes.find((n) => n.id === nodeId)
  },

  getVisibleNodes: () => {
    const { graph, expandedSwipeNodes, settings } = get()
    if (!graph) return []

    // Filter nodes based on swipe expansion state
    return graph.nodes.filter((node) => {
      // Always show non-swipe nodes
      if (!node.is_swipe) return true

      // Show swipes if auto-expand is on
      if (settings.autoExpandSwipes) return true

      // Show swipes if their parent is expanded
      if (node.parent_message_id) {
        const parentNodeId = `node-${node.parent_message_id}`
        return expandedSwipeNodes.has(parentNodeId)
      }

      return false
    })
  }
}))

// ============================================================================
// Selectors
// ============================================================================

export const useTimelineGraph = () => useTimelineStore((s) => s.graph)
export const useTimelineIsLoading = () => useTimelineStore((s) => s.isLoading)
export const useTimelineSettings = () => useTimelineStore((s) => s.settings)
export const useTimelineSelectedNode = () =>
  useTimelineStore((s) => s.selectedNodeId)

export const useTimelineActions = () =>
  useTimelineStore(
    useShallow((s) => ({
      openTimeline: s.openTimeline,
      closeTimeline: s.closeTimeline,
      refreshGraph: s.refreshGraph,
      selectNode: s.selectNode,
      setSearchQuery: s.setSearchQuery,
      setSearchMode: s.setSearchMode,
      clearSearch: s.clearSearch,
      updateSettings: s.updateSettings,
      toggleLayoutDirection: s.toggleLayoutDirection,
      toggleSwipeExpansion: s.toggleSwipeExpansion,
      expandAllSwipes: s.expandAllSwipes,
      collapseAllSwipes: s.collapseAllSwipes,
      hoverNode: s.hoverNode
    }))
  )

// ============================================================================
// Debug Export
// ============================================================================

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__tldw_useTimelineStore = useTimelineStore
}
