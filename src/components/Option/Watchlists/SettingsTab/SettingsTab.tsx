import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Select,
  Skeleton,
  Switch,
  Table,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { Clock, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWatchlistsStore } from "@/store/watchlists"
import {
  fetchClaimClusters,
  fetchJobClaimClusters,
  fetchWatchlistJobs,
  getWatchlistSettings,
  subscribeJobToCluster,
  unsubscribeJobFromCluster
} from "@/services/watchlists"
import type { ClaimCluster, WatchlistJob, WatchlistClusterSubscription } from "@/types/watchlists"
import { humanizeMilliseconds } from "@/utils/humanize-milliseconds"
import { formatRelativeTime } from "@/utils/dateFormatters"

export const SettingsTab: React.FC = () => {
  const { t } = useTranslation(["watchlists", "common"])

  // Store state
  const settings = useWatchlistsStore((s) => s.settings)
  const settingsLoading = useWatchlistsStore((s) => s.settingsLoading)

  // Store actions
  const setSettings = useWatchlistsStore((s) => s.setSettings)
  const setSettingsLoading = useWatchlistsStore((s) => s.setSettingsLoading)

  const [jobs, setJobs] = useState<WatchlistJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [clusters, setClusters] = useState<ClaimCluster[]>([])
  const [clustersLoading, setClustersLoading] = useState(false)
  const [clustersError, setClustersError] = useState<string | null>(null)
  const [clusterSearch, setClusterSearch] = useState("")
  const [jobClusters, setJobClusters] = useState<WatchlistClusterSubscription[]>([])
  const [clusterUpdates, setClusterUpdates] = useState<number[]>([])

  // Fetch settings
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const result = await getWatchlistSettings()
      setSettings(result)
    } catch (err) {
      console.error("Failed to fetch settings:", err)
      message.error(t("watchlists:settings.fetchError", "Failed to load settings"))
    } finally {
      setSettingsLoading(false)
    }
  }, [setSettings, setSettingsLoading, t])

  // Initial load
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const result = await fetchWatchlistJobs({ page: 1, size: 200 })
      const items = Array.isArray(result.items) ? result.items : []
      setJobs(items)
      setSelectedJobId((prev) => (prev == null && items.length > 0 ? items[0].id : prev))
    } catch (err) {
      console.error("Failed to fetch jobs:", err)
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }, [])

  const loadClusters = useCallback(async () => {
    setClustersLoading(true)
    setClustersError(null)
    try {
      const result = await fetchClaimClusters({
        limit: 200,
        offset: 0,
        keyword: clusterSearch || undefined
      })
      setClusters(Array.isArray(result) ? result : [])
    } catch (err: any) {
      console.error("Failed to fetch claim clusters:", err)
      setClusters([])
      setClustersError(
        err?.message || t("watchlists:settings.clusters.fetchError", "Failed to load claim clusters")
      )
    } finally {
      setClustersLoading(false)
    }
  }, [clusterSearch, t])

  const loadJobClusters = useCallback(async () => {
    if (!selectedJobId) {
      setJobClusters([])
      return
    }
    try {
      const result = await fetchJobClaimClusters(selectedJobId)
      setJobClusters(Array.isArray(result) ? result : [])
    } catch (err) {
      console.error("Failed to fetch watchlist clusters:", err)
      setJobClusters([])
    }
  }, [selectedJobId])

  useEffect(() => {
    loadJobs()
    loadClusters()
  }, [loadClusters, loadJobs])

  useEffect(() => {
    loadJobClusters()
  }, [loadJobClusters])

  const subscribedClusterIds = useMemo(() => {
    return new Set(jobClusters.map((entry) => entry.cluster_id))
  }, [jobClusters])

  const handleToggleCluster = async (cluster: ClaimCluster, enabled: boolean) => {
    if (!selectedJobId || clusterUpdates.includes(cluster.id)) return
    setClusterUpdates((prev) => [...prev, cluster.id])
    try {
      if (enabled) {
        await subscribeJobToCluster(selectedJobId, cluster.id)
        setJobClusters((prev) => [...prev, { cluster_id: cluster.id }])
      } else {
        await unsubscribeJobFromCluster(selectedJobId, cluster.id)
        setJobClusters((prev) => prev.filter((entry) => entry.cluster_id !== cluster.id))
      }
    } catch (err) {
      console.error("Failed to update cluster subscription:", err)
      message.error(t("watchlists:settings.clusters.updateError", "Failed to update cluster subscription"))
    } finally {
      setClusterUpdates((prev) => prev.filter((id) => id !== cluster.id))
    }
  }

  const clusterColumns: ColumnsType<ClaimCluster> = [
    {
      title: t("watchlists:settings.clusters.columns.cluster", "Cluster"),
      dataIndex: "id",
      key: "id",
      render: (_: number, record) => (
        <div className="space-y-1">
          <div className="font-medium text-sm">
            {record.summary || record.canonical_claim_text || `#${record.id}`}
          </div>
          <div className="text-xs text-zinc-500">
            {t("watchlists:settings.clusters.idLabel", "ID {{id}}", { id: record.id })}
          </div>
        </div>
      )
    },
    {
      title: t("watchlists:settings.clusters.columns.members", "Members"),
      dataIndex: "member_count",
      key: "member_count",
      width: 90,
      render: (count: number | undefined) => count ?? "-"
    },
    {
      title: t("watchlists:settings.clusters.columns.updated", "Updated"),
      dataIndex: "updated_at",
      key: "updated_at",
      width: 140,
      render: (date: string | null | undefined) =>
        date ? (
          <span className="text-sm text-zinc-500">
            {formatRelativeTime(date, t)}
          </span>
        ) : (
          <span className="text-sm text-zinc-400">-</span>
        )
    },
    {
      title: t("watchlists:settings.clusters.columns.subscribed", "Subscribed"),
      key: "subscribed",
      width: 120,
      render: (_: unknown, record) => (
        <Switch
          size="small"
          checked={subscribedClusterIds.has(record.id)}
          onChange={(checked) => handleToggleCluster(record, checked)}
          disabled={!selectedJobId}
          loading={clusterUpdates.includes(record.id)}
        />
      )
    }
  ]

  const formatSeconds = (seconds?: number | null): string => {
    if (seconds == null) return "-"
    return humanizeMilliseconds(seconds * 1000)
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => {
            loadSettings()
            loadJobs()
            loadClusters()
            loadJobClusters()
          }}
          loading={settingsLoading}
        >
          {t("common:refresh", "Refresh")}
        </Button>
      </div>

      {/* Description */}
      <div className="text-sm text-zinc-500">
        {t("watchlists:settings.description", "Server configuration and retention settings for the watchlists module.")}
      </div>

      {settingsLoading && !settings ? (
        <Card>
          <Skeleton active />
        </Card>
      ) : settings ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* TTL Settings */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("watchlists:settings.ttl.title", "Output Retention")}
              </span>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t("watchlists:settings.ttl.defaultOutput", "Default Output TTL")}>
                {formatSeconds(settings.default_output_ttl_seconds)}
              </Descriptions.Item>
              <Descriptions.Item label={t("watchlists:settings.ttl.temporaryOutput", "Temporary Output TTL")}>
                {formatSeconds(settings.temporary_output_ttl_seconds)}
              </Descriptions.Item>
            </Descriptions>
            <Alert
              className="mt-4"
              message={t("watchlists:settings.ttl.note", "TTL values are configured on the server.")}
              type="info"
              showIcon
            />
          </Card>

          {/* Claim Clusters */}
          <Card
            title={t("watchlists:settings.clusters.title", "Claim Clusters")}
            className="md:col-span-2"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  placeholder={t("watchlists:settings.clusters.jobPlaceholder", "Select job")}
                  value={selectedJobId ?? undefined}
                  onChange={(value) => setSelectedJobId(value ?? null)}
                  loading={jobsLoading}
                  allowClear
                  className="w-56"
                  options={jobs.map((job) => ({ label: job.name, value: job.id }))}
                />
                <Input.Search
                  placeholder={t("watchlists:settings.clusters.searchPlaceholder", "Search clusters")}
                  value={clusterSearch}
                  onChange={(e) => setClusterSearch(e.target.value)}
                  onSearch={loadClusters}
                  allowClear
                  className="w-64"
                />
                <Button
                  icon={<RefreshCw className="h-4 w-4" />}
                  onClick={loadClusters}
                  loading={clustersLoading}
                >
                  {t("common:refresh", "Refresh")}
                </Button>
              </div>

              {!selectedJobId && (
                <Alert
                  type="info"
                  showIcon
                  message={t(
                    "watchlists:settings.clusters.selectJob",
                    "Select a job to manage cluster subscriptions."
                  )}
                />
              )}

              {clustersError ? (
                <Alert type="warning" showIcon message={clustersError} />
              ) : clusters.length === 0 && !clustersLoading ? (
                <Empty
                  description={t("watchlists:settings.clusters.empty", "No clusters found")}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Table
                  dataSource={clusters}
                  columns={clusterColumns}
                  rowKey="id"
                  loading={clustersLoading}
                  pagination={{ pageSize: 6 }}
                  size="small"
                />
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Alert
          message={t("watchlists:settings.unavailable", "Settings unavailable")}
          description={t("watchlists:settings.unavailableDesc", "Could not load server settings. Make sure the server is running.")}
          type="warning"
          showIcon
        />
      )}
    </div>
  )
}
