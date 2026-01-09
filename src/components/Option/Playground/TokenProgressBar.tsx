import React from "react"
import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"

interface TokenProgressBarProps {
  /** Current conversation token count (excluding draft) */
  conversationTokens: number
  /** Draft message token count */
  draftTokens: number
  /** Maximum context window size */
  maxTokens: number | null
  /** Model label for tooltip */
  modelLabel?: string
  /** Whether to show compact version */
  compact?: boolean
}

const getProgressColor = (percentage: number): string => {
  if (percentage >= 80) return "bg-red-500"
  if (percentage >= 50) return "bg-yellow-500"
  return "bg-green-500"
}

const getProgressColorText = (percentage: number): string => {
  if (percentage >= 80) return "text-red-600 dark:text-red-400"
  if (percentage >= 50) return "text-yellow-600 dark:text-yellow-400"
  return "text-green-600 dark:text-green-400"
}

export const TokenProgressBar: React.FC<TokenProgressBarProps> = ({
  conversationTokens,
  draftTokens,
  maxTokens,
  modelLabel,
  compact = false
}) => {
  const { t } = useTranslation(["playground", "common"])

  const totalTokens = conversationTokens + draftTokens
  const percentage = maxTokens && maxTokens > 0
    ? Math.min(100, Math.round((totalTokens / maxTokens) * 100))
    : 0

  const formatNumber = React.useCallback((value: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—"
    return new Intl.NumberFormat().format(Math.round(value))
  }, [])

  const tooltipContent = React.useMemo(() => {
    const lines = [
      modelLabel && `${t("playground:tokens.model", "Model")}: ${modelLabel}`,
      `${t("playground:tokens.draft", "This message")}: ~${formatNumber(draftTokens)} ${t("playground:tokens.tokenUnit", "tokens")}`,
      `${t("playground:tokens.conversation", "Conversation")}: ${formatNumber(conversationTokens)} ${t("playground:tokens.tokenUnit", "tokens")}`,
      maxTokens && `${t("playground:tokens.contextWindow", "Context window")}: ${formatNumber(maxTokens)} ${t("playground:tokens.tokenUnit", "tokens")}`,
      maxTokens && `${t("playground:tokens.remaining", "Remaining")}: ${formatNumber(maxTokens - totalTokens)} ${t("playground:tokens.tokenUnit", "tokens")}`
    ].filter(Boolean)
    return lines.join("\n")
  }, [modelLabel, draftTokens, conversationTokens, maxTokens, totalTokens, formatNumber, t])

  if (!maxTokens || maxTokens <= 0) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
        <span>~{formatNumber(draftTokens)} {t("playground:tokens.tokenUnit", "tokens")}</span>
      </div>
    )
  }

  const progressColor = getProgressColor(percentage)
  const textColor = getProgressColorText(percentage)

  if (compact) {
    return (
      <Tooltip title={tooltipContent} placement="top">
        <div
          className="inline-flex items-center gap-2 cursor-help"
          aria-label={`${percentage}% ${t("playground:tokens.used", "used")}`}
        >
          <div className="relative h-1.5 w-16 sm:w-20 overflow-hidden rounded-full bg-border">
            <div
              className={`absolute inset-y-0 left-0 ${progressColor} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className={`text-xs sm:text-[10px] font-medium ${textColor}`}>
            {percentage}%
          </span>
        </div>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={tooltipContent} placement="top">
      <div
        className="inline-flex flex-col gap-1 cursor-help rounded-lg border border-border bg-surface px-3 py-1.5"
        aria-label={`${t("playground:tokens.contextUsage", "Context usage")}: ${percentage}%`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="relative h-2 w-24 overflow-hidden rounded-full bg-border">
            <div
              className={`absolute inset-y-0 left-0 ${progressColor} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${textColor}`}>
            {percentage}% {t("playground:tokens.used", "used")}
          </span>
        </div>
        <div className="text-[10px] text-text-muted">
          {t("playground:tokens.thisMessage", "This message")}: ~{formatNumber(draftTokens)}
        </div>
      </div>
    </Tooltip>
  )
}
