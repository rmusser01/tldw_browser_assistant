import React from "react"
import { Tabs } from "antd"
import { useTranslation } from "react-i18next"
import { ReviewTab, CreateTab, ManageTab, ImportExportTab } from "./tabs"

/**
 * FlashcardsManager contains all the tabs and core flashcard logic.
 * Connection state is handled by FlashcardsWorkspace.
 */
export const FlashcardsManager: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const [activeTab, setActiveTab] = React.useState<string>("review")

  return (
    <div className="mx-auto max-w-6xl p-4">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "review",
            label: t("option:flashcards.review", { defaultValue: "Review" }),
            children: (
              <ReviewTab
                onNavigateToCreate={() => setActiveTab("create")}
                onNavigateToImport={() => setActiveTab("importExport")}
              />
            )
          },
          {
            key: "create",
            label: t("option:flashcards.create", { defaultValue: "Create" }),
            children: <CreateTab />
          },
          {
            key: "manage",
            label: t("option:flashcards.manage", { defaultValue: "Manage" }),
            children: (
              <ManageTab
                onNavigateToCreate={() => setActiveTab("create")}
                onNavigateToImport={() => setActiveTab("importExport")}
              />
            )
          },
          {
            key: "importExport",
            label: t("option:flashcards.importExport", {
              defaultValue: "Import / Export"
            }),
            children: <ImportExportTab />
          }
        ]}
      />
    </div>
  )
}

export default FlashcardsManager
