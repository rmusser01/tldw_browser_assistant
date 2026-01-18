import { describe, expect, test } from "bun:test"
import { getCardsKeyboardNavResult } from "../../src/components/Flashcards/hooks/useCardsKeyboardNav"

describe("getCardsKeyboardNavResult", () => {
  test("j focuses the first item when none is focused", () => {
    const result = getCardsKeyboardNavResult({
      key: "j",
      itemCount: 5,
      focusedIndex: -1
    })

    expect(result?.preventDefault).toBe(true)
    expect(result?.action).toEqual({ type: "focus", index: 0 })
  })

  test("k focuses the last item when none is focused", () => {
    const result = getCardsKeyboardNavResult({
      key: "k",
      itemCount: 5,
      focusedIndex: -1
    })

    expect(result?.preventDefault).toBe(true)
    expect(result?.action).toEqual({ type: "focus", index: 4 })
  })

  test("enter edits the focused item", () => {
    const result = getCardsKeyboardNavResult({
      key: "Enter",
      itemCount: 5,
      focusedIndex: 2
    })

    expect(result?.preventDefault).toBe(true)
    expect(result?.action).toEqual({ type: "edit", index: 2 })
  })

  test("escape clears focus without preventing default", () => {
    const result = getCardsKeyboardNavResult({
      key: "Escape",
      itemCount: 5,
      focusedIndex: 2
    })

    expect(result?.preventDefault).toBe(false)
    expect(result?.action).toEqual({ type: "clear" })
  })
})
