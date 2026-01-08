import React from "react"

import { useConnectionStore } from "@/store/connection"
import {
  CONNECTED_POLL_INTERVAL_MS,
  DISCONNECTED_POLL_INTERVAL_MS
} from "@/config/connection-timing"

type PollerState = {
  refCount: number
  intervalId: number | null
  intervalMs: number | null
  lastTickAt: number | null
  ticks: number
  lastStartAt: number | null
  lastStopAt: number | null
  isConnected: boolean | null
  didInitialCheck: boolean
  overrideCounts: Map<number, number>
  unsubscribe: (() => void) | null
}

const pollerState: PollerState = {
  refCount: 0,
  intervalId: null,
  intervalMs: null,
  lastTickAt: null,
  ticks: 0,
  lastStartAt: null,
  lastStopAt: null,
  isConnected: null,
  didInitialCheck: false,
  overrideCounts: new Map(),
  unsubscribe: null
}

const normalizeOverride = (pollMs: number): number | null => {
  if (pollMs <= 0) return null
  return Math.max(5000, pollMs)
}

const addOverride = (overrideMs: number) => {
  const current = pollerState.overrideCounts.get(overrideMs) || 0
  pollerState.overrideCounts.set(overrideMs, current + 1)
}

const removeOverride = (overrideMs: number) => {
  const current = pollerState.overrideCounts.get(overrideMs) || 0
  if (current <= 1) {
    pollerState.overrideCounts.delete(overrideMs)
  } else {
    pollerState.overrideCounts.set(overrideMs, current - 1)
  }
}

const getOverrideIntervalMs = (): number | null => {
  let min: number | null = null
  for (const ms of pollerState.overrideCounts.keys()) {
    if (min === null || ms < min) min = ms
  }
  return min
}

const getDefaultIntervalMs = (): number => {
  const isConnected =
    pollerState.isConnected ??
    useConnectionStore.getState().state.isConnected
  return isConnected ? CONNECTED_POLL_INTERVAL_MS : DISCONNECTED_POLL_INTERVAL_MS
}

export const getConnectionPollerSnapshot = () => ({
  subscribers: pollerState.refCount,
  intervalMs: pollerState.intervalMs,
  lastTickAt: pollerState.lastTickAt,
  ticks: pollerState.ticks,
  lastStartAt: pollerState.lastStartAt,
  lastStopAt: pollerState.lastStopAt,
  isConnected: pollerState.isConnected,
  overrideIntervals: Array.from(pollerState.overrideCounts.keys()).sort(
    (a, b) => a - b
  )
})

const publishPollerDiagnostics = () => {
  if (typeof globalThis === "undefined") return
  const root = globalThis as typeof globalThis & {
    __tldwDiagnostics?: Record<string, unknown>
  }
  if (!root.__tldwDiagnostics) {
    root.__tldwDiagnostics = {}
  }
  root.__tldwDiagnostics.getConnectionPoller = getConnectionPollerSnapshot
  root.__tldwDiagnostics.connectionPoller = getConnectionPollerSnapshot()
}

const updateInterval = () => {
  if (typeof window === "undefined") return
  if (pollerState.refCount <= 0) return
  const overrideMs = getOverrideIntervalMs()
  const nextIntervalMs = overrideMs ?? getDefaultIntervalMs()
  if (pollerState.intervalMs === nextIntervalMs && pollerState.intervalId) {
    return
  }
  if (pollerState.intervalId) {
    window.clearInterval(pollerState.intervalId)
    pollerState.intervalId = null
  }
  pollerState.intervalMs = nextIntervalMs
  pollerState.lastStartAt = Date.now()
  pollerState.intervalId = window.setInterval(() => {
    pollerState.ticks += 1
    pollerState.lastTickAt = Date.now()
    void useConnectionStore.getState().checkOnce()
    publishPollerDiagnostics()
  }, nextIntervalMs)
  publishPollerDiagnostics()
}

const startConnectionPolling = (pollMs: number) => {
  if (typeof window === "undefined") return
  const overrideMs = normalizeOverride(pollMs)
  if (overrideMs !== null) addOverride(overrideMs)
  pollerState.refCount += 1
  if (pollerState.refCount === 1) {
    pollerState.isConnected = useConnectionStore.getState().state.isConnected
    pollerState.unsubscribe = useConnectionStore.subscribe((state) => {
      const next = state.state.isConnected
      if (pollerState.isConnected !== next) {
        pollerState.isConnected = next
        updateInterval()
      }
    })
    if (!pollerState.didInitialCheck) {
      pollerState.didInitialCheck = true
      void useConnectionStore.getState().checkOnce()
    }
  }
  updateInterval()
  publishPollerDiagnostics()
}

const stopConnectionPolling = (pollMs: number) => {
  if (typeof window === "undefined") return
  const overrideMs = normalizeOverride(pollMs)
  if (overrideMs !== null) removeOverride(overrideMs)
  pollerState.refCount = Math.max(0, pollerState.refCount - 1)
  if (pollerState.refCount === 0) {
    if (pollerState.intervalId) {
      window.clearInterval(pollerState.intervalId)
    }
    pollerState.intervalId = null
    pollerState.intervalMs = null
    pollerState.lastStopAt = Date.now()
    pollerState.isConnected = null
    pollerState.didInitialCheck = false
    if (pollerState.unsubscribe) {
      pollerState.unsubscribe()
      pollerState.unsubscribe = null
    }
  } else {
    updateInterval()
  }
  publishPollerDiagnostics()
}

/**
 * Derived "online" flag backed by the shared connection store.
 *
 * Uses the central connection state (and checkOnce) instead of calling
 * tldwClient.healthCheck directly in each consumer.
 *
 * Returns false when the connection mode is "demo", even if the server
 * is otherwise connected.
 */
export function useServerOnline(pollMs: number = 0): boolean {
  const isConnected = useConnectionStore((s) => s.state.isConnected)
  const mode = useConnectionStore((s) => s.state.mode)

  React.useEffect(() => {
    startConnectionPolling(pollMs)
    return () => stopConnectionPolling(pollMs)
  }, [pollMs])

  return isConnected && mode !== "demo"
}
