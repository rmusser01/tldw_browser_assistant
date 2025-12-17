/**
 * Agent UI Components
 *
 * Components for the agentic coding assistant interface
 */

// Workspace management
export { WorkspaceSelector } from "./WorkspaceSelector"
export type { Workspace } from "./WorkspaceSelector"

// Tool call display
export { ToolCallLog } from "./ToolCallLog"
export type { ToolCallEntry } from "./ToolCallLog"

// Diff viewing and approval
export { DiffViewer, parseDiff } from "./DiffViewer"
export type { FileDiff, DiffHunk, DiffLine } from "./DiffViewer"

// Approval workflow
export { ApprovalBanner } from "./ApprovalBanner"

// Terminal output
export { TerminalOutput } from "./TerminalOutput"
export type { CommandExecution } from "./TerminalOutput"
