import React, { useCallback, useEffect, useState } from "react"
import {
  Alert,
  Descriptions,
  Drawer,
  Empty,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { useTranslation } from "react-i18next"
import { fetchScrapedItems, getRunDetails, updateScrapedItem } from "@/services/watchlists"
import type { RunDetailResponse, ScrapedItem } from "@/types/watchlists"
import { formatRelativeTime } from "@/utils/dateFormatters"
import { StatusTag } from "../shared"

interface RunDetailDrawerProps {
  runId: number | null
  open: boolean
  onClose: () => void
}

export const RunDetailDrawer: React.FC<RunDetailDrawerProps> = ({
  runId,
  open,
  onClose
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RunDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [items, setItems] = useState<ScrapedItem[]>([])
  const [itemsTotal, setItemsTotal] = useState(0)
  const [itemsPage, setItemsPage] = useState(1)
  const [itemsPageSize, setItemsPageSize] = useState(20)
  const [updatingItemIds, setUpdatingItemIds] = useState<number[]>([])

  useEffect(() => {
    if (open && runId) {
      setLoading(true)
      setError(null)
      getRunDetails(runId)
        .then((result) => {
          setData(result)
        })
        .catch((err) => {
          console.error("Failed to fetch run details:", err)
          setError(err.message || "Failed to load details")
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setData(null)
      setError(null)
    }
  }, [open, runId])

  const loadItems = useCallback(async () => {
    if (!open || !runId) return
    setItemsLoading(true)
    try {
      const result = await fetchScrapedItems({
        run_id: runId,
        page: itemsPage,
        size: itemsPageSize
      })
      setItems(Array.isArray(result.items) ? result.items : [])
      setItemsTotal(result.total || 0)
    } catch (err) {
      console.error("Failed to fetch run items:", err)
      message.error(t("watchlists:runs.detail.itemsError", "Failed to load items"))
      setItems([])
      setItemsTotal(0)
    } finally {
      setItemsLoading(false)
    }
  }, [itemsPage, itemsPageSize, open, runId, t])

  useEffect(() => {
    if (!open) {
      setItems([])
      setItemsTotal(0)
      setItemsPage(1)
      setItemsPageSize(20)
      return
    }
    setItemsPage(1)
  }, [open, runId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Calculate duration
  const calculateDuration = (): string => {
    if (!data?.started_at) return "-"
    const start = new Date(data.started_at)
    const end = data.finished_at ? new Date(data.finished_at) : new Date()
    const durationMs = end.getTime() - start.getTime()

    if (durationMs < 1000) return "<1 second"
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)} seconds`
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)} minutes`
    return `${(durationMs / 3600000).toFixed(1)} hours`
  }

  const handleToggleReviewed = async (item: ScrapedItem, reviewed: boolean) => {
    if (updatingItemIds.includes(item.id)) return
    setUpdatingItemIds((prev) => [...prev, item.id])
    try {
      const updated = await updateScrapedItem(item.id, { reviewed })
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, reviewed: updated.reviewed } : entry
        )
      )
    } catch (err) {
      console.error("Failed to update item:", err)
      message.error(t("watchlists:runs.detail.itemsUpdateError", "Failed to update item"))
    } finally {
      setUpdatingItemIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  const itemColumns: ColumnsType<ScrapedItem> = [
    {
      title: t("watchlists:runs.detail.itemsColumns.title", "Title"),
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title: string | null, record) => (
        <div className="space-y-1">
          <div className="font-medium">
            {record.url ? (
              <a
                href={record.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                {title || record.url}
              </a>
            ) : (
              title || t("watchlists:runs.detail.itemsUntitled", "Untitled")
            )}
          </div>
          {record.summary && (
            <div className="text-xs text-zinc-500 line-clamp-2">{record.summary}</div>
          )}
        </div>
      )
    },
    {
      title: t("watchlists:runs.detail.itemsColumns.status", "Status"),
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: string) => (
        <Tag color={status === "ingested" ? "green" : "default"}>
          {status}
        </Tag>
      )
    },
    {
      title: t("watchlists:runs.detail.itemsColumns.reviewed", "Reviewed"),
      dataIndex: "reviewed",
      key: "reviewed",
      width: 110,
      render: (_: boolean, record) => (
        <Switch
          checked={record.reviewed}
          onChange={(checked) => handleToggleReviewed(record, checked)}
          loading={updatingItemIds.includes(record.id)}
          size="small"
        />
      )
    },
    {
      title: t("watchlists:runs.detail.itemsColumns.source", "Source"),
      dataIndex: "source_id",
      key: "source_id",
      width: 90,
      render: (sourceId: number) => `#${sourceId}`
    },
    {
      title: t("watchlists:runs.detail.itemsColumns.published", "Published"),
      dataIndex: "published_at",
      key: "published_at",
      width: 150,
      render: (date: string | null) =>
        date ? (
          <span className="text-sm text-zinc-500">
            {formatRelativeTime(date, t)}
          </span>
        ) : (
          <span className="text-sm text-zinc-400">-</span>
        )
    },
    {
      title: t("watchlists:runs.detail.itemsColumns.created", "Ingested"),
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (date: string) => (
        <span className="text-sm text-zinc-500">
          {formatRelativeTime(date, t)}
        </span>
      )
    }
  ]

  const tabItems = [
    {
      key: "stats",
      label: t("watchlists:runs.detail.stats", "Statistics"),
      children: (
        <div className="space-y-4">
          {data && (
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Status">
                <StatusTag status={data.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {calculateDuration()}
              </Descriptions.Item>
              <Descriptions.Item label="Started">
                {data.started_at ? formatRelativeTime(data.started_at, t) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Finished">
                {data.finished_at ? formatRelativeTime(data.finished_at, t) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Items Found">
                {data.stats?.items_found ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Items Ingested">
                {data.stats?.items_ingested ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Items Filtered">
                {data.stats?.items_filtered ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Errors">
                {data.stats?.items_errored ?? 0}
              </Descriptions.Item>
            </Descriptions>
          )}

          {data?.error_msg && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2 text-red-600">
                Error Message
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300 font-mono">
                {data.error_msg}
              </div>
            </div>
          )}

          {data?.filter_tallies && Object.keys(data.filter_tallies).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Filter Matches</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.filter_tallies).map(([filter, count]) => (
                  <Tag key={filter}>
                    {filter}: {count}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      key: "logs",
      label: t("watchlists:runs.detail.logs", "Logs"),
      children: (
        <div>
          {data?.truncated && (
            <Alert
              type="warning"
              showIcon
              className="mb-3"
              message={t("watchlists:runs.detail.logsTruncated", "Logs truncated")}
              description={t("watchlists:runs.detail.logsTruncatedDesc", "Showing the most recent log output.")}
            />
          )}
          {data?.log_text ? (
            <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-xs max-h-96 overflow-auto whitespace-pre-wrap">
              {data.log_text}
            </pre>
          ) : data?.log_path ? (
            <div className="text-sm text-zinc-500">
              {t("watchlists:runs.detail.logsPath", "Logs stored at {{path}}", { path: data.log_path })}
            </div>
          ) : (
            <Empty
              description={t("watchlists:runs.detail.noLogs", "No logs available")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      )
    },
    {
      key: "items",
      label: t("watchlists:runs.detail.items", "Scraped Items"),
      children: (
        <div>
          {items.length === 0 && !itemsLoading ? (
            <Empty
              description={t("watchlists:runs.detail.noItems", "No items found")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              dataSource={items}
              columns={itemColumns}
              rowKey="id"
              loading={itemsLoading}
              pagination={{
                current: itemsPage,
                pageSize: itemsPageSize,
                total: itemsTotal,
                showSizeChanger: true,
                onChange: (page, pageSize) => {
                  setItemsPage(page)
                  if (pageSize !== itemsPageSize) {
                    setItemsPageSize(pageSize)
                  }
                }
              }}
              size="small"
            />
          )}
        </div>
      )
    }
  ]

  return (
    <Drawer
      title={t("watchlists:runs.detail.title", "Run Details")}
      placement="right"
      onClose={onClose}
      open={open}
      width={600}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : data ? (
        <Tabs items={tabItems} />
      ) : null}
    </Drawer>
  )
}
