import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Button,
  Progress,
  Select,
  Space,
  Table,
  Tooltip,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { Eye, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWatchlistsStore } from "@/store/watchlists"
import {
  fetchJobRuns,
  fetchWatchlistJobs,
  fetchWatchlistRuns
} from "@/services/watchlists"
import type { WatchlistJob, WatchlistRun } from "@/types/watchlists"
import { formatRelativeTime } from "@/utils/dateFormatters"
import { StatusTag } from "../shared"
import { RunDetailDrawer } from "./RunDetailDrawer"

const POLL_INTERVAL_MS = 5000

export const RunsTab: React.FC = () => {
  const { t } = useTranslation(["watchlists", "common"])

  // Store state
  const runs = useWatchlistsStore((s) => s.runs)
  const runsLoading = useWatchlistsStore((s) => s.runsLoading)
  const runsTotal = useWatchlistsStore((s) => s.runsTotal)
  const runsPage = useWatchlistsStore((s) => s.runsPage)
  const runsPageSize = useWatchlistsStore((s) => s.runsPageSize)
  const runsJobFilter = useWatchlistsStore((s) => s.runsJobFilter)
  const runsStatusFilter = useWatchlistsStore((s) => s.runsStatusFilter)
  const pollingActive = useWatchlistsStore((s) => s.pollingActive)
  const runDetailOpen = useWatchlistsStore((s) => s.runDetailOpen)
  const selectedRunId = useWatchlistsStore((s) => s.selectedRunId)
  const [jobs, setJobs] = useState<WatchlistJob[]>([])

  // Store actions
  const setRuns = useWatchlistsStore((s) => s.setRuns)
  const setRunsLoading = useWatchlistsStore((s) => s.setRunsLoading)
  const setRunsPage = useWatchlistsStore((s) => s.setRunsPage)
  const setRunsPageSize = useWatchlistsStore((s) => s.setRunsPageSize)
  const setRunsJobFilter = useWatchlistsStore((s) => s.setRunsJobFilter)
  const setRunsStatusFilter = useWatchlistsStore((s) => s.setRunsStatusFilter)
  const setPollingActive = useWatchlistsStore((s) => s.setPollingActive)
  const openRunDetail = useWatchlistsStore((s) => s.openRunDetail)
  const closeRunDetail = useWatchlistsStore((s) => s.closeRunDetail)

  // Refs for polling
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch runs
  const loadRuns = useCallback(async (showLoading = true) => {
    if (showLoading) setRunsLoading(true)
    try {
      const useClientFilter = Boolean(runsJobFilter && runsStatusFilter)
      let result
      if (runsJobFilter) {
        result = await fetchJobRuns(runsJobFilter, {
          page: useClientFilter ? 1 : runsPage,
          size: useClientFilter ? 200 : runsPageSize
        })
      } else {
        result = await fetchWatchlistRuns({
          q: runsStatusFilter || undefined,
          page: runsPage,
          size: runsPageSize
        })
      }

      let items = result.items || []
      if (useClientFilter && runsStatusFilter) {
        items = items.filter((run) => run.status === runsStatusFilter)
      }

      const total = useClientFilter ? items.length : result.total
      const pagedItems = useClientFilter
        ? items.slice((runsPage - 1) * runsPageSize, runsPage * runsPageSize)
        : items

      setRuns(pagedItems, total)

      // Check if any runs are still running
      const hasRunning = items.some((r) => r.status === "running" || r.status === "pending")
      setPollingActive(hasRunning)
    } catch (err) {
      console.error("Failed to fetch runs:", err)
      if (showLoading) {
        message.error(t("watchlists:runs.fetchError", "Failed to load runs"))
      }
    } finally {
      if (showLoading) setRunsLoading(false)
    }
  }, [
    runsJobFilter,
    runsStatusFilter,
    runsPage,
    runsPageSize,
    setRuns,
    setRunsLoading,
    setPollingActive,
    t
  ])

  // Load jobs for filter dropdown
  const loadJobs = useCallback(async () => {
    try {
      const result = await fetchWatchlistJobs({ page: 1, size: 200 })
      setJobs(result.items || [])
    } catch (err) {
      console.error("Failed to fetch jobs:", err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadRuns()
    loadJobs()
  }, [loadRuns, loadJobs])

  // Polling for active runs
  useEffect(() => {
    if (pollingActive) {
      pollIntervalRef.current = setInterval(() => {
        loadRuns(false)
      }, POLL_INTERVAL_MS)
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [pollingActive, loadRuns])

  // Get job name by ID
  const getJobName = useCallback(
    (jobId: number) => {
      const job = jobs.find((j) => j.id === jobId)
      return job?.name || `Job #${jobId}`
    },
    [jobs]
  )

  // Calculate duration
  const calculateDuration = (run: WatchlistRun): string => {
    if (!run.started_at) return "-"
    const start = new Date(run.started_at)
    const end = run.finished_at ? new Date(run.finished_at) : new Date()
    const durationMs = end.getTime() - start.getTime()

    if (durationMs < 1000) return "<1s"
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`
    return `${Math.round(durationMs / 3600000)}h`
  }

  // Table columns
  const columns: ColumnsType<WatchlistRun> = [
    {
      title: t("watchlists:runs.columns.job", "Job"),
      key: "job",
      width: 200,
      ellipsis: true,
      render: (_, record) => (
        <span className="font-medium">{getJobName(record.job_id)}</span>
      )
    },
    {
      title: t("watchlists:runs.columns.status", "Status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string, record) => (
        <div className="flex items-center gap-2">
          <StatusTag status={status} />
          {status === "running" && (
            <Progress
              percent={Math.round(
                ((record.stats?.items_ingested || 0) /
                  Math.max(record.stats?.items_found || 1, 1)) *
                  100
              )}
              size="small"
              showInfo={false}
              className="w-16"
            />
          )}
        </div>
      )
    },
    {
      title: t("watchlists:runs.columns.started", "Started"),
      dataIndex: "started_at",
      key: "started_at",
      width: 140,
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
      title: t("watchlists:runs.columns.duration", "Duration"),
      key: "duration",
      width: 80,
      render: (_, record) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {calculateDuration(record)}
        </span>
      )
    },
    {
      title: t("watchlists:runs.columns.itemsFound", "Found"),
      key: "items_found",
      width: 80,
      align: "center",
      render: (_, record) => (
        <span className="text-sm">
          {record.stats?.items_found ?? "-"}
        </span>
      )
    },
    {
      title: t("watchlists:runs.columns.itemsProcessed", "Processed"),
      key: "items_processed",
      width: 100,
      align: "center",
      render: (_, record) => (
        <span className="text-sm">
          {record.stats?.items_ingested ?? "-"}
        </span>
      )
    },
    {
      title: t("watchlists:runs.columns.actions", "Actions"),
      key: "actions",
      width: 80,
      align: "center",
      render: (_, record) => (
        <Tooltip title={t("watchlists:runs.viewDetails", "View Details")}>
          <Button
            type="text"
            size="small"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => openRunDetail(record.id)}
          />
        </Tooltip>
      )
    }
  ]

  // Status options for filter
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "running", label: "Running" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" }
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            placeholder={t("watchlists:runs.filterByJob", "Filter by job")}
            value={runsJobFilter}
            onChange={setRunsJobFilter}
            allowClear
            className="w-48"
            options={jobs.map((j) => ({
              label: j.name,
              value: j.id
            }))}
          />
          <Select
            placeholder={t("watchlists:runs.filterByStatus", "Filter by status")}
            value={runsStatusFilter}
            onChange={setRunsStatusFilter}
            allowClear
            className="w-36"
            options={statusOptions}
          />
        </div>
        <div className="flex items-center gap-2">
          {pollingActive && (
            <span className="text-sm text-blue-500 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              Auto-refreshing
            </span>
          )}
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => loadRuns()}
            loading={runsLoading}
          >
            {t("common:refresh", "Refresh")}
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="text-sm text-zinc-500">
        {t("watchlists:runs.description", "View execution history and logs for your watchlist jobs.")}
      </div>

      {/* Table */}
      <Table
        dataSource={Array.isArray(runs) ? runs : []}
        columns={columns}
        rowKey="id"
        loading={runsLoading}
        pagination={{
          current: runsPage,
          pageSize: runsPageSize,
          total: runsTotal,
          showSizeChanger: true,
          showTotal: (total) =>
            t("watchlists:runs.totalItems", "{{total}} runs", { total }),
          onChange: (page, pageSize) => {
            setRunsPage(page)
            if (pageSize !== runsPageSize) {
              setRunsPageSize(pageSize)
            }
          }
        }}
        size="middle"
        scroll={{ x: 800 }}
      />

      {/* Run Detail Drawer */}
      <RunDetailDrawer
        runId={selectedRunId}
        open={runDetailOpen}
        onClose={closeRunDetail}
      />
    </div>
  )
}
