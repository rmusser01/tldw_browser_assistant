import { Popover, Radio, Switch, Tooltip, Upload } from "antd"
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
import { CharacterSelect } from "./CharacterSelect"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useMcpTools } from "@/hooks/useMcpTools"
import { browser } from "wxt/browser"
import type { ToolChoice } from "@/store/option"

interface ControlRowProps {
  // Prompt selection
  selectedSystemPrompt: string | undefined
  setSelectedSystemPrompt: (promptId: string | undefined) => void
  setSelectedQuickPrompt: (prompt: string | undefined) => void
  // Character selection
  selectedCharacterId: string | null
  setSelectedCharacterId: (id: string | null) => void
  // Save state
  temporaryChat: boolean
  serverChatId?: string | null
  setTemporaryChat: (value: boolean) => void
  // Toggles
  webSearch: boolean
  setWebSearch: (value: boolean) => void
  chatMode: "normal" | "rag" | "vision"
  setChatMode: (mode: "normal" | "rag" | "vision") => void
  toolChoice: ToolChoice
  setToolChoice: (value: ToolChoice) => void
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
  selectedCharacterId,
  setSelectedCharacterId,
  temporaryChat,
  serverChatId,
  setTemporaryChat,
  webSearch,
  setWebSearch,
  chatMode,
  setChatMode,
  toolChoice,
  setToolChoice,
  onImageUpload,
  onToggleRag,
  isConnected
}) => {
  const { t } = useTranslation(["sidepanel", "playground", "common"])
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreBtnRef = React.useRef<HTMLButtonElement>(null)
  const { capabilities } = useServerCapabilities()
  const {
    hasMcp,
    healthState: mcpHealthState,
    tools: mcpTools,
    toolsLoading: mcpToolsLoading
  } = useMcpTools()

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
      <div className="text-caption text-text-muted font-medium">
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

      <div className="panel-divider my-1" />

      {/* Search & Vision Section */}
      <div className="text-caption text-text-muted font-medium">
        {t("sidepanel:controlRow.searchSection", "Search & Vision")}
      </div>

      {/* Web Search - only show if server supports it */}
      {capabilities?.hasWebSearch && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm flex items-center gap-2">
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
        <span className="text-sm flex items-center gap-2">
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

      <div className="panel-divider my-1" />

      <div className="text-caption text-text-muted font-medium">
        {t("sidepanel:controlRow.toolChoiceLabel", "Tool choice")}
      </div>
      <Tooltip
        title={
          !hasMcp
            ? t("sidepanel:controlRow.mcpToolsUnavailable", "MCP tools unavailable")
            : mcpHealthState === "unhealthy"
              ? t("sidepanel:controlRow.mcpToolsUnhealthy", "MCP tools are offline")
              : mcpToolsLoading
                ? t("sidepanel:controlRow.mcpToolsLoading", "Loading tools...")
                : mcpTools.length === 0
                  ? t("sidepanel:controlRow.mcpToolsEmpty", "No MCP tools available")
                  : ""
        }
        open={
          !hasMcp ||
          mcpHealthState === "unhealthy" ||
          mcpToolsLoading ||
          mcpTools.length === 0
            ? undefined
            : false
        }
      >
        <Radio.Group
          size="small"
          value={toolChoice}
          onChange={(e) => setToolChoice(e.target.value as ToolChoice)}
          className="flex flex-wrap gap-2"
          aria-label={t("sidepanel:controlRow.toolChoiceLabel", "Tool choice")}
          disabled={
            !hasMcp ||
            mcpHealthState === "unhealthy" ||
            mcpToolsLoading ||
            mcpTools.length === 0
          }
        >
          <Radio.Button value="auto">
            {t("sidepanel:controlRow.toolChoiceAuto", "Auto")}
          </Radio.Button>
          <Radio.Button value="required">
            {t("sidepanel:controlRow.toolChoiceRequired", "Required")}
          </Radio.Button>
          <Radio.Button value="none">
            {t("sidepanel:controlRow.toolChoiceNone", "None")}
          </Radio.Button>
        </Radio.Group>
      </Tooltip>
      <div className="text-caption text-text-muted font-medium">
        {t("sidepanel:controlRow.mcpToolsLabel", "MCP tools")}
      </div>
      {mcpToolsLoading ? (
        <div className="text-xs text-text-muted">
          {t("sidepanel:controlRow.mcpToolsLoading", "Loading tools...")}
        </div>
      ) : mcpTools.length === 0 ? (
        <div className="text-xs text-text-muted">
          {!hasMcp
            ? t("sidepanel:controlRow.mcpToolsUnavailable", "MCP tools unavailable")
            : mcpHealthState === "unhealthy"
              ? t("sidepanel:controlRow.mcpToolsUnhealthy", "MCP tools are offline")
              : t("sidepanel:controlRow.mcpToolsEmpty", "No MCP tools available")}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {mcpTools.slice(0, 6).map((tool, index) => {
            const toolFn = (tool as any)?.function
            const name =
              (typeof tool?.name === "string" && tool.name) ||
              (typeof toolFn?.name === "string" && toolFn.name) ||
              (typeof (tool as any)?.id === "string" && (tool as any).id) ||
              `tool-${index + 1}`
            const description =
              (typeof tool?.description === "string" && tool.description) ||
              (typeof toolFn?.description === "string" && toolFn.description) ||
              ""
            return (
              <span
                key={`${name}-${index}`}
                title={description || name}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text"
              >
                {name}
              </span>
            )
          })}
          {mcpTools.length > 6 && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
              +{mcpTools.length - 6}
            </span>
          )}
        </div>
      )}

      <div className="panel-divider my-1" />

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
        <button
          data-testid="chat-upload-image"
          className="w-full text-left text-sm px-3 py-2 rounded flex items-center gap-2 hover:bg-surface2"
          title={t("sidepanel:controlRow.uploadImage", "Upload Image")}
        >
          <ImageIcon className="size-4 text-text-subtle" />
          {t("sidepanel:controlRow.uploadImage", "Upload Image")}
        </button>
      </Upload>

      <div className="panel-divider my-1" />

      <div className="text-caption text-text-muted font-medium">
        {t("sidepanel:controlRow.quickActions", "Quick actions")}
      </div>
      <button
        type="button"
        onClick={openQuickIngest}
        data-testid="chat-quick-ingest"
        className="w-full text-left text-sm px-3 py-2 rounded flex items-center gap-2 hover:bg-surface2"
        title={t("sidepanel:controlRow.quickIngest", "Quick ingest")}
      >
        <UploadCloud className="size-4 text-text-subtle" />
        {t("sidepanel:controlRow.quickIngest", "Quick ingest")}
      </button>
      <button
        type="button"
        onClick={openFullApp}
        data-testid="chat-open-full-app"
        className="w-full text-left text-sm px-3 py-2 rounded flex items-center gap-2 hover:bg-surface2"
        title={t("sidepanel:controlRow.openInFullUI", "Open full app")}
      >
        <ExternalLink className="size-4 text-text-subtle" />
        {t("sidepanel:controlRow.openInFullUI", "Open full app")}
      </button>

    </div>
  )

  return (
    <div data-testid="control-row" className="flex items-center gap-2 flex-wrap">
        {/* Ephemeral mode indicator badge */}
        {temporaryChat && (
          <Tooltip title={t("sidepanel:controlRow.ephemeralModeActive", "Ephemeral mode: chat won't be saved")}>
            <div
              data-testid="chat-ephemeral-badge"
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
              <BsIncognito className="size-3" />
              <span>{t("sidepanel:controlRow.ephemeralBadge", "Ephemeral")}</span>
            </div>
          </Tooltip>
        )}

        {/* Prompt, Model & Character selectors */}
        <PromptSelect
          selectedSystemPrompt={selectedSystemPrompt}
          setSelectedSystemPrompt={setSelectedSystemPrompt}
          setSelectedQuickPrompt={setSelectedQuickPrompt}
          iconClassName="size-4"
          className="px-2 text-text-muted hover:text-text"
        />
        <ModelSelect iconClassName="size-4" showSelectedName />
        <CharacterSelect
          selectedCharacterId={selectedCharacterId}
          setSelectedCharacterId={setSelectedCharacterId}
          iconClassName="size-4"
          className="px-2 text-text-muted hover:text-text"
        />

        {/* Divider */}
        <div className="h-4 w-px bg-border mx-1" />

        {/* Knowledge Search - opens panel */}
        <div className="relative">
          <button
            type="button"
            data-testid="control-rag-toggle"
            onClick={onToggleRag}
            className="flex items-center gap-2 px-3 py-2 sm:px-2 sm:py-1 rounded text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors min-h-[44px] sm:min-h-0 text-text-muted hover:bg-surface2 hover:text-text"
            aria-label={t("sidepanel:controlRow.knowledgeSearch", "Open knowledge search")}
            title={t("sidepanel:controlRow.knowledgeSearch", "Open knowledge search")}
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
            className={`flex items-center gap-2 px-3 py-2 sm:px-2 sm:py-1 rounded text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors min-h-[44px] sm:min-h-0 ${
              webSearch
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/40"
                : "text-text-muted hover:bg-surface2 hover:text-text"
            }`}
            aria-label={t("sidepanel:controlRow.webSearch", "Web Search")}
            aria-pressed={webSearch}
            title={t("sidepanel:controlRow.webSearch", "Web Search")}
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
              className="p-2 min-h-[44px] sm:min-h-0 rounded hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={t("sidepanel:controlRow.moreTools", "More tools")}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title={t("sidepanel:controlRow.moreTools", "More tools")}
            >
              <MoreHorizontal className="size-4 text-text-subtle" />
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
