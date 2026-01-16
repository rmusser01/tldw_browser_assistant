/**
 * Kanban service - API client for tldw_server kanban endpoints
 */

import { bgRequest, bgUpload } from "./background-proxy"
import type {
  Board,
  BoardCreate,
  BoardUpdate,
  BoardListResponse,
  BoardWithLists,
  KanbanList,
  ListCreate,
  ListUpdate,
  ListsListResponse,
  Card,
  CardCreate,
  CardUpdate,
  CardsListResponse,
  CardMoveRequest,
  ReorderRequest,
  ReorderResponse,
  BoardImportResponse
} from "@/types/kanban"

// =============================================================================
// Board API
// =============================================================================

/**
 * List all boards
 */
export async function listBoards(params?: {
  limit?: number
  offset?: number
  includeArchived?: boolean
  includeDeleted?: boolean
}): Promise<BoardListResponse> {
  const query = new URLSearchParams()
  if (params?.limit != null) query.set("limit", String(params.limit))
  if (params?.offset != null) query.set("offset", String(params.offset))
  if (params?.includeArchived) query.set("include_archived", "true")
  if (params?.includeDeleted) query.set("include_deleted", "true")
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return await bgRequest<BoardListResponse>({
    path: `/api/v1/kanban/boards${suffix}`,
    method: "GET"
  })
}

/**
 * Get a single board with nested lists and cards
 */
export async function getBoard(boardId: number): Promise<BoardWithLists> {
  return await bgRequest<BoardWithLists>({
    path: `/api/v1/kanban/boards/${boardId}`,
    method: "GET"
  })
}

/**
 * Create a new board
 */
export async function createBoard(data: BoardCreate): Promise<Board> {
  return await bgRequest<Board>({
    path: "/api/v1/kanban/boards",
    method: "POST",
    body: data
  })
}

/**
 * Update a board
 */
export async function updateBoard(
  boardId: number,
  data: BoardUpdate,
  expectedVersion?: number
): Promise<Board> {
  const headers: Record<string, string> = {}
  if (expectedVersion != null) {
    headers["X-Expected-Version"] = String(expectedVersion)
  }
  return await bgRequest<Board>({
    path: `/api/v1/kanban/boards/${boardId}`,
    method: "PATCH",
    body: data,
    headers
  })
}

/**
 * Delete a board (soft delete)
 */
export async function deleteBoard(boardId: number): Promise<void> {
  await bgRequest<void>({
    path: `/api/v1/kanban/boards/${boardId}`,
    method: "DELETE"
  })
}

/**
 * Import a board from JSON (Trello or tldw format)
 */
export async function importBoard(
  data: Record<string, any>,
  boardName?: string
): Promise<BoardImportResponse> {
  return await bgRequest<BoardImportResponse>({
    path: "/api/v1/kanban/boards/import",
    method: "POST",
    body: { data, board_name: boardName }
  })
}

// =============================================================================
// List API
// =============================================================================

/**
 * Get all lists in a board
 */
export async function getLists(boardId: number): Promise<ListsListResponse> {
  return await bgRequest<ListsListResponse>({
    path: `/api/v1/kanban/boards/${boardId}/lists`,
    method: "GET"
  })
}

/**
 * Create a new list
 */
export async function createList(
  boardId: number,
  data: ListCreate
): Promise<KanbanList> {
  return await bgRequest<KanbanList>({
    path: `/api/v1/kanban/boards/${boardId}/lists`,
    method: "POST",
    body: data
  })
}

/**
 * Update a list
 */
export async function updateList(
  listId: number,
  data: ListUpdate,
  expectedVersion?: number
): Promise<KanbanList> {
  const headers: Record<string, string> = {}
  if (expectedVersion != null) {
    headers["X-Expected-Version"] = String(expectedVersion)
  }
  return await bgRequest<KanbanList>({
    path: `/api/v1/kanban/lists/${listId}`,
    method: "PATCH",
    body: data,
    headers
  })
}

/**
 * Delete a list (soft delete)
 */
export async function deleteList(listId: number): Promise<void> {
  await bgRequest<void>({
    path: `/api/v1/kanban/lists/${listId}`,
    method: "DELETE"
  })
}

/**
 * Reorder lists in a board
 */
export async function reorderLists(
  boardId: number,
  listIds: number[]
): Promise<ReorderResponse> {
  return await bgRequest<ReorderResponse>({
    path: `/api/v1/kanban/boards/${boardId}/lists/reorder`,
    method: "POST",
    body: { ids: listIds } as ReorderRequest
  })
}

// =============================================================================
// Card API
// =============================================================================

/**
 * Get all cards in a list
 */
export async function getCards(listId: number): Promise<CardsListResponse> {
  return await bgRequest<CardsListResponse>({
    path: `/api/v1/kanban/lists/${listId}/cards`,
    method: "GET"
  })
}

/**
 * Get a single card
 */
export async function getCard(cardId: number): Promise<Card> {
  return await bgRequest<Card>({
    path: `/api/v1/kanban/cards/${cardId}`,
    method: "GET"
  })
}

/**
 * Create a new card
 */
export async function createCard(
  listId: number,
  data: CardCreate
): Promise<Card> {
  return await bgRequest<Card>({
    path: `/api/v1/kanban/lists/${listId}/cards`,
    method: "POST",
    body: data
  })
}

/**
 * Update a card
 */
export async function updateCard(
  cardId: number,
  data: CardUpdate,
  expectedVersion?: number
): Promise<Card> {
  const headers: Record<string, string> = {}
  if (expectedVersion != null) {
    headers["X-Expected-Version"] = String(expectedVersion)
  }
  return await bgRequest<Card>({
    path: `/api/v1/kanban/cards/${cardId}`,
    method: "PATCH",
    body: data,
    headers
  })
}

/**
 * Delete a card (soft delete)
 */
export async function deleteCard(cardId: number): Promise<void> {
  await bgRequest<void>({
    path: `/api/v1/kanban/cards/${cardId}`,
    method: "DELETE"
  })
}

/**
 * Move a card to a different list
 */
export async function moveCard(
  cardId: number,
  targetListId: number,
  position?: number
): Promise<Card> {
  const body: CardMoveRequest = { target_list_id: targetListId }
  if (position != null) body.position = position
  return await bgRequest<Card>({
    path: `/api/v1/kanban/cards/${cardId}/move`,
    method: "POST",
    body
  })
}

/**
 * Reorder cards in a list
 */
export async function reorderCards(
  listId: number,
  cardIds: number[]
): Promise<ReorderResponse> {
  return await bgRequest<ReorderResponse>({
    path: `/api/v1/kanban/lists/${listId}/cards/reorder`,
    method: "POST",
    body: { ids: cardIds } as ReorderRequest
  })
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique client ID for idempotency
 */
export function generateClientId(): string {
  return crypto.randomUUID()
}

/**
 * Check if a card is overdue
 */
export function isCardOverdue(card: Card): boolean {
  if (!card.due_date || card.due_complete) return false
  return new Date(card.due_date) < new Date()
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: Card["priority"]): string {
  switch (priority) {
    case "urgent":
      return "#ef4444" // red
    case "high":
      return "#f97316" // orange
    case "medium":
      return "#eab308" // yellow
    case "low":
      return "#3b82f6" // blue
    default:
      return "#9ca3af" // gray
  }
}

/**
 * Format due date for display
 */
export function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return ""
  const date = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) {
    return `${Math.abs(diffDays)}d overdue`
  } else if (diffDays === 0) {
    return "Today"
  } else if (diffDays === 1) {
    return "Tomorrow"
  } else if (diffDays < 7) {
    return `${diffDays}d`
  } else {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    })
  }
}
