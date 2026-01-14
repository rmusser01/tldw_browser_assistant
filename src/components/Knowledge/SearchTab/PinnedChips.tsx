import React from "react"
import { Button, Tooltip } from "antd"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { RagPinnedResult } from "@/utils/rag-format"

type PinnedChipsProps = {
  pinnedResults: RagPinnedResult[]
  onUnpin: (id: string) => void
  onClearAll: () => void
  maxVisible?: number
}

/**
 * Compact display of pinned results as chips
 *
 * Shows pinned items inline with remove buttons and a "Clear all" action
 */
export const PinnedChips: React.FC<PinnedChipsProps> = ({
  pinnedResults,
  onUnpin,
  onClearAll,
  maxVisible = 5
}) => {
  const { t } = useTranslation(["sidepanel"])

  if (pinnedResults.length === 0) {
    return null
  }

  const visiblePins = pinnedResults.slice(0, maxVisible)
  const hiddenCount = pinnedResults.length - maxVisible

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">
          {t("sidepanel:rag.pinned", "Pinned")}
          <span className="ml-1 text-text">({pinnedResults.length})</span>
        </span>
        <Button
          type="link"
          size="small"
          onClick={onClearAll}
          className="text-xs text-text-muted hover:text-error p-0 h-auto"
        >
          {t("sidepanel:rag.clearAll", "Clear all")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visiblePins.map((pin) => (
          <Tooltip
            key={pin.id}
            title={pin.snippet?.slice(0, 100) || pin.title}
            placement="top"
          >
            <div className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-surface2 rounded-full max-w-[180px] group">
              <span className="truncate text-text">
                {pin.title || pin.snippet?.slice(0, 30) || "Untitled"}
              </span>
              <button
                type="button"
                onClick={() => onUnpin(pin.id)}
                className="flex-shrink-0 text-text-muted hover:text-error transition-colors"
                aria-label={t("sidepanel:rag.unpin", "Unpin {{title}}", {
                  title: pin.title || "item"
                })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </Tooltip>
        ))}

        {hiddenCount > 0 && (
          <Tooltip
            title={t("sidepanel:rag.morePinned", "{{count}} more pinned items", {
              count: hiddenCount
            })}
          >
            <span className="inline-flex items-center px-2 py-1 text-xs bg-surface2 text-text-muted rounded-full">
              +{hiddenCount}
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
