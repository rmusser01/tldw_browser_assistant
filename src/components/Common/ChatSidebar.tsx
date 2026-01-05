import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Input, Tooltip, Segmented } from "antd"
import {
  Plus,
  Search,
  UploadCloud,
  BookText,
  StickyNote,
  Layers,
  NotebookPen,
  Microscope,
  Scissors,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"

import { useDebounce } from "@/hooks/useDebounce"
import { useServerChatHistory } from "@/hooks/useServerChatHistory"
import { useMessageOption } from "@/hooks/useMessageOption"
import { useFolderStore } from "@/store/folder"
import { cn } from "@/libs/utils"
import { ServerChatList } from "./ChatSidebar/ServerChatList"
import { FolderChatList } from "./ChatSidebar/FolderChatList"
import { QuickChatHelperButton } from "@/components/Common/QuickChatHelper"
import { ModeToggle } from "@/components/Sidepanel/Chat/ModeToggle"

const storage = new Storage({ area: "local" })

interface ChatSidebarProps {
  /** Whether sidebar is collapsed */
  collapsed?: boolean
  /** Toggle collapsed state */
  onToggleCollapse?: () => void
  /** Optional override for selected chat ID */
  selectedChatId?: string | null
  /** Optional callback when chat is selected */
  onSelectChat?: (chatId: string) => void
  /** Optional callback for new chat action */
  onNewChat?: () => void
  /** Optional callback for ingest action */
  onIngest?: () => void
  /** Additional class names */
  className?: string
}

type SidebarTab = "local" | "server" | "folders"

export function ChatSidebar({
  collapsed = false,
  onToggleCollapse,
  onSelectChat,
  onNewChat,
  onIngest,
  className
}: ChatSidebarProps) {
  const { t } = useTranslation(["common", "sidepanel", "option"])
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Tab state persisted in localStorage
  const [activeTab, setActiveTab] = useStorage<SidebarTab>({
    key: "tldw:sidebar:activeTab",
    instance: storage
  })
  const allowedTabs: SidebarTab[] = ["server", "folders"]
  const defaultTab: SidebarTab = "server"
  const currentTab =
    activeTab && allowedTabs.includes(activeTab) ? activeTab : defaultTab
  const [shortcutsCollapsed, setShortcutsCollapsed] = useStorage<boolean>({
    key: "tldw:sidebar:shortcutsCollapsed",
    instance: storage
  })
  const showShortcuts = shortcutsCollapsed !== true

  // Chat state
  const { clearChat, temporaryChat } = useMessageOption()

  // Folder conversation count for tab badge
  const conversationKeywordLinks = useFolderStore((s) => s.conversationKeywordLinks)
  const folderConversationCount = useMemo(
    () => new Set(conversationKeywordLinks.map((link) => link.conversation_id)).size,
    [conversationKeywordLinks]
  )

  // Server chat count for tab badge
  const { data: serverChatData } = useServerChatHistory(debouncedSearchQuery)
  const serverChats = serverChatData || []

  React.useEffect(() => {
    if (activeTab && allowedTabs.includes(activeTab)) return
    void setActiveTab(defaultTab)
  }, [activeTab, allowedTabs, defaultTab, setActiveTab])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat()
    } else {
      clearChat()
    }
  }

  const handleIngest = () => {
    if (onIngest) {
      onIngest()
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tldw:open-quick-ingest"))
    }
  }

  // Build tab options with counts
  const tabOptions = [
    {
      value: "server" as SidebarTab,
      label: `${t("common:chatSidebar.tabs.server", "Server")}${serverChats.length > 0 ? ` (${serverChats.length})` : ""}`
    },
    {
      value: "folders" as SidebarTab,
      label: `${t("common:chatSidebar.tabs.folders", "Folders")}${folderConversationCount > 0 ? ` (${folderConversationCount})` : ""}`
    }
  ]

  // Collapsed view - just icons
  if (collapsed) {
    return (
      <div
        data-testid="chat-sidebar"
        className={cn(
          "flex flex-col h-screen items-center py-4 gap-2 w-12 border-r border-border bg-surface2",
          className
        )}
      >
        <Tooltip
          title={t("common:chatSidebar.expand", "Expand sidebar")}
          placement="right"
        >
          <button
            data-testid="chat-sidebar-toggle"
            onClick={onToggleCollapse}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text"
          >
            <ChevronRight className="size-4" />
          </button>
        </Tooltip>

        <div className="h-px w-6 bg-border my-2" />

        <Tooltip
          title={t("common:chatSidebar.newChat", "New Chat")}
          placement="right"
        >
          <button
            data-testid="chat-sidebar-new-chat"
            onClick={handleNewChat}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-primary"
          >
            <Plus className="size-4" />
          </button>
        </Tooltip>

        <Tooltip
          title={t("common:chatSidebar.ingest", "Quick Ingest")}
          placement="right"
        >
          <button
            onClick={handleIngest}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-primary disabled:opacity-50"
          >
            <UploadCloud className="size-4" />
            <span className="sr-only">
              {t("common:chatSidebar.ingest", "Quick Ingest")}
            </span>
          </button>
        </Tooltip>

        <div className="h-px w-6 bg-border my-2" />

        <Tooltip
          title={t("common:chatSidebar.media", "Media")}
          placement="right"
        >
          <button
            onClick={() => navigate("/media")}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text"
          >
            <BookText className="size-4" />
          </button>
        </Tooltip>

        <Tooltip
          title={t("common:chatSidebar.notes", "Notes")}
          placement="right"
        >
          <button
            onClick={() => navigate("/notes")}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text"
          >
            <StickyNote className="size-4" />
          </button>
        </Tooltip>

        <Tooltip
          title={t("common:chatSidebar.flashcards", "Flashcards")}
          placement="right"
        >
          <button
            onClick={() => navigate("/flashcards")}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text"
          >
            <Layers className="size-4" />
          </button>
        </Tooltip>

        <Tooltip
          title={t("common:chatSidebar.prompts", "Prompts")}
          placement="right"
        >
          <button
            onClick={() => navigate("/prompts")}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text"
          >
            <NotebookPen className="size-4" />
          </button>
        </Tooltip>

        <Tooltip
          title={t("common:chatSidebar.multiItem", "Multi-Item")}
          placement="right"
        >
          <button
            onClick={() => navigate("/media-multi")}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text"
          >
            <Microscope className="size-4" />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <QuickChatHelperButton
          variant="inline"
          showToggle={false}
          appearance="ghost"
          tooltipPlacement="right"
        />

        <Tooltip
          title={t("common:chatSidebar.settings", "Settings")}
          placement="right"
        >
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text"
          >
            <Settings className="size-4" />
          </button>
        </Tooltip>
      </div>
    )
  }

  // Expanded view
  return (
    <div
      data-testid="chat-sidebar"
        className={cn(
          "flex flex-col h-screen w-64 border-r border-border bg-surface2",
          className
        )}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <h2 className="font-semibold text-text">
          {t("common:chatSidebar.title", "Chats")}
        </h2>
        <div className="flex items-center gap-1">
          <Tooltip title={t("common:chatSidebar.newChat", "New Chat")}>
            <button
              data-testid="chat-sidebar-new-chat"
              onClick={handleNewChat}
              className="p-2 rounded text-text-muted hover:bg-surface hover:text-primary"
            >
              <Plus className="size-4" />
            </button>
          </Tooltip>
          <Tooltip
            title={t("common:chatSidebar.collapse", "Collapse sidebar")}
          >
            <button
              data-testid="chat-sidebar-toggle"
              onClick={onToggleCollapse}
              className="p-2 rounded text-text-muted hover:bg-surface hover:text-text"
            >
              <ChevronLeft className="size-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <Input
          data-testid="chat-sidebar-search"
          prefix={<Search className="size-3.5 text-text-subtle" />}
          placeholder={t("common:chatSidebar.search", "Search chats...")}
          value={searchQuery}
          onChange={handleSearchChange}
          size="small"
          className="bg-surface"
          allowClear
        />
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-border">
        <Segmented
          value={currentTab}
          onChange={(value) => setActiveTab(value as SidebarTab)}
          options={tabOptions}
          block
          size="small"
          className="w-full"
        />
      </div>

      {/* Quick Actions */}
      <button
        type="button"
        aria-expanded={showShortcuts}
        aria-controls="chat-sidebar-shortcuts"
        onClick={() => setShortcutsCollapsed(showShortcuts)}
        className="group flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface"
        title={t("common:chatSidebar.shortcuts", "Shortcuts")}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
          {t("common:chatSidebar.shortcuts", "Shortcuts")}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-text-muted transition-transform group-hover:text-text",
            showShortcuts ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {showShortcuts && (
        <div id="chat-sidebar-shortcuts" className="px-3 pb-2 space-y-1">
          <button
            onClick={handleIngest}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text disabled:opacity-50"
          >
            <UploadCloud className="size-4" />
            <span>{t("common:chatSidebar.ingest", "Quick Ingest")}</span>
          </button>
          <button
            onClick={() => navigate("/media")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <BookText className="size-4" />
            <span>{t("common:chatSidebar.media", "Media")}</span>
          </button>
          <button
            onClick={() => navigate("/notes")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <StickyNote className="size-4" />
            <span>{t("common:chatSidebar.notes", "Notes")}</span>
          </button>
          <button
            onClick={() => navigate("/flashcards")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <Layers className="size-4" />
            <span>{t("common:chatSidebar.flashcards", "Flashcards")}</span>
          </button>
          <button
            onClick={() => navigate("/prompts")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <NotebookPen className="size-4" />
            <span>{t("common:chatSidebar.prompts", "Prompts")}</span>
          </button>
          <button
            onClick={() => navigate("/chunking-playground")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <Scissors className="size-4" />
            <span>
              {t(
                "settings:chunkingPlayground.nav",
                "Chunking Playground"
              )}
            </span>
          </button>
          <button
            onClick={() => navigate("/media-multi")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <Microscope className="size-4" />
            <span>{t("common:chatSidebar.multiItem", "Multi-Item")}</span>
          </button>
        </div>
      )}

      <div className="h-px bg-border mx-3" />

      {/* Tab Content */}
      <div
        className={cn(
          "flex-1 overflow-y-auto",
          temporaryChat ? "pointer-events-none opacity-50" : ""
        )}
      >
        {currentTab === "server" && (
          <ServerChatList
            searchQuery={debouncedSearchQuery}
          />
        )}

        {currentTab === "folders" && (
          <FolderChatList
            onSelectChat={onSelectChat}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
        >
          <Settings className="size-4" />
          <span>{t("common:chatSidebar.settings", "Settings")}</span>
        </button>
        <div className="mt-2 border-t border-border pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModeToggle />
            </div>
            <QuickChatHelperButton
              variant="inline"
              showToggle={false}
              appearance="ghost"
              className="shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatSidebar
