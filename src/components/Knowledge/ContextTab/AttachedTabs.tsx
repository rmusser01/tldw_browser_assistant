import React from "react"
import { Select } from "antd"
import { RefreshCw, Trash2, X, Globe } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TabInfo } from "@/hooks/useTabMentions"

type AttachedTabsProps = {
  tabs: TabInfo[]
  availableTabs: TabInfo[]
  onRemove: (tabId: number) => void
  onAdd: (tab: TabInfo) => void
  onClear: () => void
  onRefresh: () => void
}

/**
 * AttachedTabs - Browser tabs attached as context
 */
export const AttachedTabs: React.FC<AttachedTabsProps> = ({
  tabs,
  availableTabs,
  onRemove,
  onAdd,
  onClear,
  onRefresh
}) => {
  const { t } = useTranslation(["sidepanel"])

  // Filter out already attached tabs from available tabs
  const unattachedTabs = React.useMemo(
    () => availableTabs.filter((t) => !tabs.some((at) => at.id === t.id)),
    [availableTabs, tabs]
  )

  const handleAddTab = (tabId: number) => {
    const tab = availableTabs.find((t) => t.id === tabId)
    if (tab) {
      onAdd(tab)
    }
  }

  return (
    <div className="rounded border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface2/50">
        <span className="text-xs font-semibold text-text">
          {t("sidepanel:rag.browserTabs", "Browser Tabs")}
          {tabs.length > 0 && (
            <span className="ml-1.5 text-text-muted">({tabs.length})</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1 text-text-muted hover:text-text transition-colors rounded hover:bg-surface3"
            aria-label={t("sidepanel:rag.refreshTabs", "Refresh tabs")}
            title={t("sidepanel:rag.refreshTabs", "Refresh tabs")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {tabs.length > 0 && (
            <button
              onClick={onClear}
              className="p-1 text-text-muted hover:text-red-500 transition-colors rounded hover:bg-surface3"
              aria-label={t("sidepanel:rag.clearTabs", "Clear all tabs")}
              title={t("sidepanel:rag.clearTabs", "Clear all tabs")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {/* Attached tabs list */}
        {tabs.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface2/50 group"
              >
                {tab.favIconUrl ? (
                  <img
                    src={tab.favIconUrl}
                    alt=""
                    className="h-4 w-4 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                ) : (
                  <Globe className="h-4 w-4 text-text-muted flex-shrink-0" />
                )}
                <span
                  className="flex-1 text-xs text-text truncate"
                  title={tab.url}
                >
                  {tab.title}
                </span>
                <button
                  onClick={() => onRemove(tab.id)}
                  className="p-0.5 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={t("sidepanel:rag.removeTab", "Remove tab")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add tab dropdown */}
        <Select
          placeholder={t("sidepanel:rag.addFromOpenTabs", "+ Add from open tabs...")}
          value={undefined}
          onChange={handleAddTab}
          options={unattachedTabs.map((tab) => ({
            label: (
              <div className="flex items-center gap-2">
                {tab.favIconUrl ? (
                  <img src={tab.favIconUrl} alt="" className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4 text-text-muted" />
                )}
                <span className="truncate">{tab.title}</span>
              </div>
            ),
            value: tab.id
          }))}
          disabled={unattachedTabs.length === 0}
          className="w-full"
          size="small"
          showSearch
          filterOption={(input, option) => {
            const tab = unattachedTabs.find((t) => t.id === option?.value)
            if (!tab) return false
            const searchLower = input.toLowerCase()
            return (
              tab.title.toLowerCase().includes(searchLower) ||
              tab.url.toLowerCase().includes(searchLower)
            )
          }}
          notFoundContent={
            <span className="text-xs text-text-muted">
              {t("sidepanel:rag.noMoreTabs", "No more tabs available")}
            </span>
          }
        />
      </div>
    </div>
  )
}
