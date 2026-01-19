/**
 * NodePalette Component
 *
 * Displays available step types organized by category.
 * Nodes can be dragged onto the canvas to add them.
 */

import { useState, useMemo } from "react"
import { Input, Collapse, Tooltip } from "antd"
import {
  Search,
  MessageSquare,
  Video,
  GitBranch,
  Layers,
  UserCheck,
  Globe,
  Volume2,
  Mic,
  Clock,
  Terminal,
  GripVertical
} from "lucide-react"
import type { WorkflowStepType } from "@/types/workflow-editor"
import { getCategorizedSteps, type StepTypeMetadata } from "./step-registry"

// Icon mapping for the palette
const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Search,
  Video,
  GitBranch,
  Layers,
  UserCheck,
  Globe,
  Volume2,
  Mic,
  Clock,
  Terminal
}

// Category colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-300 dark:border-purple-700"
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-300 dark:border-blue-700"
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-300 dark:border-orange-700"
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-300 dark:border-green-700"
  },
  gray: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-300 dark:border-gray-600"
  }
}

interface PaletteItemProps {
  step: StepTypeMetadata
  categoryColor: string
  onDragStart: (e: React.DragEvent, stepType: WorkflowStepType) => void
}

const PaletteItem = ({ step, categoryColor, onDragStart }: PaletteItemProps) => {
  const Icon = STEP_ICONS[step.icon] || MessageSquare
  const colors = CATEGORY_COLORS[categoryColor] || CATEGORY_COLORS.gray

  return (
    <Tooltip
      title={step.description}
      placement="right"
      mouseEnterDelay={0.5}
    >
      <div
        draggable
        onDragStart={(e) => onDragStart(e, step.type)}
        className={`
          flex items-center gap-2 p-2 rounded-md cursor-grab
          border ${colors.border}
          ${colors.bg}
          hover:shadow-md hover:scale-[1.02]
          active:cursor-grabbing active:scale-100
          transition-all duration-150
        `}
      >
        <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
        <div className={`p-1.5 rounded ${colors.bg}`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {step.label}
          </div>
        </div>
      </div>
    </Tooltip>
  )
}

interface NodePaletteProps {
  className?: string
}

export const NodePalette = ({ className = "" }: NodePaletteProps) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeKeys, setActiveKeys] = useState<string[]>(["ai", "data", "control"])

  const categories = useMemo(() => getCategorizedSteps(), [])

  // Filter steps by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories

    const query = searchQuery.toLowerCase()
    return categories
      .map((cat) => ({
        ...cat,
        steps: cat.steps.filter(
          (step) =>
            step.label.toLowerCase().includes(query) ||
            step.description.toLowerCase().includes(query) ||
            step.type.toLowerCase().includes(query)
        )
      }))
      .filter((cat) => cat.steps.length > 0)
  }, [categories, searchQuery])

  const handleDragStart = (e: React.DragEvent, stepType: WorkflowStepType) => {
    e.dataTransfer.setData("application/workflow-step", stepType)
    e.dataTransfer.effectAllowed = "copy"
  }

  const collapseItems = filteredCategories.map((cat) => ({
    key: cat.category,
    label: (
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full bg-${cat.color}-500`}
          style={{ backgroundColor: `var(--${cat.color}-500, #888)` }}
        />
        <span className="font-medium">{cat.label}</span>
        <span className="text-xs text-gray-400">({cat.steps.length})</span>
      </div>
    ),
    children: (
      <div className="flex flex-col gap-2 pb-2">
        {cat.steps.map((step) => (
          <PaletteItem
            key={step.type}
            step={step}
            categoryColor={cat.color}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
    )
  }))

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Node Library
        </h3>
        <Input
          prefix={<Search className="w-4 h-4 text-gray-400" />}
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No nodes found</p>
          </div>
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            ghost
            expandIconPosition="end"
            items={collapseItems}
            className="workflow-node-palette"
          />
        )}
      </div>

      {/* Help text */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 text-center">
          Drag nodes onto the canvas to add them
        </p>
      </div>
    </div>
  )
}

export default NodePalette
