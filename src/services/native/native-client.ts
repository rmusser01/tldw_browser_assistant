/**
 * Native Messaging Client for tldw-agent
 *
 * This module provides communication with the local tldw-agent native messaging host
 * for workspace operations (filesystem, git, exec).
 */

import { browser } from "wxt/browser"

const HOST_NAME = "com.tldw.agent"

/**
 * Request sent to the native host
 */
export interface NativeRequest {
  id: string
  type: "ping" | "config" | "mcp_request" | "mcp_list_tools"
  payload?: any
}

/**
 * Response from the native host
 */
export interface NativeResponse {
  id: string
  ok: boolean
  data?: any
  error?: {
    code: string
    message: string
  }
  streaming?: boolean
}

/**
 * MCP tool definition
 */
export interface MCPToolDefinition {
  name: string
  description: string
  parameters: Record<string, any>
  tier: "read" | "write" | "exec"
}

/**
 * MCP tool result
 */
export interface MCPToolResult {
  ok: boolean
  data?: any
  error?: string
}

/**
 * Generate a unique request ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if the native host is installed and responsive
 */
export async function isHostInstalled(): Promise<boolean> {
  try {
    const response = await sendNativeMessage({
      id: generateId(),
      type: "ping"
    })
    return response?.ok === true
  } catch (e) {
    console.debug("[native-client] Host check failed:", e)
    return false
  }
}

/**
 * Get host configuration
 */
export async function getHostConfig(): Promise<{
  llm_endpoint: string
  execution_enabled: boolean
  shell: string
} | null> {
  try {
    const response = await sendNativeMessage({
      id: generateId(),
      type: "config"
    })
    if (response?.ok) {
      return response.data
    }
    return null
  } catch (e) {
    console.error("[native-client] Failed to get config:", e)
    return null
  }
}

/**
 * List available MCP tools
 */
export async function listTools(): Promise<MCPToolDefinition[]> {
  const response = await sendNativeMessage({
    id: generateId(),
    type: "mcp_list_tools"
  })

  if (!response?.ok) {
    throw new Error(response?.error?.message || "Failed to list tools")
  }

  return response.data || []
}

/**
 * Execute an MCP tool
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any> = {}
): Promise<MCPToolResult> {
  const response = await sendNativeMessage({
    id: generateId(),
    type: "mcp_request",
    payload: {
      method: "tools/call",
      tool_name: toolName,
      arguments: args
    }
  })

  if (!response?.ok) {
    return {
      ok: false,
      error: response?.error?.message || "Tool execution failed"
    }
  }

  return response.data as MCPToolResult
}

/**
 * Send a message to the native host
 */
async function sendNativeMessage(request: NativeRequest): Promise<NativeResponse> {
  // Check if native messaging is available
  if (!browser?.runtime?.sendNativeMessage) {
    throw new Error("Native messaging not available. Make sure you're running in an extension context.")
  }

  try {
    const response = await browser.runtime.sendNativeMessage(HOST_NAME, request)
    return response as NativeResponse
  } catch (e: any) {
    // Handle common native messaging errors
    if (e?.message?.includes("not found") || e?.message?.includes("Native host")) {
      throw new NativeHostNotFoundError(
        "tldw-agent is not installed. Please run the install script for your browser."
      )
    }
    throw e
  }
}

/**
 * Error thrown when the native host is not found
 */
export class NativeHostNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NativeHostNotFoundError"
  }
}

// ============================================
// Workspace Tools - High-level API
// ============================================

/**
 * Set the current workspace root
 */
export async function setWorkspace(path: string): Promise<MCPToolResult> {
  return executeTool("workspace.chdir", { path })
}

/**
 * Get current working directory info
 */
export async function getWorkspaceInfo(): Promise<{
  root: string
  cwd: string
  abs: string
} | null> {
  const result = await executeTool("workspace.pwd")
  if (result.ok) {
    return result.data
  }
  return null
}

/**
 * List directory contents
 */
export async function listDirectory(
  path: string = ".",
  options: {
    depth?: number
    includeHidden?: boolean
    maxEntries?: number
  } = {}
): Promise<MCPToolResult> {
  return executeTool("fs.list", {
    path,
    depth: options.depth,
    include_hidden: options.includeHidden,
    max_entries: options.maxEntries
  })
}

/**
 * Read file contents
 */
export async function readFile(
  path: string,
  options: {
    startLine?: number
    endLine?: number
  } = {}
): Promise<MCPToolResult> {
  return executeTool("fs.read", {
    path,
    start_line: options.startLine,
    end_line: options.endLine
  })
}

/**
 * Search file contents with grep
 */
export async function searchGrep(
  pattern: string,
  options: {
    paths?: string[]
    glob?: string
    caseSensitive?: boolean
    maxResults?: number
  } = {}
): Promise<MCPToolResult> {
  return executeTool("search.grep", {
    pattern,
    paths: options.paths,
    glob: options.glob,
    case_sensitive: options.caseSensitive,
    max_results: options.maxResults
  })
}

/**
 * Find files by glob pattern
 */
export async function searchGlob(
  pattern: string,
  options: {
    path?: string
    maxResults?: number
  } = {}
): Promise<MCPToolResult> {
  return executeTool("search.glob", {
    pattern,
    path: options.path,
    max_results: options.maxResults
  })
}

/**
 * Get git status
 */
export async function gitStatus(): Promise<MCPToolResult> {
  return executeTool("git.status")
}

/**
 * Get git diff
 */
export async function gitDiff(options: {
  paths?: string[]
  staged?: boolean
} = {}): Promise<MCPToolResult> {
  return executeTool("git.diff", options)
}

/**
 * Get git log
 */
export async function gitLog(options: {
  count?: number
  path?: string
} = {}): Promise<MCPToolResult> {
  return executeTool("git.log", options)
}

/**
 * Get git branch info
 */
export async function gitBranch(): Promise<MCPToolResult> {
  return executeTool("git.branch")
}

// ============================================
// Write Tools (require approval)
// ============================================

/**
 * Write content to a file
 */
export async function writeFile(path: string, content: string): Promise<MCPToolResult> {
  return executeTool("fs.write", { path, content })
}

/**
 * Apply a unified diff patch
 */
export async function applyPatch(patch: string): Promise<MCPToolResult> {
  return executeTool("fs.apply_patch", { patch })
}

/**
 * Create a directory
 */
export async function createDirectory(path: string): Promise<MCPToolResult> {
  return executeTool("fs.mkdir", { path })
}

/**
 * Delete a file or directory
 */
export async function deleteFile(path: string, recursive = false): Promise<MCPToolResult> {
  return executeTool("fs.delete", { path, recursive })
}

/**
 * Stage files for git commit
 */
export async function gitAdd(paths: string[]): Promise<MCPToolResult> {
  return executeTool("git.add", { paths })
}

/**
 * Create a git commit
 */
export async function gitCommit(message: string): Promise<MCPToolResult> {
  return executeTool("git.commit", { message })
}

// ============================================
// Exec Tools (require explicit approval)
// ============================================

/**
 * Run an allowlisted command
 */
export async function execRun(
  commandId: string,
  options: {
    args?: string[]
    cwd?: string
    timeoutMs?: number
  } = {}
): Promise<MCPToolResult> {
  return executeTool("exec.run", {
    command_id: commandId,
    args: options.args,
    cwd: options.cwd,
    timeout_ms: options.timeoutMs
  })
}
