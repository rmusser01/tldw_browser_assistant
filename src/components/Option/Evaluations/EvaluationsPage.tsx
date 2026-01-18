/**
 * EvaluationsPage
 *
 * Main container for the Evaluations module.
 * Provides a tabbed interface for managing evaluations, runs, datasets, webhooks, and history.
 */

import React, { useEffect } from "react"
import { Alert, Tabs } from "antd"
import type { TabsProps } from "antd"
import { BarChart3, Database, History, Play, Webhook } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import ConnectFeatureBanner from "@/components/Common/ConnectFeatureBanner"
import { PageShell } from "@/components/Common/PageShell"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useEvaluationsStore, type EvaluationsTab as EvaluationsTabType } from "@/store/evaluations"
import { DatasetsTab } from "./tabs/DatasetsTab"
import { EvaluationsTab } from "./tabs/EvaluationsTab"
import { HistoryTab } from "./tabs/HistoryTab"
import { RunsTab } from "./tabs/RunsTab"
import { WebhooksTab } from "./tabs/WebhooksTab"

export const EvaluationsPage: React.FC = () => {
  const { t } = useTranslation(["evaluations", "common"])
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isOnline = useServerOnline()
  const tourActive = searchParams.get("tour") === "1"

  const activeTab = useEvaluationsStore((s) => s.activeTab)
  const setActiveTab = useEvaluationsStore((s) => s.setActiveTab)
  const setSelectedEvalId = useEvaluationsStore((s) => s.setSelectedEvalId)
  const setSelectedRunId = useEvaluationsStore((s) => s.setSelectedRunId)
  const resetStore = useEvaluationsStore((s) => s.resetStore)

  // Sync URL params to store on mount
  useEffect(() => {
    const tabFromQuery = searchParams.get("tab") as EvaluationsTabType | null
    const evalIdFromQuery = searchParams.get("evaluationId")
    const runIdFromQuery = searchParams.get("runId")

    if (
      tabFromQuery &&
      ["evaluations", "runs", "datasets", "webhooks", "history"].includes(
        tabFromQuery
      )
    ) {
      setActiveTab(tabFromQuery)
    }
    if (evalIdFromQuery) {
      setSelectedEvalId(evalIdFromQuery)
    }
    if (runIdFromQuery) {
      setSelectedRunId(runIdFromQuery)
    }
  }, [searchParams, setActiveTab, setSelectedEvalId, setSelectedRunId])

  // Reset store on unmount
  useEffect(() => {
    return () => {
      resetStore()
    }
  }, [resetStore])

  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    if (tourActive) {
      root.dataset.evaluationsTour = "on"
    } else {
      delete root.dataset.evaluationsTour
    }
    return () => {
      delete root.dataset.evaluationsTour
    }
  }, [tourActive])

  // Sync store to URL params
  const handleTabChange = (key: string) => {
    const tab = key as EvaluationsTabType
    setActiveTab(tab)

    const params = new URLSearchParams(searchParams)
    params.set("tab", tab)
    navigate(`?${params.toString()}`, { replace: true })
  }

  const tabItems: TabsProps["items"] = [
    {
      key: "evaluations",
      label: (
        <span className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {t("evaluations:tabEvaluations", "Evaluations")}
        </span>
      ),
      children: <EvaluationsTab />
    },
    {
      key: "runs",
      label: (
        <span className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          {t("evaluations:tabRuns", "Runs")}
        </span>
      ),
      children: <RunsTab />
    },
    {
      key: "datasets",
      label: (
        <span className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          {t("evaluations:tabDatasets", "Datasets")}
        </span>
      ),
      children: <DatasetsTab />
    },
    {
      key: "webhooks",
      label: (
        <span className="flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          {t("evaluations:tabWebhooks", "Webhooks")}
        </span>
      ),
      children: <WebhooksTab />
    },
    {
      key: "history",
      label: (
        <span className="flex items-center gap-2">
          <History className="h-4 w-4" />
          {t("evaluations:tabHistory", "History")}
        </span>
      ),
      children: <HistoryTab />
    }
  ]

  if (!isOnline) {
    return (
      <ConnectFeatureBanner
        title={t("evaluations:emptyConnectTitle", {
          defaultValue: "Connect to use Evaluations"
        })}
        description={t("evaluations:emptyConnectDescription", {
          defaultValue:
            "To create and run evaluations, first connect to your tldw server."
        })}
        examples={[
          t("evaluations:emptyConnectExample1", {
            defaultValue:
              "Open Settings → tldw server to add your server URL and API key."
          }),
          t("evaluations:emptyConnectExample2", {
            defaultValue:
              "Once connected, you can define evaluations and inspect metrics here."
          })
        ]}
      />
    )
  }

  return (
    <PageShell className="py-6" maxWidthClassName="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("evaluations:title", "Evaluations")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t(
            "evaluations:subtitle",
            "Define evaluations against your tldw server and inspect recent runs."
          )}
        </p>
      </div>

      <Alert
        message={t("evaluations:betaNotice", "Beta Feature")}
        description={t(
          "evaluations:betaDescription",
          "Evaluations is currently in beta. Some features may be incomplete or change."
        )}
        type="info"
        showIcon
        className="mb-6"
      />

      {tourActive && (
        <Alert
          type="info"
          showIcon
          message={t("evaluations:tourTitle", {
            defaultValue: "Evaluations tour"
          })}
          description={t("evaluations:tourDescription", {
            defaultValue:
              "Tour mode highlights key actions. Remove ?tour=1 from the URL to exit."
          })}
          className="mb-6"
        />
      )}

      {tourActive && (
        <style>{`
          [data-evaluations-tour="on"] [data-eval-tour] {
            outline: 2px dashed rgba(59, 130, 246, 0.8);
            outline-offset: 4px;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
            border-radius: 8px;
          }
        `}</style>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        className="evaluations-tabs"
      />
    </PageShell>
  )
}

export default EvaluationsPage
