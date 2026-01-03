import { create } from "zustand"

export type ArtifactKind = "code" | "table" | "diagram"

export type ArtifactTableData = {
  headers: string[]
  rows: string[][]
}

export type ArtifactItem = {
  id: string
  title: string
  content: string
  language?: string
  kind: ArtifactKind
  lineCount?: number
  table?: ArtifactTableData
}

type ArtifactState = {
  active: ArtifactItem | null
  isOpen: boolean
  isPinned: boolean
  openArtifact: (artifact: ArtifactItem, options?: { auto?: boolean }) => void
  closeArtifact: () => void
  setPinned: (value: boolean) => void
}

export const useArtifactsStore = create<ArtifactState>((set, get) => ({
  active: null,
  isOpen: false,
  isPinned: false,
  openArtifact: (artifact, options) =>
    set((state) => {
      if (options?.auto && state.isPinned) {
        return state
      }
      return {
        active: artifact,
        isOpen: true
      }
    }),
  closeArtifact: () =>
    set(() => ({
      active: null,
      isOpen: false,
      isPinned: false
    })),
  setPinned: (value) =>
    set((state) => ({
      isPinned: value,
      isOpen: value ? state.isOpen || Boolean(state.active) : state.isOpen
    }))
}))

if (typeof window !== "undefined") {
  ;(window as any).__tldw_useArtifactsStore = useArtifactsStore
}
