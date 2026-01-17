import React, { useEffect } from "react"
import { Alert, Empty, Tabs } from "antd"
import type { TabsProps } from "antd"
import { BookOpen, Highlighter, FileText, ArrowLeftRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useServerOnline } from "@/hooks/useServerOnline"
import { PageShell } from "@/components/Common/PageShell"
import { useCollectionsStore } from "@/store/collections"
import type { CollectionsTab } from "@/types/collections"
import { ReadingItemsList } from "./ReadingList/ReadingItemsList"
import { HighlightsList } from "./Highlights/HighlightsList"
import { TemplatesList } from "./Templates/TemplatesList"
import { ImportExportPanel } from "./ImportExport/ImportExportPanel"

/**
 * CollectionsPlaygroundPage
 *
 * Main container for the Collections feature.
 * Provides a tabbed interface for Reading List, Highlights, Templates, and Import/Export.
 */
export const CollectionsPlaygroundPage: React.FC = () => {
  const { t } = useTranslation(["collections", "common"])
  const isOnline = useServerOnline()

  const activeTab = useCollectionsStore((s) => s.activeTab)
  const setActiveTab = useCollectionsStore((s) => s.setActiveTab)
  const resetStore = useCollectionsStore((s) => s.resetStore)

  // Reset store on unmount
  useEffect(() => {
    return () => {
      resetStore()
    }
  }, [resetStore])

  const tabItems: TabsProps["items"] = [
    {
      key: "reading",
      label: (
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          {t("collections:tabs.reading", "Reading List")}
        </span>
      ),
      children: <ReadingItemsList />
    },
    {
      key: "highlights",
      label: (
        <span className="flex items-center gap-2">
          <Highlighter className="h-4 w-4" />
          {t("collections:tabs.highlights", "Highlights")}
        </span>
      ),
      children: <HighlightsList />
    },
    {
      key: "templates",
      label: (
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t("collections:tabs.templates", "Templates")}
        </span>
      ),
      children: <TemplatesList />
    },
    {
      key: "import-export",
      label: (
        <span className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          {t("collections:tabs.importExport", "Import/Export")}
        </span>
      ),
      children: <ImportExportPanel />
    }
  ]

  if (!isOnline) {
    return (
      <PageShell className="py-6" maxWidthClassName="max-w-6xl">
        <Empty
          description={t(
            "collections:offline",
            "Server is offline. Please connect to use Collections."
          )}
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="py-6" maxWidthClassName="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("collections:title", "Collections")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t(
            "collections:description",
            "Save articles, create highlights, manage templates, and import/export your reading list."
          )}
        </p>
      </div>

      <Alert
        message={t("collections:betaNotice", "Beta Feature")}
        description={t(
          "collections:betaDescription",
          "Collections is currently in beta. Some features may require backend support."
        )}
        type="info"
        showIcon
        className="mb-6"
      />

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as CollectionsTab)}
        items={tabItems}
        className="collections-tabs"
      />
    </PageShell>
  )
}

export default CollectionsPlaygroundPage
