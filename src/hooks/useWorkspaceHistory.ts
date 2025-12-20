/**
 * useWorkspaceHistory Hook
 *
 * React hook for managing workspace history.
 * Tracks recently used workspaces and provides quick access.
 */

import { useState, useEffect, useCallback } from "react"
import type { WorkspaceHistoryEntry } from "@/services/agent/storage"
import {
  getRecentWorkspaces,
  getLastUsedWorkspace,
  recordWorkspaceUsage,
  removeFromHistory,
  initializeWorkspaceHistory,
  getSelectedWorkspaceId,
  setSelectedWorkspaceId,
  clearSelectedWorkspaceId,
} from "@/services/agent/storage"

interface Workspace {
  id: string
  name: string
  path: string
}

interface UseWorkspaceHistoryReturn {
  // State
  recentWorkspaces: WorkspaceHistoryEntry[]
  selectedWorkspaceId: string | null
  isLoading: boolean

  // Actions
  recordUsage: (workspace: Workspace) => Promise<void>
  getLastUsed: () => WorkspaceHistoryEntry | null
  removeWorkspace: (workspaceId: string) => Promise<void>
  setSelectedId: (workspaceId: string | null) => Promise<void>
  refreshHistory: () => Promise<void>
}

export function useWorkspaceHistory(
  existingWorkspaces: Workspace[]
): UseWorkspaceHistoryReturn {
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceHistoryEntry[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Get existing workspace IDs for filtering
  const existingIds = existingWorkspaces.map((w) => w.id)

  // Initialize and load history when workspaces change
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true)

      try {
        // Initialize (cleans up orphaned entries)
        if (!initialized) {
          const result = await initializeWorkspaceHistory(existingIds)
          if (result.entriesRemoved > 0) {
            console.log(`Cleaned up ${result.entriesRemoved} orphaned workspace history entries`)
          }
          setInitialized(true)
        }

        // Load filtered history
        const history = await getRecentWorkspaces(existingIds)
        setRecentWorkspaces(history)

        // Load selected workspace ID
        const selectedId = await getSelectedWorkspaceId()
        // Only use if it still exists
        if (selectedId && existingIds.includes(selectedId)) {
          setSelectedWorkspaceIdState(selectedId)
        } else if (selectedId) {
          // Clear invalid selection
          await clearSelectedWorkspaceId()
          setSelectedWorkspaceIdState(null)
        }
      } catch (error) {
        console.error("Failed to load workspace history:", error)
        setRecentWorkspaces([])
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [existingIds.join(","), initialized]) // Join IDs to create stable dependency

  // Record workspace usage
  const recordUsage = useCallback(
    async (workspace: Workspace): Promise<void> => {
      try {
        await recordWorkspaceUsage(workspace)
        await setSelectedWorkspaceId(workspace.id)

        // Refresh history
        const history = await getRecentWorkspaces(existingIds)
        setRecentWorkspaces(history)
        setSelectedWorkspaceIdState(workspace.id)
      } catch (error) {
        console.error("Failed to record workspace usage:", error)
      }
    },
    [existingIds]
  )

  // Get last used workspace (sync - from current state)
  const getLastUsed = useCallback((): WorkspaceHistoryEntry | null => {
    return recentWorkspaces[0] || null
  }, [recentWorkspaces])

  // Remove workspace from history
  const removeWorkspace = useCallback(
    async (workspaceId: string): Promise<void> => {
      try {
        await removeFromHistory(workspaceId)

        // Clear selection if removing selected workspace
        if (selectedWorkspaceId === workspaceId) {
          await clearSelectedWorkspaceId()
          setSelectedWorkspaceIdState(null)
        }

        // Refresh history
        const history = await getRecentWorkspaces(existingIds)
        setRecentWorkspaces(history)
      } catch (error) {
        console.error("Failed to remove workspace from history:", error)
      }
    },
    [existingIds, selectedWorkspaceId]
  )

  // Set selected workspace ID
  const setSelectedId = useCallback(
    async (workspaceId: string | null): Promise<void> => {
      try {
        if (workspaceId) {
          await setSelectedWorkspaceId(workspaceId)
        } else {
          await clearSelectedWorkspaceId()
        }
        setSelectedWorkspaceIdState(workspaceId)
      } catch (error) {
        console.error("Failed to set selected workspace:", error)
      }
    },
    []
  )

  // Manual refresh
  const refreshHistory = useCallback(async (): Promise<void> => {
    try {
      const history = await getRecentWorkspaces(existingIds)
      setRecentWorkspaces(history)
    } catch (error) {
      console.error("Failed to refresh workspace history:", error)
    }
  }, [existingIds])

  return {
    // State
    recentWorkspaces,
    selectedWorkspaceId,
    isLoading,

    // Actions
    recordUsage,
    getLastUsed,
    removeWorkspace,
    setSelectedId,
    refreshHistory,
  }
}

/**
 * Helper hook to auto-select last used workspace on mount
 */
export function useAutoSelectWorkspace(
  existingWorkspaces: Workspace[],
  currentSelectedId: string | null,
  onSelect: (workspace: Workspace) => void
): void {
  const existingIds = existingWorkspaces.map((w) => w.id)

  useEffect(() => {
    // Only run if no workspace is currently selected
    if (currentSelectedId || existingWorkspaces.length === 0) return

    const autoSelect = async () => {
      try {
        const lastUsed = await getLastUsedWorkspace(existingIds)
        if (lastUsed) {
          const workspace = existingWorkspaces.find((w) => w.id === lastUsed.workspaceId)
          if (workspace) {
            onSelect(workspace)
          }
        }
      } catch (error) {
        console.error("Failed to auto-select workspace:", error)
      }
    }

    autoSelect()
  }, [existingWorkspaces, currentSelectedId, existingIds, onSelect])
}
