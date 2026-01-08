import type { StoreSlice } from "@/store/option/slices/types"

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
  >
> = (set) => ({
  ragMediaIds: null,
  setRagMediaIds: (ragMediaIds) => set({ ragMediaIds }),
  ragSearchMode: "hybrid",
  setRagSearchMode: (ragSearchMode) => set({ ragSearchMode }),
  ragTopK: null,
  setRagTopK: (ragTopK) => set({ ragTopK }),
  ragEnableGeneration: false,
  setRagEnableGeneration: (ragEnableGeneration) =>
    set({ ragEnableGeneration }),
  ragEnableCitations: false,
  setRagEnableCitations: (ragEnableCitations) =>
    set({ ragEnableCitations }),
  ragSources: [],
  setRagSources: (ragSources) => set({ ragSources }),
  ragAdvancedOptions: {},
  setRagAdvancedOptions: (ragAdvancedOptions) => set({ ragAdvancedOptions })
})
