/**
 * Session Storage Service
 *
 * CRUD operations for agent sessions using @plasmohq/storage.
 * Sessions are stored as a single array for efficient access.
 */

import { Storage } from "@plasmohq/storage"
import { STORAGE_KEYS, STORAGE_LIMITS, RESTORABLE_STATUSES, STALE_STATUSES } from "./constants"
import type {
  StoredAgentSession,
  ActiveSessionRef,
  SessionMetadata,
  SessionSaveInput,
} from "./types"
import {
  createSessionFromInput,
  extractSessionMetadata,
  isSessionExpired,
  generateSessionId,
  dateToISOString,
} from "./utils"

// Storage instance
const storage = new Storage({ area: "local" })

/**
 * Get all stored sessions
 */
export async function getAllSessions(): Promise<StoredAgentSession[]> {
  const sessions = await storage.get<StoredAgentSession[]>(STORAGE_KEYS.SESSIONS)
  return sessions || []
}

/**
 * Save all sessions (internal helper)
 */
async function setAllSessions(sessions: StoredAgentSession[]): Promise<void> {
  await storage.set(STORAGE_KEYS.SESSIONS, sessions)
}

/**
 * Save or update a session
 * If session with same ID exists, updates it; otherwise adds new
 */
export async function saveSession(session: StoredAgentSession): Promise<void> {
  const sessions = await getAllSessions()
  const existingIndex = sessions.findIndex((s) => s.id === session.id)

  if (existingIndex >= 0) {
    // Update existing - preserve createdAt
    sessions[existingIndex] = {
      ...session,
      createdAt: sessions[existingIndex].createdAt,
      updatedAt: dateToISOString(new Date()),
    }
  } else {
    // Add new
    sessions.push(session)
  }

  // Prune if needed
  await pruneAndSave(sessions)
}

/**
 * Save session from component input
 * Creates new session if no ID provided, updates if ID exists
 */
export async function saveSessionFromInput(
  input: SessionSaveInput,
  existingId?: string
): Promise<string> {
  const session = createSessionFromInput(input, existingId)

  // If updating existing, get the original createdAt
  if (existingId) {
    const sessions = await getAllSessions()
    const existing = sessions.find((s) => s.id === existingId)
    if (existing) {
      session.createdAt = existing.createdAt
    }
  }

  await saveSession(session)
  return session.id
}

/**
 * Get a single session by ID
 */
export async function getSession(sessionId: string): Promise<StoredAgentSession | null> {
  const sessions = await getAllSessions()
  return sessions.find((s) => s.id === sessionId) || null
}

/**
 * Get all sessions for a specific workspace
 */
export async function getWorkspaceSessions(workspaceId: string): Promise<StoredAgentSession[]> {
  const sessions = await getAllSessions()
  return sessions
    .filter((s) => s.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

/**
 * Get session metadata list for a workspace (for lazy loading)
 */
export async function getSessionMetadataList(workspaceId: string): Promise<SessionMetadata[]> {
  const sessions = await getWorkspaceSessions(workspaceId)
  return sessions.map(extractSessionMetadata)
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getAllSessions()
  const filtered = sessions.filter((s) => s.id !== sessionId)
  await setAllSessions(filtered)

  // Also clear active session ref if it matches
  const activeRef = await getActiveSession()
  if (activeRef?.sessionId === sessionId) {
    await clearActiveSession()
  }
}

/**
 * Delete all sessions for a workspace
 */
export async function deleteWorkspaceSessions(workspaceId: string): Promise<void> {
  const sessions = await getAllSessions()
  const filtered = sessions.filter((s) => s.workspaceId !== workspaceId)
  await setAllSessions(filtered)

  // Also clear active session ref if it matches workspace
  const activeRef = await getActiveSession()
  if (activeRef?.workspaceId === workspaceId) {
    await clearActiveSession()
  }
}

/**
 * Prune old sessions for a specific workspace (enforce per-workspace limit)
 */
export async function pruneWorkspaceSessions(workspaceId: string): Promise<void> {
  const sessions = await getAllSessions()
  const workspaceSessions = sessions.filter((s) => s.workspaceId === workspaceId)

  if (workspaceSessions.length <= STORAGE_LIMITS.MAX_SESSIONS_PER_WORKSPACE) {
    return // No pruning needed
  }

  // Sort by updatedAt descending, keep only the most recent
  workspaceSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const toKeep = new Set(
    workspaceSessions.slice(0, STORAGE_LIMITS.MAX_SESSIONS_PER_WORKSPACE).map((s) => s.id)
  )

  const filtered = sessions.filter(
    (s) => s.workspaceId !== workspaceId || toKeep.has(s.id)
  )
  await setAllSessions(filtered)
}

/**
 * Prune expired sessions (older than MAX_SESSION_AGE_DAYS)
 */
export async function pruneExpiredSessions(): Promise<number> {
  const sessions = await getAllSessions()
  const validSessions = sessions.filter((s) => !isSessionExpired(s))
  const prunedCount = sessions.length - validSessions.length

  if (prunedCount > 0) {
    await setAllSessions(validSessions)
  }

  return prunedCount
}

/**
 * Prune to enforce global session limit
 */
export async function pruneGlobalSessions(): Promise<number> {
  const sessions = await getAllSessions()

  if (sessions.length <= STORAGE_LIMITS.MAX_TOTAL_SESSIONS) {
    return 0 // No pruning needed
  }

  // Sort by updatedAt descending, keep most recent
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const toKeep = sessions.slice(0, STORAGE_LIMITS.MAX_TOTAL_SESSIONS)
  const prunedCount = sessions.length - toKeep.length

  await setAllSessions(toKeep)
  return prunedCount
}

/**
 * Combined prune and save operation
 */
async function pruneAndSave(sessions: StoredAgentSession[]): Promise<void> {
  // First, remove expired sessions
  let filtered = sessions.filter((s) => !isSessionExpired(s))

  // Group by workspace and enforce per-workspace limit
  const byWorkspace = new Map<string, StoredAgentSession[]>()
  for (const session of filtered) {
    const list = byWorkspace.get(session.workspaceId) || []
    list.push(session)
    byWorkspace.set(session.workspaceId, list)
  }

  // Keep only most recent per workspace
  const kept: StoredAgentSession[] = []
  for (const [, workspaceSessions] of byWorkspace) {
    workspaceSessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    kept.push(...workspaceSessions.slice(0, STORAGE_LIMITS.MAX_SESSIONS_PER_WORKSPACE))
  }

  // Enforce global limit
  kept.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  filtered = kept.slice(0, STORAGE_LIMITS.MAX_TOTAL_SESSIONS)

  await setAllSessions(filtered)
}

/**
 * Mark stale sessions as failed
 * Called on mount to clean up sessions that were "running" when browser closed
 */
export async function markStaleSessionsFailed(): Promise<number> {
  const sessions = await getAllSessions()
  let markedCount = 0

  const updated = sessions.map((session) => {
    if ((STALE_STATUSES as readonly string[]).includes(session.status)) {
      markedCount++
      return {
        ...session,
        status: "error" as const,
        updatedAt: dateToISOString(new Date()),
      }
    }
    return session
  })

  if (markedCount > 0) {
    await setAllSessions(updated)
  }

  return markedCount
}

/**
 * Get a restorable session for a workspace
 * Returns the most recent session with a restorable status
 */
export async function getRestorableSession(
  workspaceId: string
): Promise<StoredAgentSession | null> {
  const sessions = await getWorkspaceSessions(workspaceId)
  return (
    sessions.find((s) =>
      (RESTORABLE_STATUSES as readonly string[]).includes(s.status)
    ) || null
  )
}

/**
 * Get the active session reference
 */
export async function getActiveSession(): Promise<ActiveSessionRef | null> {
  return await storage.get<ActiveSessionRef>(STORAGE_KEYS.ACTIVE_SESSION)
}

/**
 * Set the active session reference
 */
export async function setActiveSession(ref: ActiveSessionRef): Promise<void> {
  await storage.set(STORAGE_KEYS.ACTIVE_SESSION, ref)
}

/**
 * Clear the active session reference
 */
export async function clearActiveSession(): Promise<void> {
  await storage.remove(STORAGE_KEYS.ACTIVE_SESSION)
}

/**
 * Initialize storage on mount
 * - Marks stale sessions as failed
 * - Prunes expired sessions
 * Returns counts for logging
 */
export async function initializeSessionStorage(): Promise<{
  staleMarked: number
  expired: number
  globalPruned: number
}> {
  const staleMarked = await markStaleSessionsFailed()
  const expired = await pruneExpiredSessions()
  const globalPruned = await pruneGlobalSessions()

  return { staleMarked, expired, globalPruned }
}
