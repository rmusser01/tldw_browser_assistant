import React from "react"
import { useTranslation } from "react-i18next"
import type { KnowledgeTab } from "./KnowledgePanel"

type KnowledgeTabsProps = {
  activeTab: KnowledgeTab
  onTabChange: (tab: KnowledgeTab) => void
  contextCount?: number
  className?: string
}

/**
 * Tab navigation for the Knowledge panel
 *
 * Features:
 * - 3 tabs: Search, Settings, Context
 * - Badge on Context tab showing attached item count
 * - Keyboard navigation (1/2/3 when focused, disabled in text inputs)
 * - ARIA roles for accessibility
 */
export const KnowledgeTabs: React.FC<KnowledgeTabsProps> = ({
  activeTab,
  onTabChange,
  contextCount = 0,
  className = ""
}) => {
  const { t } = useTranslation(["sidepanel"])

  const tabs: { id: KnowledgeTab; label: string; badge?: number }[] = [
    {
      id: "search",
      label: t("sidepanel:knowledge.tabs.search", "Search")
    },
    {
      id: "settings",
      label: t("sidepanel:knowledge.tabs.settings", "Settings")
    },
    {
      id: "context",
      label: t("sidepanel:knowledge.tabs.context", "Context"),
      badge: contextCount > 0 ? contextCount : undefined
    }
  ]

  const tabIds: KnowledgeTab[] = ["search", "settings", "context"]

  const focusTab = (tabId: KnowledgeTab) => {
    const element = document.getElementById(`knowledge-tab-${tabId}`)
    element?.focus()
  }

  // Handle keyboard navigation (arrow keys and 1/2/3 to switch tabs)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle when focus is on tablist, not inside text inputs
    const target = e.target as HTMLElement
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return
    }

    const currentIndex = Math.max(tabIds.indexOf(activeTab), 0)

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % tabIds.length
      const nextTab = tabIds[nextIndex]
      onTabChange(nextTab)
      focusTab(nextTab)
      return
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length
      const prevTab = tabIds[prevIndex]
      onTabChange(prevTab)
      focusTab(prevTab)
      return
    }

    if (e.key === "1") {
      onTabChange("search")
      focusTab("search")
    } else if (e.key === "2") {
      onTabChange("settings")
      focusTab("settings")
    } else if (e.key === "3") {
      onTabChange("context")
      focusTab("context")
    }
  }

  return (
    <div
      role="tablist"
      aria-label={t("sidepanel:knowledge.tabs.label", "Knowledge panel sections")}
      className={`flex border-b border-border ${className}`}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`knowledge-tabpanel-${tab.id}`}
          id={`knowledge-tab-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onTabChange(tab.id)}
          className={`
            relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
            ${
              activeTab === tab.id
                ? "text-accent border-b-2 border-accent -mb-[1px]"
                : "text-text-muted hover:text-text"
            }
          `}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span
              className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent/20 px-1.5 text-xs font-semibold text-accent"
              aria-label={t(
                "sidepanel:knowledge.tabs.contextBadge",
                "{{count}} items attached",
                { count: tab.badge }
              )}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
