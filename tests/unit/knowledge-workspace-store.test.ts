import { describe, expect, test } from "bun:test"
import { DEFAULT_RAG_SETTINGS } from "../../src/services/rag/unified-rag"
import { useKnowledgeWorkspaceStore } from "../../src/store/knowledge-workspace"

describe("knowledge workspace store defaults", () => {
  test("initial defaults match unified RAG defaults", () => {
    const state = useKnowledgeWorkspaceStore.getState()

    expect(state.ragSearchMode).toBe(DEFAULT_RAG_SETTINGS.search_mode)
    expect(state.ragTopK).toBe(DEFAULT_RAG_SETTINGS.top_k)
    expect(state.ragEnableGeneration).toBe(DEFAULT_RAG_SETTINGS.enable_generation)
    expect(state.ragEnableCitations).toBe(DEFAULT_RAG_SETTINGS.enable_citations)
    expect(state.ragSources).toEqual(DEFAULT_RAG_SETTINGS.sources)
  })
})
