import {
  formatToChatHistory,
  formatToMessage,
  getTitleById,
  getRecentChatFromCopilot,
  generateID
} from "@/db/dexie/helpers"
import useBackgroundMessage from "@/hooks/useBackgroundMessage"
import { useMigration } from "@/hooks/useMigration"
import { useSmartScroll } from "@/hooks/useSmartScroll"
import {
  useChatShortcuts,
  useSidebarShortcuts,
  useChatModeShortcuts,
  useWebSearchShortcuts
} from "@/hooks/keyboard/useKeyboardShortcuts"
import { useConnectionActions } from "@/hooks/useConnectionState"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { copilotResumeLastChat } from "@/services/app"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { createSafeStorage } from "@/utils/safe-storage"
import { CHAT_BACKGROUND_IMAGE_SETTING } from "@/services/settings/ui-settings"
import { useStorage } from "@plasmohq/storage/hook"
import { ChevronDown } from "lucide-react"
import React, { lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { SidePanelBody } from "~/components/Sidepanel/Chat/body"
import { SidepanelForm } from "~/components/Sidepanel/Chat/form"
import { SidepanelHeaderSimple } from "~/components/Sidepanel/Chat/SidepanelHeaderSimple"
import { ConnectionBanner } from "~/components/Sidepanel/Chat/ConnectionBanner"
import { SidepanelChatSidebar } from "~/components/Sidepanel/Chat/Sidebar"
import NoteQuickSaveModal from "~/components/Sidepanel/Notes/NoteQuickSaveModal"
import { useMessage } from "~/hooks/useMessage"
import { useSidepanelChatTabsStore } from "@/store/sidepanel-chat-tabs"
import { DEFAULT_CHAT_SETTINGS } from "@/types/chat-settings"
import type {
  ChatModelSettingsSnapshot,
  SidepanelChatSnapshot,
  SidepanelChatTab
} from "@/store/sidepanel-chat-tabs"
import { useStoreChatModelSettings } from "@/store/model"
import { useUiModeStore } from "@/store/ui-mode"
import { useArtifactsStore } from "@/store/artifacts"
import { ArtifactsPanel } from "@/components/Sidepanel/Chat/ArtifactsPanel"

// Lazy-load Timeline to reduce initial bundle size (~1.2MB cytoscape)
const TimelineModal = lazy(() =>
  import("@/components/Timeline").then((m) => ({ default: m.TimelineModal }))
)
const CommandPalette = lazy(() =>
  import("@/components/Common/CommandPalette").then((m) => ({
    default: m.CommandPalette
  }))
)
import type { ChatHistory, Message as ChatMessage } from "~/store/option"

const deriveNoteTitle = (
  content: string,
  pageTitle?: string,
  url?: string
): string => {
  const cleanedTitle = (pageTitle || "").trim()
  if (cleanedTitle) return cleanedTitle
  const normalized = (content || "").trim().replace(/\s+/g, " ")
  if (normalized) {
    const words = normalized.split(" ").slice(0, 8).join(" ")
    return words + (normalized.length > words.length ? "..." : "")
  }
  if (url) {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }
  return ""
}

const MODEL_SETTINGS_KEYS = [
  "f16KV",
  "frequencyPenalty",
  "keepAlive",
  "logitsAll",
  "mirostat",
  "mirostatEta",
  "mirostatTau",
  "numBatch",
  "numCtx",
  "numGpu",
  "numGqa",
  "numKeep",
  "numPredict",
  "numThread",
  "penalizeNewline",
  "presencePenalty",
  "repeatLastN",
  "repeatPenalty",
  "ropeFrequencyBase",
  "ropeFrequencyScale",
  "temperature",
  "tfsZ",
  "topK",
  "topP",
  "typicalP",
  "useMLock",
  "useMMap",
  "vocabOnly",
  "seed",
  "minP",
  "systemPrompt",
  "useMlock",
  "reasoningEffort",
  "ocrLanguage",
  "historyMessageLimit",
  "historyMessageOrder",
  "slashCommandInjectionMode",
  "apiProvider",
  "extraHeaders",
  "extraBody"
] as const

type ModelSettingsKey = (typeof MODEL_SETTINGS_KEYS)[number]
type ChatModelSettingsState = ReturnType<typeof useStoreChatModelSettings>

const pickChatModelSettings = (
  state: ChatModelSettingsState
): ChatModelSettingsSnapshot => {
  const snapshot = {} as Record<
    ModelSettingsKey,
    ChatModelSettingsSnapshot[ModelSettingsKey]
  >
  MODEL_SETTINGS_KEYS.forEach((key) => {
    snapshot[key] = state[key] as ChatModelSettingsSnapshot[ModelSettingsKey]
  })
  return snapshot as ChatModelSettingsSnapshot
}

const applyChatModelSettingsSnapshot = (
  snapshot: ChatModelSettingsSnapshot | undefined
) => {
  const store = useStoreChatModelSettings.getState()
  store.reset()
  if (!snapshot) return
  MODEL_SETTINGS_KEYS.forEach((key) => {
    const value = snapshot[key]
    if (value !== undefined) {
      store.updateSetting(key, value as any)
    }
  })
}

const SidepanelChat = () => {
  const drop = React.useRef<HTMLDivElement>(null)
  const [dropedFile, setDropedFile] = React.useState<File | undefined>()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [sidebarSearchQuery, setSidebarSearchQuery] = React.useState("")
  const [composerHeight, setComposerHeight] = React.useState(0)
  const { t } = useTranslation(["playground", "sidepanel", "common"])
  const notification = useAntdNotification()
  // Per-tab storage (Chrome side panel) or per-window/global (Firefox sidebar).
  // tabId: undefined = not resolved yet, null = resolved but unavailable.
  const [tabId, setTabId] = React.useState<number | null | undefined>(undefined)
  const [isRestoringChat, setIsRestoringChat] = React.useState(false)
  const storageRef = React.useRef(
    createSafeStorage({
      area: "local"
    })
  )
  const [dropState, setDropState] = React.useState<
    "idle" | "dragging" | "error"
  >("idle")
  const [dropFeedback, setDropFeedback] = React.useState<
    { type: "info" | "error"; message: string } | null
  >(null)
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  // L20: Debounce timer for drag-leave to prevent false positives
  const dragLeaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const showDropFeedback = React.useCallback(
    (feedback: { type: "info" | "error"; message: string }) => {
      setDropFeedback(feedback)
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
      feedbackTimerRef.current = setTimeout(() => {
        // L16: Explicitly clear feedback on timer expiry
        setDropFeedback(null)
        feedbackTimerRef.current = null
      }, 4000)
    },
    []
  )
  useMigration()
  const {
    streaming,
    onSubmit,
    messages,
    history,
    setHistory,
    historyId,
    setHistoryId,
    setMessages,
    selectedModel,
    setSelectedModel,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    defaultChatWithWebsite,
    chatMode,
    setChatMode,
    toolChoice,
    setToolChoice,
    setIsEmbedding,
    setIsFirstMessage,
    setIsLoading,
    setIsProcessing,
    setIsSearchingInternet,
    setStreaming,
    setTemporaryChat,
    sidepanelTemporaryChat,
    stopStreamingRequest,
    temporaryChat,
    clearChat,
    queuedMessages,
    setQueuedMessages,
    serverChatClusterId,
    serverChatExternalRef,
    serverChatId,
    serverChatSource,
    serverChatState,
    serverChatTopic,
    setServerChatClusterId,
    setServerChatExternalRef,
    setServerChatId,
    setServerChatSource,
    setServerChatState,
    setServerChatTopic,
    setUseOCR,
    useOCR,
    webSearch,
    setWebSearch
  } = useMessage()
  const tabs = useSidepanelChatTabsStore((state) => state.tabs)
  const activeTabId = useSidepanelChatTabsStore((state) => state.activeTabId)
  const modelSettingsSnapshot = useStoreChatModelSettings((state) =>
    pickChatModelSettings(state)
  )
  const isSwitchingTabRef = React.useRef(false)
  const { containerRef, isAutoScrollToBottom, autoScrollToBottom } =
    useSmartScroll(messages, streaming, 100)
  const uiMode = useUiModeStore((state) => state.mode)
  const [isNarrow, setIsNarrow] = React.useState(false)
  const { checkOnce } = useConnectionActions()
  const [noteModalOpen, setNoteModalOpen] = React.useState(false)
  const [noteDraftContent, setNoteDraftContent] = React.useState("")
  const [noteDraftTitle, setNoteDraftTitle] = React.useState("")
  const [noteSuggestedTitle, setNoteSuggestedTitle] = React.useState("")
  const [noteSourceUrl, setNoteSourceUrl] = React.useState<string | undefined>()
  const [noteSaving, setNoteSaving] = React.useState(false)
  const [noteError, setNoteError] = React.useState<string | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [stickyChatInput] = useStorage(
    "stickyChatInput",
    DEFAULT_CHAT_SETTINGS.stickyChatInput
  )

  const resetNoteModal = React.useCallback(() => {
    setNoteModalOpen(false)
    setNoteDraftContent("")
    setNoteDraftTitle("")
    setNoteSuggestedTitle("")
    setNoteSourceUrl(undefined)
    setNoteSaving(false)
    setNoteError(null)
  }, [])

  const handleNoteSave = React.useCallback(async () => {
    const content = noteDraftContent.trim()
    const title = (noteDraftTitle || noteSuggestedTitle).trim()
    if (!content) {
      setNoteError(t("sidepanel:notes.emptyContent", "Nothing to save"))
      return
    }
    if (!title) {
      setNoteError(t("sidepanel:notes.titleRequired", "Add a title to save this note"))
      return
    }
    setNoteError(null)
    setNoteSaving(true)
    try {
      await tldwClient.createNote(content, {
        title,
        metadata: {
          source_url: noteSourceUrl,
          origin: "context-menu"
        }
      })
      notification.success({
        message: t("sidepanel:notification.savedToNotes", "Saved to Notes")
      })
      resetNoteModal()
    } catch (e: any) {
      const msg = e?.message || "Failed to save note"
      setNoteError(msg)
      notification.error({ message: msg })
    } finally {
      setNoteSaving(false)
    }
  }, [
    noteDraftContent,
    noteDraftTitle,
    noteSuggestedTitle,
    noteSourceUrl,
    notification,
    resetNoteModal,
    t
  ])

  const handleNoteTitleChange = (value: string) => {
    setNoteDraftTitle(value)
    if (noteError) setNoteError(null)
  }

  const handleNoteContentChange = (value: string) => {
    setNoteDraftContent(value)
    if (noteError) setNoteError(null)
  }

  const buildSnapshot = React.useCallback((): SidepanelChatSnapshot => {
    return {
      history,
      messages,
      chatMode,
      historyId,
      webSearch,
      toolChoice,
      selectedModel: selectedModel ?? null,
      selectedSystemPrompt,
      selectedQuickPrompt,
      temporaryChat,
      useOCR,
      serverChatId,
      serverChatState,
      serverChatTopic,
      serverChatClusterId,
      serverChatSource,
      serverChatExternalRef,
      queuedMessages,
      modelSettings: modelSettingsSnapshot
    }
  }, [
    history,
    messages,
    chatMode,
    historyId,
    webSearch,
    toolChoice,
    selectedModel,
    selectedSystemPrompt,
    selectedQuickPrompt,
    temporaryChat,
    useOCR,
    serverChatId,
    serverChatState,
    serverChatTopic,
    serverChatClusterId,
    serverChatSource,
    serverChatExternalRef,
    queuedMessages,
    modelSettingsSnapshot
  ])

  const applySnapshot = React.useCallback(
    (snapshot: SidepanelChatSnapshot) => {
      setHistory(snapshot.history || [])
      setMessages(snapshot.messages || [])
      setHistoryId(snapshot.historyId ?? null)
      setChatMode(snapshot.chatMode || "normal")
      setWebSearch(snapshot.webSearch ?? false)
      setToolChoice(snapshot.toolChoice ?? "auto")
      setSelectedModel(snapshot.selectedModel ?? null)
      setSelectedSystemPrompt(snapshot.selectedSystemPrompt ?? null)
      setSelectedQuickPrompt(snapshot.selectedQuickPrompt ?? null)
      setTemporaryChat(snapshot.temporaryChat ?? false)
      setUseOCR(snapshot.useOCR ?? false)
      setServerChatId(snapshot.serverChatId ?? null)
      setServerChatState(snapshot.serverChatState ?? null)
      setServerChatTopic(snapshot.serverChatTopic ?? null)
      setServerChatClusterId(snapshot.serverChatClusterId ?? null)
      setServerChatSource(snapshot.serverChatSource ?? null)
      setServerChatExternalRef(snapshot.serverChatExternalRef ?? null)
      setQueuedMessages(snapshot.queuedMessages ?? [])
      setIsFirstMessage((snapshot.history || []).length === 0)
      setIsLoading(false)
      setIsProcessing(false)
      setIsEmbedding(false)
      setStreaming(false)
      setIsSearchingInternet(false)
      applyChatModelSettingsSnapshot(snapshot.modelSettings)
    },
    [
      setHistory,
      setMessages,
      setHistoryId,
      setChatMode,
      setWebSearch,
      setSelectedModel,
      setSelectedSystemPrompt,
      setSelectedQuickPrompt,
      setTemporaryChat,
      setUseOCR,
      setServerChatId,
      setServerChatState,
      setServerChatTopic,
      setServerChatClusterId,
      setServerChatSource,
      setServerChatExternalRef,
      setQueuedMessages,
      setIsFirstMessage,
      setIsLoading,
      setIsProcessing,
      setIsEmbedding,
      setStreaming,
      setIsSearchingInternet
    ]
  )

  const saveActiveTabSnapshot = React.useCallback(() => {
    const currentTabId = useSidepanelChatTabsStore.getState().activeTabId
    if (!currentTabId) return
    const snapshot = buildSnapshot()
    snapshot.modelSettings = pickChatModelSettings(
      useStoreChatModelSettings.getState()
    )
    useSidepanelChatTabsStore.getState().setSnapshot(currentTabId, snapshot)
  }, [buildSnapshot])

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev)
  }

  const toggleChatMode = () => {
    setChatMode(chatMode === "rag" ? "normal" : "rag")
  }

  const toggleWebSearchMode = () => {
    setWebSearch(!webSearch)
  }

  useChatShortcuts(clearChat, true)
  useSidebarShortcuts(toggleSidebar, true)
  useChatModeShortcuts(toggleChatMode, true)
  useWebSearchShortcuts(toggleWebSearchMode, true)

  const [chatBackgroundImage] = useStorage({
    key: CHAT_BACKGROUND_IMAGE_SETTING.key,
    instance: createSafeStorage()
  })
  const bgMsg = useBackgroundMessage()
  const lastBgMsgRef = React.useRef<typeof bgMsg | null>(null)

  const getTabsStorageKey = (id: number | null | undefined) =>
    id != null ? `sidepanelChatTabsState:tab-${id}` : "sidepanelChatTabsState"
  const getLegacyStorageKey = (id: number | null | undefined) =>
    id != null ? `sidepanelChatState:tab-${id}` : "sidepanelChatState"

  type LegacySidepanelChatSnapshot = {
    history: ChatHistory
    messages: ChatMessage[]
    chatMode: typeof chatMode
    historyId: string | null
  }

  type SidepanelTabsState = {
    tabs: SidepanelChatTab[]
    activeTabId: string | null
    snapshotsById: Record<string, SidepanelChatSnapshot>
  }

  const restoreSidepanelState = async () => {
    // Wait until we've attempted to resolve tab id so we don't
    // accidentally attach a tab-specific snapshot to the wrong key.
    if (tabId === undefined) {
      return
    }

    const storage = storageRef.current
    setIsRestoringChat(true)
    try {
      // Prefer a tab-specific snapshot; fall back to the legacy/global key
      // so existing users don't lose their last session.
      const keysToTry: string[] = [getTabsStorageKey(tabId)]
      if (tabId != null) {
        keysToTry.push(getTabsStorageKey(null))
      }

      let tabsState: SidepanelTabsState | null = null
      for (const key of keysToTry) {
        // eslint-disable-next-line no-await-in-loop
        const candidate = (await storage.get(key)) as SidepanelTabsState | null
        if (candidate && Array.isArray(candidate.tabs)) {
          tabsState = candidate
          break
        }
      }

      if (tabsState && tabsState.tabs.length > 0) {
        const fallbackId = tabsState.tabs[0]?.id ?? null
        const resolvedActiveId =
          (tabsState.activeTabId &&
            tabsState.snapshotsById?.[tabsState.activeTabId] &&
            tabsState.activeTabId) ||
          fallbackId
        useSidepanelChatTabsStore
          .getState()
          .setTabsState({
            tabs: tabsState.tabs,
            activeTabId: resolvedActiveId,
            snapshotsById: tabsState.snapshotsById || {}
          })
        if (resolvedActiveId) {
          const snapshot = tabsState.snapshotsById?.[resolvedActiveId]
          if (snapshot) {
            applySnapshot(snapshot)
          }
        }
        setIsRestoringChat(false)
        return
      }

      const legacyKeysToTry: string[] = [getLegacyStorageKey(tabId)]
      if (tabId != null) {
        legacyKeysToTry.push(getLegacyStorageKey(null))
      }

      let legacySnapshot: LegacySidepanelChatSnapshot | null = null
      for (const key of legacyKeysToTry) {
        // eslint-disable-next-line no-await-in-loop
        const candidate = (await storage.get(key)) as
          | LegacySidepanelChatSnapshot
          | null
        if (candidate && Array.isArray(candidate.messages)) {
          legacySnapshot = candidate
          break
        }
      }

      if (legacySnapshot && Array.isArray(legacySnapshot.messages)) {
        const restoredSnapshot: SidepanelChatSnapshot = {
          history: legacySnapshot.history || [],
          messages: legacySnapshot.messages || [],
          chatMode: legacySnapshot.chatMode || "normal",
          historyId: legacySnapshot.historyId ?? null,
          webSearch,
          toolChoice,
          selectedModel: selectedModel ?? null,
          selectedSystemPrompt,
          selectedQuickPrompt,
          temporaryChat,
          useOCR,
          serverChatId,
          serverChatState,
          serverChatTopic,
          serverChatClusterId,
          serverChatSource,
          serverChatExternalRef,
          queuedMessages,
          modelSettings: modelSettingsSnapshot
        }
        const initialTab: SidepanelChatTab = {
          id: generateID(),
          label: t("sidepanel:tabs.newChat", "New chat"),
          historyId: legacySnapshot.historyId ?? null,
          serverChatId: null,
          serverChatTopic: null,
          updatedAt: Date.now()
        }
        useSidepanelChatTabsStore.getState().setTabsState({
          tabs: [initialTab],
          activeTabId: initialTab.id,
          snapshotsById: { [initialTab.id]: restoredSnapshot }
        })
        applySnapshot(restoredSnapshot)
        setIsRestoringChat(false)
        return
      }
    } catch {
      // fall through to recent chat resume
    }

    try {
      const isEnabled = await copilotResumeLastChat()
      if (!isEnabled) {
        setIsRestoringChat(false)
        return
      }
      if (messages.length === 0) {
        const recentChat = await getRecentChatFromCopilot()
        if (recentChat) {
          const restoredHistory = formatToChatHistory(recentChat.messages)
          const restoredMessages = formatToMessage(recentChat.messages)
          const restoredSnapshot: SidepanelChatSnapshot = {
            history: restoredHistory,
            messages: restoredMessages,
            chatMode,
            historyId: recentChat.history.id,
            webSearch,
            toolChoice,
            selectedModel: selectedModel ?? null,
            selectedSystemPrompt,
            selectedQuickPrompt,
            temporaryChat,
            useOCR,
            serverChatId,
            serverChatState,
            serverChatTopic,
            serverChatClusterId,
            serverChatSource,
            serverChatExternalRef,
            queuedMessages,
            modelSettings: modelSettingsSnapshot
          }
          const initialTab: SidepanelChatTab = {
            id: generateID(),
            label: t("sidepanel:tabs.newChat", "New chat"),
            historyId: recentChat.history.id,
            serverChatId: null,
            serverChatTopic: null,
            updatedAt: Date.now()
          }
          useSidepanelChatTabsStore.getState().setTabsState({
            tabs: [initialTab],
            activeTabId: initialTab.id,
            snapshotsById: { [initialTab.id]: restoredSnapshot }
          })
          applySnapshot(restoredSnapshot)
        }
      }
    } finally {
      setIsRestoringChat(false)
    }
  }

  const persistSidepanelState = React.useCallback(() => {
    const storage = storageRef.current
    const key = getTabsStorageKey(tabId)
    saveActiveTabSnapshot()
    const { tabs, activeTabId, snapshotsById } =
      useSidepanelChatTabsStore.getState()
    const snapshot: SidepanelTabsState = {
      tabs,
      activeTabId,
      snapshotsById
    }
    void storage.set(key, snapshot).catch(() => {
      // ignore persistence errors in sidepanel
    })
  }, [saveActiveTabSnapshot, tabId])

  React.useEffect(() => {
    void checkOnce()
  }, [checkOnce])

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const media = window.matchMedia("(max-width: 400px)")
    const update = () => setIsNarrow(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  React.useEffect(() => {
    // Resolve the tab id associated with this sidepanel instance.
    const fetchTabId = async () => {
      try {
        // browser is provided by the extension runtime (see wxt config).
        const resp: any = await browser.runtime.sendMessage({
          type: "tldw:get-tab-id"
        })
        if (resp && typeof resp.tabId === "number") {
          setTabId(resp.tabId)
        } else {
          setTabId(null)
        }
      } catch {
        setTabId(null)
      }
    }
    fetchTabId()
  }, [])

  React.useEffect(() => {
    void restoreSidepanelState()
  }, [tabId])

  const truncateTabLabel = React.useCallback((label: string) => {
    const trimmed = label.trim()
    if (trimmed.length <= 40) return trimmed
    return `${trimmed.slice(0, 40)}...`
  }, [])

  const fallbackLabel = React.useMemo(() => {
    if (historyId || serverChatTopic) return ""
    const firstUserMessage = messages.find((message) => !message.isBot)?.message
    return (firstUserMessage || "").trim()
  }, [historyId, serverChatTopic, messages])

  React.useEffect(() => {
    if (!activeTabId || isSwitchingTabRef.current) return
    let isCurrent = true
    const updateLabel = async () => {
      const store = useSidepanelChatTabsStore.getState()
      const currentTab = store.tabs.find((tab) => tab.id === activeTabId)
      const isManualLabel = currentTab?.labelSource === "manual"
      let label = ""
      if (historyId) {
        try {
          label = (await getTitleById(historyId)) || ""
        } catch {
          label = ""
        }
      }
      if (!label && serverChatTopic) {
        label = serverChatTopic
      }
      if (!label && fallbackLabel) {
        label = fallbackLabel
      }
      if (!label) {
        label = t("sidepanel:tabs.newChat", "New chat")
      }
      if (!isCurrent) return
      useSidepanelChatTabsStore.getState().upsertTab({
        id: activeTabId,
        label:
          isManualLabel && currentTab?.label
            ? currentTab.label
            : truncateTabLabel(label),
        labelSource: isManualLabel ? "manual" : "auto",
        historyId: historyId ?? null,
        serverChatId: serverChatId ?? null,
        serverChatTopic: serverChatTopic ?? null,
        updatedAt: Date.now()
      })
    }
    void updateLabel()
    return () => {
      isCurrent = false
    }
  }, [
    activeTabId,
    fallbackLabel,
    historyId,
    serverChatId,
    serverChatTopic,
    t,
    truncateTabLabel
  ])

  const handleRenameActiveTab = React.useCallback(
    (nextLabel: string) => {
      const trimmed = nextLabel.trim()
      if (!activeTabId || !trimmed) return
      useSidepanelChatTabsStore.getState().renameTab(activeTabId, trimmed)
    },
    [activeTabId]
  )

  React.useEffect(() => {
    if (!activeTabId || isSwitchingTabRef.current) return
    useSidepanelChatTabsStore.getState().setSnapshot(
      activeTabId,
      buildSnapshot()
    )
  }, [activeTabId, buildSnapshot])

  React.useEffect(() => {
    if (isRestoringChat || isSwitchingTabRef.current) return
    if (tabs.length > 0 && activeTabId) return
    const initialTabId = generateID()
    const initialTab: SidepanelChatTab = {
      id: initialTabId,
      label: t("sidepanel:tabs.newChat", "New chat"),
      historyId: historyId ?? null,
      serverChatId: serverChatId ?? null,
      serverChatTopic: serverChatTopic ?? null,
      updatedAt: Date.now()
    }
    useSidepanelChatTabsStore.getState().setTabsState({
      tabs: [initialTab],
      activeTabId: initialTabId,
      snapshotsById: { [initialTabId]: buildSnapshot() }
    })
  }, [
    activeTabId,
    buildSnapshot,
    historyId,
    isRestoringChat,
    serverChatId,
    serverChatTopic,
    t,
    tabs.length
  ])

  const handleNewTab = React.useCallback(() => {
    saveActiveTabSnapshot()
    if (streaming) {
      stopStreamingRequest()
    }
    setDropedFile(undefined)
    const newTabId = generateID()
    useSidepanelChatTabsStore.getState().upsertTab({
      id: newTabId,
      label: t("sidepanel:tabs.newChat", "New chat"),
      historyId: null,
      serverChatId: null,
      serverChatTopic: null,
      updatedAt: Date.now()
    })
    isSwitchingTabRef.current = true
    useSidepanelChatTabsStore.getState().setActiveTabId(newTabId)
    clearChat()
    setTimeout(() => {
      isSwitchingTabRef.current = false
    }, 0)
  }, [
    clearChat,
    saveActiveTabSnapshot,
    setDropedFile,
    stopStreamingRequest,
    streaming,
    t
  ])

  const handleSelectTab = React.useCallback(
    (tabId: string) => {
      if (!tabId || tabId === activeTabId) return
      saveActiveTabSnapshot()
      if (streaming) {
        stopStreamingRequest()
      }
      setDropedFile(undefined)
      const snapshot = useSidepanelChatTabsStore.getState().getSnapshot(tabId)
      isSwitchingTabRef.current = true
      useSidepanelChatTabsStore.getState().setActiveTabId(tabId)
      if (snapshot) {
        applySnapshot(snapshot)
      } else {
        clearChat()
      }
      setTimeout(() => {
        isSwitchingTabRef.current = false
      }, 0)
    },
    [
      activeTabId,
      applySnapshot,
      clearChat,
      saveActiveTabSnapshot,
      stopStreamingRequest,
      streaming,
      setDropedFile
    ]
  )

  const handleCloseTab = React.useCallback(
    (tabId: string) => {
      const store = useSidepanelChatTabsStore.getState()
      if (store.tabs.length <= 1) {
        store.removeTab(tabId)
        handleNewTab()
        return
      }
      if (tabId === store.activeTabId) {
        const currentIndex = store.tabs.findIndex((tab) => tab.id === tabId)
        const nextTab =
          store.tabs[currentIndex + 1] || store.tabs[currentIndex - 1]
        if (nextTab) {
          handleSelectTab(nextTab.id)
        }
      }
      store.removeTab(tabId)
    },
    [handleNewTab, handleSelectTab]
  )

  React.useEffect(() => {
    const handleBeforeUnload = () => {
      persistSidepanelState()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistSidepanelState()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      persistSidepanelState()
    }
  }, [persistSidepanelState])

  React.useEffect(() => {
    if (!drop.current) {
      return
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setDropState("idle")

      const files = Array.from(e.dataTransfer?.files || [])

      const isImage = files.every((file) => file.type.startsWith("image/"))

      if (!isImage) {
        setDropState("error")
        showDropFeedback({
          type: "error",
          message: t(
            "playground:drop.imageOnly",
            "Only images can be dropped here right now."
          )
        })
        return
      }

      const newFiles = Array.from(e.dataTransfer?.files || []).slice(0, 1)
      if (newFiles.length > 0) {
        setDropedFile(newFiles[0])
        showDropFeedback({
          type: "info",
          message: `${newFiles[0]?.name || "Image"} ready to send`
        })
      }
    }

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // L20: Clear drag-leave debounce timer when re-entering
      if (dragLeaveTimerRef.current) {
        clearTimeout(dragLeaveTimerRef.current)
        dragLeaveTimerRef.current = null
      }
      setDropState("dragging")
      showDropFeedback({
        type: "info",
        message: t(
          "playground:drop.imageHint",
          "Drop an image to include it in your message"
        )
      })
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // L20: Debounce drag-leave by 50ms to prevent false positives from child elements
      if (dragLeaveTimerRef.current) {
        clearTimeout(dragLeaveTimerRef.current)
      }
      dragLeaveTimerRef.current = setTimeout(() => {
        setDropState("idle")
        dragLeaveTimerRef.current = null
      }, 50)
    }

    drop.current.addEventListener("dragover", handleDragOver)
    drop.current.addEventListener("drop", handleDrop)
    drop.current.addEventListener("dragenter", handleDragEnter)
    drop.current.addEventListener("dragleave", handleDragLeave)

    return () => {
      if (drop.current) {
        drop.current.removeEventListener("dragover", handleDragOver)
        drop.current.removeEventListener("drop", handleDrop)
        drop.current.removeEventListener("dragenter", handleDragEnter)
        drop.current.removeEventListener("dragleave", handleDragLeave)
      }
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = null
      }
      // L20: Clean up drag-leave debounce timer
      if (dragLeaveTimerRef.current) {
        clearTimeout(dragLeaveTimerRef.current)
        dragLeaveTimerRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    if (defaultChatWithWebsite) {
      setChatMode("rag")
    }
    if (sidepanelTemporaryChat) {
      setTemporaryChat(true)
    }
  }, [defaultChatWithWebsite, sidepanelTemporaryChat])

  React.useEffect(() => {
    if (!bgMsg) return
    if (lastBgMsgRef.current === bgMsg) return

    if (bgMsg.type === "save-to-notes") {
      lastBgMsgRef.current = bgMsg
      const selected = (bgMsg.text || bgMsg.payload?.selectionText || "").trim()
      if (!selected) {
        notification.warning({
          message: t(
            "sidepanel:notification.noSelectionForNotes",
            "Select text to save to Notes"
          )
        })
        return
      }
      const sourceUrl = (bgMsg.payload?.pageUrl as string | undefined) || undefined
      const suggestedTitle = deriveNoteTitle(
        selected,
        bgMsg.payload?.pageTitle as string | undefined,
        sourceUrl
      )
      setNoteDraftContent(selected)
      setNoteSuggestedTitle(suggestedTitle)
      setNoteDraftTitle(suggestedTitle)
      setNoteSourceUrl(sourceUrl)
      setNoteSaving(false)
      setNoteError(null)
        setNoteModalOpen(true)
      return
    }

    if (streaming) return

    lastBgMsgRef.current = bgMsg

    if (bgMsg.type === "transcription" || bgMsg.type === "transcription+summary") {
      const transcript = (bgMsg.payload?.transcript || bgMsg.text || "").trim()
      const summaryText = (bgMsg.payload?.summary || "").trim()
      const url = (bgMsg.payload?.url as string | undefined) || ""
      const label =
        bgMsg.type === "transcription+summary"
          ? t("sidepanel:notification.transcriptionSummaryTitle", "Transcription + summary")
          : t("sidepanel:notification.transcriptionTitle", "Transcription")
      const parts: string[] = []
      if (url) {
        parts.push(`${t("sidepanel:notification.sourceLabel", "Source")}: ${url}`)
      }
      if (transcript) {
        parts.push(`${t("sidepanel:notification.transcriptLabel", "Transcript")}:\n${transcript}`)
      }
      if (summaryText) {
        parts.push(`${t("sidepanel:notification.summaryLabel", "Summary")}:\n${summaryText}`)
      }
      const messageBody =
        parts.filter(Boolean).join("\n\n") ||
        t(
          "sidepanel:notification.transcriptionFallback",
          "Transcription completed. Open Media in the Web UI to view it."
        )
      const id = generateID()
      setMessages((prev) => [
        ...prev,
        { isBot: true, name: label, message: messageBody, sources: [], id }
      ])
      setHistory([...history, { role: "assistant", content: messageBody }])
      return
    }

    if (selectedModel) {
      onSubmit({
        message: bgMsg.text,
        messageType: bgMsg.type,
        image: ""
      })
    } else {
      notification.error({
        message: t("formError.noModel")
      })
    }
  }, [
    bgMsg,
    streaming,
    selectedModel,
    onSubmit,
    notification,
    t,
    setMessages,
    setHistory,
    history,
    setNoteDraftContent,
    setNoteSuggestedTitle,
    setNoteDraftTitle,
    setNoteSourceUrl,
    setNoteSaving,
    setNoteError,
    setNoteModalOpen
  ])

  const draftKey = activeTabId
    ? `tldw:sidepanelChatDraft:${activeTabId}`
    : "tldw:sidepanelChatDraft"

  const activeTabLabel = React.useMemo(() => {
    const active = tabs.find((tab) => tab.id === activeTabId)
    if (active?.label) return active.label
    return t("sidepanel:tabs.newChat", "New chat")
  }, [activeTabId, tabs, t])

  const isDockedSidebar = uiMode === "pro" && !isNarrow
  const isSidebarVisible = isDockedSidebar || sidebarOpen
  const messagePadding = uiMode === "pro" ? "px-4" : "px-6"
  const artifactsOpen = useArtifactsStore((state) => state.isOpen)
  const closeArtifacts = useArtifactsStore((state) => state.closeArtifact)

  return (
    <div className="flex h-dvh w-full" data-testid="chat-workspace">
      {isSidebarVisible && (
        <SidepanelChatSidebar
          open={isSidebarVisible}
          variant={isDockedSidebar ? "docked" : "overlay"}
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
          searchQuery={sidebarSearchQuery}
          onSearchQueryChange={setSidebarSearchQuery}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      {!isDockedSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <main className="relative h-dvh flex-1 bg-bg" data-testid="chat-main">
        <div className="relative z-20 w-full">
          <SidepanelHeaderSimple
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            activeTitle={activeTabLabel}
            onRenameTitle={handleRenameActiveTab}
          />
          <ConnectionBanner className="pt-12" />
        </div>
        <div
          ref={drop}
          data-testid="chat-dropzone"
          className={`relative flex h-full flex-col items-center bg-bg ${
            dropState === "dragging" ? "bg-surface2" : ""
          }`}
          style={
            chatBackgroundImage
              ? {
                  backgroundImage: `url(${chatBackgroundImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat"
                }
              : {}
          }>
          {/* Background overlay for opacity effect */}
          {chatBackgroundImage && (
            <div
              className="absolute inset-0 bg-bg"
              style={{ opacity: 0.9, pointerEvents: "none" }}
            />
          )}

          {dropState === "dragging" && (
            <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
              <div className="rounded-2xl border border-dashed border-white/70 bg-black/70 px-5 py-3 text-center text-sm font-medium text-white shadow-lg backdrop-blur-sm dark:border-white/40">
                {t(
                  "playground:drop.overlayInstruction",
                  "Drop the image to attach it to your next reply"
                )}
              </div>
            </div>
          )}

          {dropFeedback && (
            <div className="pointer-events-none absolute top-20 left-0 right-0 z-30 flex justify-center px-4">
              <div
                role="status"
                aria-live="polite"
                className={`max-w-lg rounded-full px-4 py-2 text-sm shadow-lg backdrop-blur-sm ${
                  dropFeedback.type === "error"
                    ? "bg-red-600 text-white"
                    : "bg-slate-900/80 text-white dark:bg-slate-100/90 dark:text-slate-900"
                }`}
              >
                {dropFeedback.message}
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={t("playground:aria.chatTranscript", "Chat messages")}
            data-testid="chat-messages"
            className={`custom-scrollbar relative z-10 flex flex-1 w-full flex-col items-center overflow-x-hidden overflow-y-auto ${messagePadding}`}
            style={{
              paddingBottom: stickyChatInput
                ? composerHeight
                  ? composerHeight + 16
                  : 160
                : 0
            }}
          >
            {isRestoringChat ? (
              <div
                className="relative flex w-full flex-col items-center pt-16 pb-4"
                aria-busy="true"
                aria-label={t("sidepanel:chat.restoringChat", "Restoring previous chat")}>
                <div className="w-full max-w-3xl space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <SidePanelBody
                scrollParentRef={containerRef}
                searchQuery={sidebarSearchQuery}
                inputRef={textareaRef}
              />
            )}
            {!stickyChatInput && (
              <div className="w-full pt-4 pb-6">
                <SidepanelForm
                  key={activeTabId || "sidepanel-chat"}
                  dropedFile={dropedFile}
                  inputRef={textareaRef}
                  onHeightChange={setComposerHeight}
                  draftKey={draftKey}
                />
              </div>
            )}
          </div>

          {!isAutoScrollToBottom && (
            <div className="fixed bottom-32 z-20 left-0 right-0 flex justify-center">
              <button
                onClick={() => autoScrollToBottom()}
                aria-label={t("playground:composer.scrollToLatest", "Scroll to latest messages")}
                title={t("playground:composer.scrollToLatest", "Scroll to latest messages") as string}
                data-testid="chat-scroll-latest"
                className="bg-gray-50 shadow border border-gray-200 dark:border-none dark:bg-white/20 p-1.5 rounded-full pointer-events-auto hover:bg-gray-100 dark:hover:bg-white/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
                <ChevronDown className="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
              </button>
            </div>
          )}
          {stickyChatInput && (
            <div className="absolute bottom-0 w-full z-10">
              <SidepanelForm
                key={activeTabId || "sidepanel-chat"}
                dropedFile={dropedFile}
                inputRef={textareaRef}
                onHeightChange={setComposerHeight}
                draftKey={draftKey}
              />
            </div>
          )}
        </div>
      </main>
      {artifactsOpen && (
        <>
          <button
            type="button"
            aria-label={t("common:close", "Close")}
            onClick={closeArtifacts}
            className="fixed inset-0 z-40 bg-black/40"
            title={t("common:close", "Close")}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px]">
            <ArtifactsPanel />
          </div>
        </>
      )}
      <NoteQuickSaveModal
        open={noteModalOpen}
        title={noteDraftTitle}
        content={noteDraftContent}
        suggestedTitle={noteSuggestedTitle}
        sourceUrl={noteSourceUrl}
        loading={noteSaving}
        error={noteError}
        onTitleChange={handleNoteTitleChange}
        onContentChange={handleNoteContentChange}
        onCancel={resetNoteModal}
        onSave={handleNoteSave}
        modalTitle={t("sidepanel:notes.saveToNotesTitle", "Save to Notes")}
        saveText={t("common:save", "Save")}
        cancelText={t("common:cancel", "Cancel")}
        titleLabel={t("sidepanel:notes.titleLabel", "Title")}
        contentLabel={t("sidepanel:notes.contentLabel", "Content")}
        titleRequiredText={t("sidepanel:notes.titleRequired", "Title is required to create a note.")}
        helperText={t("sidepanel:notes.helperText", "Review or edit the selected text, then Save or Cancel.")}
        sourceLabel={t("sidepanel:notes.sourceLabel", "Source")}
      />
      <Suspense fallback={null}>
        <CommandPalette
          scope="sidepanel"
          onNewChat={clearChat}
          onToggleRag={toggleChatMode}
          onToggleWebSearch={toggleWebSearchMode}
          onIngestPage={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("tldw:open-quick-ingest"))
            }
          }}
          onSwitchModel={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("tldw:open-model-settings"))
            }
          }}
          onToggleSidebar={toggleSidebar}
        />
      </Suspense>
      <Suspense fallback={null}>
        <TimelineModal />
      </Suspense>
    </div>
  )
}

export default SidepanelChat
