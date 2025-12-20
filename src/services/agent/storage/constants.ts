/**
 * Storage Constants for Session Persistence & Workspace History
 */

/** Storage keys used in @plasmohq/storage */
export const STORAGE_KEYS = {
  /** All sessions stored as single array */
  SESSIONS: "agent:sessions",
  /** Reference to currently active session */
  ACTIVE_SESSION: "agent:activeSession",
  /** Workspace usage history */
  WORKSPACE_HISTORY: "agent:workspaceHistory",
  /** Currently selected workspace ID (already exists in WorkspaceSelector) */
  SELECTED_WORKSPACE: "agent:selectedWorkspace",
} as const

/** Storage size limits to stay under browser extension quota */
export const STORAGE_LIMITS = {
  /** Maximum sessions per workspace */
  MAX_SESSIONS_PER_WORKSPACE: 5,
  /** Maximum total sessions across all workspaces */
  MAX_TOTAL_SESSIONS: 30,
  /** Maximum workspaces in history */
  MAX_WORKSPACE_HISTORY: 10,
  /** Auto-delete sessions older than this many days */
  MAX_SESSION_AGE_DAYS: 30,
  /** Maximum message content length before truncation */
  MAX_MESSAGE_LENGTH: 4000,
  /** Maximum tool result length before truncation */
  MAX_TOOL_RESULT_LENGTH: 2000,
  /** Maximum tool arguments length before truncation */
  MAX_ARGS_LENGTH: 1000,
  /** Maximum diff preview length */
  MAX_DIFF_PREVIEW_LENGTH: 500,
  /** Maximum command output preview length */
  MAX_OUTPUT_PREVIEW_LENGTH: 1000,
  /** Maximum session title length */
  MAX_TITLE_LENGTH: 50,
  /** Debounce interval for auto-save in milliseconds */
  AUTO_SAVE_DEBOUNCE_MS: 3000,
} as const

/** Statuses that indicate a session can be restored */
export const RESTORABLE_STATUSES = ["waiting_approval"] as const

/** Statuses that indicate a session was interrupted (should be marked failed on load) */
export const STALE_STATUSES = ["running"] as const
