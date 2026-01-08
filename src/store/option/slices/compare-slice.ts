import type { StoreSlice } from "@/store/option/slices/types"

export const createCompareSlice: StoreSlice<
  Pick<
    import("@/store/option/types").State,
    | "compareMode"
    | "setCompareMode"
    | "compareSelectedModels"
    | "setCompareSelectedModels"
    | "compareSelectionByCluster"
    | "setCompareSelectionForCluster"
    | "compareActiveModelsByCluster"
    | "setCompareActiveModelsForCluster"
    | "compareParentByHistory"
    | "setCompareParentForHistory"
    | "compareCanonicalByCluster"
    | "setCompareCanonicalForCluster"
    | "compareSplitChats"
    | "setCompareSplitChat"
  >
> = (set) => ({
  compareMode: false,
  setCompareMode: (compareMode) => set({ compareMode }),
  compareSelectedModels: [],
  setCompareSelectedModels: (compareSelectedModels) =>
    set({ compareSelectedModels }),
  compareSelectionByCluster: {},
  setCompareSelectionForCluster: (clusterId, models) =>
    set((state) => ({
      compareSelectionByCluster: {
        ...state.compareSelectionByCluster,
        [clusterId]: models
      }
    })),
  compareActiveModelsByCluster: {},
  setCompareActiveModelsForCluster: (clusterId, models) =>
    set((state) => ({
      compareActiveModelsByCluster: {
        ...state.compareActiveModelsByCluster,
        [clusterId]: models
      }
    })),
  compareParentByHistory: {},
  setCompareParentForHistory: (historyId, meta) =>
    set((state) => ({
      compareParentByHistory: {
        ...state.compareParentByHistory,
        [historyId]: meta
      }
    })),
  compareCanonicalByCluster: {},
  setCompareCanonicalForCluster: (clusterId, messageId) =>
    set((state) => ({
      compareCanonicalByCluster: {
        ...state.compareCanonicalByCluster,
        [clusterId]: messageId
      }
    })),
  compareSplitChats: {},
  setCompareSplitChat: (clusterId, modelKey, historyId) =>
    set((state) => ({
      compareSplitChats: {
        ...state.compareSplitChats,
        [clusterId]: {
          ...(state.compareSplitChats[clusterId] || {}),
          [modelKey]: historyId
        }
      }
    }))
})
