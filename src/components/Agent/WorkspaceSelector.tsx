/**
 * WorkspaceSelector - Select and manage workspace directories
 */

import { FC, useState, useEffect, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Dropdown, Modal, Input, message, Divider } from "antd"
import {
  FolderOpen,
  ChevronDown,
  Plus,
  AlertCircle,
  Check,
  Trash2,
  Clock
} from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"
import * as nativeClient from "@/services/native/native-client"
import { useWorkspaceHistory, useAutoSelectWorkspace } from "@/hooks/useWorkspaceHistory"

export interface Workspace {
  id: string
  name: string
  path: string
}

interface WorkspaceSelectorProps {
  onWorkspaceChange?: (workspace: Workspace | null) => void
  className?: string
}

export const WorkspaceSelector: FC<WorkspaceSelectorProps> = ({
  onWorkspaceChange,
  className = ""
}) => {
  const { t } = useTranslation("common")
  const [workspaces, setWorkspaces] = useStorage<Workspace[]>("agent:workspaces", [])
  const [selectedId, setSelectedId] = useStorage<string | null>("agent:selectedWorkspace", null)
  const [isHostInstalled, setIsHostInstalled] = useState<boolean | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPath, setNewPath] = useState("")
  const [newName, setNewName] = useState("")
  const [isValidating, setIsValidating] = useState(false)

  // Workspace history
  const {
    recentWorkspaces,
    recordUsage,
  } = useWorkspaceHistory(workspaces || [])

  // Check if native host is installed
  useEffect(() => {
    nativeClient.isHostInstalled().then(setIsHostInstalled)
  }, [])

  // Get currently selected workspace
  const selectedWorkspace = workspaces?.find(w => w.id === selectedId) || null

  const callbackRef = useRef(onWorkspaceChange)
  useEffect(() => {
    callbackRef.current = onWorkspaceChange
  })

  // Notify parent of workspace change
  useEffect(() => {
    callbackRef.current?.(selectedWorkspace)
  }, [selectedWorkspace])

  // Auto-select last used workspace on mount
  useAutoSelectWorkspace(
    workspaces || [],
    selectedId,
    // Auto-select callback always uses latest handleSelect
    (workspace: Workspace) => {
      handleSelect(workspace)
    }
  )

  // Handle workspace selection
  const handleSelect = async (workspace: Workspace) => {
    try {
      // Set workspace in native agent
      const result = await nativeClient.setWorkspace(workspace.path)
      if (!result.ok) {
        message.error(result.error || t("failedToSetWorkspace", "Failed to set workspace"))
        return
      }
      setSelectedId(workspace.id)

      // Record usage in history
      await recordUsage(workspace)
    } catch (e: unknown) {
      const err =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: unknown }).message)
          : t("failedToSetWorkspace", "Failed to set workspace")
      message.error(err)
    }
  }

  // Handle adding new workspace
  const handleAddWorkspace = async () => {
    if (!newPath.trim()) {
      message.error(t("pleaseEnterPath", "Please enter a path"))
      return
    }

    setIsValidating(true)
    try {
      // Validate path via native agent
      const result = await nativeClient.setWorkspace(newPath.trim())
      if (!result.ok) {
        message.error(result.error || t("invalidPath", "Invalid path"))
        return
      }

      // Add to list
      const workspace: Workspace = {
        id: crypto.randomUUID(),
        name: newName.trim() || (newPath.split(/[/\\]/).pop() || t("workspace", "Workspace")),
        path: newPath.trim()
      }

      setWorkspaces([...(workspaces || []), workspace])
      setSelectedId(workspace.id)
      setShowAddModal(false)
      setNewPath("")
      setNewName("")
      message.success(t("workspaceAdded", "Workspace added"))
    } catch (e: unknown) {
      const err =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: unknown }).message)
          : t("failedToAddWorkspace", "Failed to add workspace")
      message.error(err)
    } finally {
      setIsValidating(false)
    }
  }

  // Handle removing workspace
  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setWorkspaces((workspaces || []).filter(w => w.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
    }
  }

  // If host not installed, show setup prompt
  if (isHostInstalled === false) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 ${className}`}>
        <AlertCircle className="size-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm text-yellow-700 dark:text-yellow-300">
          {t("agentNotInstalled", "tldw-agent not installed")}
        </span>
        <a
          href="https://github.com/rmusser01/tldw_browser_assistant/blob/HEAD/docs/agent/user-guide.md#installation"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-auto"
        >
          {t("setup", "Setup")}
        </a>
      </div>
    )
  }

  // Loading state
  if (isHostInstalled === null) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
        <div className="size-4 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">
          {t("checkingAgent", "Checking agent...")}
        </span>
      </div>
    )
  }

  // Format relative time for recent workspaces
  const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return t("justNow", "Just now")
    if (diffMins < 60) return `${diffMins}m ${t("ago", "ago")}`
    if (diffHours < 24) return `${diffHours}h ${t("ago", "ago")}`
    if (diffDays < 7) return `${diffDays}d ${t("ago", "ago")}`
    return date.toLocaleDateString()
  }

  // Build menu items with recent workspaces section
  const menuItems = []

  // Recent workspaces section (if any)
  if (recentWorkspaces.length > 0) {
    menuItems.push({
      key: "recent-header",
      type: "group" as const,
      label: (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <Clock className="size-3" />
          {t("recent", "Recent")}
        </div>
      ),
      children: recentWorkspaces.slice(0, 3).map(recent => {
        const ws = workspaces?.find(w => w.id === recent.workspaceId)
        if (!ws) return null
        return {
          key: `recent-${ws.id}`,
          label: (
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{ws.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(recent.lastUsedAt)}
                </span>
              </div>
              {ws.id === selectedId && (
                <Check className="size-4 text-green-500 flex-shrink-0" />
              )}
            </div>
          ),
          onClick: () => handleSelect(ws)
        }
      }).filter(Boolean)
    })

    menuItems.push({ type: "divider" as const, key: "recent-divider" })
  }

  // All workspaces section
  menuItems.push({
    key: "all-header",
    type: "group" as const,
    label: (
      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {t("allWorkspaces", "All Workspaces")}
      </span>
    ),
    children: (workspaces || []).map(ws => ({
      key: ws.id,
      label: (
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{ws.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {ws.path}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {ws.id === selectedId && (
              <Check className="size-4 text-green-500" />
            )}
            <button
              onClick={(e) => handleRemove(ws.id, e)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Trash2 className="size-3 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>
      ),
      onClick: () => handleSelect(ws)
    }))
  })

  menuItems.push({ type: "divider" as const, key: "add-divider" })

  // Add workspace option
  menuItems.push({
    key: "add",
    label: (
      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
        <Plus className="size-4" />
        <span>{t("addWorkspace", "Add Workspace")}</span>
      </div>
    ),
    onClick: () => setShowAddModal(true)
  })

  return (
    <>
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["click"]}
        placement="bottomLeft"
      >
        <button
          className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${className}`}
        >
          <FolderOpen className="size-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium truncate max-w-[200px]">
            {selectedWorkspace?.name || t("selectWorkspace", "Select Workspace")}
          </span>
          <ChevronDown className="size-4 text-gray-400" />
        </button>
      </Dropdown>

      <Modal
        title={t("addWorkspace", "Add Workspace")}
        open={showAddModal}
        onOk={handleAddWorkspace}
        onCancel={() => {
          setShowAddModal(false)
          setNewPath("")
          setNewName("")
        }}
        confirmLoading={isValidating}
        okText={t("add", "Add")}
        cancelText={t("cancel", "Cancel")}
      >
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("workspacePath", "Workspace Path")}
            </label>
            <Input
              placeholder="/Users/you/projects/myapp"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onPressEnter={handleAddWorkspace}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t("workspacePathHelp", "Enter the full path to your project directory")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("workspaceName", "Display Name")} ({t("optional", "optional")})
            </label>
            <Input
              placeholder="My Project"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onPressEnter={handleAddWorkspace}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default WorkspaceSelector
