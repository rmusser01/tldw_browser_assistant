import React from "react"
import { Button, Tooltip } from "antd"
import { Eye, MessageSquare, Pin, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { RagResult } from "../hooks"
import {
  getResultTitle,
  getResultText,
  getResultType,
  getResultDate,
  getResultScore
} from "../hooks"

type ResultItemProps = {
  result: RagResult
  query?: string
  onInsert: (result: RagResult) => void
  onAsk: (result: RagResult) => void
  onPreview: (result: RagResult) => void
  onPin: (result: RagResult) => void
  isPinned?: boolean
  highlightTerms?: boolean
}

/**
 * Format a date for display
 */
const formatDate = (value?: string | number) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date)
}

/**
 * Format a score for display
 */
const formatScore = (score?: number) =>
  typeof score === "number" && Number.isFinite(score)
    ? score.toFixed(2)
    : null

/**
 * Highlight query terms in text
 */
const highlightText = (text: string, query?: string) => {
  if (!query) return text

  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  if (terms.length === 0) return text

  const escaped = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  )
  const regex = new RegExp(`(${escaped.join("|")})`, "gi")
  const parts = text.split(regex)
  const termSet = new Set(terms.map((term) => term.toLowerCase()))

  return parts.map((part, idx) =>
    termSet.has(part.toLowerCase()) ? (
      <mark key={`h-${idx}`} className="bg-warn/20 text-text rounded px-0.5">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`t-${idx}`}>{part}</React.Fragment>
    )
  )
}

/**
 * Single search result with 4 actions: Insert, Ask, Preview, Pin
 */
export const ResultItem: React.FC<ResultItemProps> = React.memo(
  ({
    result,
    query,
    onInsert,
    onAsk,
    onPreview,
    onPin,
    isPinned = false,
    highlightTerms = true
  }) => {
    const { t } = useTranslation(["sidepanel"])

    const title = getResultTitle(result)
    const text = getResultText(result)
    const type = getResultType(result)
    const date = formatDate(getResultDate(result))
    const score = formatScore(getResultScore(result))

    // Truncate snippet for display
    const snippet = text.slice(0, 300) + (text.length > 300 ? "..." : "")

    return (
      <div className="rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent/50">
        {/* Header: Title + Score */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-medium text-text line-clamp-1 flex-1">
            {title || t("sidepanel:rag.untitledResult", "Untitled")}
          </h4>
          {score && (
            <span className="text-xs text-text-muted whitespace-nowrap">
              {score}
            </span>
          )}
        </div>

        {/* Metadata: Type + Date */}
        {(type || date) && (
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            {type && <span>{type}</span>}
            {type && date && <span>•</span>}
            {date && <span>{date}</span>}
          </div>
        )}

        {/* Snippet */}
        <p className="text-xs text-text-muted line-clamp-3 mb-3">
          {highlightTerms ? highlightText(snippet, query) : snippet}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Tooltip title={t("sidepanel:rag.actions.insert", "Insert")}>
            <Button
              type="text"
              size="small"
              onClick={() => onInsert(result)}
              icon={<Plus className="h-3.5 w-3.5" />}
              className="text-text-muted hover:text-accent"
            >
              {t("sidepanel:rag.actions.insert", "Insert")}
            </Button>
          </Tooltip>

          <Tooltip title={t("sidepanel:rag.actions.ask", "Ask")}>
            <Button
              type="text"
              size="small"
              onClick={() => onAsk(result)}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              className="text-text-muted hover:text-accent"
            >
              {t("sidepanel:rag.actions.ask", "Ask")}
            </Button>
          </Tooltip>

          <Tooltip title={t("sidepanel:rag.actions.preview", "Preview")}>
            <Button
              type="text"
              size="small"
              onClick={() => onPreview(result)}
              icon={<Eye className="h-3.5 w-3.5" />}
              className="text-text-muted hover:text-accent"
            >
              {t("sidepanel:rag.actions.preview", "Preview")}
            </Button>
          </Tooltip>

          <Tooltip
            title={
              isPinned
                ? t("sidepanel:rag.actions.pinned", "Already pinned")
                : t("sidepanel:rag.actions.pin", "Pin")
            }
          >
            <Button
              type="text"
              size="small"
              onClick={() => onPin(result)}
              disabled={isPinned}
              icon={
                <Pin
                  className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`}
                />
              }
              className={
                isPinned
                  ? "text-accent"
                  : "text-text-muted hover:text-accent"
              }
            >
              {t("sidepanel:rag.actions.pin", "Pin")}
            </Button>
          </Tooltip>
        </div>
      </div>
    )
  }
)

ResultItem.displayName = "ResultItem"
