import { createWithEqualityFn } from "zustand/traditional"

type WritingPlaygroundState = {
  activeSessionId: string | null
  activeSessionName: string | null
  setActiveSessionId: (activeSessionId: string | null) => void
  setActiveSessionName: (activeSessionName: string | null) => void
}

export const useWritingPlaygroundStore = createWithEqualityFn<WritingPlaygroundState>((set) => ({
  activeSessionId: null,
  activeSessionName: null,
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setActiveSessionName: (activeSessionName) => set({ activeSessionName })
}))
