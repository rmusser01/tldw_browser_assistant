/**
 * Timeline Services
 *
 * Exports all timeline-related services for conversation tree visualization.
 */

// Graph builder for constructing DAG from chat data
export {
  timelineGraphBuilder,
  TimelineGraphBuilder,
  type TimelineNode,
  type TimelineEdge,
  type TimelineGraph,
  type TimelineNodeType,
  type SwipeGroup
} from './graph-builder'

// API service for server communication
export {
  timelineApi,
  TimelineApiService,
  type ConversationTreeResponse,
  type ForkRequest,
  type ForkResponse,
  type MessageWithParent,
  type SearchResult
} from './api'

// Search service with fragment search (swoop)
export {
  timelineSearch,
  TimelineSearchService,
  type SearchMode,
  type SearchOptions,
  type SearchMatch,
  type HighlightRange
} from './search'
