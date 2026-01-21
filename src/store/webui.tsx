import { createWithEqualityFn } from "zustand/traditional"

type State = {
  sendWhenEnter: boolean
  setSendWhenEnter: (sendWhenEnter: boolean) => void

  ttsEnabled: boolean
  setTTSEnabled: (isTTSEnabled: boolean) => void
}

export const useWebUI = createWithEqualityFn<State>((set) => ({
  sendWhenEnter: true,
  setSendWhenEnter: (sendWhenEnter) => set({ sendWhenEnter }),

  ttsEnabled: true,
  setTTSEnabled: (ttsEnabled) => set({ ttsEnabled })
}))
