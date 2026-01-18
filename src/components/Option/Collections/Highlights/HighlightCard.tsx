import React from "react"
import { Button, Tooltip } from "antd"
import { ExternalLink, Trash2, Edit } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Highlight, HighlightColor } from "@/types/collections"

const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: "bg-yellow-100 dark:bg-yellow-900/30",
  green: "bg-green-100 dark:bg-green-900/30",
  blue: "bg-blue-100 dark:bg-blue-900/30",
  pink: "bg-pink-100 dark:bg-pink-900/30",
  purple: "bg-purple-100 dark:bg-purple-900/30"
}

export const getHighlightBgColor = (color?: HighlightColor): string => {
  return HIGHLIGHT_BG[color || "yellow"]
}

interface HighlightCardProps {
  highlight: Highlight
  onDelete: (id: string) => void
  onEdit?: (highlight: Highlight) => void
  onViewArticle?: () => void
  compact?: boolean
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  highlight,
  onDelete,
  onEdit,
  onViewArticle,
  compact = false
}) => {
  const { t } = useTranslation("collections")

  return (
    <div
      className={`group rounded-lg border border-zinc-200 p-3 transition-shadow hover:shadow-sm dark:border-zinc-700 ${getHighlightBgColor(highlight.color)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <blockquote className="text-sm italic text-zinc-700 dark:text-zinc-200">
            "{highlight.quote}"
          </blockquote>

          {highlight.note && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {highlight.note}
            </p>
          )}

          {!compact && highlight.item_title && (
            <p className="mt-2 text-xs text-zinc-500">
              {t("collections:highlights.from", "From")}: {highlight.item_title}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onViewArticle && (
            <Tooltip title={t("collections:highlights.viewArticle", "View Article")}>
              <Button
                type="text"
                size="small"
                icon={<ExternalLink className="h-4 w-4" />}
                onClick={onViewArticle}
                aria-label={t("collections:highlights.viewArticle", "View Article")}
              />
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip title={t("collections:highlights.edit", "Edit")}>
              <Button
                type="text"
                size="small"
                icon={<Edit className="h-4 w-4" />}
                onClick={() => onEdit(highlight)}
                aria-label={t("collections:highlights.edit", "Edit")}
              />
            </Tooltip>
          )}
          <Tooltip title={t("common:delete", "Delete")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => onDelete(highlight.id)}
              aria-label={t("common:delete", "Delete")}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
