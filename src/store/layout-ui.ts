import { createWithEqualityFn } from "zustand/traditional"

type LayoutUiState = {
  chatSidebarCollapsed: boolean
  setChatSidebarCollapsed: (next: boolean | ((prev: boolean) => boolean)) => void
}

export const useLayoutUiStore = createWithEqualityFn<LayoutUiState>((set) => ({
  chatSidebarCollapsed: false,
  setChatSidebarCollapsed: (next) =>
    set((state) => ({
      chatSidebarCollapsed:
        typeof next === "function" ? next(state.chatSidebarCollapsed) : next
    }))
}))
