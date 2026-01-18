import { describe, expect, test } from "bun:test"
import { getFlashcardShortcutResult } from "../../src/components/Flashcards/hooks/useFlashcardShortcuts"

describe("getFlashcardShortcutResult", () => {
  test("space flips when answer is hidden", () => {
    const result = getFlashcardShortcutResult(" ", false)

    expect(result?.preventDefault).toBe(true)
    expect(result?.action).toEqual({ type: "flip" })
  })

  test("space prevents default when answer is shown", () => {
    const result = getFlashcardShortcutResult(" ", true)

    expect(result?.preventDefault).toBe(true)
    expect(result?.action).toBeUndefined()
  })

  test("number keys rate when answer is shown", () => {
    const result = getFlashcardShortcutResult("2", true)

    expect(result?.preventDefault).toBe(true)
    expect(result?.action).toEqual({ type: "rate", rating: 2 })
  })

  test("ignores unrelated keys", () => {
    const result = getFlashcardShortcutResult("x", false)

    expect(result).toBeNull()
  })
})
