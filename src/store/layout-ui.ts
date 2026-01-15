import { create } from "zustand"

type LayoutUiState = {
  chatSidebarCollapsed: boolean
  setChatSidebarCollapsed: (next: boolean | ((prev: boolean) => boolean)) => void
}

export const useLayoutUiStore = create<LayoutUiState>((set) => ({
  chatSidebarCollapsed: false,
  setChatSidebarCollapsed: (next) =>
    set((state) => ({
      chatSidebarCollapsed:
        typeof next === "function" ? next(state.chatSidebarCollapsed) : next
    }))
}))
