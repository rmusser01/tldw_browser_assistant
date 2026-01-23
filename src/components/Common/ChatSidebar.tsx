import React, { useState, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
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
  CombineIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare
} from "lucide-react"
import {
  SIDEBAR_ACTIVE_TAB_SETTING,
  SIDEBAR_SHORTCUTS_COLLAPSED_SETTING
} from "@/services/settings/ui-settings"
import { useSetting } from "@/hooks/useSetting"

import { useDebounce } from "@/hooks/useDebounce"
import { useServerChatHistory } from "@/hooks/useServerChatHistory"
import { useClearChat } from "@/hooks/chat/useClearChat"
import { useStoreMessageOption } from "@/store/option"
import { useFolderStore } from "@/store/folder"
import { useRouteTransitionStore } from "@/store/route-transition"
import { cn } from "@/libs/utils"
import { ServerChatList } from "./ChatSidebar/ServerChatList"
import { FolderChatList } from "./ChatSidebar/FolderChatList"
import { QuickChatHelperButton } from "@/components/Common/QuickChatHelper"
import { ModeToggle } from "@/components/Sidepanel/Chat/ModeToggle"

interface ChatSidebarProps {
  /** Whether sidebar is collapsed */
  collapsed?: boolean
  /** Toggle collapsed state */
  onToggleCollapse?: () => void
  /** Additional class names */
  className?: string
}

type SidebarTab = "server" | "folders"

export function ChatSidebar({
  collapsed = false,
  onToggleCollapse,
  className
}: ChatSidebarProps) {
  const { t } = useTranslation(["common", "sidepanel", "option"])
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [selectionMode, setSelectionMode] = useState(false)

  // Tab state persisted in UI settings
  const [currentTab, setCurrentTab] = useSetting(SIDEBAR_ACTIVE_TAB_SETTING)
  const [shortcutsCollapsed, setShortcutsCollapsed] = useSetting(
    SIDEBAR_SHORTCUTS_COLLAPSED_SETTING
  )
  const showShortcuts = shortcutsCollapsed !== true

  const clearChat = useClearChat()
  const temporaryChat = useStoreMessageOption((state) => state.temporaryChat)
  const startRouteTransition = useRouteTransitionStore((state) => state.start)

  // Folder conversation count for tab badge
  const conversationKeywordLinks = useFolderStore((s) => s.conversationKeywordLinks)
  const folderConversationCount = useMemo(
    () => new Set(conversationKeywordLinks.map((link) => link.conversation_id)).size,
    [conversationKeywordLinks]
  )

  // Server chat count for tab badge
  const { data: serverChatData } = useServerChatHistory(debouncedSearchQuery)
  const serverChats = serverChatData || []

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleNewChat = () => {
    clearChat()
  }

  const handleIngest = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tldw:open-quick-ingest"))
    }
  }

  const navigateWithLoading = React.useCallback(
    (path: string) => {
      if (path === location.pathname) {
        return
      }
      void setShortcutsCollapsed(true)
      startRouteTransition(path)
      navigate(path)
    },
    [location.pathname, navigate, setShortcutsCollapsed, startRouteTransition]
  )

  React.useEffect(() => {
    if (currentTab !== "server" && selectionMode) {
      setSelectionMode(false)
    }
  }, [currentTab, selectionMode])

  const previousPathRef = React.useRef(location.pathname)
  React.useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname
      void setShortcutsCollapsed(true)
    }
  }, [location.pathname, setShortcutsCollapsed])

  // Build tab options with counts
  const tabOptions: Array<{ value: SidebarTab; label: string }> = [
    {
      value: "server",
      label: `${t("common:chatSidebar.tabs.server", "Server")}${serverChats.length > 0 ? ` (${serverChats.length})` : ""}`
    },
    {
      value: "folders",
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
          {currentTab === "server" && (
            <Tooltip
              title={
                selectionMode
                  ? t("sidepanel:multiSelect.exit", "Exit selection")
                  : t("sidepanel:multiSelect.enter", "Select chats")
              }
            >
              <button
                type="button"
                onClick={() => setSelectionMode((prev) => !prev)}
                className={cn(
                  "rounded p-2",
                  selectionMode
                    ? "bg-surface text-text"
                    : "text-text-muted hover:bg-surface hover:text-text"
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
          )}
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
        <Segmented<SidebarTab>
          value={currentTab}
          onChange={(value) => {
            void setCurrentTab(value)
          }}
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
        onClick={() => {
          void setShortcutsCollapsed(showShortcuts)
        }}
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
            onClick={() => navigateWithLoading("/knowledge")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <CombineIcon className="size-4" />
            <span>{t("option:header.modeKnowledge", "Knowledge QA")}</span>
          </button>
          <button
            onClick={() => navigateWithLoading("/media")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <BookText className="size-4" />
            <span>{t("common:chatSidebar.media", "Media")}</span>
          </button>
          <button
            onClick={() => navigateWithLoading("/notes")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <StickyNote className="size-4" />
            <span>{t("common:chatSidebar.notes", "Notes")}</span>
          </button>
          <button
            onClick={() => navigateWithLoading("/flashcards")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <Layers className="size-4" />
            <span>{t("common:chatSidebar.flashcards", "Flashcards")}</span>
          </button>
          <button
            onClick={() => navigateWithLoading("/prompts")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <NotebookPen className="size-4" />
            <span>{t("common:chatSidebar.prompts", "Prompts")}</span>
          </button>
          <button
            onClick={() => navigateWithLoading("/workspace-playground")}
            className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <Scissors className="size-4" />
            <span>
              {t(
                "option:header.workspacePlayground",
                "Workspace Playground"
              )}
            </span>
          </button>
          <button
            onClick={() => navigateWithLoading("/media-multi")}
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
            selectionMode={selectionMode}
          />
        )}

        {currentTab === "folders" && (
          <FolderChatList />
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
