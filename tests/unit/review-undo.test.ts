import { describe, expect, test } from "bun:test"
import { buildReviewUndoState } from "../../src/components/Flashcards/utils/review-undo"
import type { Flashcard } from "../../src/services/flashcards"

const makeCard = (): Flashcard => ({
  uuid: "card-1",
  deck_id: null,
  front: "Front",
  back: "Back",
  notes: null,
  extra: null,
  is_cloze: false,
  tags: null,
  ef: 2.5,
  interval_days: 0,
  repetitions: 0,
  lapses: 0,
  due_at: null,
  last_reviewed_at: null,
  last_modified: null,
  deleted: false,
  client_id: "client",
  version: 1,
  model_type: "basic",
  reverse: false
})

describe("buildReviewUndoState", () => {
  test("returns null when no card is available", () => {
    const result = buildReviewUndoState(null, 2)

    expect(result).toBeNull()
  })

  test("returns next count and override card", () => {
    const card = makeCard()
    const result = buildReviewUndoState(card, 3)

    expect(result).toEqual({
      nextReviewedCount: 2,
      overrideCard: card
    })
  })
})
