import { Popover, Switch, Tooltip, Upload } from "antd"
import {
  Search,
  MoreHorizontal,
  Eye,
  Globe,
  Image as ImageIcon,
  UploadCloud,
  ExternalLink
} from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import { BsIncognito } from "react-icons/bs"
import { ModelSelect } from "@/components/Common/ModelSelect"
import { PromptSelect } from "@/components/Common/PromptSelect"
import { FeatureHint, useFeatureHintSeen } from "@/components/Common/FeatureHint"
import { SaveStatusIcon } from "./SaveStatusIcon"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { browser } from "wxt/browser"

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

  // Track if hints have been seen
  const knowledgeHintSeen = useFeatureHintSeen("knowledge-search")
  const moreToolsHintSeen = useFeatureHintSeen("more-tools")

  const handleSaveClick = () => {
    // Toggle between ephemeral and local save
    setTemporaryChat(!temporaryChat)
  }

  const openQuickIngest = () => {
    window.dispatchEvent(new CustomEvent("tldw:open-quick-ingest"))
    setMoreOpen(false)
    requestAnimationFrame(() => moreBtnRef.current?.focus())
  }

  const openFullApp = () => {
    try {
      const url = browser.runtime.getURL("/options.html#/")
      if (browser.tabs?.create) {
        browser.tabs.create({ url })
        setMoreOpen(false)
        requestAnimationFrame(() => moreBtnRef.current?.focus())
        return
      }
    } catch {}
    window.open("/options.html#/", "_blank")
    setMoreOpen(false)
    requestAnimationFrame(() => moreBtnRef.current?.focus())
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
              ? t("sidepanel:controlRow.visionDisabledKnowledge", "Disable Knowledge Search to use Vision")
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

      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      <div className="text-xs text-gray-500 font-medium">
        {t("sidepanel:controlRow.quickActions", "Quick actions")}
      </div>
      <button
        type="button"
        onClick={openQuickIngest}
        className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <UploadCloud className="size-4 text-gray-500" />
        {t("sidepanel:controlRow.quickIngest", "Quick ingest")}
      </button>
      <button
        type="button"
        onClick={openFullApp}
        className="w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <ExternalLink className="size-4 text-gray-500" />
        {t("sidepanel:controlRow.openInFullUI", "Open full app")}
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

        {/* Knowledge Search - opens panel */}
        <div className="relative">
          <button
            type="button"
            data-testid="control-rag-toggle"
            onClick={onToggleRag}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-2 sm:py-1 rounded text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 transition-colors min-h-[44px] sm:min-h-0 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label={t("sidepanel:controlRow.knowledgeSearch", "Open knowledge search")}
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">{t("sidepanel:controlRow.knowledge", "Knowledge search")}</span>
          </button>
          {!knowledgeHintSeen && isConnected && (
            <FeatureHint
              featureKey="knowledge-search"
              title={t("common:featureHints.knowledge.title", "Search your knowledge")}
              description={t("common:featureHints.knowledge.description", "Open the knowledge search panel to find snippets and insert them into your chat.")}
              position="top"
            />
          )}
        </div>

        {/* Web Search Toggle - with label and shortcut (if available) */}
        {capabilities?.hasWebSearch && (
          <button
            type="button"
            data-testid="control-web-toggle"
            onClick={() => setWebSearch(!webSearch)}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-2 sm:py-1 rounded text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 transition-colors min-h-[44px] sm:min-h-0 ${
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

        {/* Save Status Icon */}
        <SaveStatusIcon
          temporaryChat={temporaryChat}
          serverChatId={serverChatId}
          onClick={handleSaveClick}
        />

        {/* More Tools Menu */}
        <div className="relative">
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
              className="p-2 sm:p-1.5 min-h-[44px] sm:min-h-0 rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700"
              aria-label={t("sidepanel:controlRow.moreTools", "More tools")}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="size-4 text-gray-500 dark:text-gray-400" />
            </button>
          </Popover>
          {!moreToolsHintSeen && (
            <FeatureHint
              featureKey="more-tools"
              title={t("common:featureHints.moreTools.title", "More tools available")}
              description={t("common:featureHints.moreTools.description", "Access vision mode, image upload, quick ingest, and the full app.")}
              position="top"
            />
          )}
        </div>
      </div>
    )
}
