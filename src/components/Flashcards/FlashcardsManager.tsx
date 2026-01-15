import React from "react"
import { Tabs } from "antd"
import { useTranslation } from "react-i18next"
import { ReviewTab, ManageTab, ImportExportTab } from "./tabs"
import type { Flashcard } from "@/services/flashcards"

/**
 * FlashcardsManager contains all the tabs and core flashcard logic.
 * Connection state is handled by FlashcardsWorkspace.
 *
 * Structure: Review | Cards | Import/Export
 * - Review: Spaced repetition study loop
 * - Cards: Browse, filter, create, edit, bulk operations
 * - Import/Export: CSV/APKG import and export
 */
export const FlashcardsManager: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const [activeTab, setActiveTab] = React.useState<string>("review")
  const [reviewDeckId, setReviewDeckId] = React.useState<number | null | undefined>(undefined)
  const [reviewOverrideCard, setReviewOverrideCard] = React.useState<Flashcard | null>(null)

  const handleReviewCard = React.useCallback(
    (card: Flashcard) => {
      setReviewDeckId(card.deck_id ?? undefined)
      setReviewOverrideCard(card)
      setActiveTab("review")
    },
    [setActiveTab]
  )

  return (
    <div className="mx-auto max-w-6xl p-4">
      <Tabs
        data-testid="flashcards-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "review",
            label: t("option:flashcards.review", { defaultValue: "Review" }),
            children: (
              <ReviewTab
                onNavigateToCreate={() => setActiveTab("cards")}
                onNavigateToImport={() => setActiveTab("importExport")}
                reviewDeckId={reviewDeckId}
                onReviewDeckChange={setReviewDeckId}
                reviewOverrideCard={reviewOverrideCard}
                onClearOverride={() => setReviewOverrideCard(null)}
              />
            )
          },
          {
            key: "cards",
            label: t("option:flashcards.cards", { defaultValue: "Cards" }),
            children: (
              <ManageTab
                onNavigateToImport={() => setActiveTab("importExport")}
                onReviewCard={handleReviewCard}
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
