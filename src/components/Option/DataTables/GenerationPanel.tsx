import React, { useState } from "react"
import {
  Button,
  Card,
  Collapse,
  Input,
  InputNumber,
  Select,
  Space,
  Tag
} from "antd"
import { Plus, Trash2, Sparkles, Settings2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { useDataTablesStore } from "@/store/data-tables"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { ColumnType, DataTableColumn } from "@/types/data-tables"

const { TextArea } = Input
const { Panel } = Collapse

// Column type options
const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "boolean", label: "Boolean" },
  { value: "currency", label: "Currency" }
]

// Example prompts
const EXAMPLE_PROMPTS = [
  "Create a table comparing key features, pricing, and ratings from these sources",
  "Extract all entities mentioned with their type, description, and first appearance",
  "List all action items with assignee, due date, and status",
  "Create a summary table with topic, key points, and source reference",
  "Extract product information including name, price, and specifications"
]

/**
 * GenerationPanel
 *
 * Component for entering the table generation prompt and configuring
 * optional column hints and settings.
 */
export const GenerationPanel: React.FC = () => {
  const { t } = useTranslation(["dataTables", "common"])

  // Store state
  const prompt = useDataTablesStore((s) => s.prompt)
  const columnHints = useDataTablesStore((s) => s.columnHints)
  const selectedModel = useDataTablesStore((s) => s.selectedModel)
  const maxRows = useDataTablesStore((s) => s.maxRows)
  const selectedSources = useDataTablesStore((s) => s.selectedSources)

  // Store actions
  const setPrompt = useDataTablesStore((s) => s.setPrompt)
  const addColumnHint = useDataTablesStore((s) => s.addColumnHint)
  const updateColumnHint = useDataTablesStore((s) => s.updateColumnHint)
  const removeColumnHint = useDataTablesStore((s) => s.removeColumnHint)
  const setSelectedModel = useDataTablesStore((s) => s.setSelectedModel)
  const setMaxRows = useDataTablesStore((s) => s.setMaxRows)

  // Local state for new column
  const [newColumnName, setNewColumnName] = useState("")
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text")

  // Fetch available models
  const { data: models } = useQuery({
    queryKey: ["tldw-chat-models"],
    queryFn: () => tldwClient.getModels(),
    staleTime: 5 * 60 * 1000
  })

  // Handle adding a column hint
  const handleAddColumn = () => {
    if (!newColumnName.trim()) return

    addColumnHint({
      name: newColumnName.trim(),
      type: newColumnType
    })
    setNewColumnName("")
    setNewColumnType("text")
  }

  // Use example prompt
  const useExamplePrompt = (example: string) => {
    setPrompt(example)
  }

  return (
    <div className="space-y-6">
      {/* Sources summary */}
      <div>
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          {t("dataTables:sourcesSelected", "Sources Selected")}
        </h4>
        <div className="flex flex-wrap gap-1">
          {selectedSources.map((source) => (
            <Tag key={source.id} className="truncate max-w-[150px]">
              {source.title}
            </Tag>
          ))}
        </div>
      </div>

      {/* Prompt input */}
      <div>
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("dataTables:promptLabel", "Describe the table you want to create")}
          </span>
        </h4>
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t(
            "dataTables:promptPlaceholder",
            "E.g., Create a table comparing the main topics discussed, with columns for topic, key points, and relevance score..."
          )}
          rows={4}
          showCount
          maxLength={2000}
        />
      </div>

      {/* Example prompts */}
      <div>
        <h5 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
          {t("dataTables:examplePrompts", "Example prompts:")}
        </h5>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example, index) => (
            <button
              key={index}
              onClick={() => useExamplePrompt(example)}
              className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              {example.slice(0, 40)}...
            </button>
          ))}
        </div>
      </div>

      {/* Advanced options */}
      <Collapse ghost>
        <Panel
          header={
            <span className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4" />
              {t("dataTables:advancedOptions", "Advanced Options")}
            </span>
          }
          key="advanced"
        >
          <div className="space-y-4">
            {/* Column hints */}
            <div>
              <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t("dataTables:columnHints", "Column Hints (Optional)")}
              </h5>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                {t(
                  "dataTables:columnHintsDesc",
                  "Suggest column names and types to guide the LLM. If not specified, columns will be inferred from your prompt."
                )}
              </p>

              {/* Existing hints */}
              {columnHints.length > 0 && (
                <div className="space-y-2 mb-3">
                  {columnHints.map((hint, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded"
                    >
                      <Input
                        value={hint.name || ""}
                        onChange={(e) =>
                          updateColumnHint(index, { ...hint, name: e.target.value })
                        }
                        placeholder="Column name"
                        size="small"
                        className="flex-1"
                      />
                      <Select
                        value={hint.type || "text"}
                        onChange={(value) =>
                          updateColumnHint(index, { ...hint, type: value })
                        }
                        options={COLUMN_TYPES}
                        size="small"
                        className="w-28"
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => removeColumnHint(index)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Add new hint */}
              <div className="flex items-center gap-2">
                <Input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder={t("dataTables:newColumnName", "Column name")}
                  size="small"
                  className="flex-1"
                  onPressEnter={handleAddColumn}
                />
                <Select
                  value={newColumnType}
                  onChange={setNewColumnType}
                  options={COLUMN_TYPES}
                  size="small"
                  className="w-28"
                />
                <Button
                  type="primary"
                  size="small"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={handleAddColumn}
                  disabled={!newColumnName.trim()}
                >
                  {t("common:add", "Add")}
                </Button>
              </div>
            </div>

            {/* Model selection */}
            <div>
              <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t("dataTables:modelSelection", "Model")}
              </h5>
              <Select
                value={selectedModel}
                onChange={setSelectedModel}
                placeholder={t("dataTables:selectModel", "Use default model")}
                allowClear
                className="w-full"
                options={
                  models?.map((m) => ({
                    value: m.id,
                    label: `${m.name} (${m.provider})`
                  })) || []
                }
              />
            </div>

            {/* Max rows */}
            <div>
              <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t("dataTables:maxRows", "Maximum Rows")}
              </h5>
              <InputNumber
                value={maxRows}
                onChange={(value) => setMaxRows(value || 100)}
                min={1}
                max={1000}
                className="w-32"
              />
              <span className="ml-2 text-xs text-zinc-500">
                {t("dataTables:maxRowsHint", "(1-1000)")}
              </span>
            </div>
          </div>
        </Panel>
      </Collapse>
    </div>
  )
}
