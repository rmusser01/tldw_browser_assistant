import React, { useEffect, useState } from "react"
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Spin,
  Switch,
  Tag,
  message
} from "antd"
import { Download, RefreshCw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useDataTablesStore } from "@/store/data-tables"
import { exportAndDownload } from "@/utils/data-table-export"
import type { DataTable, ExportFormat } from "@/types/data-tables"
import { EditableDataTable } from "./EditableDataTable"

interface TableDetailModalProps {
  open: boolean
  tableId: string | null
  onClose: () => void
}

/**
 * TableDetailModal
 *
 * Drawer modal for viewing and editing table details, data, and exporting.
 */
export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  open,
  tableId,
  onClose
}) => {
  const { t } = useTranslation(["dataTables", "common"])

  // Store state
  const currentTable = useDataTablesStore((s) => s.currentTable)
  const currentTableLoading = useDataTablesStore((s) => s.currentTableLoading)
  const editingState = useDataTablesStore((s) => s.editingState)

  // Store actions
  const setCurrentTable = useDataTablesStore((s) => s.setCurrentTable)
  const setCurrentTableLoading = useDataTablesStore((s) => s.setCurrentTableLoading)
  const stopEditing = useDataTablesStore((s) => s.stopEditing)
  const updateTableInList = useDataTablesStore((s) => s.updateTableInList)

  // Local state
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [editMode, setEditMode] = useState(false)

  // Fetch table details
  const fetchTable = async () => {
    if (!tableId) return

    setCurrentTableLoading(true)
    setError(null)

    try {
      const table = await tldwClient.getDataTable(tableId)
      setCurrentTable(table)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load table"
      setError(errorMessage)
    } finally {
      setCurrentTableLoading(false)
    }
  }

  // Fetch on open
  useEffect(() => {
    if (open && tableId) {
      fetchTable()
      setEditMode(false) // Reset edit mode when opening
    }
    return () => {
      if (!open) {
        setCurrentTable(null)
        setError(null)
        stopEditing()
      }
    }
  }, [open, tableId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle close with unsaved changes check
  const handleClose = () => {
    if (editMode && editingState.isDirty) {
      // Show confirmation
      if (!window.confirm(t("dataTables:discardUnsavedChanges", "You have unsaved changes. Are you sure you want to close?"))) {
        return
      }
    }
    stopEditing()
    onClose()
  }

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    if (!currentTable) return

    setIsExporting(true)
    try {
      await exportAndDownload(currentTable, format)
      message.success(
        t("dataTables:exportSuccess", "Table exported as {{format}}", {
          format: format.toUpperCase()
        })
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Export failed"
      message.error(errorMessage)
    } finally {
      setIsExporting(false)
    }
  }

  // Handle regenerate
  const handleRegenerate = async () => {
    if (!tableId) return

    setIsRegenerating(true)
    try {
      const updatedTable = await tldwClient.regenerateDataTable(tableId)
      const table = updatedTable?.table || updatedTable
      setCurrentTable(table)
      // Update in list
      if (table) {
        updateTableInList(tableId, {
          row_count: table.row_count || table.rows?.length || 0,
          column_count: table.columns?.length || 0,
          updated_at: table.updated_at
        })
      }
      message.success(t("dataTables:regenerateSuccess", "Table regenerated successfully!"))
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Regeneration failed"
      message.error(errorMessage)
    } finally {
      setIsRegenerating(false)
    }
  }

  // Handle save success
  const handleSaveSuccess = (updatedTable: DataTable) => {
    setCurrentTable(updatedTable)
    // Update in list
    if (updatedTable && tableId) {
      updateTableInList(tableId, {
        row_count: updatedTable.row_count || updatedTable.rows?.length || 0,
        column_count: updatedTable.columns?.length || 0,
        updated_at: updatedTable.updated_at
      })
    }
  }

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-"
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  return (
    <Drawer
      title={currentTable?.name || t("dataTables:tableDetails", "Table Details")}
      placement="right"
      width={900}
      open={open}
      onClose={handleClose}
      extra={
        <Button type="text" icon={<X className="h-4 w-4" />} onClick={handleClose} />
      }
    >
      {/* Loading */}
      {currentTableLoading && (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert
          type="error"
          message={t("common:error", "Error")}
          description={error}
          showIcon
        />
      )}

      {/* Content */}
      {!currentTableLoading && !error && currentTable && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button
                icon={<Download className="h-4 w-4" />}
                onClick={() => handleExport("csv")}
                loading={isExporting}
                size="small"
              >
                CSV
              </Button>
              <Button
                icon={<Download className="h-4 w-4" />}
                onClick={() => handleExport("xlsx")}
                loading={isExporting}
                size="small"
              >
                Excel
              </Button>
              <Button
                icon={<Download className="h-4 w-4" />}
                onClick={() => handleExport("json")}
                loading={isExporting}
                size="small"
              >
                JSON
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t("dataTables:editMode", "Edit Mode")}
                </span>
                <Switch
                  checked={editMode}
                  onChange={setEditMode}
                  size="small"
                />
              </div>
              <Button
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={handleRegenerate}
                loading={isRegenerating}
                size="small"
              >
                {t("dataTables:regenerate", "Regenerate")}
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label={t("dataTables:rows", "Rows")}>
              {currentTable.row_count || currentTable.rows?.length || 0}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataTables:columns", "Columns")}>
              {currentTable.columns?.length || 0}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataTables:created", "Created")}>
              {formatDate(currentTable.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataTables:updated", "Updated")}>
              {formatDate(currentTable.updated_at)}
            </Descriptions.Item>
            {currentTable.generation_model && (
              <Descriptions.Item
                label={t("dataTables:model", "Model")}
                span={2}
              >
                {currentTable.generation_model}
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Description */}
          {currentTable.description && (
            <div>
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t("dataTables:description", "Description")}
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {currentTable.description}
              </p>
            </div>
          )}

          {/* Prompt */}
          {currentTable.prompt && (
            <div>
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t("dataTables:prompt", "Generation Prompt")}
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                "{currentTable.prompt}"
              </p>
            </div>
          )}

          {/* Sources */}
          {currentTable.sources && currentTable.sources.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t("dataTables:sources", "Sources")} ({currentTable.sources.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {currentTable.sources.map((source, index) => (
                  <Tag key={index}>
                    {source.type}: {source.title}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Data table */}
          <div>
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              {t("dataTables:data", "Data")}
              {editMode && (
                <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">
                  ({t("dataTables:editModeActive", "Click cells to edit")})
                </span>
              )}
            </h4>
            {currentTable.rows && currentTable.rows.length > 0 ? (
              <EditableDataTable
                table={currentTable}
                onSaveSuccess={handleSaveSuccess}
                readOnly={!editMode}
              />
            ) : (
              <Empty description={t("dataTables:noData", "No data")} />
            )}
          </div>
        </div>
      )}

      {/* No table */}
      {!currentTableLoading && !error && !currentTable && (
        <Empty description={t("dataTables:tableNotFound", "Table not found")} />
      )}
    </Drawer>
  )
}
