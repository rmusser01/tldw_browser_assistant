import React, { useEffect, useState } from "react"
import {
  Descriptions,
  Drawer,
  Empty,
  Spin,
  Tabs,
  Tag
} from "antd"
import { useTranslation } from "react-i18next"
import { getRunDetails } from "@/services/watchlists"
import type { RunDetailResponse } from "@/types/watchlists"
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

  const run = data?.run

  // Calculate duration
  const calculateDuration = (): string => {
    if (!run?.started_at) return "-"
    const start = new Date(run.started_at)
    const end = run.finished_at ? new Date(run.finished_at) : new Date()
    const durationMs = end.getTime() - start.getTime()

    if (durationMs < 1000) return "<1 second"
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)} seconds`
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)} minutes`
    return `${(durationMs / 3600000).toFixed(1)} hours`
  }

  const tabItems = [
    {
      key: "stats",
      label: t("watchlists:runs.detail.stats", "Statistics"),
      children: (
        <div className="space-y-4">
          {run && (
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Status">
                <StatusTag status={run.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {calculateDuration()}
              </Descriptions.Item>
              <Descriptions.Item label="Started">
                {run.started_at ? formatRelativeTime(run.started_at, t) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Finished">
                {run.finished_at ? formatRelativeTime(run.finished_at, t) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Items Found">
                {run.stats?.items_found ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Items Ingested">
                {run.stats?.items_ingested ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Items Filtered">
                {run.stats?.items_filtered ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Errors">
                {run.stats?.items_errored ?? 0}
              </Descriptions.Item>
            </Descriptions>
          )}

          {run?.error_msg && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2 text-red-600">
                Error Message
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300 font-mono">
                {run.error_msg}
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
          {data?.logs && data.logs.length > 0 ? (
            <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-xs max-h-96 overflow-auto">
              {data.logs.map((line, index) => (
                <div key={index} className="py-0.5 whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              description={t("watchlists:runs.detail.noLogs", "No logs available")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
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
