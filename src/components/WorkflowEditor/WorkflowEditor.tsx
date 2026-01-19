/**
 * WorkflowEditor Component
 *
 * Main workflow editor component that combines:
 * - Toolbar with workflow actions
 * - Canvas for visual editing
 * - Sidebar with palette, config, and execution panels
 */

import { useEffect, useCallback, useState } from "react"
import {
  Button,
  Input,
  Tooltip,
  Dropdown,
  Segmented,
  Badge,
  message
} from "antd"
import {
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Map,
  FileDown,
  FileUp,
  Settings,
  Palette,
  Play,
  MoreVertical,
  AlertCircle,
  Plus,
  Trash2
} from "lucide-react"
import type { SidebarPanel } from "@/types/workflow-editor"
import { useWorkflowEditorStore } from "@/store/workflow-editor"
import { WorkflowCanvas } from "./WorkflowCanvas"
import { NodePalette } from "./NodePalette"
import { NodeConfigPanel } from "./NodeConfigPanel"
import { ExecutionPanel } from "./ExecutionPanel"

interface WorkflowEditorProps {
  className?: string
}

export const WorkflowEditor = ({ className = "" }: WorkflowEditorProps) => {
  // Store state
  const workflowName = useWorkflowEditorStore((s) => s.workflowName)
  const isDirty = useWorkflowEditorStore((s) => s.isDirty)
  const isMiniMapVisible = useWorkflowEditorStore((s) => s.isMiniMapVisible)
  const isGridVisible = useWorkflowEditorStore((s) => s.isGridVisible)
  const sidebarPanel = useWorkflowEditorStore((s) => s.sidebarPanel)
  const isValid = useWorkflowEditorStore((s) => s.isValid)
  const issues = useWorkflowEditorStore((s) => s.issues)
  const status = useWorkflowEditorStore((s) => s.status)

  // Store actions
  const setWorkflowMeta = useWorkflowEditorStore((s) => s.setWorkflowMeta)
  const newWorkflow = useWorkflowEditorStore((s) => s.newWorkflow)
  const saveWorkflow = useWorkflowEditorStore((s) => s.saveWorkflow)
  const toggleMiniMap = useWorkflowEditorStore((s) => s.toggleMiniMap)
  const toggleGrid = useWorkflowEditorStore((s) => s.toggleGrid)
  const setSidebarPanel = useWorkflowEditorStore((s) => s.setSidebarPanel)
  const undo = useWorkflowEditorStore((s) => s.undo)
  const redo = useWorkflowEditorStore((s) => s.redo)
  const canUndo = useWorkflowEditorStore((s) => s.canUndo)
  const canRedo = useWorkflowEditorStore((s) => s.canRedo)
  const validate = useWorkflowEditorStore((s) => s.validate)
  const clearCanvas = useWorkflowEditorStore((s) => s.clearCanvas)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(workflowName)

  // Initialize with a new workflow on mount
  useEffect(() => {
    const nodes = useWorkflowEditorStore.getState().nodes
    if (nodes.length === 0) {
      newWorkflow()
    }
  }, [newWorkflow])

  // Validate on changes
  useEffect(() => {
    validate()
  }, [validate])

  const handleSave = useCallback(() => {
    const workflow = saveWorkflow()
    console.log("Workflow saved:", workflow)
    message.success("Workflow saved")
    // In a real implementation, this would call the API
  }, [saveWorkflow])

  const handleExport = useCallback(() => {
    const workflow = saveWorkflow()
    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${workflow.name.toLowerCase().replace(/\s+/g, "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success("Workflow exported")
  }, [saveWorkflow])

  const handleImport = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const workflow = JSON.parse(text)
        useWorkflowEditorStore.getState().loadWorkflow(workflow)
        message.success("Workflow imported")
      } catch (error) {
        message.error("Failed to import workflow")
      }
    }
    input.click()
  }, [])

  const handleNameEdit = useCallback(() => {
    if (isEditing) {
      setWorkflowMeta(editName, useWorkflowEditorStore.getState().workflowDescription)
    }
    setIsEditing(!isEditing)
  }, [isEditing, editName, setWorkflowMeta])

  const sidebarPanelOptions = [
    { value: "palette", icon: <Palette className="w-4 h-4" />, label: "Nodes" },
    { value: "config", icon: <Settings className="w-4 h-4" />, label: "Config" },
    { value: "execution", icon: <Play className="w-4 h-4" />, label: "Run" }
  ]

  const moreMenuItems = [
    {
      key: "new",
      icon: <Plus className="w-4 h-4" />,
      label: "New Workflow",
      onClick: () => {
        if (isDirty) {
          if (confirm("You have unsaved changes. Create new workflow?")) {
            newWorkflow()
          }
        } else {
          newWorkflow()
        }
      }
    },
    {
      key: "import",
      icon: <FileUp className="w-4 h-4" />,
      label: "Import",
      onClick: handleImport
    },
    {
      key: "export",
      icon: <FileDown className="w-4 h-4" />,
      label: "Export",
      onClick: handleExport
    },
    { type: "divider" as const },
    {
      key: "clear",
      icon: <Trash2 className="w-4 h-4" />,
      label: "Clear Canvas",
      danger: true,
      onClick: () => {
        if (confirm("Clear all nodes from the canvas?")) {
          clearCanvas()
        }
      }
    }
  ]

  const errorCount = issues.filter((i) => i.severity === "error").length
  const warningCount = issues.filter((i) => i.severity === "warning").length

  return (
    <div className={`flex flex-col h-full bg-gray-100 dark:bg-gray-900 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Workflow name */}
        <div className="flex items-center gap-2 min-w-[200px]">
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameEdit}
              onPressEnter={handleNameEdit}
              size="small"
              autoFocus
              className="max-w-[180px]"
            />
          ) : (
            <button
              onClick={() => {
                setEditName(workflowName)
                setIsEditing(true)
              }}
              className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-500 truncate max-w-[180px]"
            >
              {workflowName}
            </button>
          )}
          {isDirty && (
            <span className="text-xs text-gray-400">*</span>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Tooltip title="Undo (Cmd+Z)">
            <Button
              type="text"
              size="small"
              icon={<Undo2 className="w-4 h-4" />}
              disabled={!canUndo()}
              onClick={undo}
            />
          </Tooltip>
          <Tooltip title="Redo (Cmd+Shift+Z)">
            <Button
              type="text"
              size="small"
              icon={<Redo2 className="w-4 h-4" />}
              disabled={!canRedo()}
              onClick={redo}
            />
          </Tooltip>
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

        {/* View controls */}
        <div className="flex items-center gap-1">
          <Tooltip title="Toggle Grid">
            <Button
              type={isGridVisible ? "primary" : "text"}
              size="small"
              icon={<Grid3X3 className="w-4 h-4" />}
              onClick={toggleGrid}
            />
          </Tooltip>
          <Tooltip title="Toggle Minimap">
            <Button
              type={isMiniMapVisible ? "primary" : "text"}
              size="small"
              icon={<Map className="w-4 h-4" />}
              onClick={toggleMiniMap}
            />
          </Tooltip>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Validation status */}
        {(errorCount > 0 || warningCount > 0) && (
          <Tooltip
            title={
              <div className="space-y-1">
                {issues.map((issue) => (
                  <div key={issue.id} className="flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            }
          >
            <Badge
              count={errorCount || warningCount}
              color={errorCount > 0 ? "red" : "orange"}
              size="small"
            >
              <Button
                type="text"
                size="small"
                icon={
                  <AlertCircle
                    className={`w-4 h-4 ${
                      errorCount > 0 ? "text-red-500" : "text-orange-500"
                    }`}
                  />
                }
              />
            </Badge>
          </Tooltip>
        )}

        {/* Save button */}
        <Tooltip title="Save (Cmd+S)">
          <Button
            type="primary"
            size="small"
            icon={<Save className="w-4 h-4" />}
            onClick={handleSave}
            disabled={!isDirty}
          >
            Save
          </Button>
        </Tooltip>

        {/* More menu */}
        <Dropdown
          menu={{ items: moreMenuItems }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button
            type="text"
            size="small"
            icon={<MoreVertical className="w-4 h-4" />}
          />
        </Dropdown>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          {/* Panel tabs */}
          <div className="flex items-center p-2 border-b border-gray-200 dark:border-gray-700">
            <Segmented
              size="small"
              value={sidebarPanel || "palette"}
              onChange={(value) => setSidebarPanel(value as SidebarPanel)}
              options={sidebarPanelOptions.map((opt) => ({
                value: opt.value,
                icon: opt.icon,
                title: opt.label
              }))}
              block
            />
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {sidebarPanel === "palette" && <NodePalette className="h-full" />}
            {sidebarPanel === "config" && <NodeConfigPanel className="h-full" />}
            {sidebarPanel === "execution" && <ExecutionPanel className="h-full" />}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <WorkflowCanvas />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            {useWorkflowEditorStore.getState().nodes.length} nodes
          </span>
          <span>
            {useWorkflowEditorStore.getState().edges.length} connections
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status !== "idle" && (
            <span className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === "running"
                    ? "bg-blue-500 animate-pulse"
                    : status === "completed"
                    ? "bg-green-500"
                    : status === "failed"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }`}
              />
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default WorkflowEditor
