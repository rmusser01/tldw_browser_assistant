import React, { useEffect } from "react"
import { Alert, Empty, Tabs } from "antd"
import type { TabsProps } from "antd"
import { Table2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useServerOnline } from "@/hooks/useServerOnline"
import { PageShell } from "@/components/Common/PageShell"
import { useDataTablesStore } from "@/store/data-tables"
import { consumeDataTablesPrefill } from "@/utils/data-tables-prefill"
import { DataTablesList } from "./DataTablesList"
import { CreateTableWizard } from "./CreateTableWizard"

/**
 * DataTablesPage
 *
 * Main container for the Data Tables Studio feature.
 * Provides a tabbed interface for viewing saved tables and creating new ones.
 */
export const DataTablesPage: React.FC = () => {
  const { t } = useTranslation(["dataTables", "common"])
  const isOnline = useServerOnline()

  const activeTab = useDataTablesStore((s) => s.activeTab)
  const setActiveTab = useDataTablesStore((s) => s.setActiveTab)
  const addSource = useDataTablesStore((s) => s.addSource)
  const setWizardStep = useDataTablesStore((s) => s.setWizardStep)
  const setGeneratedTable = useDataTablesStore((s) => s.setGeneratedTable)
  const resetStore = useDataTablesStore((s) => s.resetStore)
  const resetWizard = useDataTablesStore((s) => s.resetWizard)

  // Reset store on unmount
  useEffect(() => {
    return () => {
      resetStore()
    }
  }, [resetStore])

  useEffect(() => {
    let isActive = true
    const applyPrefill = async () => {
      const payload = await consumeDataTablesPrefill()
      if (!payload || !isActive) return

      resetWizard()

      if (payload.kind === "chat") {
        addSource(payload.source)
        setWizardStep("prompt")
        return
      }

      if (payload.kind === "artifact") {
        if (payload.source) {
          addSource(payload.source)
        }
        setGeneratedTable(payload.table)
        setWizardStep("preview")
      }
    }

    void applyPrefill()

    return () => {
      isActive = false
    }
  }, [addSource, resetWizard, setGeneratedTable, setWizardStep])

  const tabItems: TabsProps["items"] = [
    {
      key: "tables",
      label: (
        <span className="flex items-center gap-2">
          <Table2 className="h-4 w-4" />
          {t("dataTables:tabs.tables", "My Tables")}
        </span>
      ),
      children: <DataTablesList />
    },
    {
      key: "create",
      label: (
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("dataTables:tabs.create", "Create Table")}
        </span>
      ),
      children: <CreateTableWizard />
    }
  ]

  if (!isOnline) {
    return (
      <PageShell className="py-6" maxWidthClassName="max-w-6xl">
        <Empty
          description={t(
            "dataTables:offline",
            "Server is offline. Please connect to use Data Tables."
          )}
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="py-6" maxWidthClassName="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("dataTables:title", "Data Tables Studio")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t(
            "dataTables:dataTablesDescription",
            "Generate structured tables from your chats, documents, and knowledge base using natural language prompts."
          )}
        </p>
      </div>

      <Alert
        message={t("dataTables:betaNotice", "Beta Feature")}
        description={t(
          "dataTables:betaDescription",
          "Data Tables is currently in beta. Table generation requires backend support."
        )}
        type="info"
        showIcon
        className="mb-6"
      />

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        items={tabItems}
        className="data-tables-tabs"
      />
    </PageShell>
  )
}

export default DataTablesPage
