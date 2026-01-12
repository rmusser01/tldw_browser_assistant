import { describe, expect, test } from "bun:test"
import {
  formatPinnedResults,
  formatRagResult,
  type RagPinnedResult
} from "../../src/utils/rag-format"

describe("rag-format", () => {
  const sample: RagPinnedResult = {
    id: "1",
    title: "Sample",
    url: "https://example.com",
    snippet: "Snippet text"
  }

  test("formatRagResult renders markdown", () => {
    const formatted = formatRagResult(sample, "markdown")
    expect(formatted).toContain("**Sample**")
    expect(formatted).toContain("Snippet text")
    expect(formatted).toContain("Source: https://example.com")
  })

  test("formatPinnedResults joins entries", () => {
    const formatted = formatPinnedResults([sample, sample], "text")
    const parts = formatted.split("\n\n")
    expect(parts.length).toBeGreaterThan(2)
  })
})
