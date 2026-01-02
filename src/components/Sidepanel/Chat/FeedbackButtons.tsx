import React from "react"
import { Tooltip } from "antd"
import { MoreHorizontal, ThumbsDown, ThumbsUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FeedbackThumb } from "@/store/feedback"

type Props = {
  selected?: FeedbackThumb
  disabled?: boolean
  isSubmitting?: boolean
  onThumbUp?: () => void
  onThumbDown?: () => void
  onOpenDetails?: () => void
  showThanks?: boolean
  disabledReason?: string
}

const baseButton =
  "inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors"

const getThumbClass = (active: boolean, kind: "up" | "down") => {
  if (active) {
    return kind === "up"
      ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
  }
  return "border-border text-text-muted hover:bg-surface2"
}

export const FeedbackButtons = ({
  selected = null,
  disabled = false,
  isSubmitting = false,
  onThumbUp,
  onThumbDown,
  onOpenDetails,
  showThanks = false,
  disabledReason
}: Props) => {
  const { t } = useTranslation("playground")
  const label = t("feedback.prompt", "Was this helpful?")
  const disabledHint = disabledReason
    ? disabledReason
    : t(
        "feedback.disabled",
        "Feedback is available after the response finishes."
      )

  const isDisabled = disabled || isSubmitting

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-text-muted">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <Tooltip
          title={
            isDisabled
              ? disabledHint
              : t("feedback.thumbsUp", "Helpful")
          }>
          <button
            type="button"
            aria-label={t("feedback.thumbsUp", "Helpful")}
            aria-pressed={selected === "up"}
            disabled={isDisabled}
            onClick={onThumbUp}
            className={`${baseButton} ${getThumbClass(
              selected === "up",
              "up"
            )} ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}>
            <ThumbsUp className="h-3 w-3" />
          </button>
        </Tooltip>
        <Tooltip
          title={
            isDisabled
              ? disabledHint
              : t("feedback.thumbsDown", "Not helpful")
          }>
          <button
            type="button"
            aria-label={t("feedback.thumbsDown", "Not helpful")}
            aria-pressed={selected === "down"}
            disabled={isDisabled}
            onClick={onThumbDown}
            className={`${baseButton} ${getThumbClass(
              selected === "down",
              "down"
            )} ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}>
            <ThumbsDown className="h-3 w-3" />
          </button>
        </Tooltip>
        <Tooltip
          title={
            isDisabled ? disabledHint : t("feedback.more", "More feedback")
          }>
          <button
            type="button"
            aria-label={t("feedback.more", "More feedback")}
            disabled={isDisabled}
            onClick={onOpenDetails}
            className={`${baseButton} border-border text-text-muted hover:bg-surface2 ${
              isDisabled ? "cursor-not-allowed opacity-50" : ""
            }`}>
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </Tooltip>
      </div>
      {showThanks && (
        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
          {t("feedback.thanks", "Thanks for the feedback")}
        </span>
      )}
    </div>
  )
}
