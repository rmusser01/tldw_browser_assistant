import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Button,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tooltip,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  GripVertical,
  Plus,
  PlusCircle,
  RotateCcw,
  Save,
  Trash2
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useDataTablesStore } from "@/store/data-tables"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { DataTable, DataTableColumn, DataTableRow } from "@/types/data-tables"
import { EditableCell } from "./EditableCell"
const AddColumnModal = React.lazy(() =>
  import("./AddColumnModal").then((module) => ({
    default: module.AddColumnModal
  }))
)

interface EditableDataTableProps {
  table: DataTable
  onSaveSuccess?: (table: DataTable) => void
  readOnly?: boolean
}

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value)
    const protocol = parsed.protocol.toLowerCase()
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

// Sortable column header component
const SortableColumnHeader: React.FC<{
  column: DataTableColumn
  onDelete: () => void
  readOnly?: boolean
}> = ({ column, onDelete, readOnly }) => {
  const { t } = useTranslation(["dataTables", "common"])
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 group"
    >
      {!readOnly && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <div className="flex-1">
        <div className="font-medium">{column.name}</div>
        <div className="text-xs text-zinc-400">{column.type}</div>
      </div>
      {!readOnly && (
        <Popconfirm
          title={t("dataTables:deleteColumn", "Delete column?")}
          description={t(
            "dataTables:deleteColumnConfirm",
            "This will remove the column and all its data."
          )}
          onConfirm={onDelete}
          okText={t("common:delete", "Delete")}
          cancelText={t("common:cancel", "Cancel")}
          okButtonProps={{ danger: true }}
        >
          <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-1">
            <Trash2 className="h-3 w-3" />
          </button>
        </Popconfirm>
      )}
    </div>
  )
}

/**
 * EditableDataTable
 *
 * Main editable table component with drag-and-drop column reordering,
 * cell editing, and row/column management.
 */
export const EditableDataTable: React.FC<EditableDataTableProps> = ({
  table,
  onSaveSuccess,
  readOnly = false
}) => {
  const { t } = useTranslation(["dataTables", "common"])
  const queryClient = useQueryClient()

  // Store state
  const editingTable = useDataTablesStore((s) => s.editingTable)
  const editingRows = useDataTablesStore((s) => s.editingRows)
  const editingState = useDataTablesStore((s) => s.editingState)
  const originalTable = useDataTablesStore((s) => s.originalTable)
  const editingTableId = editingTable?.id

  // Store actions
  const startEditing = useDataTablesStore((s) => s.startEditing)
  const stopEditing = useDataTablesStore((s) => s.stopEditing)
  const updateCell = useDataTablesStore((s) => s.updateCell)
  const addRow = useDataTablesStore((s) => s.addRow)
  const deleteRow = useDataTablesStore((s) => s.deleteRow)
  const addColumn = useDataTablesStore((s) => s.addColumn)
  const deleteColumn = useDataTablesStore((s) => s.deleteColumn)
  const reorderColumns = useDataTablesStore((s) => s.reorderColumns)
  const setEditingCellKey = useDataTablesStore((s) => s.setEditingCellKey)
  const discardChanges = useDataTablesStore((s) => s.discardChanges)
  const getEditedTableData = useDataTablesStore((s) => s.getEditedTableData)

  // Local state
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false)

  // Initialize editing when entering edit mode or switching tables.
  useEffect(() => {
    if (!table || readOnly) return
    if (!editingTableId || editingTableId !== table.id) {
      startEditing(table)
    }
  }, [table, readOnly, editingTableId, startEditing])

  // Cleanup editing state when the table changes or unmounts.
  useEffect(() => {
    return () => {
      if (!readOnly) {
        stopEditing()
      }
    }
  }, [table?.id, readOnly, stopEditing])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor)
  )

  // Handle drag end for column reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !editingTable) return

      const oldIndex = editingTable.columns.findIndex((c) => c.id === active.id)
      const newIndex = editingTable.columns.findIndex((c) => c.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderColumns(oldIndex, newIndex)
      }
    },
    [editingTable, reorderColumns]
  )

  // Handle save
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingTable) {
        throw new Error("No table to save")
      }
      const editedData = getEditedTableData()
      if (!editedData) {
        throw new Error("No data to save")
      }
      return tldwClient.saveDataTableContent(editingTable.id, editedData)
    },
    onSuccess: async (updatedTable) => {
      startEditing(updatedTable)
      message.success(t("dataTables:saveSuccess", "Changes saved successfully!"))
      onSaveSuccess?.(updatedTable)
      await queryClient.invalidateQueries({ queryKey: ["dataTables"] })
    },
    onError: (error) => {
      console.error("Failed to save table changes:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save changes"
      message.error(errorMessage)
    }
  })

  const handleSave = () => {
    if (!editingTable) return
    saveMutation.mutate()
  }

  // Handle discard
  const handleDiscard = () => {
    discardChanges()
    message.info(t("dataTables:changesDiscarded", "Changes discarded"))
  }

  // Handle add column
  const handleAddColumn = (column: DataTableColumn) => {
    addColumn(column)
    setAddColumnModalOpen(false)
    message.success(
      t("dataTables:columnAdded", "Column '{{name}}' added", {
        name: column.name
      })
    )
  }

  // Check if a cell was modified
  const isCellModified = useCallback(
    (rowIndex: number, columnName: string) => {
      if (!originalTable) return false
      const originalRow = originalTable.rows?.[rowIndex]
      const currentRow = editingRows[rowIndex]
      if (!originalRow || !currentRow) return false
      return originalRow[columnName] !== currentRow[columnName]
    },
    [originalTable, editingRows]
  )

  // Build table columns
  const columns = useMemo((): ColumnsType<DataTableRow> => {
    const tableColumns = editingTable?.columns || table.columns || []
    const dataColumns: ColumnsType<DataTableRow> = tableColumns.map((col, colIndex) => ({
      title: readOnly ? (
        <div>
          <div className="font-medium">{col.name}</div>
          <div className="text-xs text-zinc-400">{col.type}</div>
        </div>
      ) : (
        <SortableColumnHeader
          column={col}
          onDelete={() => deleteColumn(col.id)}
          readOnly={readOnly}
        />
      ),
      dataIndex: col.name,
      key: col.id,
      width: 150,
      ellipsis: true,
      render: (value: any, record: DataTableRow, rowIndex: number) => {
        if (readOnly) {
          // Read-only rendering
          if (value === null || value === undefined) {
            return <span className="text-zinc-400">-</span>
          }
          if (col.type === "url" && typeof value === "string") {
            if (!isHttpUrl(value)) {
              return String(value)
            }
            return (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {value.length > 40 ? `${value.slice(0, 40)}...` : value}
              </a>
            )
          }
          if (col.type === "boolean") {
            return value ? t("common:yes", "Yes") : t("common:no", "No")
          }
          return String(value)
        }

        const cellKey = `${rowIndex}-${col.id}`
        const isEditing = editingState.editingCellKey === cellKey

        return (
          <EditableCell
            value={value}
            columnType={col.type}
            columnName={col.name}
            rowIndex={rowIndex}
            isEditing={isEditing}
            isModified={isCellModified(rowIndex, col.name)}
            onStartEdit={() => setEditingCellKey(cellKey)}
            onFinishEdit={(newValue) => {
              updateCell(rowIndex, col.name, newValue)
              setEditingCellKey(null)
            }}
            onCancelEdit={() => setEditingCellKey(null)}
          />
        )
      }
    }))

    // Add actions column if not read-only
    if (!readOnly) {
      dataColumns.push({
        title: "",
        key: "_actions",
        width: 50,
        fixed: "right",
        render: (_: any, __: DataTableRow, rowIndex: number) => (
          <Popconfirm
            title={t("dataTables:deleteRow", "Delete row?")}
            description={t(
              "dataTables:deleteRowConfirm",
              "This action cannot be undone."
            )}
            onConfirm={() => deleteRow(rowIndex)}
            okText={t("common:delete", "Delete")}
            cancelText={t("common:cancel", "Cancel")}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t("dataTables:deleteRow", "Delete row")}>
              <button className="text-zinc-400 hover:text-red-500 p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </Tooltip>
          </Popconfirm>
        )
      })
    }

    return dataColumns
  }, [
    editingTable,
    table,
    editingState.editingCellKey,
    readOnly,
    deleteColumn,
    deleteRow,
    updateCell,
    setEditingCellKey,
    isCellModified,
    t
  ])

  // Column IDs for sortable context
  const columnIds = useMemo(
    () => (editingTable?.columns || table.columns || []).map((c) => c.id),
    [editingTable, table]
  )

  // Data source
  const dataSource = readOnly
    ? (table.rows || []).map((row, index) => ({
        ...row,
        _id: `row-${index}`
      }))
    : editingRows

  // Empty state
  if (!table && !editingTable) {
    return <Empty description={t("dataTables:noTable", "No table data")} />
  }

  return (
    <div className="editable-data-table space-y-4">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Space>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => addRow()}
            >
              {t("dataTables:addRow", "Add Row")}
            </Button>
            <Button
              icon={<PlusCircle className="h-4 w-4" />}
              onClick={() => setAddColumnModalOpen(true)}
            >
              {t("dataTables:addColumn", "Add Column")}
            </Button>
          </Space>
          <Space>
            <Button
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleDiscard}
              disabled={!editingState.isDirty}
            >
              {t("dataTables:discard", "Discard")}
            </Button>
            <Button
              type="primary"
              icon={<Save className="h-4 w-4" />}
              onClick={handleSave}
              loading={saveMutation.isPending}
              disabled={!editingState.isDirty}
            >
              {t("dataTables:save", "Save")}
            </Button>
          </Space>
        </div>
      )}

      {/* Dirty indicator */}
      {!readOnly && editingState.isDirty && (
        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          {t("dataTables:unsavedChanges", "You have unsaved changes")}
        </div>
      )}

      {/* Table info */}
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">{dataSource.length}</span>{" "}
        {t("dataTables:rows", "rows")} &bull;{" "}
        <span className="font-medium">
          {(editingTable?.columns || table.columns || []).length}
        </span>{" "}
        {t("dataTables:columnsLabel", "columns")}
      </div>

      {/* Table with DnD */}
      {readOnly ? (
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="_id"
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) =>
              t("dataTables:showingRows", "Showing {{total}} rows", { total })
          }}
          scroll={{ x: true }}
          size="small"
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            <Table
              dataSource={dataSource}
              columns={columns}
              rowKey="_id"
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                showTotal: (total) =>
                  t("dataTables:showingRows", "Showing {{total}} rows", {
                    total
                  })
              }}
              scroll={{ x: true }}
              size="small"
            />
          </SortableContext>
        </DndContext>
      )}

      {/* Add Column Modal */}
      <Suspense fallback={null}>
        <AddColumnModal
          open={addColumnModalOpen}
          onClose={() => setAddColumnModalOpen(false)}
          onAdd={handleAddColumn}
          existingColumns={editingTable?.columns || table.columns || []}
        />
      </Suspense>
    </div>
  )
}
