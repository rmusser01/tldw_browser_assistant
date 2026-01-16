import { create } from "zustand"

type RouteTransitionState = {
  active: boolean
  pendingPath: string | null
  startedAt: number | null
  start: (path?: string) => void
  stop: () => void
}

export const useRouteTransitionStore = create<RouteTransitionState>((set) => ({
  active: false,
  pendingPath: null,
  startedAt: null,
  start: (path) =>
    set({
      active: true,
      pendingPath: path ?? null,
      startedAt: Date.now()
    }),
  stop: () => set({ active: false, pendingPath: null, startedAt: null })
}))
