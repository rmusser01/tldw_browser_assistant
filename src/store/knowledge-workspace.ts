import { create } from "zustand"
import { DEFAULT_RAG_SETTINGS } from "@/services/rag/unified-rag"

type KnowledgeWorkspaceState = {
  ragSearchMode: "hybrid" | "vector" | "fts"
  ragTopK: number | null
  ragEnableGeneration: boolean
  ragEnableCitations: boolean
  ragSources: string[]
  setRagSearchMode: (mode: "hybrid" | "vector" | "fts") => void
  setRagTopK: (value: number | null) => void
  setRagEnableGeneration: (value: boolean) => void
  setRagEnableCitations: (value: boolean) => void
  setRagSources: (sources: string[]) => void
}

export const useKnowledgeWorkspaceStore = create<KnowledgeWorkspaceState>(
  (set) => ({
    ragSearchMode: DEFAULT_RAG_SETTINGS.search_mode,
    ragTopK: DEFAULT_RAG_SETTINGS.top_k,
    ragEnableGeneration: DEFAULT_RAG_SETTINGS.enable_generation,
    ragEnableCitations: DEFAULT_RAG_SETTINGS.enable_citations,
    ragSources: DEFAULT_RAG_SETTINGS.sources,
    setRagSearchMode: (ragSearchMode) => set({ ragSearchMode }),
    setRagTopK: (ragTopK) => set({ ragTopK }),
    setRagEnableGeneration: (ragEnableGeneration) =>
      set({ ragEnableGeneration }),
    setRagEnableCitations: (ragEnableCitations) =>
      set({ ragEnableCitations }),
    setRagSources: (ragSources) => set({ ragSources })
  })
)
