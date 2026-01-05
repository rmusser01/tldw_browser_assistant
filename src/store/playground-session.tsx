import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

const STORAGE_KEY = "tldw-playground-session"
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

const createMemoryStorage = (): StateStorage => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
})

export interface PlaygroundSessionData {
  // Core identifier (used to restore messages from Dexie)
  historyId: string | null
  serverChatId: string | null

  // Settings NOT already persisted elsewhere (selectedModel uses useStorage)
  chatMode: "normal" | "rag"
  webSearch: boolean
  compareMode: boolean
  compareSelectedModels: string[]

  // RAG settings (when chatMode === "rag")
  ragMediaIds: number[] | null
  ragSearchMode: "hybrid" | "vector" | "fts"
  ragTopK: number | null
  ragEnableGeneration: boolean
  ragEnableCitations: boolean

  // Metadata
  lastUpdated: number
}

interface PlaygroundSessionState extends PlaygroundSessionData {
  // Actions
  saveSession: (data: Partial<PlaygroundSessionData>) => void
  clearSession: () => void
  isSessionStale: () => boolean
  isSessionValid: () => boolean
}

const initialState: PlaygroundSessionData = {
  historyId: null,
  serverChatId: null,
  chatMode: "normal",
  webSearch: false,
  compareMode: false,
  compareSelectedModels: [],
  ragMediaIds: null,
  ragSearchMode: "hybrid",
  ragTopK: null,
  ragEnableGeneration: true,
  ragEnableCitations: true,
  lastUpdated: 0
}

export const usePlaygroundSessionStore = create<PlaygroundSessionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      saveSession: (data) =>
        set((state) => ({
          ...state,
          ...data,
          lastUpdated: Date.now()
        })),

      clearSession: () => set({ ...initialState, lastUpdated: 0 }),

      isSessionStale: () => {
        const { lastUpdated } = get()
        if (lastUpdated === 0) return true
        return Date.now() - lastUpdated > STALE_THRESHOLD_MS
      },

      isSessionValid: () => {
        const { historyId, serverChatId, lastUpdated } = get()
        // Session is valid if we have an ID and it's not stale
        const hasId = historyId !== null || serverChatId !== null
        const isNotStale = lastUpdated > 0 && Date.now() - lastUpdated <= STALE_THRESHOLD_MS
        return hasId && isNotStale
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : createMemoryStorage()
      ),
      partialize: (state) => ({
        historyId: state.historyId,
        serverChatId: state.serverChatId,
        chatMode: state.chatMode,
        webSearch: state.webSearch,
        compareMode: state.compareMode,
        compareSelectedModels: state.compareSelectedModels,
        ragMediaIds: state.ragMediaIds,
        ragSearchMode: state.ragSearchMode,
        ragTopK: state.ragTopK,
        ragEnableGeneration: state.ragEnableGeneration,
        ragEnableCitations: state.ragEnableCitations,
        lastUpdated: state.lastUpdated
      })
    }
  )
)

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__tldw_usePlaygroundSessionStore = usePlaygroundSessionStore
}
