/**
 * Storage Module for Session Persistence & Workspace History
 *
 * Barrel export for all storage-related functionality.
 */

// Types
export type {
  StoredAgentSession,
  StoredAgentMessage,
  StoredToolCallEntry,
  StoredPendingApproval,
  StoredFileDiff,
  StoredCommandExecution,
  ActiveSessionRef,
  WorkspaceHistoryEntry,
  SessionMetadata,
  SessionSaveInput,
  SessionRestoreOutput,
  RestorableStatus,
} from "./types"

export { CURRENT_SCHEMA_VERSION } from "./types"

// Constants
export {
  STORAGE_KEYS,
  STORAGE_LIMITS,
  RESTORABLE_STATUSES,
  STALE_STATUSES,
} from "./constants"

// Utilities
export {
  truncateContent,
  generateTitle,
  generateSessionId,
  dateToISOString,
  isoStringToDate,
  isSessionExpired,
  isRestorableStatus,
  isStaleStatus,
  summarizeMessage,
  summarizeToolCall,
  summarizePendingApproval,
  summarizeDiff,
  summarizeExecution,
  extractSessionMetadata,
  createSessionFromInput,
  sessionToRestoreOutput,
  debounce,
} from "./utils"

// Session Storage Service
export {
  getAllSessions,
  saveSession,
  saveSessionFromInput,
  getSession,
  getWorkspaceSessions,
  getSessionMetadataList,
  deleteSession,
  deleteWorkspaceSessions,
  pruneWorkspaceSessions,
  pruneExpiredSessions,
  pruneGlobalSessions,
  markStaleSessionsFailed,
  getRestorableSession,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  initializeSessionStorage,
} from "./sessionStorage"

// Workspace History Service
export {
  getAllWorkspaceHistory,
  recordWorkspaceUsage,
  getRecentWorkspaces,
  getLastUsedWorkspace,
  removeFromHistory,
  incrementSessionCount,
  decrementSessionCount,
  updateSessionCount,
  getSelectedWorkspaceId,
  setSelectedWorkspaceId,
  clearSelectedWorkspaceId,
  initializeWorkspaceHistory,
} from "./workspaceHistory"
