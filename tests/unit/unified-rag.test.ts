import { describe, expect, test } from "bun:test"
import {
  DEFAULT_RAG_SETTINGS,
  applyRagPreset,
  buildRagSearchRequest,
  toRagAdvancedOptions
} from "../../src/services/rag/unified-rag"

const randomString = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

describe("unified-rag defaults", () => {
  test("applyRagPreset merges overrides", () => {
    const fast = applyRagPreset("fast")
    expect(fast.search_mode).toBe("fts")
    expect(fast.top_k).toBe(5)
    expect(fast.enable_reranking).toBe(false)

    const thorough = applyRagPreset("thorough")
    expect(thorough.top_k).toBe(20)
    expect(thorough.enable_claims).toBe(true)
  })

  test("buildRagSearchRequest trims query and omits empty defaults", () => {
    const settings = {
      ...DEFAULT_RAG_SETTINGS,
      query: "  hello world  ",
      generation_model: null,
      generation_prompt: null
    }
    const { query, options, timeoutMs } = buildRagSearchRequest(settings)
    expect(query).toBe("hello world")
    expect(timeoutMs).toBe(45000)
    expect(options).not.toHaveProperty("generation_model")
    expect(options).not.toHaveProperty("generation_prompt")
  })

  test("buildRagSearchRequest trims whitespace (property-style)", () => {
    for (let i = 0; i < 20; i += 1) {
      const raw = `  ${randomString()}  `
      const { query } = buildRagSearchRequest({
        ...DEFAULT_RAG_SETTINGS,
        query: raw
      })
      expect(query).toBe(raw.trim())
    }
  })

  test("toRagAdvancedOptions excludes query and top-level controls", () => {
    const options = toRagAdvancedOptions(DEFAULT_RAG_SETTINGS)
    expect(options).not.toHaveProperty("query")
    expect(options).not.toHaveProperty("search_mode")
    expect(options).not.toHaveProperty("top_k")
    expect(options).not.toHaveProperty("enable_generation")
    expect(options).not.toHaveProperty("enable_citations")
    expect(options).not.toHaveProperty("sources")
  })
})
