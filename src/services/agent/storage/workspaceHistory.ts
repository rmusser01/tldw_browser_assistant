/**
 * Workspace History Service
 *
 * Track and manage recently used workspaces for quick access.
 * Filters out orphaned workspaces that no longer exist.
 */

import { Storage } from "@plasmohq/storage"
import { STORAGE_KEYS, STORAGE_LIMITS } from "./constants"
import type { WorkspaceHistoryEntry } from "./types"
import { dateToISOString } from "./utils"

// Storage instance
const storage = new Storage({ area: "local" })

/**
 * Get all workspace history entries
 */
export async function getAllWorkspaceHistory(): Promise<WorkspaceHistoryEntry[]> {
  const history = await storage.get<WorkspaceHistoryEntry[]>(STORAGE_KEYS.WORKSPACE_HISTORY)
  return history || []
}

/**
 * Save workspace history (internal helper)
 */
async function setWorkspaceHistory(history: WorkspaceHistoryEntry[]): Promise<void> {
  await storage.set(STORAGE_KEYS.WORKSPACE_HISTORY, history)
}

/**
 * Record workspace usage
 * Updates lastUsedAt if exists, creates entry if not
 */
export async function recordWorkspaceUsage(workspace: {
  id: string
  name: string
  path: string
}): Promise<void> {
  const history = await getAllWorkspaceHistory()
  const existingIndex = history.findIndex((h) => h.workspaceId === workspace.id)
  const now = dateToISOString(new Date())

  if (existingIndex >= 0) {
    // Update existing entry
    history[existingIndex] = {
      ...history[existingIndex],
      name: workspace.name,
      path: workspace.path,
      lastUsedAt: now,
    }
  } else {
    // Add new entry
    history.push({
      workspaceId: workspace.id,
      name: workspace.name,
      path: workspace.path,
      lastUsedAt: now,
      sessionCount: 0,
    })
  }

  // Sort by lastUsedAt descending and enforce limit
  history.sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
  const trimmed = history.slice(0, STORAGE_LIMITS.MAX_WORKSPACE_HISTORY)

  await setWorkspaceHistory(trimmed)
}

/**
 * Get recent workspaces filtered by existing workspace IDs
 * Removes orphaned entries that no longer exist
 */
export async function getRecentWorkspaces(
  existingWorkspaceIds: string[]
): Promise<WorkspaceHistoryEntry[]> {
  const history = await getAllWorkspaceHistory()
  const existingSet = new Set(existingWorkspaceIds)

  // Filter to only existing workspaces
  const valid = history.filter((h) => existingSet.has(h.workspaceId))

  // If we removed any orphans, save the cleaned list
  if (valid.length < history.length) {
    await setWorkspaceHistory(valid)
  }

  return valid
}

/**
 * Get the last used workspace that still exists
 */
export async function getLastUsedWorkspace(
  existingWorkspaceIds: string[]
): Promise<WorkspaceHistoryEntry | null> {
  const recent = await getRecentWorkspaces(existingWorkspaceIds)
  return recent[0] || null
}

/**
 * Remove a workspace from history
 */
export async function removeFromHistory(workspaceId: string): Promise<void> {
  const history = await getAllWorkspaceHistory()
  const filtered = history.filter((h) => h.workspaceId !== workspaceId)
  await setWorkspaceHistory(filtered)
}

/**
 * Increment session count for a workspace
 */
export async function incrementSessionCount(workspaceId: string): Promise<void> {
  const history = await getAllWorkspaceHistory()
  const entry = history.find((h) => h.workspaceId === workspaceId)

  if (entry) {
    entry.sessionCount++
    await setWorkspaceHistory(history)
  }
}

/**
 * Decrement session count for a workspace
 */
export async function decrementSessionCount(workspaceId: string): Promise<void> {
  const history = await getAllWorkspaceHistory()
  const entry = history.find((h) => h.workspaceId === workspaceId)

  if (entry && entry.sessionCount > 0) {
    entry.sessionCount--
    await setWorkspaceHistory(history)
  }
}

/**
 * Update session count for a workspace based on actual sessions
 */
export async function updateSessionCount(
  workspaceId: string,
  count: number
): Promise<void> {
  const history = await getAllWorkspaceHistory()
  const entry = history.find((h) => h.workspaceId === workspaceId)

  if (entry) {
    entry.sessionCount = count
    await setWorkspaceHistory(history)
  }
}

/**
 * Get the currently selected workspace ID
 */
export async function getSelectedWorkspaceId(): Promise<string | null> {
  return await storage.get<string>(STORAGE_KEYS.SELECTED_WORKSPACE) || null
}

/**
 * Set the currently selected workspace ID
 */
export async function setSelectedWorkspaceId(workspaceId: string): Promise<void> {
  await storage.set(STORAGE_KEYS.SELECTED_WORKSPACE, workspaceId)
}

/**
 * Clear the selected workspace ID
 */
export async function clearSelectedWorkspaceId(): Promise<void> {
  await storage.remove(STORAGE_KEYS.SELECTED_WORKSPACE)
}

/**
 * Initialize workspace history on mount
 * Cleans up orphaned entries based on existing workspaces
 */
export async function initializeWorkspaceHistory(
  existingWorkspaceIds: string[]
): Promise<{
  entriesRemoved: number
  totalEntries: number
}> {
  const history = await getAllWorkspaceHistory()
  const existingSet = new Set(existingWorkspaceIds)

  const valid = history.filter((h) => existingSet.has(h.workspaceId))
  const entriesRemoved = history.length - valid.length

  if (entriesRemoved > 0) {
    await setWorkspaceHistory(valid)
  }

  return {
    entriesRemoved,
    totalEntries: valid.length,
  }
}
