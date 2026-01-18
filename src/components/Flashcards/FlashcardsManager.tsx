import React from "react"
import { Button, Tabs, Tooltip } from "antd"
import { HelpCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ReviewTab, ManageTab, ImportExportTab } from "./tabs"
import { KeyboardShortcutsModal } from "./components"
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
  const [shortcutsModalOpen, setShortcutsModalOpen] = React.useState(false)

  // Listen for "?" key to open keyboard shortcuts modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault()
        setShortcutsModalOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

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
        tabBarExtraContent={
          <Tooltip
            title={t("option:flashcards.keyboardShortcutsHelp", {
              defaultValue: "Press ? to show shortcuts"
            })}
          >
            <Button
              type="text"
              size="small"
              icon={<HelpCircle className="size-4" />}
              onClick={() => setShortcutsModalOpen(true)}
              aria-label={t("option:flashcards.keyboardShortcutsTitle", {
                defaultValue: "Keyboard Shortcuts"
              })}
            />
          </Tooltip>
        }
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

      <KeyboardShortcutsModal
        open={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        activeTab={activeTab as "review" | "cards" | "import"}
      />
    </div>
  )
}

export default FlashcardsManager
