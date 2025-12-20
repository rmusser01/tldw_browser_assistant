/**
 * useSessionPersistence Hook
 *
 * React hook for session persistence with debounced auto-save.
 * Manages session CRUD operations and handles stale session cleanup.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import type {
  StoredAgentSession,
  SessionMetadata,
  SessionSaveInput,
} from "@/services/agent/storage"
import {
  getSessionMetadataList,
  getSession,
  saveSessionFromInput,
  deleteSession as deleteStorageSession,
  deleteWorkspaceSessions,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getRestorableSession,
  initializeSessionStorage,
  debounce,
  STORAGE_LIMITS,
} from "@/services/agent/storage"

interface UseSessionPersistenceReturn {
  // State
  sessions: SessionMetadata[]
  activeSessionId: string | null
  isLoading: boolean
  restorableSession: StoredAgentSession | null

  // Actions
  saveCurrentSession: (input: SessionSaveInput) => void
  saveCurrentSessionImmediate: (input: SessionSaveInput) => Promise<string>
  loadSession: (sessionId: string) => Promise<StoredAgentSession | null>
  deleteSession: (sessionId: string) => Promise<void>
  clearAllSessions: () => Promise<void>
  dismissRestorableSession: () => Promise<void>
  setActiveSessionId: (sessionId: string | null) => Promise<void>
  refreshSessions: () => Promise<void>
}

export function useSessionPersistence(
  workspaceId: string | null
): UseSessionPersistenceReturn {
  const [sessions, setSessions] = useState<SessionMetadata[]>([])
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [restorableSession, setRestorableSession] = useState<StoredAgentSession | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Track current session ID for debounced saves
  const currentSessionIdRef = useRef<string | null>(null)

  // Debounced save function ref
  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null)

  // Initialize debounced save function
  useEffect(() => {
    const debouncedFn = debounce(
      async (input: SessionSaveInput, sessionId?: string) => {
        if (!workspaceId) return
        try {
          const savedId = await saveSessionFromInput(input, sessionId)
          currentSessionIdRef.current = savedId

          // Update active session ref
          await setActiveSession({
            sessionId: savedId,
            workspaceId: input.workspaceId,
          })

          // Refresh session list
          const metadata = await getSessionMetadataList(workspaceId)
          setSessions(metadata)
        } catch (error) {
          console.error("Failed to save session:", error)
        }
      },
      STORAGE_LIMITS.AUTO_SAVE_DEBOUNCE_MS
    )

    debouncedSaveRef.current = debouncedFn

    return () => {
      debouncedFn.cancel()
    }
  }, [workspaceId])

  // Initialize storage on mount (once)
  useEffect(() => {
    if (initialized) return

    const init = async () => {
      try {
        const result = await initializeSessionStorage()
        console.log(
          `Session storage initialized: ${result.staleMarked} stale marked, ${result.expired} expired pruned, ${result.globalPruned} global pruned`
        )
        setInitialized(true)
      } catch (error) {
        console.error("Failed to initialize session storage:", error)
        setInitialized(true) // Continue anyway
      }
    }

    init()
  }, [initialized])

  // Load sessions and check for restorable session when workspace changes
  useEffect(() => {
    if (!initialized) return

    const loadWorkspaceData = async () => {
      setIsLoading(true)

      if (!workspaceId) {
        setSessions([])
        setActiveSessionIdState(null)
        setRestorableSession(null)
        setIsLoading(false)
        return
      }

      try {
        // Load session metadata list
        const metadata = await getSessionMetadataList(workspaceId)
        setSessions(metadata)

        // Check for active session
        const activeRef = await getActiveSession()
        if (activeRef?.workspaceId === workspaceId) {
          setActiveSessionIdState(activeRef.sessionId)
          currentSessionIdRef.current = activeRef.sessionId
        } else {
          setActiveSessionIdState(null)
          currentSessionIdRef.current = null
        }

        // Check for restorable session
        const restorable = await getRestorableSession(workspaceId)
        setRestorableSession(restorable)
      } catch (error) {
        console.error("Failed to load workspace data:", error)
        setSessions([])
        setActiveSessionIdState(null)
        setRestorableSession(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkspaceData()
  }, [workspaceId, initialized])

  // Debounced save - for auto-save during execution
  const saveCurrentSession = useCallback(
    (input: SessionSaveInput) => {
      if (!workspaceId || !debouncedSaveRef.current) return
      debouncedSaveRef.current(input, currentSessionIdRef.current || undefined)
    },
    [workspaceId]
  )

  // Immediate save - for critical status changes (approval needed, complete, error)
  const saveCurrentSessionImmediate = useCallback(
    async (input: SessionSaveInput): Promise<string> => {
      if (!workspaceId) {
        throw new Error("No workspace selected")
      }

      // Cancel any pending debounced save
      debouncedSaveRef.current?.cancel()

      try {
        const savedId = await saveSessionFromInput(input, currentSessionIdRef.current || undefined)
        currentSessionIdRef.current = savedId

        // Update active session ref
        await setActiveSession({
          sessionId: savedId,
          workspaceId: input.workspaceId,
        })

        // Refresh session list
        const metadata = await getSessionMetadataList(workspaceId)
        setSessions(metadata)

        // Update active session ID state
        setActiveSessionIdState(savedId)

        return savedId
      } catch (error) {
        console.error("Failed to save session immediately:", error)
        throw error
      }
    },
    [workspaceId]
  )

  // Load a full session by ID
  const loadSession = useCallback(
    async (sessionId: string): Promise<StoredAgentSession | null> => {
      try {
        return await getSession(sessionId)
      } catch (error) {
        console.error("Failed to load session:", error)
        return null
      }
    },
    []
  )

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await deleteStorageSession(sessionId)

        // If deleting current session, clear reference
        if (currentSessionIdRef.current === sessionId) {
          currentSessionIdRef.current = null
          setActiveSessionIdState(null)
        }

        // Refresh session list
        if (workspaceId) {
          const metadata = await getSessionMetadataList(workspaceId)
          setSessions(metadata)
        }

        // Clear restorable if it was this session
        if (restorableSession?.id === sessionId) {
          setRestorableSession(null)
        }
      } catch (error) {
        console.error("Failed to delete session:", error)
        throw error
      }
    },
    [workspaceId, restorableSession]
  )

  // Clear all sessions for current workspace
  const clearAllSessions = useCallback(async (): Promise<void> => {
    if (!workspaceId) return

    try {
      await deleteWorkspaceSessions(workspaceId)
      setSessions([])
      currentSessionIdRef.current = null
      setActiveSessionIdState(null)
      setRestorableSession(null)
    } catch (error) {
      console.error("Failed to clear all sessions:", error)
      throw error
    }
  }, [workspaceId])

  // Dismiss restorable session (delete it without restoring)
  const dismissRestorableSession = useCallback(async (): Promise<void> => {
    if (!restorableSession) return

    try {
      await deleteStorageSession(restorableSession.id)
      setRestorableSession(null)

      // Refresh session list
      if (workspaceId) {
        const metadata = await getSessionMetadataList(workspaceId)
        setSessions(metadata)
      }
    } catch (error) {
      console.error("Failed to dismiss restorable session:", error)
      throw error
    }
  }, [restorableSession, workspaceId])

  // Set active session ID
  const setActiveSessionIdFn = useCallback(
    async (sessionId: string | null): Promise<void> => {
      try {
        if (sessionId && workspaceId) {
          await setActiveSession({ sessionId, workspaceId })
          currentSessionIdRef.current = sessionId
        } else {
          await clearActiveSession()
          currentSessionIdRef.current = null
        }
        setActiveSessionIdState(sessionId)
      } catch (error) {
        console.error("Failed to set active session:", error)
        throw error
      }
    },
    [workspaceId]
  )

  // Manual refresh sessions
  const refreshSessions = useCallback(async (): Promise<void> => {
    if (!workspaceId) return

    try {
      const metadata = await getSessionMetadataList(workspaceId)
      setSessions(metadata)
    } catch (error) {
      console.error("Failed to refresh sessions:", error)
    }
  }, [workspaceId])

  return {
    // State
    sessions,
    activeSessionId,
    isLoading,
    restorableSession,

    // Actions
    saveCurrentSession,
    saveCurrentSessionImmediate,
    loadSession,
    deleteSession,
    clearAllSessions,
    dismissRestorableSession,
    setActiveSessionId: setActiveSessionIdFn,
    refreshSessions,
  }
}
