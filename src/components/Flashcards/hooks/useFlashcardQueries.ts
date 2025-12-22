import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listDecks,
  listFlashcards,
  createFlashcard,
  createDeck,
  updateFlashcard,
  deleteFlashcard,
  reviewFlashcard,
  getFlashcard,
  importFlashcards,
  exportFlashcards,
  exportFlashcardsFile,
  getFlashcardsImportLimits,
  type Deck,
  type Flashcard,
  type FlashcardCreate,
  type FlashcardUpdate
} from "@/services/flashcards"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"

export type DueStatus = "new" | "learning" | "due" | "all"

export interface UseFlashcardQueriesOptions {
  enabled?: boolean
}

/**
 * Hook for fetching flashcard decks
 */
export function useDecksQuery(options?: UseFlashcardQueriesOptions) {
  const isOnline = useServerOnline()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const flashcardsUnsupported = !capsLoading && !!capabilities && !capabilities.hasFlashcards
  const flashcardsEnabled = isOnline && !flashcardsUnsupported

  return useQuery({
    queryKey: ["flashcards:decks"],
    queryFn: listDecks,
    enabled: options?.enabled ?? flashcardsEnabled
  })
}

/**
 * Hook for fetching next due card for review
 */
export function useReviewQuery(deckId: number | null | undefined, options?: UseFlashcardQueriesOptions) {
  const isOnline = useServerOnline()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const flashcardsUnsupported = !capsLoading && !!capabilities && !capabilities.hasFlashcards
  const flashcardsEnabled = isOnline && !flashcardsUnsupported

  return useQuery({
    queryKey: ["flashcards:review:next", deckId],
    queryFn: async (): Promise<Flashcard | null> => {
      const res = await listFlashcards({
        deck_id: deckId ?? undefined,
        due_status: "due",
        order_by: "due_at",
        limit: 1,
        offset: 0
      })
      return res.items?.[0] || null
    },
    enabled: options?.enabled ?? flashcardsEnabled
  })
}

/**
 * Hook for fetching flashcard list with filters
 */
export interface ManageQueryParams {
  deckId?: number | null
  query?: string
  tag?: string
  dueStatus?: DueStatus
  page?: number
  pageSize?: number
}

export function useManageQuery(params: ManageQueryParams, options?: UseFlashcardQueriesOptions) {
  const isOnline = useServerOnline()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const flashcardsUnsupported = !capsLoading && !!capabilities && !capabilities.hasFlashcards
  const flashcardsEnabled = isOnline && !flashcardsUnsupported

  const { deckId, query, tag, dueStatus = "all", page = 1, pageSize = 20 } = params

  return useQuery({
    queryKey: ["flashcards:list", deckId, query, tag, dueStatus, page, pageSize],
    queryFn: async () =>
      await listFlashcards({
        deck_id: deckId ?? undefined,
        q: query || undefined,
        tag: tag || undefined,
        due_status: dueStatus,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order_by: "due_at"
      }),
    enabled: options?.enabled ?? flashcardsEnabled
  })
}

/**
 * Hook for fetching import limits
 */
export function useImportLimitsQuery(options?: UseFlashcardQueriesOptions) {
  const isOnline = useServerOnline()

  return useQuery({
    queryKey: ["flashcards:import:limits"],
    queryFn: getFlashcardsImportLimits,
    enabled: options?.enabled ?? isOnline
  })
}

/**
 * Hook for creating a flashcard
 */
export function useCreateFlashcardMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["flashcards:create"],
    mutationFn: (payload: FlashcardCreate) => createFlashcard(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    }
  })
}

/**
 * Hook for creating a deck
 */
export function useCreateDeckMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["flashcards:deck:create"],
    mutationFn: (params: { name: string; description?: string }) =>
      createDeck({ name: params.name.trim(), description: params.description?.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards:decks"] })
    }
  })
}

/**
 * Hook for updating a flashcard
 */
export function useUpdateFlashcardMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["flashcards:update"],
    mutationFn: (params: { uuid: string; update: FlashcardUpdate }) =>
      updateFlashcard(params.uuid, params.update),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    }
  })
}

/**
 * Hook for deleting a flashcard
 */
export function useDeleteFlashcardMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["flashcards:delete"],
    mutationFn: (params: { uuid: string; version: number }) =>
      deleteFlashcard(params.uuid, params.version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    }
  })
}

/**
 * Hook for submitting a review
 */
export function useReviewFlashcardMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["flashcards:review"],
    mutationFn: (params: { cardUuid: string; rating: number; answerTimeMs?: number }) =>
      reviewFlashcard({
        card_uuid: params.cardUuid,
        rating: params.rating,
        answer_time_ms: params.answerTimeMs
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards:review:next"] })
      qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    }
  })
}

/**
 * Hook for importing flashcards
 */
export function useImportFlashcardsMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["flashcards:import"],
    mutationFn: (params: { content: string; delimiter: string; hasHeader: boolean }) =>
      importFlashcards({
        content: params.content,
        delimiter: params.delimiter,
        has_header: params.hasHeader
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards:list"] })
      qc.invalidateQueries({ queryKey: ["flashcards:decks"] })
    }
  })
}

/**
 * Helper to check if flashcards feature is available
 */
export function useFlashcardsEnabled() {
  const isOnline = useServerOnline()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const flashcardsUnsupported = !capsLoading && !!capabilities && !capabilities.hasFlashcards

  return {
    isOnline,
    capsLoading,
    flashcardsUnsupported,
    flashcardsEnabled: isOnline && !flashcardsUnsupported
  }
}

// Re-export service functions that are used directly
export { getFlashcard, exportFlashcards, exportFlashcardsFile }
