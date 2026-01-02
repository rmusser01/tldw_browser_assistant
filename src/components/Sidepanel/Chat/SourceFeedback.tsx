import React from "react"
import { Tooltip } from "antd"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MessageSource } from "@/components/Common/Playground/MessageSource"
import type { FeedbackThumb } from "@/store/feedback"

type Props = {
  source: any
  sourceKey: string
  sourceIndex?: number
  selected?: FeedbackThumb
  disabled?: boolean
  onRate?: (sourceKey: string, source: any, thumb: FeedbackThumb) => void
  onSourceClick?: (source: any) => void
  onTrackClick?: (source: any, index?: number) => void
}

const buttonBase =
  "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors"

export const SourceFeedback = ({
  source,
  sourceKey,
  sourceIndex,
  selected = null,
  disabled = false,
  onRate,
  onSourceClick,
  onTrackClick
}: Props) => {
  const { t } = useTranslation("playground")

  const handleSourceClick = React.useCallback(
    (payload: any) => {
      onTrackClick?.(payload, sourceIndex)
      onSourceClick?.(payload)
    },
    [onSourceClick, onTrackClick, sourceIndex]
  )

  const handleSourceNavigate = React.useCallback(
    (payload: any) => {
      onTrackClick?.(payload, sourceIndex)
    },
    [onTrackClick, sourceIndex]
  )

  const isDisabled = disabled

  return (
    <div className="flex items-center gap-2">
      <MessageSource
        source={source}
        onSourceClick={handleSourceClick}
        onSourceNavigate={handleSourceNavigate}
      />
      <div className="flex items-center gap-1">
        <Tooltip title={t("feedback.sourceHelpful", "Helpful source")}>
          <button
            type="button"
            aria-label={t("feedback.sourceHelpful", "Helpful source")}
            aria-pressed={selected === "up"}
            disabled={isDisabled}
            onClick={() => onRate?.(sourceKey, source, "up")}
            className={`${buttonBase} ${
              selected === "up"
                ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "border-border text-text-subtle hover:bg-surface2"
            } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}>
            <ThumbsUp className="h-3 w-3" />
          </button>
        </Tooltip>
        <Tooltip title={t("feedback.sourceUnhelpful", "Unhelpful source")}>
          <button
            type="button"
            aria-label={t("feedback.sourceUnhelpful", "Unhelpful source")}
            aria-pressed={selected === "down"}
            disabled={isDisabled}
            onClick={() => onRate?.(sourceKey, source, "down")}
            className={`${buttonBase} ${
              selected === "down"
                ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                : "border-border text-text-subtle hover:bg-surface2"
            } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}>
            <ThumbsDown className="h-3 w-3" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
