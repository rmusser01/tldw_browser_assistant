import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

export type UiMode = "casual" | "pro"

type UiModeState = {
  mode: UiMode
  setMode: (mode: UiMode) => void
  toggleMode: () => void
}

const createMemoryStorage = (): StateStorage => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
})

export const useUiModeStore = create<UiModeState>()(
  persist(
    (set, get) => ({
      mode: "casual",
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set({ mode: get().mode === "pro" ? "casual" : "pro" })
    }),
    {
      name: "tldw-ui-mode",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : createMemoryStorage()
      )
    }
  )
)
