import React from "react"
import { message, Tooltip, Modal } from "antd"
import {
  ChevronLeft,
  Circle,
  CheckCircle2,
  Clock,
  XCircle,
  Pin,
  PinOff,
  Plus,
  Search,
  X,
  Folder,
  FolderPlus,
  Tag,
  Trash2,
  CheckSquare
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { shallow } from "zustand/shallow"
import { classNames } from "@/libs/class-name"
import type { SidepanelChatTab, ConversationStatus } from "@/store/sidepanel-chat-tabs"
import { useSidepanelChatTabsStore } from "@/store/sidepanel-chat-tabs"
import { useUiModeStore } from "@/store/ui-mode"
import { useFolderStore } from "@/store/folder"
import { useBulkChatOperations } from "@/hooks/useBulkChatOperations"
import { ModeToggle } from "./ModeToggle"
import { ConversationContextMenu } from "./ConversationContextMenu"
import { FolderPickerModal } from "./FolderPickerModal"
import { BulkFolderPickerModal } from "./BulkFolderPickerModal"
import { BulkTagPickerModal } from "./BulkTagPickerModal"
import { exportTabToJSON, exportTabToMarkdown } from "@/utils/conversation-export"

type SidebarGroup = {
  label: string
  items: SidepanelChatTab[]
}

type SidepanelChatSidebarProps = {
  open: boolean
  variant: "docked" | "overlay"
  tabs: SidepanelChatTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onNewTab: () => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onClose?: () => void
}

/**
 * Status indicator component
 */
const StatusIndicator: React.FC<{ status: ConversationStatus }> = ({
  status
}) => {
  if (!status) return null

  const icons: Record<string, React.ReactNode> = {
    in_progress: <Circle className="size-2 fill-blue-500 text-blue-500" />,
    resolved: <CheckCircle2 className="size-2.5 text-green-500" />,
    backlog: <Clock className="size-2.5 text-gray-400" />,
    non_viable: <XCircle className="size-2.5 text-red-400" />
  }

  return (
    <span className="flex-shrink-0" aria-label={status}>
      {icons[status]}
    </span>
  )
}

/**
 * Folder labels component - shows folder assignments as small chips
 */
const FolderLabels: React.FC<{ conversationId: string | null }> = ({
  conversationId
}) => {
  const getFoldersForConversation = useFolderStore(
    (state) => state.getFoldersForConversation
  )
  const uiPrefs = useFolderStore((state) => state.uiPrefs)

  if (!conversationId) return null

  const folders = getFoldersForConversation(conversationId)
  if (folders.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {folders.slice(0, 3).map((folder) => {
        const color = uiPrefs[folder.id]?.color || "#6b7280"
        return (
          <span
            key={folder.id}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${color}20`,
              color: color
            }}
          >
            <Folder className="size-2" />
            <span className="truncate max-w-[60px]">{folder.name}</span>
          </span>
        )
      })}
      {folders.length > 3 && (
        <span className="text-[10px] text-text-muted">
          +{folders.length - 3}
        </span>
      )}
    </div>
  )
}

const buildGroups = (tabs: SidepanelChatTab[], t: (key: string, fallback: string) => string): SidebarGroup[] => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfToday.getDate() - 1)

  const today: SidepanelChatTab[] = []
  const yesterday: SidepanelChatTab[] = []
  const older: SidepanelChatTab[] = []

  tabs.forEach((tab) => {
    const updatedAt = new Date(tab.updatedAt)
    if (updatedAt >= startOfToday) {
      today.push(tab)
    } else if (updatedAt >= startOfYesterday) {
      yesterday.push(tab)
    } else {
      older.push(tab)
    }
  })

  const groups: SidebarGroup[] = []
  if (today.length > 0) {
    groups.push({
      label: t("common:today", "Today"),
      items: today
    })
  }
  if (yesterday.length > 0) {
    groups.push({
      label: t("common:yesterday", "Yesterday"),
      items: yesterday
    })
  }
  if (older.length > 0) {
    groups.push({
      label: t("common:older", "Older"),
      items: older
    })
  }
  return groups
}

export const SidepanelChatSidebar = ({
  open,
  variant,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  searchQuery,
  onSearchQueryChange,
  onClose
}: SidepanelChatSidebarProps) => {
  const { t } = useTranslation(["common", "sidepanel"])
  const togglePinned = useSidepanelChatTabsStore(
    (state) => state.togglePinned
  )
  const renameTab = useSidepanelChatTabsStore((state) => state.renameTab)
  const setStatus = useSidepanelChatTabsStore((state) => state.setStatus)
  const uiMode = useUiModeStore((state) => state.mode)

  // Context menu handlers
  const handleRename = React.useCallback(
    (tabId: string, newLabel: string) => {
      renameTab(tabId, newLabel)
    },
    [renameTab]
  )

  const handleSetStatus = React.useCallback(
    (tabId: string, status: ConversationStatus) => {
      setStatus(tabId, status)
    },
    [setStatus]
  )

  // Folder picker modal state
  const [folderPickerOpen, setFolderPickerOpen] = React.useState(false)
  const [folderPickerTabId, setFolderPickerTabId] = React.useState<string | null>(null)

  // Bulk selection state
  const [selectionMode, setSelectionMode] = React.useState(false)
  const [selectedTabIds, setSelectedTabIds] = React.useState<string[]>([])
  const [bulkFolderPickerOpen, setBulkFolderPickerOpen] = React.useState(false)
  const [bulkTagPickerOpen, setBulkTagPickerOpen] = React.useState(false)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = React.useState(false)

  const {
    folderApiAvailable,
    ensureKeyword,
    addKeywordToConversation
  } = useFolderStore(
    (state) => ({
      folderApiAvailable: state.folderApiAvailable,
      ensureKeyword: state.ensureKeyword,
      addKeywordToConversation: state.addKeywordToConversation
    }),
    shallow
  )

  const handleAddToFolder = React.useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) {
      setFolderPickerTabId(tab.serverChatId || tab.historyId)
      setFolderPickerOpen(true)
    }
  }, [tabs])

  const handleFolderPickerClose = React.useCallback(() => {
    setFolderPickerOpen(false)
  }, [])

  const handleExportJSON = React.useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab?.historyId) {
        message.error(t("sidepanel:contextMenu.exportError", "Cannot export: conversation not saved locally"))
        return
      }
      const success = await exportTabToJSON(tab.historyId)
      if (success) {
        message.success(t("sidepanel:contextMenu.exportSuccess", "Exported successfully"))
      } else {
        message.error(t("sidepanel:contextMenu.exportError", "Export failed"))
      }
    },
    [tabs, t]
  )

  const handleExportMarkdown = React.useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab?.historyId) {
        message.error(t("sidepanel:contextMenu.exportError", "Cannot export: conversation not saved locally"))
        return
      }
      const success = await exportTabToMarkdown(tab.historyId)
      if (success) {
        message.success(t("sidepanel:contextMenu.exportSuccess", "Exported successfully"))
      } else {
        message.error(t("sidepanel:contextMenu.exportError", "Export failed"))
      }
    },
    [tabs, t]
  )
  const isPro = uiMode === "pro"
  const itemClass = isPro ? "px-2 py-1 text-caption" : "px-3 py-2 text-body"
  const groupGap = isPro ? "gap-1" : "gap-2"
  const groupSpacing = isPro ? "mb-3" : "mb-4"

  const toggleSelectionMode = React.useCallback(() => {
    setSelectionMode((prev) => !prev)
  }, [])

  const toggleTabSelected = React.useCallback((tabId: string) => {
    setSelectedTabIds((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    )
  }, [])

  const handleRowClick = React.useCallback(
    (tabId: string) => {
      if (selectionMode) {
        toggleTabSelected(tabId)
        return
      }
      onSelectTab(tabId)
    },
    [selectionMode, toggleTabSelected, onSelectTab]
  )

  const renderTabRow = React.useCallback(
    (tab: SidepanelChatTab) => {
      const isSelected = selectedTabIds.includes(tab.id)
      const row = (
        <div
          key={tab.id}
          className={classNames(
            "flex items-center justify-between rounded-md",
            itemClass,
            tab.id === activeTabId
              ? "bg-surface2 text-text"
              : "text-text-muted hover:bg-surface2 hover:text-text",
            selectionMode && isSelected ? "border border-primary/40" : "border border-transparent"
          )}
        >
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleTabSelected(tab.id)}
              onClick={(e) => e.stopPropagation()}
              className="mr-2 size-3 rounded border-border text-primary accent-primary"
              aria-label={t("sidepanel:multiSelect.toggle", "Toggle selection")}
            />
          )}
          <button
            type="button"
            onClick={() => handleRowClick(tab.id)}
            className="flex-1 min-w-0 text-left"
            title={tab.label}
          >
            <div className="flex items-center gap-1.5">
              <StatusIndicator status={tab.status} />
              <span className="truncate">{tab.label}</span>
            </div>
            <FolderLabels conversationId={tab.serverChatId || tab.historyId} />
          </button>
          {!selectionMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Tooltip title={tab.pinned ? t("common:unpin", "Unpin") : t("common:pin", "Pin")}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePinned(tab.id)
                  }}
                  className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                  aria-label={tab.pinned ? t("common:unpin", "Unpin") : t("common:pin", "Pin")}
                  title={tab.pinned ? t("common:unpin", "Unpin") : t("common:pin", "Pin")}
                >
                  {tab.pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                </button>
              </Tooltip>
              <Tooltip title={t("common:close", "Close")}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTab(tab.id)
                  }}
                  className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                  aria-label={t("common:close", "Close")}
                  title={t("common:close", "Close")}
                >
                  <X className="size-3" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      )

      if (selectionMode) {
        return row
      }

      return (
        <ConversationContextMenu
          key={tab.id}
          tab={tab}
          onRename={handleRename}
          onTogglePin={togglePinned}
          onSetStatus={handleSetStatus}
          onAddToFolder={handleAddToFolder}
          onExportJSON={handleExportJSON}
          onExportMarkdown={handleExportMarkdown}
          onDelete={onCloseTab}
          currentStatus={tab.status}
        >
          {row}
        </ConversationContextMenu>
      )
    },
    [
      activeTabId,
      itemClass,
      selectionMode,
      selectedTabIds,
      t,
      togglePinned,
      toggleTabSelected,
      handleRowClick,
      onCloseTab,
      handleRename,
      handleSetStatus,
      handleAddToFolder,
      handleExportJSON,
      handleExportMarkdown
    ]
  )

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const sortedTabs = React.useMemo(
    () =>
      [...tabs].sort((a, b) => b.updatedAt - a.updatedAt),
    [tabs]
  )

  const filteredTabs = React.useMemo(() => {
    if (!normalizedQuery) return sortedTabs
    return sortedTabs.filter((tab) =>
      tab.label.toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery, sortedTabs])

  const pinnedTabs = filteredTabs.filter((tab) => tab.pinned)
  const unpinnedTabs = filteredTabs.filter((tab) => !tab.pinned)
  const groups = buildGroups(unpinnedTabs, (key, fallback) =>
    t(key as any, fallback)
  )

  const visibleTabIds = React.useMemo(() => {
    const ids = new Set<string>()
    pinnedTabs.forEach((tab) => ids.add(tab.id))
    groups.forEach((group) => {
      group.items.forEach((tab) => ids.add(tab.id))
    })
    return Array.from(ids)
  }, [groups, pinnedTabs])

  const tabById = React.useMemo(
    () => new Map(filteredTabs.map((tab) => [tab.id, tab])),
    [filteredTabs]
  )

  const selectedTabs = React.useMemo(
    () =>
      selectedTabIds
        .map((id) => tabById.get(id))
        .filter(Boolean) as SidepanelChatTab[],
    [selectedTabIds, tabById]
  )

  const selectedConversationIds = React.useMemo(
    () => {
      const ids = new Set<string>()
      selectedTabs.forEach((tab) => {
        if (tab.serverChatId) ids.add(tab.serverChatId)
      })
      return Array.from(ids)
    },
    [selectedTabs]
  )

  const localOnlySelectedCount = React.useMemo(
    () => selectedTabs.filter((tab) => !tab.serverChatId).length,
    [selectedTabs]
  )
  const { openBulkFolderPicker, openBulkTagPicker, applyBulkTrash } =
    useBulkChatOperations({
      selectedConversationIds,
      folderApiAvailable,
      ensureKeyword,
      addKeywordToConversation,
      t,
      setBulkFolderPickerOpen,
      setBulkTagPickerOpen
    })

  React.useEffect(() => {
    if (!selectionMode) {
      setSelectedTabIds([])
      return
    }
    setSelectedTabIds((prev) => prev.filter((id) => visibleTabIds.includes(id)))
  }, [selectionMode, visibleTabIds])

  const handleSelectAllVisible = React.useCallback(() => {
    setSelectedTabIds(visibleTabIds)
  }, [visibleTabIds])

  const clearSelection = React.useCallback(() => {
    setSelectedTabIds([])
  }, [])

  const openBulkDeleteConfirm = React.useCallback(() => {
    setBulkDeleteConfirmOpen(true)
  }, [])

  const handleBulkFolderPickerClose = React.useCallback(() => {
    setBulkFolderPickerOpen(false)
  }, [])

  const handleBulkTagPickerClose = React.useCallback(() => {
    setBulkTagPickerOpen(false)
  }, [])

  const handleBulkDeleteConfirmClose = React.useCallback(() => {
    setBulkDeleteConfirmOpen(false)
  }, [])

  const handleBulkDelete = async () => {
    if (selectedTabs.length === 0) return

    const failedConversationIds = new Set<string>()
    if (selectedConversationIds.length > 0) {
      const result = await applyBulkTrash()
      if (!result) return
      result.failedConversationIds.forEach((id) => failedConversationIds.add(id))
    }

    const remainingSelection: string[] = []
    selectedTabs.forEach((tab) => {
      if (tab.serverChatId && failedConversationIds.has(tab.serverChatId)) {
        remainingSelection.push(tab.id)
        return
      }
      onCloseTab(tab.id)
    })

    if (localOnlySelectedCount > 0) {
      message.info(
        t("sidepanel:multiSelect.localOnlyClosed", {
          defaultValue: "{{count}} local chat(s) were closed.",
          count: localOnlySelectedCount
        })
      )
    }

    setSelectedTabIds(remainingSelection)
    setBulkDeleteConfirmOpen(false)
  }

  const panelClass = classNames(
    "flex h-full min-h-0 flex-col border-r border-border bg-surface",
    variant === "overlay"
      ? `fixed left-0 top-0 z-40 w-72 shadow-card transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`
      : "w-72"
  )

  return (
    <aside className={panelClass} data-testid="sidepanel-chat-sidebar">
      <div
        className={classNames(
          "flex items-center justify-between border-b border-border",
          isPro ? "px-4 py-2" : "px-4 py-3"
        )}
      >
        <div className="text-body font-semibold text-text">
          {t("common:chatSidebar.title", "Chats")}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip title={t("common:chatSidebar.newChat", "New Chat")}>
            <button
              type="button"
              data-testid="sidepanel-sidebar-new-chat"
              onClick={onNewTab}
              className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text"
              title={t("common:chatSidebar.newChat", "New Chat")}
            >
              <Plus className="size-4" />
            </button>
          </Tooltip>
          <Tooltip
            title={
              selectionMode
                ? t("sidepanel:multiSelect.exit", "Exit selection")
                : t("sidepanel:multiSelect.enter", "Select chats")
            }
          >
            <button
              type="button"
              onClick={toggleSelectionMode}
              className={classNames(
                "rounded-md p-2",
                selectionMode
                  ? "bg-surface2 text-text"
                  : "text-text-muted hover:bg-surface2 hover:text-text"
              )}
              aria-pressed={selectionMode}
              aria-label={
                selectionMode
                  ? t("sidepanel:multiSelect.exit", "Exit selection")
                  : t("sidepanel:multiSelect.enter", "Select chats")
              }
            >
              <CheckSquare className="size-4" />
            </button>
          </Tooltip>
          {variant === "overlay" ? (
            <Tooltip title={t("common:close", "Close")}>
              <button
                type="button"
                aria-label={t("common:close", "Close")}
                onClick={() => onClose?.()}
                className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text"
                title={t("common:close", "Close")}
              >
                <X className="size-4" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip title={t("common:chatSidebar.collapse", "Collapse sidebar")}>
              <button
                type="button"
                aria-label={t("common:chatSidebar.collapse", "Collapse sidebar")}
                onClick={() => onClose?.()}
                className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text"
                title={t("common:chatSidebar.collapse", "Collapse sidebar")}
              >
                <ChevronLeft className="size-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <label className="panel-input flex items-center gap-2">
          <Search className="size-4 text-text-subtle" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t("common:chatSidebar.search", "Search chats...") as string}
            data-testid="sidepanel-sidebar-search"
            className="w-full bg-transparent text-body text-text outline-none placeholder:text-text-subtle"
          />
        </label>
      </div>

      {selectionMode && (
        <div className="border-b border-border px-4 py-2">
          <div className="flex items-center justify-between text-xs text-text-subtle">
            <span>
              {t("sidepanel:multiSelect.count", {
                defaultValue: "{{count}} selected",
                count: selectedTabIds.length
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-text-subtle hover:text-text"
                disabled={visibleTabIds.length === 0}
              >
                {t("sidepanel:multiSelect.selectAll", "Select all")}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-text-subtle hover:text-text"
                disabled={selectedTabIds.length === 0}
              >
                {t("sidepanel:multiSelect.clear", "Clear")}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openBulkFolderPicker}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface2"
              disabled={selectedTabIds.length === 0}
            >
              <FolderPlus className="size-3.5" />
              {t("sidepanel:multiSelect.addToFolder", "Add to folders")}
            </button>
            <button
              type="button"
              onClick={openBulkTagPicker}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface2"
              disabled={selectedTabIds.length === 0}
            >
              <Tag className="size-3.5" />
              {t("sidepanel:multiSelect.addTags", "Add tags")}
            </button>
            <button
              type="button"
              onClick={openBulkDeleteConfirm}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-red-600 hover:bg-surface2"
              disabled={selectedTabIds.length === 0}
            >
              <Trash2 className="size-3.5" />
              {t("common:delete", "Delete")}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {pinnedTabs.length > 0 && (
          <div className={groupSpacing}>
            <div className="panel-section-label">
              {t("common:pinned", "Pinned")}
            </div>
            <div className={classNames("flex flex-col", groupGap)}>
              {pinnedTabs.map((tab) => renderTabRow(tab))}
            </div>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className={groupSpacing}>
            <div className="panel-section-label">
              {group.label}
            </div>
            <div className={classNames("flex flex-col", groupGap)}>
              {group.items.map((tab) => renderTabRow(tab))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        <ModeToggle />
      </div>

      <FolderPickerModal
        open={folderPickerOpen}
        onClose={handleFolderPickerClose}
        conversationId={folderPickerTabId}
      />

      <BulkFolderPickerModal
        open={bulkFolderPickerOpen}
        conversationIds={selectedConversationIds}
        onClose={handleBulkFolderPickerClose}
        onSuccess={clearSelection}
      />

      <BulkTagPickerModal
        open={bulkTagPickerOpen}
        conversationIds={selectedConversationIds}
        onClose={handleBulkTagPickerClose}
        onSuccess={clearSelection}
      />

      <Modal
        open={bulkDeleteConfirmOpen}
        onCancel={handleBulkDeleteConfirmClose}
        onOk={handleBulkDelete}
        okText={t("sidepanel:multiSelect.deleteConfirmOk", "Move to trash")}
        cancelText={t("common:cancel", "Cancel")}
        okButtonProps={{ danger: true }}
        title={t(
          "sidepanel:multiSelect.deleteConfirmTitle",
          "Move chats to trash?"
        )}
        destroyOnClose
      >
        <p>
          {t(
            "sidepanel:multiSelect.deleteConfirmBody",
            "This will hide the selected chats by tagging them as Trash."
          )}
        </p>
      </Modal>
    </aside>
  )
}
