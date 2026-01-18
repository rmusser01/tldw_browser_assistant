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

const invalidateFlashcardsQueries = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      typeof query.queryKey[0] === "string" &&
      query.queryKey[0].startsWith("flashcards:")
  })

/**
 * Hook for fetching flashcard decks
 */
export function useDecksQuery(options?: UseFlashcardQueriesOptions) {
  const { flashcardsEnabled } = useFlashcardsEnabled()

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
  const { flashcardsEnabled } = useFlashcardsEnabled()

  return useQuery({
    queryKey: ["flashcards:review:next", deckId],
    queryFn: async (): Promise<Flashcard | null> => {
      const dueRes = await listFlashcards({
        deck_id: deckId ?? undefined,
        due_status: "due",
        order_by: "due_at",
        limit: 1,
        offset: 0
      })
      const dueCard = dueRes.items?.[0]
      if (dueCard) return dueCard

      const newRes = await listFlashcards({
        deck_id: deckId ?? undefined,
        due_status: "new",
        order_by: "created_at",
        limit: 1,
        offset: 0
      })
      const newCard = newRes.items?.[0]
      if (newCard) return newCard

      const learningRes = await listFlashcards({
        deck_id: deckId ?? undefined,
        due_status: "learning",
        order_by: "due_at",
        limit: 1,
        offset: 0
      })
      return learningRes.items?.[0] || null
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
  const { flashcardsEnabled } = useFlashcardsEnabled()

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
  const { flashcardsEnabled } = useFlashcardsEnabled()

  return useQuery({
    queryKey: ["flashcards:import:limits"],
    queryFn: getFlashcardsImportLimits,
    enabled: options?.enabled ?? flashcardsEnabled
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
      invalidateFlashcardsQueries(qc)
    },
    onError: (error) => {
      console.error("Failed to create flashcard:", error)
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
      invalidateFlashcardsQueries(qc)
    },
    onError: (error) => {
      console.error("Failed to create deck:", error)
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
      invalidateFlashcardsQueries(qc)
    },
    onError: (error) => {
      console.error("Failed to update flashcard:", error)
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
      invalidateFlashcardsQueries(qc)
    },
    onError: (error) => {
      console.error("Failed to delete flashcard:", error)
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
      invalidateFlashcardsQueries(qc)
    },
    onError: (error) => {
      console.error("Failed to submit flashcard review:", error)
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
      invalidateFlashcardsQueries(qc)
    },
    onError: (error) => {
      console.error("Failed to import flashcards:", error)
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

/**
 * Hook for fetching due counts across statuses
 */
export function useDueCountsQuery(deckId?: number | null, options?: UseFlashcardQueriesOptions) {
  const { flashcardsEnabled } = useFlashcardsEnabled()

  return useQuery({
    queryKey: ["flashcards:due-counts", deckId],
    queryFn: async () => {
      const [due, newCards, learning] = await Promise.all([
        listFlashcards({ deck_id: deckId ?? undefined, due_status: "due", limit: 0, offset: 0 }),
        listFlashcards({ deck_id: deckId ?? undefined, due_status: "new", limit: 0, offset: 0 }),
        listFlashcards({ deck_id: deckId ?? undefined, due_status: "learning", limit: 0, offset: 0 })
      ])
      return {
        due: due.count,
        new: newCards.count,
        learning: learning.count,
        total: due.count + newCards.count + learning.count
      }
    },
    enabled: options?.enabled ?? flashcardsEnabled
  })
}

/**
 * Hook to check if user has any flashcards
 */
export function useHasCardsQuery(options?: UseFlashcardQueriesOptions) {
  const { flashcardsEnabled } = useFlashcardsEnabled()

  return useQuery({
    queryKey: ["flashcards:has-cards"],
    queryFn: async () => {
      const res = await listFlashcards({ limit: 0, offset: 0 })
      return res.count > 0
    },
    enabled: options?.enabled ?? flashcardsEnabled
  })
}

/**
 * Hook to get the next due card info (for showing when the next review is due)
 */
export function useNextDueQuery(deckId?: number | null, options?: UseFlashcardQueriesOptions) {
  const { flashcardsEnabled } = useFlashcardsEnabled()

  return useQuery({
    queryKey: ["flashcards:next-due", deckId],
    queryFn: async () => {
      const PAGE_SIZE = 200
      const MAX_PAGES = 10
      const oneHour = 60 * 60 * 1000
      const nowMs = Date.now()

      let offset = 0
      let pagesChecked = 0
      let scanned = 0
      let nextDueAt: string | null = null
      let nextDueMs = 0
      let cardsDue = 0

      while (true) {
        const res = await listFlashcards({
          deck_id: deckId ?? undefined,
          due_status: "all",
          order_by: "due_at",
          limit: PAGE_SIZE,
          offset
        })
        const items = res.items || []
        if (items.length === 0) break
        pagesChecked += 1
        scanned += items.length

        for (const card of items) {
          if (!card.due_at) continue
          const dueMs = new Date(card.due_at).getTime()
          if (Number.isNaN(dueMs)) continue

          if (!nextDueAt) {
            if (dueMs > nowMs) {
              nextDueAt = card.due_at
              nextDueMs = dueMs
              cardsDue = 1
            }
            continue
          }

          if (dueMs <= nextDueMs + oneHour) {
            cardsDue += 1
          } else {
            return { nextDueAt, cardsDue, isCapped: false, scanned }
          }
        }

        if (pagesChecked >= MAX_PAGES) {
          return {
            nextDueAt,
            cardsDue,
            isCapped: true,
            scanned
          }
        }

        if (items.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }

      if (!nextDueAt) return null

      return {
        nextDueAt,
        cardsDue,
        isCapped: false,
        scanned
      }
    },
    enabled: options?.enabled ?? flashcardsEnabled
  })
}

// Re-export service functions that are used directly
export { getFlashcard, exportFlashcards, exportFlashcardsFile }
