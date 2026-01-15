import React, { useCallback, useEffect, useState } from "react"
import {
  Button,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { Edit2, Play, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWatchlistsStore } from "@/store/watchlists"
import {
  deleteWatchlistJob,
  fetchWatchlistJobs,
  triggerWatchlistRun,
  updateWatchlistJob
} from "@/services/watchlists"
import type { WatchlistJob } from "@/types/watchlists"
import { formatRelativeTime } from "@/utils/dateFormatters"
import { CronDisplay, StatusTag } from "../shared"
import { JobFormModal } from "./JobFormModal"

export const JobsTab: React.FC = () => {
  const { t } = useTranslation(["watchlists", "common"])

  // Store state
  const jobs = useWatchlistsStore((s) => s.jobs)
  const jobsLoading = useWatchlistsStore((s) => s.jobsLoading)
  const jobsTotal = useWatchlistsStore((s) => s.jobsTotal)
  const jobsPage = useWatchlistsStore((s) => s.jobsPage)
  const jobsPageSize = useWatchlistsStore((s) => s.jobsPageSize)
  const jobFormOpen = useWatchlistsStore((s) => s.jobFormOpen)
  const jobFormEditId = useWatchlistsStore((s) => s.jobFormEditId)

  // Store actions
  const setJobs = useWatchlistsStore((s) => s.setJobs)
  const setJobsLoading = useWatchlistsStore((s) => s.setJobsLoading)
  const setJobsPage = useWatchlistsStore((s) => s.setJobsPage)
  const setJobsPageSize = useWatchlistsStore((s) => s.setJobsPageSize)
  const openJobForm = useWatchlistsStore((s) => s.openJobForm)
  const closeJobForm = useWatchlistsStore((s) => s.closeJobForm)
  const addJob = useWatchlistsStore((s) => s.addJob)
  const updateJobInList = useWatchlistsStore((s) => s.updateJobInList)
  const removeJob = useWatchlistsStore((s) => s.removeJob)
  const addRun = useWatchlistsStore((s) => s.addRun)

  // Local state
  const [triggeringJobId, setTriggeringJobId] = useState<number | null>(null)

  // Fetch jobs
  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const result = await fetchWatchlistJobs({
        limit: jobsPageSize,
        offset: (jobsPage - 1) * jobsPageSize
      })
      setJobs(result.items, result.total)
    } catch (err) {
      console.error("Failed to fetch jobs:", err)
      message.error(t("watchlists:jobs.fetchError", "Failed to load jobs"))
    } finally {
      setJobsLoading(false)
    }
  }, [jobsPage, jobsPageSize, setJobs, setJobsLoading, t])

  // Initial load
  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Handle toggle active
  const handleToggleActive = async (job: WatchlistJob) => {
    try {
      const updated = await updateWatchlistJob(job.id, { active: !job.active })
      updateJobInList(job.id, updated)
      message.success(
        job.active
          ? t("watchlists:jobs.disabled", "Job disabled")
          : t("watchlists:jobs.enabled", "Job enabled")
      )
    } catch (err) {
      console.error("Failed to toggle job:", err)
      message.error(t("watchlists:jobs.toggleError", "Failed to update job"))
    }
  }

  // Handle delete
  const handleDelete = async (jobId: number) => {
    try {
      await deleteWatchlistJob(jobId)
      removeJob(jobId)
      message.success(t("watchlists:jobs.deleted", "Job deleted"))
    } catch (err) {
      console.error("Failed to delete job:", err)
      message.error(t("watchlists:jobs.deleteError", "Failed to delete job"))
    }
  }

  // Handle manual run trigger
  const handleTriggerRun = async (jobId: number) => {
    setTriggeringJobId(jobId)
    try {
      const run = await triggerWatchlistRun(jobId)
      addRun(run)
      updateJobInList(jobId, { last_run_at: run.started_at || new Date().toISOString() })
      message.success(t("watchlists:jobs.runTriggered", "Run triggered"))
    } catch (err) {
      console.error("Failed to trigger run:", err)
      message.error(t("watchlists:jobs.runError", "Failed to trigger run"))
    } finally {
      setTriggeringJobId(null)
    }
  }

  // Get job for editing
  const editingJob = jobFormEditId
    ? jobs.find((j) => j.id === jobFormEditId)
    : undefined

  // Render scope summary
  const renderScope = (job: WatchlistJob) => {
    const parts: string[] = []
    if (job.scope.sources?.length) {
      parts.push(`${job.scope.sources.length} source${job.scope.sources.length > 1 ? "s" : ""}`)
    }
    if (job.scope.groups?.length) {
      parts.push(`${job.scope.groups.length} group${job.scope.groups.length > 1 ? "s" : ""}`)
    }
    if (job.scope.tags?.length) {
      parts.push(`${job.scope.tags.length} tag${job.scope.tags.length > 1 ? "s" : ""}`)
    }
    return parts.length > 0 ? parts.join(", ") : "No scope"
  }

  // Table columns
  const columns: ColumnsType<WatchlistJob> = [
    {
      title: t("watchlists:jobs.columns.name", "Name"),
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string, record) => (
        <div>
          <span className="font-medium">{name}</span>
          {record.description && (
            <div className="text-xs text-zinc-500 truncate">
              {record.description}
            </div>
          )}
        </div>
      )
    },
    {
      title: t("watchlists:jobs.columns.schedule", "Schedule"),
      dataIndex: "schedule_expr",
      key: "schedule_expr",
      width: 180,
      render: (schedule: string | null) => <CronDisplay expression={schedule} />
    },
    {
      title: t("watchlists:jobs.columns.scope", "Scope"),
      key: "scope",
      width: 150,
      render: (_, record) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {renderScope(record)}
        </span>
      )
    },
    {
      title: t("watchlists:jobs.columns.filters", "Filters"),
      key: "filters",
      width: 80,
      align: "center",
      render: (_, record) => {
        const count = record.job_filters?.filters?.length || 0
        return count > 0 ? (
          <Tag>{count}</Tag>
        ) : (
          <span className="text-zinc-400">-</span>
        )
      }
    },
    {
      title: t("watchlists:jobs.columns.lastRun", "Last Run"),
      dataIndex: "last_run_at",
      key: "last_run_at",
      width: 140,
      render: (date: string | null) =>
        date ? (
          <span className="text-sm text-zinc-500">
            {formatRelativeTime(date, t)}
          </span>
        ) : (
          <span className="text-sm text-zinc-400">
            {t("watchlists:jobs.never", "Never")}
          </span>
        )
    },
    {
      title: t("watchlists:jobs.columns.active", "Active"),
      dataIndex: "active",
      key: "active",
      width: 80,
      align: "center",
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          size="small"
          onChange={() => handleToggleActive(record)}
        />
      )
    },
    {
      title: t("watchlists:jobs.columns.actions", "Actions"),
      key: "actions",
      width: 130,
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t("watchlists:jobs.runNow", "Run Now")}>
            <Button
              type="text"
              size="small"
              icon={<Play className="h-4 w-4" />}
              onClick={() => handleTriggerRun(record.id)}
              loading={triggeringJobId === record.id}
              disabled={!record.active}
            />
          </Tooltip>
          <Tooltip title={t("common:edit", "Edit")}>
            <Button
              type="text"
              size="small"
              icon={<Edit2 className="h-4 w-4" />}
              onClick={() => openJobForm(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title={t("watchlists:jobs.deleteConfirm", "Delete this job?")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common:yes", "Yes")}
            cancelText={t("common:no", "No")}
          >
            <Tooltip title={t("common:delete", "Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 className="h-4 w-4" />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {t("watchlists:jobs.description", "Create scheduled jobs to automatically fetch and process content from your sources.")}
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={loadJobs}
            loading={jobsLoading}
          >
            {t("common:refresh", "Refresh")}
          </Button>
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => openJobForm()}
          >
            {t("watchlists:jobs.addJob", "Add Job")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table
        dataSource={Array.isArray(jobs) ? jobs : []}
        columns={columns}
        rowKey="id"
        loading={jobsLoading}
        pagination={{
          current: jobsPage,
          pageSize: jobsPageSize,
          total: jobsTotal,
          showSizeChanger: true,
          showTotal: (total) =>
            t("watchlists:jobs.totalItems", "{{total}} jobs", { total }),
          onChange: (page, pageSize) => {
            setJobsPage(page)
            if (pageSize !== jobsPageSize) {
              setJobsPageSize(pageSize)
            }
          }
        }}
        size="middle"
        scroll={{ x: 900 }}
      />

      {/* Job Form Modal */}
      <JobFormModal
        open={jobFormOpen}
        onClose={closeJobForm}
        initialValues={editingJob}
        onSuccess={() => {
          closeJobForm()
          loadJobs()
        }}
      />
    </div>
  )
}
