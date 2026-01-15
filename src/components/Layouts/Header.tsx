import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { CogIcon, Gauge, UserCircle2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"
import { ModelSelect } from "../Common/ModelSelect"
import { PromptSelect } from "../Common/PromptSelect"
import PromptSearch from "../Common/PromptSearch"
import { useQuery } from "@tanstack/react-query"
import { useServerOnline } from "@/hooks/useServerOnline"
import { isMac } from "@/hooks/keyboard/useKeyboardShortcuts"
import { fetchChatModels } from "@/services/tldw-server"
import { getTitleById, updateHistory } from "@/db"
import { useStoreChatModelSettings } from "@/store/model"
import { useMessageOption } from "~/hooks/useMessageOption"
import { Avatar, Select, Input, Divider, Tooltip } from "antd"
import { LayoutGrid, Github, GitBranch } from "lucide-react"
import { getAllPrompts } from "@/db/dexie/helpers"
import { ProviderIcons } from "../Common/ProviderIcon"
import logoImage from "~/assets/icon.png"
import { NewChat } from "./NewChat"
import { MoreOptions } from "./MoreOptions"
import { CharacterSelect } from "../Common/CharacterSelect"
import { PrimaryToolbar } from "./PrimaryToolbar"
import type { Character } from "@/types/character"
import OmniSearchBar from "../Common/OmniSearchBar"
import { useOmniSearchDeps } from "@/hooks/useOmniSearchDeps"
import { useTimelineStore } from "@/store/timeline"

// Extracted components for better maintainability
import { ModeSelector, type CoreMode } from "./ModeSelector"
import { ConnectionStatus } from "./ConnectionStatus"
import { QuickIngestButton } from "./QuickIngestButton"
import { HeaderShortcuts } from "./HeaderShortcuts"
import { ChatHeader } from "./ChatHeader"
import { openSidepanel } from "@/utils/sidepanel"
import { useSetting } from "@/hooks/useSetting"
import { HEADER_SHORTCUTS_EXPANDED_SETTING } from "@/services/settings/ui-settings"
import { useSelectedCharacter } from "@/hooks/useSelectedCharacter"

type Props = {
  setOpenModelSettings: (open: boolean) => void
  showSelectors?: boolean
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

export const Header: React.FC<Props> = ({
  setOpenModelSettings,
  showSelectors = true,
  onToggleSidebar,
  sidebarCollapsed = false
}) => {
  const { t, i18n } = useTranslation([
    "option",
    "common",
    "settings",
    "playground"
  ])
  const isRTL = i18n?.dir?.() === "rtl"
  const cmdKey = isMac ? "⌘" : "Ctrl+"

  const [shareModeEnabled] = useStorage("shareMode", false)
  const [headerShortcutsExpanded, setHeaderShortcutsExpanded] = useSetting(
    HEADER_SHORTCUTS_EXPANDED_SETTING
  )
  const [selectedCharacter] = useSelectedCharacter<Character | null>(null)
  const {
    selectedModel,
    setSelectedModel,
    clearChat,
    selectedSystemPrompt,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    setSelectedSystemPrompt,
    messages,
    streaming,
    historyId,
    temporaryChat,
    serverChatId
  } = useMessageOption()
  const omniDeps = useOmniSearchDeps()
  const openTimeline = useTimelineStore((state) => state.openTimeline)
  const isOnline = useServerOnline()
  const {
    data: models,
    isLoading: isModelsLoading
  } = useQuery({
    queryKey: ["fetchModel"],
    queryFn: () => fetchChatModels({ returnEmpty: true }),
    refetchIntervalInBackground: false,
    staleTime: 1000 * 60 * 1,
    enabled: isOnline
  })

  const { data: prompts } = useQuery({
    queryKey: ["fetchAllPromptsLayout"],
    queryFn: getAllPrompts
  })

  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [chatTitle, setChatTitle] = React.useState("")
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)

  const canOpenTimeline = Boolean(historyId) && !temporaryChat && historyId !== "temp"
  const showTimelineButton = canOpenTimeline && !streaming

  const handleOpenTimeline = React.useCallback(() => {
    if (!historyId || temporaryChat || historyId === "temp") return
    void openTimeline(historyId)
  }, [historyId, openTimeline, temporaryChat])

  const currentCoreMode: CoreMode = React.useMemo(() => {
    if (pathname.startsWith("/review") || pathname.startsWith("/media-multi"))
      return "mediaMulti"
    if (pathname.startsWith("/media")) return "media"
    if (
      pathname.startsWith("/settings/knowledge") ||
      pathname.startsWith("/knowledge")
    )
      return "knowledge"
    if (pathname.startsWith("/notes")) return "notes"
    if (
      pathname.startsWith("/prompts") ||
      pathname.startsWith("/settings/prompt")
    )
      return "prompts"
    if (
      pathname.startsWith("/prompt-studio") ||
      pathname.startsWith("/settings/prompt-studio")
    )
      return "promptStudio"
    if (
      pathname.startsWith("/world-books") ||
      pathname.startsWith("/settings/world-books")
    )
      return "worldBooks"
    if (
      pathname.startsWith("/dictionaries") ||
      pathname.startsWith("/settings/chat-dictionaries")
    )
      return "dictionaries"
    if (
      pathname.startsWith("/characters") ||
      pathname.startsWith("/settings/characters")
    )
      return "characters"
    if (pathname.startsWith("/flashcards")) return "flashcards"
    if (pathname.startsWith("/quiz")) return "quiz"
    if (
      pathname.startsWith("/evaluations") ||
      pathname.startsWith("/settings/evaluations")
    ) {
      return "evaluations"
    }
    if (pathname.startsWith("/documentation")) return "documentation"
    if (pathname.startsWith("/chunking-playground")) return "chunkingPlayground"
    if (
      pathname.startsWith("/speech") ||
      pathname.startsWith("/stt") ||
      pathname.startsWith("/tts")
    ) {
      return "speech"
    }
    return "playground"
  }, [pathname])

  const openSidebar = React.useCallback(async () => {
    try {
      await openSidepanel()
    } catch {}
  }, [])

  const handleCoreModeChange = (mode: CoreMode) => {
    switch (mode) {
      case "playground":
        navigate("/")
        break
      case "media":
        navigate("/media")
        break
      case "mediaMulti":
        navigate("/media-multi")
        break
      case "knowledge":
        navigate("/knowledge")
        break
      case "notes":
        navigate("/notes")
        break
      case "prompts":
        navigate("/prompts")
        break
      case "promptStudio":
        navigate("/prompt-studio")
        break
      case "flashcards":
        navigate("/flashcards")
        break
      case "quiz":
        navigate("/quiz")
        break
      case "evaluations":
        navigate("/evaluations")
        break
      case "documentation":
        navigate("/documentation")
        break
      case "chunkingPlayground":
        navigate("/chunking-playground")
        break
      case "worldBooks":
        navigate("/world-books")
        break
      case "dictionaries":
        navigate("/dictionaries")
        break
      case "characters":
        navigate("/characters")
        break
      case "speech":
        navigate("/speech")
        break
      case "watchlists":
        navigate("/watchlists")
        break
    }
  }

  React.useEffect(() => {
    ;(async () => {
      try {
        if (historyId && historyId !== "temp" && !temporaryChat) {
          const title = await getTitleById(historyId)
          setChatTitle(title || "")
        } else {
          setChatTitle("")
        }
      } catch {}
    })()
  }, [historyId, temporaryChat])

  const saveTitle = async (value: string) => {
    try {
      if (historyId && historyId !== "temp" && !temporaryChat) {
        await updateHistory(historyId, value.trim() || "Untitled")
      }
    } catch (e) {
      console.error("Failed to update chat title", e)
    }
  }

  const getPromptInfoById = (id: string) => {
    return prompts?.find((prompt) => prompt.id === id)
  }

  const handlePromptChange = (value?: string) => {
    if (!value) {
      setSelectedSystemPrompt(undefined)
      setSelectedQuickPrompt(undefined)
      return
    }
    const prompt = getPromptInfoById(value)
    if (prompt?.is_system) {
      setSelectedSystemPrompt(prompt.id)
    } else {
      setSelectedSystemPrompt(undefined)
      setSelectedQuickPrompt(prompt!.content)
    }
  }

  const isChatRoute = currentCoreMode === "playground"
  const openCommandPalette = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("tldw:open-command-palette"))
  }, [])

  const openShortcutsModal = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("tldw:open-shortcuts-modal"))
  }, [])

  const toggleHeaderShortcuts = React.useCallback(() => {
    void setHeaderShortcutsExpanded(!headerShortcutsExpanded).catch(() => {
      // ignore storage write failures
    })
  }, [headerShortcutsExpanded, setHeaderShortcutsExpanded])

  const handleTitleEditStart = React.useCallback(() => {
    setIsEditingTitle(true)
  }, [])

  const handleTitleCommit = React.useCallback(
    async (value: string) => {
      setIsEditingTitle(false)
      await saveTitle(value)
    },
    [saveTitle]
  )

  if (isChatRoute) {
    return (
      <ChatHeader
        t={t}
        temporaryChat={temporaryChat}
        historyId={historyId}
        chatTitle={chatTitle}
        isEditingTitle={isEditingTitle}
        onTitleChange={setChatTitle}
        onTitleEditStart={handleTitleEditStart}
        onTitleCommit={handleTitleCommit}
        onToggleSidebar={onToggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        onOpenCommandPalette={openCommandPalette}
        onOpenShortcutsModal={openShortcutsModal}
        onOpenSettings={() => navigate("/settings/tldw")}
        onClearChat={clearChat}
        showTimelineButton={showTimelineButton}
        onOpenTimeline={handleOpenTimeline}
        shortcutsExpanded={headerShortcutsExpanded}
        onToggleShortcuts={toggleHeaderShortcuts}
        commandKeyLabel={cmdKey}
      />
    )
  }

  return (
    <header
      data-istemporary-chat={temporaryChat}
      data-ischat-route={isChatRoute}
      className="z-30 flex w-full flex-col gap-3 border-b bg-bg/95 p-3 backdrop-blur border-border data-[istemporary-chat='true']:bg-purple-900 data-[ischat-route='true']:bg-surface/95">
      {/*
        Top band: place the details bar directly below the PrimaryToolbar (New Chat)
        on all breakpoints to keep the most-used actions grouped together.
      */}
      <div className="flex w-full flex-col gap-3">
        <PrimaryToolbar
          showBack={pathname !== "/"}
          isRTL={isRTL}>
          <div className="flex w-full items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <NewChat clearChat={clearChat} />
              {isChatRoute && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenModelSettings(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-text-muted transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                    title={t("option:header.modelSettings", "Model settings")}
                  >
                    <Gauge className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t("option:header.modelSettings", "Model settings")}
                    </span>
                  </button>
                </>
              )}
              {/* GitHub link moved to right-side cluster */}
              {!temporaryChat && historyId && historyId !== "temp" && (
                <div className="hidden min-w-[160px] max-w-[280px] lg:block">
                  {isEditingTitle ? (
                    <Input
                      size="small"
                      autoFocus
                      value={chatTitle}
                      onChange={(e) => setChatTitle(e.target.value)}
                      onPressEnter={async () => {
                        setIsEditingTitle(false)
                        await saveTitle(chatTitle)
                      }}
                      onBlur={async () => {
                        setIsEditingTitle(false)
                        await saveTitle(chatTitle)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingTitle(true)}
                      className="truncate text-left text-sm text-text hover:underline"
                      title={chatTitle || "Untitled"}>
                      {chatTitle || t("option:header.untitledChat", "Untitled")}
                    </button>
                  )}
                </div>
              )}
              {!temporaryChat && serverChatId && (
                <span
                  className="hidden md:inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs text-success shadow-sm"
                  title={t(
                    "option:header.serverBackedTooltip",
                    "Messages in this chat are also saved on your tldw server."
                  )}>
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {t("option:header.serverBackedLabel", "Server-backed chat")}
                </span>
              )}
              {/* Status chips for current selections */}
              <div className="hidden md:flex items-center gap-2">
                {selectedCharacter?.name && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary shadow-sm">
                    {selectedCharacter?.avatar_url ? (
                      <img
                        src={selectedCharacter.avatar_url}
                        className="h-4 w-4 rounded-full"
                      />
                    ) : (
                      <UserCircle2 className="h-4 w-4" />
                    )}
                    <span className="max-w-[140px] truncate">
                      {selectedCharacter.name}
                    </span>
                  </span>
                )}
                {(selectedSystemPrompt || selectedQuickPrompt) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-text shadow-sm">
                    {t("option:header.promptLabel", "Prompt")}:
                    <span className="max-w-[140px] truncate">
                      {selectedSystemPrompt
                        ? getPromptInfoById(selectedSystemPrompt)?.title ||
                          t("option:header.systemPrompt", "System prompt")
                        : t("option:header.customPrompt", "Custom")}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[160px] flex justify-center">
              <OmniSearchBar deps={omniDeps} />
            </div>
            <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate("/settings/tldw")}
                className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-text-muted transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus   "
                title={t("option:header.serverSettings", "Settings")}
              >
                <CogIcon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {t("option:header.serverSettings", "Settings")}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <img
                  src={logoImage}
                  alt={t("common:pageAssist", "tldw Assistant")}
                  className="h-6 w-auto"
                />
                <span className="text-sm font-medium text-text ">
                  {t("common:pageAssist", "tldw Assistant")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.open(
                      "https://github.com/rmusser01/tldw_browser_assistant",
                      "_blank",
                      "noopener"
                    )
                  } catch {}
                }}
                className="inline-flex items-center justify-center rounded-md border border-transparent p-1 text-text-muted transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus   "
                aria-label={
                  t("option:githubRepository", "GitHub Repository") as string
                }
                title={t("option:githubRepository", "GitHub Repository")}
              >
                <Github className="h-4 w-4" aria-hidden="true" />
              </button>
              {selectedModel && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-text shadow-sm border-border ">
                  {t("option:header.modelLabel", "Model")}:
                  <span className="max-w-[140px] truncate">
                    {(() => {
                      const m = models?.find((m) => m.model === selectedModel)
                      return m?.nickname || m?.model || selectedModel
                    })()}
                  </span>
                </span>
              )}
            </div>
          </div>
        </PrimaryToolbar>

        {showSelectors && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 min-w-[220px]">
              {(() => {
                const id = "header-model-label"
                return (
                  <span
                    id={id}
                    className="text-xs font-medium uppercase tracking-wide text-text-muted ">
                    {t("option:header.modelLabel", "Model")}
                  </span>
                )
              })()}
              <div className="hidden lg:block">
                <Select
                  className="min-w-[220px] max-w-[320px]"
                  placeholder={t("common:selectAModel")}
                  aria-label={t("common:selectAModel") as string}
                  aria-labelledby="header-model-label"
                  value={selectedModel}
                  onChange={(value) => {
                    setSelectedModel(value)
                  }}
                  filterOption={(input, option) => {
                    const rawLabel = option?.label
                    let haystack: string | undefined
                    if (typeof rawLabel === "string") {
                      haystack = rawLabel
                    } else if (React.isValidElement(rawLabel)) {
                      const props = rawLabel.props as {
                        "data-title"?: string
                        children?: React.ReactNode
                      }
                      haystack =
                        props["data-title"] ||
                        (typeof props.children === "string"
                          ? props.children
                          : undefined)
                    }
                    if (!haystack && option?.value != null) {
                      haystack = String(option.value)
                    }
                    return (
                      haystack?.toLowerCase().includes(input.toLowerCase()) ??
                      false
                    )
                  }}
                  showSearch
                  loading={isModelsLoading}
                  options={models?.map((model) => ({
                    label: (
                      <span
                        key={model.model}
                        data-title={model.name}
                        className="flex items-center gap-2">
                        {model?.avatar ? (
                          <Avatar
                            src={model.avatar}
                            alt={model.name}
                            size="small"
                          />
                        ) : (
                          <ProviderIcons
                            provider={model?.provider}
                            className="h-4 w-4"
                          />
                        )}
                        <span className="truncate">
                          {model?.nickname || model.model}
                        </span>
                      </span>
                    ),
                    value: model.model
                  }))}
                  size="large"
                />
              </div>
              <div className="lg:hidden">
                <ModelSelect />
              </div>
            </div>

            <div className="hidden min-w-[240px] flex-col gap-1 lg:flex">
              {(() => {
                const id = "header-prompt-label"
                return (
                  <span
                    id={id}
                    className="text-xs font-medium uppercase tracking-wide text-text-muted ">
                    {t("option:header.promptLabel", "Prompt")}
                  </span>
                )
              })()}
              <PromptSearch
                inputId="header-prompt-search"
                ariaLabel={
                  t("option:selectAPrompt", "Select a Prompt") as string
                }
                ariaLabelledby="header-prompt-label"
                onInsertMessage={(content) => {
                  setSelectedSystemPrompt(undefined)
                  setSelectedQuickPrompt(content)
                }}
                onInsertSystem={(content) => {
                  setSelectedSystemPrompt(undefined)
                  const { setSystemPrompt } =
                    useStoreChatModelSettings.getState?.() ||
                    ({ setSystemPrompt: undefined } as any)
                  setSystemPrompt?.(content)
                }}
              />
            </div>

            <div className="w-full min-w-[180px] lg:hidden">
              <PromptSelect
                selectedSystemPrompt={selectedSystemPrompt}
                setSelectedSystemPrompt={setSelectedSystemPrompt}
                setSelectedQuickPrompt={setSelectedQuickPrompt}
              />
            </div>

            <CharacterSelect className="text-text-muted hover:text-text " />
          </div>
        )}
      </div>

      {showSelectors && <Divider className="hidden lg:block" plain />}

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-xs text-text-muted ">
          <div />

          <div className="flex justify-center">
            <QuickIngestButton />
          </div>

          <div className="flex items-center justify-end gap-3">
            <ConnectionStatus />

            {!isChatRoute && (
              <>
                <button
                  type="button"
                  onClick={() => setOpenModelSettings(true)}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-text-muted transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus    sm:w-auto"
                  title={t("option:header.modelSettings", "Model settings")}
                >
                  <Gauge className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {t("option:header.modelSettings", "Model settings")}
                  </span>
                </button>

                {messages.length > 0 && !streaming && (
                  <div className="flex items-center gap-1">
                    <MoreOptions
                      shareModeEnabled={shareModeEnabled}
                      historyId={historyId}
                      messages={messages}
                    />
                    <span className="sr-only">
                      {t("option:header.moreActions", "More actions")}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    void openSidebar()
                  }}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-text-muted transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus    sm:w-auto"
                  title={t("option:header.openSidebar", "Open sidebar")}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  <span>{t("option:header.openSidebar", "Open sidebar")}</span>
                </button>
              </>
            )}

            {isChatRoute && (
              <>
                {messages.length > 0 && !streaming && (
                  <div className="flex items-center gap-1">
                    <MoreOptions
                      shareModeEnabled={shareModeEnabled}
                      historyId={historyId}
                      messages={messages}
                    />
                    <span className="sr-only">
                      {t("option:header.moreActions", "More actions")}
                    </span>
                  </div>
                )}

                {canOpenTimeline && !streaming && (
                  <Tooltip title={t("option:header.timeline", "Timeline")}>
                    <button
                      type="button"
                      onClick={handleOpenTimeline}
                      className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-text-muted transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus   "
                      title={t("option:header.timeline", "Timeline")}
                    >
                      <GitBranch className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}

                <button
                  type="button"
                  onClick={() => {
                    void openSidebar()
                  }}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-text-muted transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus    sm:w-auto"
                  title={t("option:header.openSidebar", "Open sidebar")}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  <span>{t("option:header.openSidebar", "Open sidebar")}</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:flex-1">
          <ModeSelector
            currentMode={currentCoreMode}
            onModeChange={handleCoreModeChange}
          />
          <HeaderShortcuts />
        </div>
      </div>
    </header>
  )
}
