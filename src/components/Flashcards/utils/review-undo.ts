import type { Flashcard } from "@/services/flashcards"

export type ReviewUndoState = {
  nextReviewedCount: number
  overrideCard: Flashcard
}

export function buildReviewUndoState(
  lastReviewedCard: Flashcard | null,
  reviewedCount: number
): ReviewUndoState | null {
  if (!lastReviewedCard) return null

  return {
    nextReviewedCount: Math.max(0, reviewedCount - 1),
    overrideCard: lastReviewedCard
  }
}
