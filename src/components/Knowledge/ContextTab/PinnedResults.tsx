import React from "react"
import { Trash2, X, Pin, FileText, Video, MessageSquare, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { RagPinnedResult } from "@/utils/rag-format"

type PinnedResultsProps = {
  results: RagPinnedResult[]
  onUnpin: (id: string) => void
  onClear: () => void
}

/**
 * Get icon for result type
 */
const getResultIcon = (type?: string) => {
  switch (type) {
    case "video":
    case "media":
      return Video
    case "note":
    case "notes":
      return FileText
    case "chat":
    case "chats":
      return MessageSquare
    case "character":
    case "characters":
      return User
    default:
      return Pin
  }
}

/**
 * PinnedResults - RAG search results pinned as context
 */
export const PinnedResults: React.FC<PinnedResultsProps> = ({
  results,
  onUnpin,
  onClear
}) => {
  const { t } = useTranslation(["sidepanel"])

  return (
    <div className="rounded border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface2/50">
        <span className="text-xs font-semibold text-text">
          {t("sidepanel:rag.pinnedResults", "Pinned Results")}
          {results.length > 0 && (
            <span className="ml-1.5 text-text-muted">({results.length})</span>
          )}
        </span>
        {results.length > 0 && (
          <button
            onClick={onClear}
            className="p-1 text-text-muted hover:text-red-500 transition-colors rounded hover:bg-surface3"
            aria-label={t("sidepanel:rag.clearPins", "Clear all pinned")}
            title={t("sidepanel:rag.clearPins", "Clear all pinned")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {results.length > 0 ? (
          <div className="space-y-1.5">
            {results.map((result) => {
              const ResultIcon = getResultIcon(result.type)
              return (
                <div
                  key={result.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded bg-surface2/50 group"
                >
                  <ResultIcon className="h-4 w-4 text-text-muted flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    {result.title && (
                      <span className="text-xs font-medium text-text truncate block">
                        {result.title}
                      </span>
                    )}
                    <span className="text-[11px] text-text-muted line-clamp-2">
                      {result.snippet}
                    </span>
                    {result.source && (
                      <span className="text-[10px] text-text-muted/70 truncate block mt-0.5">
                        {result.type && `${result.type} • `}
                        {t("sidepanel:rag.pinnedFromSearch", "Pinned from search")}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onUnpin(result.id)}
                    className="p-0.5 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={t("sidepanel:rag.unpinResult", "Unpin result")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-text-muted text-center py-2">
            {t(
              "sidepanel:rag.noPinnedResults",
              "No pinned results. Pin items from the Search tab."
            )}
          </p>
        )}
      </div>
    </div>
  )
}
