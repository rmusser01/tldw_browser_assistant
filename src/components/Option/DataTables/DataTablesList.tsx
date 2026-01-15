import React, { useEffect, useCallback } from "react"
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Pagination,
  Spin,
  Table,
  Tooltip,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import {
  Download,
  Eye,
  RefreshCw,
  Search,
  Trash2,
  FileSpreadsheet
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useDataTablesStore } from "@/store/data-tables"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { DataTableSummary } from "@/types/data-tables"
import { ExportMenu } from "./ExportMenu"
import { TableDetailModal } from "./TableDetailModal"

/**
 * DataTablesList
 *
 * Displays a list of saved data tables with search, pagination, and actions.
 */
export const DataTablesList: React.FC = () => {
  const { t } = useTranslation(["dataTables", "common"])

  // Store state
  const tables = useDataTablesStore((s) => s.tables)
  const tablesLoading = useDataTablesStore((s) => s.tablesLoading)
  const tablesError = useDataTablesStore((s) => s.tablesError)
  const tablesTotal = useDataTablesStore((s) => s.tablesTotal)
  const tablesPage = useDataTablesStore((s) => s.tablesPage)
  const tablesPageSize = useDataTablesStore((s) => s.tablesPageSize)
  const tablesSearch = useDataTablesStore((s) => s.tablesSearch)
  const selectedTableId = useDataTablesStore((s) => s.selectedTableId)
  const tableDetailOpen = useDataTablesStore((s) => s.tableDetailOpen)
  const deleteConfirmOpen = useDataTablesStore((s) => s.deleteConfirmOpen)
  const deleteTargetId = useDataTablesStore((s) => s.deleteTargetId)

  // Store actions
  const setTables = useDataTablesStore((s) => s.setTables)
  const setTablesLoading = useDataTablesStore((s) => s.setTablesLoading)
  const setTablesError = useDataTablesStore((s) => s.setTablesError)
  const setTablesPage = useDataTablesStore((s) => s.setTablesPage)
  const setTablesSearch = useDataTablesStore((s) => s.setTablesSearch)
  const openTableDetail = useDataTablesStore((s) => s.openTableDetail)
  const closeTableDetail = useDataTablesStore((s) => s.closeTableDetail)
  const openDeleteConfirm = useDataTablesStore((s) => s.openDeleteConfirm)
  const closeDeleteConfirm = useDataTablesStore((s) => s.closeDeleteConfirm)
  const removeTable = useDataTablesStore((s) => s.removeTable)

  // Fetch tables
  const fetchTables = useCallback(async () => {
    setTablesLoading(true)
    setTablesError(null)
    try {
      const response = await tldwClient.listDataTables({
        page: tablesPage,
        page_size: tablesPageSize,
        search: tablesSearch || undefined
      })

      // Handle different response formats
      const tablesList = Array.isArray(response)
        ? response
        : response?.tables || response?.data || []
      const total = response?.total ?? tablesList.length

      setTables(tablesList, total)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load tables"
      setTablesError(errorMessage)
      message.error(errorMessage)
    } finally {
      setTablesLoading(false)
    }
  }, [tablesPage, tablesPageSize, tablesSearch, setTables, setTablesLoading, setTablesError])

  // Initial fetch
  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTargetId) return

    try {
      await tldwClient.deleteDataTable(deleteTargetId)
      removeTable(deleteTargetId)
      message.success(t("dataTables:deleteSuccess", "Table deleted successfully"))
      closeDeleteConfirm()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete table"
      message.error(errorMessage)
    }
  }

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      })
    } catch {
      return dateStr
    }
  }

  // Table columns
  const columns: ColumnsType<DataTableSummary> = [
    {
      title: t("dataTables:columns.name", "Name"),
      dataIndex: "name",
      key: "name",
      render: (name: string, record: DataTableSummary) => (
        <button
          className="text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          onClick={() => openTableDetail(record.id)}
        >
          {name}
        </button>
      )
    },
    {
      title: t("dataTables:columns.rows", "Rows"),
      dataIndex: "row_count",
      key: "row_count",
      width: 80,
      align: "center"
    },
    {
      title: t("dataTables:columns.columns", "Columns"),
      dataIndex: "column_count",
      key: "column_count",
      width: 80,
      align: "center"
    },
    {
      title: t("dataTables:columns.sources", "Sources"),
      dataIndex: "source_count",
      key: "source_count",
      width: 80,
      align: "center"
    },
    {
      title: t("dataTables:columns.created", "Created"),
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (date: string) => formatDate(date)
    },
    {
      title: t("dataTables:columns.actions", "Actions"),
      key: "actions",
      width: 150,
      render: (_: any, record: DataTableSummary) => (
        <div className="flex items-center gap-2">
          <Tooltip title={t("dataTables:view", "View")}>
            <Button
              type="text"
              size="small"
              icon={<Eye className="h-4 w-4" />}
              onClick={() => openTableDetail(record.id)}
            />
          </Tooltip>
          <ExportMenu tableId={record.id} tableName={record.name} />
          <Tooltip title={t("dataTables:delete", "Delete")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => openDeleteConfirm(record.id)}
            />
          </Tooltip>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-4">
      {/* Search and refresh */}
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder={t("dataTables:searchPlaceholder", "Search tables...")}
          prefix={<Search className="h-4 w-4 text-zinc-400" />}
          value={tablesSearch}
          onChange={(e) => setTablesSearch(e.target.value)}
          className="max-w-xs"
          allowClear
        />
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={fetchTables}
          loading={tablesLoading}
        >
          {t("common:refresh", "Refresh")}
        </Button>
      </div>

      {/* Error state */}
      {tablesError && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400">{tablesError}</p>
        </Card>
      )}

      {/* Loading state */}
      {tablesLoading && tables.length === 0 && (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      )}

      {/* Empty state */}
      {!tablesLoading && tables.length === 0 && !tablesError && (
        <Empty
          image={<FileSpreadsheet className="h-16 w-16 mx-auto text-zinc-300 dark:text-zinc-600" />}
          description={
            <span className="text-zinc-500 dark:text-zinc-400">
              {tablesSearch
                ? t("dataTables:noSearchResults", "No tables found matching your search")
                : t("dataTables:noTables", "No tables yet. Create your first table!")}
            </span>
          }
        />
      )}

      {/* Tables list */}
      {tables.length > 0 && (
        <>
          <Table
            dataSource={tables}
            columns={columns}
            rowKey="id"
            loading={tablesLoading}
            pagination={false}
            size="middle"
          />

          {/* Pagination */}
          {tablesTotal > tablesPageSize && (
            <div className="flex justify-end">
              <Pagination
                current={tablesPage}
                pageSize={tablesPageSize}
                total={tablesTotal}
                onChange={(page) => setTablesPage(page)}
                showSizeChanger={false}
                showTotal={(total) =>
                  t("dataTables:totalTables", "{{total}} tables", { total })
                }
              />
            </div>
          )}
        </>
      )}

      {/* Table detail modal */}
      <TableDetailModal
        open={tableDetailOpen}
        tableId={selectedTableId}
        onClose={closeTableDetail}
      />

      {/* Delete confirmation modal */}
      <Modal
        title={t("dataTables:deleteConfirmTitle", "Delete Table")}
        open={deleteConfirmOpen}
        onOk={handleDelete}
        onCancel={closeDeleteConfirm}
        okText={t("common:delete", "Delete")}
        cancelText={t("common:cancel", "Cancel")}
        okButtonProps={{ danger: true }}
      >
        <p>
          {t(
            "dataTables:deleteConfirmMessage",
            "Are you sure you want to delete this table? This action cannot be undone."
          )}
        </p>
      </Modal>
    </div>
  )
}
