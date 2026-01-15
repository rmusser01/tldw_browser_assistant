import React from "react"
import { Modal } from "antd"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { UploadedFile } from "@/db/dexie/types"
import type { TabInfo } from "@/hooks/useTabMentions"
import type { RagPinnedResult } from "@/utils/rag-format"
import { formatRagResult } from "@/utils/rag-format"
import { KnowledgeTabs } from "./KnowledgeTabs"
import { SearchTab } from "./SearchTab"
import { SettingsTab } from "./SettingsTab"
import { ContextTab } from "./ContextTab"
import {
  useKnowledgeSettings,
  useKnowledgeSearch,
  toPinnedResult,
  type RagResult
} from "./hooks"

/**
 * Tab identifiers for the 3-tab architecture
 */
export type KnowledgeTab = "search" | "settings" | "context"

/**
 * Props for KnowledgePanel - matches RagSearchBar props for compatibility
 */
export type KnowledgePanelProps = {
  onInsert: (text: string) => void
  onAsk: (text: string, options?: { ignorePinnedResults?: boolean }) => void
  isConnected?: boolean
  open?: boolean
  onOpenChange?: (nextOpen: boolean) => void
  autoFocus?: boolean
  showToggle?: boolean
  variant?: "card" | "embedded"
  currentMessage?: string
  showAttachedContext?: boolean
  attachedTabs?: TabInfo[]
  availableTabs?: TabInfo[]
  attachedFiles?: UploadedFile[]
  onRemoveTab?: (tabId: number) => void
  onAddTab?: (tab: TabInfo) => void
  onClearTabs?: () => void
  onRefreshTabs?: () => void
  onAddFile?: () => void
  onRemoveFile?: (fileId: string) => void
  onClearFiles?: () => void
}

const normalizeUrl = (value?: string) => value?.trim().toLowerCase()
const noop = () => {}

/**
 * KnowledgePanel - Main container for the 3-tab RAG interface
 *
 * Implements the 3-tab architecture:
 * - Search tab: Query input, source filters, results list, pinned results
 * - Settings tab: All RAG settings organized in collapsible sections
 * - Context tab: Manage attached tabs, files, and pinned results
 */
export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  onInsert,
  onAsk,
  isConnected = true,
  open,
  onOpenChange,
  autoFocus = true,
  showToggle = true,
  variant = "card",
  currentMessage,
  showAttachedContext = false,
  attachedTabs = [],
  availableTabs = [],
  attachedFiles = [],
  onRemoveTab,
  onAddTab,
  onClearTabs,
  onRefreshTabs,
  onAddFile,
  onRemoveFile,
  onClearFiles
}) => {
  const { t } = useTranslation(["sidepanel"])

  // Tab state - default to search tab
  const [activeTab, setActiveTab] = React.useState<KnowledgeTab>("search")

  // Open/close state (controlled or uncontrolled)
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = typeof open === "boolean"
  const isOpen = isControlled ? open : internalOpen
  const setOpenState = React.useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next)
        return
      }
      setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  // Preview modal state
  const [previewItem, setPreviewItem] = React.useState<RagPinnedResult | null>(
    null
  )

  // Settings state (from hook)
  const settings = useKnowledgeSettings(currentMessage)

  // Search state (from hook)
  const search = useKnowledgeSearch({
    resolvedQuery: settings.resolvedQuery,
    draftSettings: settings.draftSettings,
    applySettings: settings.applySettings,
    onInsert,
    onAsk
  })

  // Handle preview action
  const handlePreview = React.useCallback((result: RagResult) => {
    setPreviewItem(toPinnedResult(result))
  }, [])

  // Discard staged settings on close
  const previousOpen = React.useRef(isOpen)
  React.useEffect(() => {
    if (previousOpen.current && !isOpen) {
      settings.discardChanges()
    }
    previousOpen.current = isOpen
  }, [isOpen, settings.discardChanges])

  // Handle Ask with confirmation for pinned results
  const handleAsk = React.useCallback(
    (result: RagResult) => {
      const pinned = toPinnedResult(result)
      if (search.pinnedResults.length > 0) {
        Modal.confirm({
          title: t("sidepanel:rag.askConfirmTitle", "Ask about this item?"),
          content: t(
            "sidepanel:rag.askConfirmContent",
            "Pinned results will be ignored for this Ask."
          ),
          okText: t("common:continue", "Continue"),
          cancelText: t("common:cancel", "Cancel"),
          onOk: () =>
            onAsk(formatRagResult(pinned, "markdown"), {
              ignorePinnedResults: true
            })
        })
        return
      }
      onAsk(formatRagResult(pinned, "markdown"), { ignorePinnedResults: true })
    },
    [onAsk, search.pinnedResults.length, t]
  )

  // Context item count for badge (tabs + files + pinned results)
  const contextCount = React.useMemo(() => {
    const seen = new Set<string>()

    attachedTabs.forEach((tab) => {
      const normalized = normalizeUrl(tab.url)
      if (normalized) {
        seen.add(`url:${normalized}`)
      } else {
        seen.add(`tab:${tab.id}`)
      }
    })

    attachedFiles.forEach((file) => {
      seen.add(`file:${file.id}`)
    })

    search.pinnedResults.forEach((pin) => {
      const normalized = normalizeUrl(pin.url)
      if (normalized) {
        seen.add(`url:${normalized}`)
      } else {
        seen.add(`pin:${pin.id}`)
      }
    })

    return seen.size
  }, [attachedTabs, attachedFiles, search.pinnedResults])

  // Toggle handler for external events
  React.useEffect(() => {
    const handler = () => setOpenState(!isOpen)
    window.addEventListener("tldw:toggle-rag", handler)
    return () => window.removeEventListener("tldw:toggle-rag", handler)
  }, [isOpen, setOpenState])

  // Don't render if closed
  if (!isOpen) {
    if (showToggle) {
      return (
        <button
          onClick={() => setOpenState(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          {t("sidepanel:rag.show", "Show Knowledge Search")}
        </button>
      )
    }
    return null
  }

  const wrapperClassName = variant === "embedded" ? "w-full" : "w-full mb-2"
  const panelClassName =
    variant === "embedded"
      ? "panel-elevated relative"
      : "panel-card mb-2 relative"

  return (
    <div className={wrapperClassName}>
      <div className={panelClassName}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-text">
            {t("sidepanel:knowledge.title", "Knowledge Search")}
          </h3>
          <button
            onClick={() => setOpenState(false)}
            className="p-1 text-text-muted hover:text-text transition-colors rounded"
            aria-label={t("common:close", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <KnowledgeTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          contextCount={contextCount}
        />

        {/* Tab content */}
        {activeTab === "search" && (
          <SearchTab
            query={settings.draftSettings.query}
            onQueryChange={(q) =>
              settings.updateSetting("query", q, { transient: true })
            }
            useCurrentMessage={settings.useCurrentMessage}
            onUseCurrentMessageChange={settings.setUseCurrentMessage}
            selectedSources={settings.draftSettings.sources}
            onSourcesChange={(sources) =>
              settings.updateSetting("sources", sources)
            }
            preset={settings.preset}
            onPresetChange={settings.applyPreset}
            onSearch={search.runSearch}
            loading={search.loading}
            queryError={search.queryError}
            results={search.results}
            sortMode={search.sortMode}
            onSortModeChange={search.setSortMode}
            sortResults={search.sortResults}
            hasAttemptedSearch={search.hasAttemptedSearch}
            timedOut={search.timedOut}
            highlightTerms={settings.draftSettings.highlight_query_terms}
            pinnedResults={search.pinnedResults}
            onPin={search.handlePin}
            onUnpin={search.handleUnpin}
            onClearPins={search.handleClearPins}
            onInsert={search.handleInsert}
            onAsk={handleAsk}
            onPreview={handlePreview}
            isConnected={isConnected}
            autoFocus={autoFocus}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            settings={settings.draftSettings}
            preset={settings.preset}
            searchFilter={settings.advancedSearch}
            onSearchFilterChange={settings.setAdvancedSearch}
            onUpdate={settings.updateSetting}
            onPresetChange={settings.applyPreset}
            onResetToBalanced={settings.resetToBalanced}
          />
        )}

        {activeTab === "context" && (
          <ContextTab
            attachedTabs={attachedTabs}
            availableTabs={availableTabs}
            onRemoveTab={onRemoveTab || noop}
            onAddTab={onAddTab || noop}
            onClearTabs={onClearTabs || noop}
            onRefreshTabs={onRefreshTabs || noop}
            attachedFiles={attachedFiles}
            onAddFile={onAddFile || noop}
            onRemoveFile={onRemoveFile || noop}
            onClearFiles={onClearFiles || noop}
            pinnedResults={search.pinnedResults}
            onUnpinResult={search.handleUnpin}
            onClearPins={search.handleClearPins}
          />
        )}

        {/* Apply actions (visible across tabs) */}
        <div className="flex items-center justify-end gap-2 px-3 py-3 border-t border-border bg-surface">
          <button
            onClick={settings.applySettings}
            disabled={!settings.isDirty}
            className="px-3 py-1.5 text-sm text-text bg-surface2 rounded hover:bg-surface3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("sidepanel:rag.apply", "Apply")}
          </button>
          <button
            onClick={() => {
              search.runSearch({ applyFirst: true })
              setActiveTab("search")
            }}
            className="px-3 py-1.5 text-sm text-white bg-accent rounded hover:bg-accent/90 transition-colors"
          >
            {t("sidepanel:rag.applyAndSearch", "Apply & Search")}
          </button>
        </div>

        {/* Preview Modal */}
        <Modal
          open={!!previewItem}
          onCancel={() => setPreviewItem(null)}
          footer={null}
          title={previewItem?.title || t("sidepanel:rag.preview", "Preview")}
          width={600}
        >
          {previewItem && (
            <div className="space-y-4">
              {previewItem.source && (
                <p className="text-xs text-text-muted">
                  {t("sidepanel:rag.source", "Source")}: {previewItem.source}
                </p>
              )}
              <p className="text-sm text-text whitespace-pre-wrap">
                {previewItem.snippet}
              </p>
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => {
                    onInsert(formatRagResult(previewItem, "markdown"))
                    setPreviewItem(null)
                  }}
                  className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent/90"
                >
                  {t("sidepanel:rag.actions.insert", "Insert")}
                </button>
                <button
                  onClick={() => {
                    onAsk(formatRagResult(previewItem, "markdown"), {
                      ignorePinnedResults: true
                    })
                    setPreviewItem(null)
                  }}
                  className="px-3 py-1.5 text-sm bg-surface2 text-text rounded hover:bg-surface3"
                >
                  {t("sidepanel:rag.actions.ask", "Ask")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}
