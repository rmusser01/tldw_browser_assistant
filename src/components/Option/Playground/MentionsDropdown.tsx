import React from "react"
import { TabInfo, MentionPosition } from "~/hooks/useTabMentions"
import { Globe, X, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"

interface MentionsDropdownProps {
  show: boolean
  tabs: TabInfo[]
  mentionPosition: MentionPosition | null
  onSelectTab: (tab: TabInfo) => void
  onClose: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
  refetchTabs: () => Promise<void>
  onMentionsOpen: () => Promise<void>
}

export const MentionsDropdown: React.FC<MentionsDropdownProps> = ({
  show,
  tabs,
  mentionPosition,
  onSelectTab,
  onClose,
  textareaRef,
  refetchTabs,
  onMentionsOpen
}) => {
  const { t } = useTranslation(["common"])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })

  React.useEffect(() => {
    setSelectedIndex(0)
  }, [tabs])

  React.useEffect(() => {
    if (show && textareaRef.current && dropdownRef.current) {
      const textareaRect = textareaRef.current.getBoundingClientRect()
      const dropdownHeight = dropdownRef.current.offsetHeight || 320 
      
      setPosition({
        top: -dropdownHeight - 8, 
        left: 0
      })
    }
  }, [show, tabs])

  React.useEffect(() => {
    if (show) {
      onMentionsOpen()
    }
  }, [show, onMentionsOpen])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!show) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % tabs.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + tabs.length) % tabs.length)
          break
        case "Enter":
          e.preventDefault()
          if (tabs[selectedIndex]) {
            onSelectTab(tabs[selectedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
      }
    }

    if (show) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [show, tabs, selectedIndex, onSelectTab, onClose])

  const handleRefreshTabs = async () => {
    if (isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await refetchTabs()
    } catch (error) {
      console.error("Failed to refresh tabs:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!show) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 bg-surface border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto w-80"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="p-2 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text">
          Select Tab
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshTabs}
            disabled={isRefreshing}
            type="button"
            className="text-text-subtle hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh tabs"
            aria-label="Refresh tabs">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="text-text-subtle hover:text-text"
            aria-label={t("common:close", "Close") as string}
            title={t("common:close", "Close") as string}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab)}
            title={tab.title}
            className={`w-full text-left p-3 hover:bg-surface2 flex items-center gap-3 transition-colors ${
              index === selectedIndex
                ? "bg-surface2 border-r-2 border-primary"
                : ""
            }`}>
            <div className="flex-shrink-0">
              {tab.favIconUrl ? (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  className="w-4 h-4 rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = "none"
                    target.nextElementSibling?.classList.remove("hidden")
                  }}
                />
              ) : null}
              <Globe
                className={`w-4 h-4 text-text-subtle ${tab.favIconUrl ? "hidden" : ""}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text truncate">
                {tab.title}
              </div>
            </div>
          </button>
        ))}
      </div>

      {tabs.length === 0 && mentionPosition?.query && (
        <div className="p-4 text-center text-text-subtle text-sm">
          <p>No tabs found matching "{mentionPosition.query}"</p>
          <button
            onClick={handleRefreshTabs}
            disabled={isRefreshing}
            title={isRefreshing ? "Refreshing..." : "Refresh tabs"}
            className="mt-2 text-primary hover:text-primaryStrong disabled:opacity-50">
            {isRefreshing ? "Refreshing..." : "Refresh tabs"}
          </button>
        </div>
      )}
    </div>
  )
}
