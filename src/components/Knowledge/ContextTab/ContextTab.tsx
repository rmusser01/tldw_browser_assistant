import React from "react"
import { useTranslation } from "react-i18next"
import type { UploadedFile } from "@/db/dexie/types"
import type { TabInfo } from "@/hooks/useTabMentions"
import type { RagPinnedResult } from "@/utils/rag-format"
import { AttachedTabs } from "./AttachedTabs"
import { AttachedFiles } from "./AttachedFiles"
import { PinnedResults } from "./PinnedResults"

type ContextTabProps = {
  // Attached browser tabs
  attachedTabs: TabInfo[]
  availableTabs: TabInfo[]
  onRemoveTab: (tabId: number) => void
  onAddTab: (tab: TabInfo) => void
  onClearTabs: () => void
  onRefreshTabs: () => void

  // Attached files
  attachedFiles: UploadedFile[]
  onAddFile: () => void
  onRemoveFile: (fileId: string) => void
  onClearFiles: () => void

  // Pinned results
  pinnedResults: RagPinnedResult[]
  onUnpinResult: (id: string) => void
  onClearPins: () => void
}

/**
 * ContextTab - Unified attachment management
 *
 * Phase 4 implementation: Shows all attached context items
 * (browser tabs, files, and pinned RAG results) in one place.
 */
export const ContextTab: React.FC<ContextTabProps> = ({
  attachedTabs,
  availableTabs,
  onRemoveTab,
  onAddTab,
  onClearTabs,
  onRefreshTabs,
  attachedFiles,
  onAddFile,
  onRemoveFile,
  onClearFiles,
  pinnedResults,
  onUnpinResult,
  onClearPins
}) => {
  const { t } = useTranslation(["sidepanel"])

  const hasAnyContent =
    attachedTabs.length > 0 ||
    attachedFiles.length > 0 ||
    pinnedResults.length > 0

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      role="tabpanel"
      id="knowledge-tabpanel-context"
      aria-labelledby="knowledge-tab-context"
    >
      {/* Header explanation */}
      <div className="px-3 py-2 border-b border-border bg-surface2/50">
        <p className="text-xs text-text-muted">
          {t(
            "sidepanel:rag.contextExplanation",
            "These items will be included in your next query."
          )}
        </p>
      </div>

      {/* Content sections */}
      <div className="flex-1 px-3 py-3 space-y-4">
        {/* Attached Browser Tabs */}
        <AttachedTabs
          tabs={attachedTabs}
          availableTabs={availableTabs}
          onRemove={onRemoveTab}
          onAdd={onAddTab}
          onClear={onClearTabs}
          onRefresh={onRefreshTabs}
        />

        {/* Attached Files */}
        <AttachedFiles
          files={attachedFiles}
          onAdd={onAddFile}
          onRemove={onRemoveFile}
          onClear={onClearFiles}
        />

        {/* Pinned Results */}
        <PinnedResults
          results={pinnedResults}
          onUnpin={onUnpinResult}
          onClear={onClearPins}
        />

        {/* Empty state */}
        {!hasAnyContent && (
          <div className="text-center py-8 text-text-muted">
            <p className="text-sm">
              {t(
                "sidepanel:rag.noContextItems",
                "No context items attached yet."
              )}
            </p>
            <p className="text-xs mt-2">
              {t(
                "sidepanel:rag.contextHint",
                "Pin search results or attach browser tabs and files to include them in your queries."
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
