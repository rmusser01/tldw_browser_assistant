import { Tag } from "antd"
import React from "react"
import { useTranslation } from "react-i18next"

interface ReviewProgressProps {
  dueCount: number
  reviewedCount: number
  deckName?: string
}

export const ReviewProgress: React.FC<ReviewProgressProps> = ({
  dueCount,
  reviewedCount,
  deckName
}) => {
  const { t } = useTranslation(["option"])
  const remaining = Math.max(0, dueCount - reviewedCount)
  // Average time per card in seconds (based on typical flashcard review time of 10-20s)
  const avgTimePerCard = 15
  const estimatedMinutes = Math.ceil((remaining * avgTimePerCard) / 60)

  if (dueCount === 0) return null

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-surface2 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-primary">{remaining}</span>
        <span className="text-sm text-text-muted">
          {t("option:flashcards.cardsRemaining", { defaultValue: "cards remaining" })}
        </span>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="text-sm text-text-muted">
        <span className="font-medium text-text">{reviewedCount}</span>{" "}
        {t("option:flashcards.reviewed", { defaultValue: "reviewed" })}
      </div>
      {remaining > 0 && (
        <>
          <div className="h-8 w-px bg-border" />
          <div className="text-sm text-text-muted">
            ~{estimatedMinutes}{" "}
            {t("option:flashcards.minutesLeft", { defaultValue: "min left" })}
          </div>
        </>
      )}
      {deckName && <Tag className="ml-auto">{deckName}</Tag>}
    </div>
  )
}
