import { Popover, Switch, Tooltip, Upload } from "antd"
import {
  Search,
  MoreHorizontal,
  Eye,
  Globe,
  Image as ImageIcon,
  UploadCloud,
  LayoutGrid,
  BookText,
  StickyNote,
  Layers
} from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import { BsIncognito } from "react-icons/bs"
import { ModelSelect } from "@/components/Common/ModelSelect"
import { PromptSelect } from "@/components/Common/PromptSelect"
import { SaveStatusIcon } from "./SaveStatusIcon"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { formatShortcut, isMac } from "@/hooks/useKeyboardShortcuts"

interface ControlRowProps {
  // Prompt selection
  selectedSystemPrompt: string | undefined
  setSelectedSystemPrompt: (promptId: string | undefined) => void
  setSelectedQuickPrompt: (prompt: string | undefined) => void
  // Save state
  temporaryChat: boolean
  serverChatId?: string | null
  setTemporaryChat: (value: boolean) => void
  // Toggles
  webSearch: boolean
  setWebSearch: (value: boolean) => void
  chatMode: "normal" | "rag" | "vision"
  setChatMode: (mode: "normal" | "rag" | "vision") => void
  // Image upload
  onImageUpload: (file: File) => void
  // RAG toggle
  onToggleRag: () => void
  // Connection state
  isConnected: boolean
}

export const ControlRow: React.FC<ControlRowProps> = ({
  selectedSystemPrompt,
  setSelectedSystemPrompt,
  setSelectedQuickPrompt,
  temporaryChat,
  serverChatId,
  setTemporaryChat,
  webSearch,
  setWebSearch,
  chatMode,
  setChatMode,
  onImageUpload,
  onToggleRag,
  isConnected
}) => {
  const { t } = useTranslation(["sidepanel", "playground", "common"])
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreBtnRef = React.useRef<HTMLButtonElement>(null)
  const { capabilities } = useServerCapabilities()

  const openOptionsPage = React.useCallback((hash: string) => {
    try {
      if (
        typeof browser === "undefined" ||
        !browser.runtime ||
        !browser.tabs
      ) {
        window.open(`/options.html${hash}`, "_blank")
        return
      }
      const url = browser.runtime.getURL(`/options.html${hash}`)
      browser.tabs.create({ url })
    } catch {
      window.open(`/options.html${hash}`, "_blank")
    }
  }, [])

  const handleSaveClick = () => {
    // Toggle between ephemeral and local save
    setTemporaryChat(!temporaryChat)
  }

  const moreMenuContent = (
    <div
      className="flex flex-col gap-2 p-2 min-w-[200px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          setMoreOpen(false)
          requestAnimationFrame(() => moreBtnRef.current?.focus())
        }
      }}
    >
      {/* Save Mode */}
      <div className="text-xs text-gray-500 font-medium">
        {t("sidepanel:controlRow.saveMode", "Save Mode")}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">
          {t("sidepanel:controlRow.ephemeral", "Ephemeral")}
        </span>
        <Switch
          size="small"
          checked={temporaryChat}
          onChange={(checked) => setTemporaryChat(checked)}
        />
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Search & Vision Section */}
      <div className="text-xs text-gray-500 font-medium">
        {t("sidepanel:controlRow.searchSection", "Search & Vision")}
      </div>

      {/* Web Search - only show if server supports it */}
      {capabilities?.hasWebSearch && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm flex items-center gap-1.5">
            <Globe className="size-3.5" />
            {t("sidepanel:controlRow.webSearch", "Web Search")}
          </span>
          <Switch
            size="small"
            checked={webSearch}
            onChange={(checked) => setWebSearch(checked)}
          />
        </div>
      )}

      {/* Vision */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm flex items-center gap-1.5">
          <Eye className="size-3.5" />
          {t("sidepanel:controlRow.vision", "Vision")}
        </span>
        {/* L12: Always show tooltip for disabled controls for better accessibility */}
        <Tooltip
          title={
            chatMode === "rag"
              ? t("sidepanel:controlRow.visionDisabledRag", "Disable RAG mode to use Vision")
              : t("sidepanel:controlRow.visionTooltip", "Enable Vision to analyze images")
          }
          open={chatMode === "rag" ? undefined : false}
        >
          <Switch
            size="small"
            checked={chatMode === "vision"}
            disabled={chatMode === "rag"}
            onChange={(checked) => setChatMode(checked ? "vision" : "normal")}
          />
        </Tooltip>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Upload Image */}
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={(file) => {
          onImageUpload(file)
          setMoreOpen(false)
          return false
        }}
      >
        <button className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ImageIcon className="size-4 text-gray-500" />
          {t("sidepanel:controlRow.uploadImage", "Upload Image")}
        </button>
      </Upload>

      {/* Quick Ingest */}
      <button
        disabled={!isConnected}
        onClick={() => {
          try {
            browser.runtime.sendMessage({ type: "tldw:ingest", mode: "store" })
          } catch {}
          setMoreOpen(false)
        }}
        className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UploadCloud className="size-4 text-gray-500" />
        {t("sidepanel:controlRow.quickIngest", "Quick Ingest Page")}
      </button>

      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Modes - open full UI */}
      <div className="text-xs text-gray-500 font-medium">
        {t("sidepanel:controlRow.openInFullUI", "Open in Full UI")}
      </div>
      <button
        onClick={() => openOptionsPage("#/")}
        className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <LayoutGrid className="size-4 text-gray-500" />
        {t("sidepanel:controlRow.modeChat", "Chat")}
      </button>
      <button
        onClick={() => openOptionsPage("#/media")}
        className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <BookText className="size-4 text-gray-500" />
        {t("sidepanel:controlRow.modeMedia", "Media")}
      </button>
      <button
        onClick={() => openOptionsPage("#/notes")}
        className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <StickyNote className="size-4 text-gray-500" />
        {t("sidepanel:controlRow.modeNotes", "Notes")}
      </button>
      <button
        onClick={() => openOptionsPage("#/flashcards")}
        className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Layers className="size-4 text-gray-500" />
        {t("sidepanel:controlRow.modeFlashcards", "Flashcards")}
      </button>
    </div>
  )

  return (
    <div data-testid="control-row" className="flex items-center gap-1.5 flex-wrap">
        {/* Ephemeral mode indicator badge */}
        {temporaryChat && (
          <Tooltip title={t("sidepanel:controlRow.ephemeralModeActive", "Ephemeral mode: chat won't be saved")}>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
              <BsIncognito className="size-3" />
              <span>{t("sidepanel:controlRow.ephemeralBadge", "Ephemeral")}</span>
            </div>
          </Tooltip>
        )}

        {/* Prompt & Model selectors */}
        <PromptSelect
          selectedSystemPrompt={selectedSystemPrompt}
          setSelectedSystemPrompt={setSelectedSystemPrompt}
          setSelectedQuickPrompt={setSelectedQuickPrompt}
          iconClassName="size-4"
          className="text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100"
        />
        <ModelSelect iconClassName="size-4" showSelectedName />

        {/* Divider */}
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />

        {/* RAG Toggle - with label and shortcut */}
        <button
          type="button"
          data-testid="control-rag-toggle"
          onClick={onToggleRag}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 transition-colors ${
            chatMode === "rag"
              ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900/40"
              : "text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          aria-label={t("sidepanel:controlRow.ragSearch", "RAG Search")}
          aria-pressed={chatMode === "rag"}
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">{t("sidepanel:controlRow.rag", "RAG")}</span>
        </button>

        {/* Web Search Toggle - with label and shortcut (if available) */}
        {capabilities?.hasWebSearch && (
          <button
            type="button"
            data-testid="control-web-toggle"
            onClick={() => setWebSearch(!webSearch)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 transition-colors ${
              webSearch
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/40"
                : "text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={t("sidepanel:controlRow.webSearch", "Web Search")}
            aria-pressed={webSearch}
          >
            <Globe className="size-3.5" />
            <span className="hidden sm:inline">{t("sidepanel:controlRow.web", "Web")}</span>
          </button>
        )}

        {/* Vision Toggle - with label */}
        <Tooltip
          title={
            chatMode === "rag"
              ? t("sidepanel:controlRow.visionDisabledRag", "Disable RAG mode to use Vision")
              : undefined
          }
        >
          <button
            type="button"
            data-testid="control-vision-toggle"
            onClick={() => setChatMode(chatMode === "vision" ? "normal" : "vision")}
            disabled={chatMode === "rag"}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              chatMode === "vision"
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/40"
                : "text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={t("sidepanel:controlRow.vision", "Vision")}
            aria-pressed={chatMode === "vision"}
          >
            <Eye className="size-3.5" />
            <span className="hidden sm:inline">{t("sidepanel:controlRow.vision", "Vision")}</span>
          </button>
        </Tooltip>

        {/* Save Status Icon */}
        <SaveStatusIcon
          temporaryChat={temporaryChat}
          serverChatId={serverChatId}
          onClick={handleSaveClick}
        />

        {/* More Tools Menu */}
        <Popover
          trigger="click"
          open={moreOpen}
          onOpenChange={(visible) => {
            setMoreOpen(visible)
            if (!visible) {
              requestAnimationFrame(() => moreBtnRef.current?.focus())
            }
          }}
          content={moreMenuContent}
          placement="topRight"
        >
          <button
            ref={moreBtnRef}
            type="button"
            data-testid="control-more-menu"
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700"
            aria-label={t("sidepanel:controlRow.moreTools", "More tools")}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="size-4 text-gray-500 dark:text-gray-400" />
          </button>
        </Popover>
      </div>
    )
}
