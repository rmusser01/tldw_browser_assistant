import React, { useCallback, useEffect, useState } from "react"
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Skeleton,
  Space,
  Statistic,
  message
} from "antd"
import { Clock, Database, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWatchlistsStore } from "@/store/watchlists"
import { getWatchlistSettings } from "@/services/watchlists"
import type { WatchlistSettings } from "@/types/watchlists"

export const SettingsTab: React.FC = () => {
  const { t } = useTranslation(["watchlists", "common"])

  // Store state
  const settings = useWatchlistsStore((s) => s.settings)
  const settingsLoading = useWatchlistsStore((s) => s.settingsLoading)

  // Store actions
  const setSettings = useWatchlistsStore((s) => s.setSettings)
  const setSettingsLoading = useWatchlistsStore((s) => s.setSettingsLoading)

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

  // Format duration for display
  const formatTtl = (hours: number | undefined): string => {
    if (!hours) return "-"
    if (hours < 24) return `${hours} hours`
    const days = Math.round(hours / 24)
    return `${days} days`
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={loadSettings}
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
                {t("watchlists:settings.ttl.title", "Data Retention")}
              </span>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t("watchlists:settings.ttl.items", "Items TTL")}>
                {formatTtl(settings.items_ttl_hours)}
              </Descriptions.Item>
              <Descriptions.Item label={t("watchlists:settings.ttl.runs", "Runs TTL")}>
                {formatTtl(settings.runs_ttl_hours)}
              </Descriptions.Item>
              <Descriptions.Item label={t("watchlists:settings.ttl.outputs", "Outputs TTL")}>
                {formatTtl(settings.outputs_ttl_hours)}
              </Descriptions.Item>
            </Descriptions>
            <Alert
              className="mt-4"
              message={t("watchlists:settings.ttl.note", "TTL values are configured on the server.")}
              type="info"
              showIcon
            />
          </Card>

          {/* Database Stats */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                {t("watchlists:settings.stats.title", "Database Statistics")}
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <Statistic
                title={t("watchlists:settings.stats.sources", "Sources")}
                value={settings.stats?.sources_count ?? "-"}
              />
              <Statistic
                title={t("watchlists:settings.stats.jobs", "Jobs")}
                value={settings.stats?.jobs_count ?? "-"}
              />
              <Statistic
                title={t("watchlists:settings.stats.runs", "Total Runs")}
                value={settings.stats?.runs_count ?? "-"}
              />
              <Statistic
                title={t("watchlists:settings.stats.items", "Total Items")}
                value={settings.stats?.items_count ?? "-"}
              />
            </div>
          </Card>

          {/* Scheduler Status */}
          <Card
            title={t("watchlists:settings.scheduler.title", "Scheduler")}
            className="md:col-span-2"
          >
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t("watchlists:settings.scheduler.status", "Status")}>
                <span className={settings.scheduler_running ? "text-green-600" : "text-red-600"}>
                  {settings.scheduler_running
                    ? t("watchlists:settings.scheduler.running", "Running")
                    : t("watchlists:settings.scheduler.stopped", "Stopped")}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label={t("watchlists:settings.scheduler.pendingJobs", "Pending Jobs")}>
                {settings.pending_jobs_count ?? 0}
              </Descriptions.Item>
            </Descriptions>
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
