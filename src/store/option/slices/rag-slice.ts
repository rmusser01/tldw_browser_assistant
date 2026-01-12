import type { StoreSlice } from "@/store/option/slices/types"
import { DEFAULT_RAG_SETTINGS, toRagAdvancedOptions } from "@/services/rag/unified-rag"

export const createRagSlice: StoreSlice<
  Pick<
    import("@/store/option/types").State,
    | "ragMediaIds"
    | "setRagMediaIds"
    | "ragSearchMode"
    | "setRagSearchMode"
    | "ragTopK"
    | "setRagTopK"
    | "ragEnableGeneration"
    | "setRagEnableGeneration"
    | "ragEnableCitations"
    | "setRagEnableCitations"
    | "ragSources"
    | "setRagSources"
    | "ragAdvancedOptions"
    | "setRagAdvancedOptions"
    | "ragPinnedResults"
    | "setRagPinnedResults"
  >
> = (set) => ({
  ragMediaIds: null,
  setRagMediaIds: (ragMediaIds) => set({ ragMediaIds }),
  ragSearchMode: DEFAULT_RAG_SETTINGS.search_mode,
  setRagSearchMode: (ragSearchMode) => set({ ragSearchMode }),
  ragTopK: DEFAULT_RAG_SETTINGS.top_k,
  setRagTopK: (ragTopK) => set({ ragTopK }),
  ragEnableGeneration: DEFAULT_RAG_SETTINGS.enable_generation,
  setRagEnableGeneration: (ragEnableGeneration) =>
    set({ ragEnableGeneration }),
  ragEnableCitations: DEFAULT_RAG_SETTINGS.enable_citations,
  setRagEnableCitations: (ragEnableCitations) =>
    set({ ragEnableCitations }),
  ragSources: DEFAULT_RAG_SETTINGS.sources,
  setRagSources: (ragSources) => set({ ragSources }),
  ragAdvancedOptions: toRagAdvancedOptions(DEFAULT_RAG_SETTINGS),
  setRagAdvancedOptions: (ragAdvancedOptions) => set({ ragAdvancedOptions }),
  ragPinnedResults: [],
  setRagPinnedResults: (ragPinnedResults) => set({ ragPinnedResults })
})
