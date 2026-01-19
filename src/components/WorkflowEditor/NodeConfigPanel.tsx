/**
 * NodeConfigPanel Component
 *
 * Configuration sidebar for editing node properties.
 * Dynamically renders form fields based on the step's config schema.
 */

import { useMemo, useCallback } from "react"
import {
  Input,
  InputNumber,
  Select,
  Switch,
  Form,
  Button,
  Tooltip,
  Empty,
  Divider
} from "antd"
import {
  Settings,
  Trash2,
  Copy,
  Info,
  AlertCircle
} from "lucide-react"
import type {
  WorkflowNodeData,
  WorkflowNode
} from "@/types/workflow-editor"
import type { ConfigFieldSchema } from "./step-registry"
import { useWorkflowEditorStore } from "@/store/workflow-editor"
import { getStepMetadata } from "./step-registry"

const { TextArea } = Input

interface NodeConfigPanelProps {
  className?: string
}

export const NodeConfigPanel = ({ className = "" }: NodeConfigPanelProps) => {
  const nodes = useWorkflowEditorStore((s) => s.nodes)
  const selectedNodeIds = useWorkflowEditorStore((s) => s.selectedNodeIds)
  const updateNode = useWorkflowEditorStore((s) => s.updateNode)
  const deleteNodes = useWorkflowEditorStore((s) => s.deleteNodes)
  const duplicateNodes = useWorkflowEditorStore((s) => s.duplicateNodes)

  const selectedNode = useMemo(
    () =>
      selectedNodeIds.length === 1
        ? nodes.find((n) => n.id === selectedNodeIds[0])
        : null,
    [nodes, selectedNodeIds]
  )

  const metadata = useMemo(
    () => (selectedNode ? getStepMetadata(selectedNode.data.stepType) : null),
    [selectedNode]
  )

  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNode) return
      const currentConfig = selectedNode.data.config as Record<string, unknown>
      updateNode(selectedNode.id, {
        config: {
          ...currentConfig,
          [key]: value
        }
      } as Partial<WorkflowNodeData>)
    },
    [selectedNode, updateNode]
  )

  const handleLabelChange = useCallback(
    (label: string) => {
      if (!selectedNode) return
      updateNode(selectedNode.id, { label })
    },
    [selectedNode, updateNode]
  )

  const handleDelete = useCallback(() => {
    if (!selectedNode) return
    deleteNodes([selectedNode.id])
  }, [selectedNode, deleteNodes])

  const handleDuplicate = useCallback(() => {
    if (!selectedNode) return
    duplicateNodes([selectedNode.id])
  }, [selectedNode, duplicateNodes])

  // No node selected
  if (!selectedNode || !metadata) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Node Configuration
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              selectedNodeIds.length > 1
                ? "Multiple nodes selected"
                : "Select a node to configure"
            }
          />
        </div>
      </div>
    )
  }

  const shouldShowField = (field: ConfigFieldSchema): boolean => {
    if (!field.showWhen) return true
    const dependentValue = selectedNode.data.config[field.showWhen.field]
    return dependentValue === field.showWhen.value
  }

  const renderField = (field: ConfigFieldSchema) => {
    if (!shouldShowField(field)) return null

    const value = selectedNode.data.config[field.key] ?? field.default

    const label = (
      <span className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
        {field.description && (
          <Tooltip title={field.description}>
            <Info className="w-3 h-3 text-gray-400 cursor-help" />
          </Tooltip>
        )}
      </span>
    )

    switch (field.type) {
      case "text":
      case "url":
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <Input
              value={value as string}
              onChange={(e) => handleConfigChange(field.key, e.target.value)}
              placeholder={field.description}
              type={field.type === "url" ? "url" : "text"}
            />
          </Form.Item>
        )

      case "textarea":
      case "template-editor":
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <TextArea
              value={value as string}
              onChange={(e) => handleConfigChange(field.key, e.target.value)}
              placeholder={field.description}
              rows={field.type === "template-editor" ? 4 : 3}
              className="font-mono text-sm"
            />
            {field.type === "template-editor" && (
              <div className="text-xs text-gray-400 mt-1">
                Use {"{{variable}}"} for template placeholders
              </div>
            )}
          </Form.Item>
        )

      case "number":
      case "duration":
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <InputNumber
              value={value as number}
              onChange={(val) => handleConfigChange(field.key, val)}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.type === "duration" ? 1 : 0.1}
              className="w-full"
              addonAfter={field.type === "duration" ? "sec" : undefined}
            />
          </Form.Item>
        )

      case "select":
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <Select
              value={value as string}
              onChange={(val) => handleConfigChange(field.key, val)}
              options={field.options}
              className="w-full"
            />
          </Form.Item>
        )

      case "multiselect":
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <Select
              mode="multiple"
              value={value as string[]}
              onChange={(val) => handleConfigChange(field.key, val)}
              options={field.options}
              className="w-full"
            />
          </Form.Item>
        )

      case "checkbox":
        return (
          <Form.Item key={field.key} className="mb-3">
            <div className="flex items-center justify-between">
              {label}
              <Switch
                checked={value as boolean}
                onChange={(checked) => handleConfigChange(field.key, checked)}
              />
            </div>
          </Form.Item>
        )

      case "json-editor":
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <TextArea
              value={
                typeof value === "string"
                  ? value
                  : JSON.stringify(value, null, 2)
              }
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  handleConfigChange(field.key, parsed)
                } catch {
                  // Keep as string if not valid JSON
                  handleConfigChange(field.key, e.target.value)
                }
              }}
              rows={4}
              className="font-mono text-xs"
            />
          </Form.Item>
        )

      case "model-picker":
        // Placeholder for model picker - would integrate with model store
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <Select
              value={value as string}
              onChange={(val) => handleConfigChange(field.key, val)}
              placeholder="Select a model"
              className="w-full"
              options={[
                { value: "gpt-4", label: "GPT-4" },
                { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
                { value: "claude-3-opus", label: "Claude 3 Opus" },
                { value: "claude-3-sonnet", label: "Claude 3 Sonnet" }
              ]}
            />
          </Form.Item>
        )

      case "collection-picker":
        // Placeholder for collection picker
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <Select
              value={value as string}
              onChange={(val) => handleConfigChange(field.key, val)}
              placeholder="Select a collection"
              className="w-full"
              options={[
                { value: "default", label: "Default Collection" }
              ]}
            />
          </Form.Item>
        )

      default:
        return (
          <Form.Item key={field.key} label={label} className="mb-3">
            <Input
              value={value as string}
              onChange={(e) => handleConfigChange(field.key, e.target.value)}
            />
          </Form.Item>
        )
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {metadata.label}
          </h3>
          <div className="flex items-center gap-1">
            <Tooltip title="Duplicate">
              <Button
                type="text"
                size="small"
                icon={<Copy className="w-4 h-4" />}
                onClick={handleDuplicate}
              />
            </Tooltip>
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 className="w-4 h-4" />}
                onClick={handleDelete}
              />
            </Tooltip>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {metadata.description}
        </p>
      </div>

      {/* Configuration Form */}
      <div className="flex-1 overflow-y-auto p-3">
        <Form layout="vertical" size="small">
          {/* Node Label */}
          <Form.Item label="Node Label" className="mb-3">
            <Input
              value={selectedNode.data.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Enter node label"
            />
          </Form.Item>

          <Divider className="my-3" />

          {/* Dynamic Config Fields */}
          {metadata.configSchema.map(renderField)}
        </Form>
      </div>

      {/* Port Info */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Inputs:
            </span>
            <span className="text-gray-500">
              {metadata.inputs.length > 0
                ? metadata.inputs.map((i) => i.label).join(", ")
                : "None"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Outputs:
            </span>
            <span className="text-gray-500">
              {metadata.outputs.length > 0
                ? metadata.outputs.map((o) => o.label).join(", ")
                : "None"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NodeConfigPanel
