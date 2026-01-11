import { useMutation } from "@tanstack/react-query"
import React from "react"
import useDynamicTextareaSize from "~/hooks/useDynamicTextareaSize"
import { useMessage } from "~/hooks/useMessage"
import { toBase64 } from "~/libs/to-base64"
import { Checkbox, Dropdown, Switch, Tooltip, message, Modal } from "antd"
import { useWebUI } from "~/store/webui"
import { defaultEmbeddingModelForRag } from "~/services/tldw-server"
import {
  ImageIcon,
  MicIcon,
  StopCircleIcon,
  X,
  CornerUpLeft,
  EyeIcon,
  EyeOffIcon,
  Gauge,
  Search,
  FileText,
  Globe
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { getVariable } from "@/utils/select-variable"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useTldwStt } from "@/hooks/useTldwStt"
import { useMicStream } from "@/hooks/useMicStream"
import { BsIncognito } from "react-icons/bs"
import { handleChatInputKeyDown } from "@/utils/key-down"
import { getIsSimpleInternetSearch } from "@/services/search"
import { useStorage } from "@plasmohq/storage/hook"
import { useSttSettings } from "@/hooks/useSttSettings"
import { useServerDictation } from "@/hooks/useServerDictation"
import { useComposerEvents } from "@/hooks/useComposerEvents"
import { useTemporaryChatToggle } from "@/hooks/useTemporaryChatToggle"
import { useSelectedCharacter } from "@/hooks/useSelectedCharacter"
import {
  COMPOSER_CONSTANTS,
  SPACING,
  STORAGE_KEYS,
  getComposerGap
} from "@/config/ui-constants"
import { isFireFoxPrivateMode } from "@/utils/is-private-mode"
import { useFocusShortcuts } from "@/hooks/keyboard"
import { isFirefoxTarget } from "@/config/platform"
import { useDraftPersistence } from "@/hooks/useDraftPersistence"
import { useSlashCommands, type SlashCommandItem } from "@/hooks/useSlashCommands"
import { useTabMentions, type TabInfo } from "~/hooks/useTabMentions"
import { RagSearchBar } from "@/components/Sidepanel/Chat/RagSearchBar"
import { QueuedMessagesBanner } from "@/components/Sidepanel/Chat/QueuedMessagesBanner"
import { ConnectionStatusIndicator } from "@/components/Sidepanel/Chat/ConnectionStatusIndicator"
import { ControlRow } from "@/components/Sidepanel/Chat/ControlRow"
import { ContextChips } from "@/components/Sidepanel/Chat/ContextChips"
import { SlashCommandMenu } from "@/components/Sidepanel/Chat/SlashCommandMenu"
import { MentionsMenu, type MentionMenuItem } from "@/components/Sidepanel/Chat/MentionsMenu"
import { ModelParamsPanel } from "@/components/Sidepanel/Chat/ModelParamsPanel"
import { CurrentChatModelSettings } from "@/components/Common/Settings/CurrentChatModelSettings"
import { ActorPopout } from "@/components/Common/Settings/ActorPopout"
import { DocumentGeneratorDrawer } from "@/components/Common/Playground/DocumentGeneratorDrawer"
import QuickIngestModal from "@/components/Common/QuickIngestModal"
import {
  useConnectionState,
  useConnectionUxState
} from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useTldwAudioStatus } from "@/hooks/useTldwAudioStatus"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { useSetting } from "@/hooks/useSetting"
import { useFocusComposerOnConnect } from "@/hooks/useComposerFocus"
import { useQuickIngestStore } from "@/store/quick-ingest"
import { useUiModeStore } from "@/store/ui-mode"
import { useStoreMessageOption } from "@/store/option"
import { shallow } from "zustand/shallow"
import { Button } from "@/components/Common/Button"
import { useSimpleForm } from "@/hooks/useSimpleForm"
import { generateID } from "@/db/dexie/helpers"
import type { UploadedFile } from "@/db/dexie/types"
import { formatFileSize } from "@/utils/format"
import { CONTEXT_FILE_SIZE_MB_SETTING } from "@/services/settings/ui-settings"
import { browser } from "wxt/browser"
import type { Character } from "@/types/character"

type Props = {
  dropedFile: File | undefined
  inputRef?: React.RefObject<HTMLTextAreaElement>
  onHeightChange?: (height: number) => void
  draftKey?: string
}

export const SidepanelForm = ({
  dropedFile,
  inputRef,
  onHeightChange,
  draftKey
}: Props) => {
  const formContainerRef = React.useRef<HTMLDivElement>(null)
  const localTextareaRef = React.useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localTextareaRef
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const contextFileInputRef = React.useRef<HTMLInputElement>(null)
  const { sendWhenEnter, setSendWhenEnter } = useWebUI()
  const [typing, setTyping] = React.useState<boolean>(false)
  const { t } = useTranslation(["playground", "common", "option", "sidepanel"])
  const notification = useAntdNotification()
  const [chatWithWebsiteEmbedding] = useStorage(
    "chatWithWebsiteEmbedding",
    false
  )
  const [storedCharacter] = useSelectedCharacter<Character | null>(null)
  const [contextFileMaxSizeMb] = useSetting(CONTEXT_FILE_SIZE_MB_SETTING)
  const maxContextFileSizeBytes = React.useMemo(
    () => contextFileMaxSizeMb * 1024 * 1024,
    [contextFileMaxSizeMb]
  )
  const maxContextFileSizeLabel = React.useMemo(
    () => formatFileSize(maxContextFileSizeBytes),
    [maxContextFileSizeBytes]
  )
  // STT settings consolidated into a single hook
  const sttSettings = useSttSettings()
  const queuedQuickIngestCount = useQuickIngestStore((s) => s.queuedCount)
  const quickIngestHadFailure = useQuickIngestStore((s) => s.hadRecentFailure)
  const uiMode = useUiModeStore((state) => state.mode)
  const isProMode = uiMode === "pro"
  const { replyTarget, clearReplyTarget } = useStoreMessageOption(
    (state) => ({
      replyTarget: state.replyTarget,
      clearReplyTarget: state.clearReplyTarget
    }),
    shallow
  )
  const composerPadding = SPACING.COMPOSER_PADDING
  const composerGap = getComposerGap(isProMode)
  const cardPadding = SPACING.CARD_PADDING
  const textareaMaxHeight = isProMode
    ? COMPOSER_CONSTANTS.TEXTAREA_MAX_HEIGHT_PRO
    : COMPOSER_CONSTANTS.TEXTAREA_MAX_HEIGHT_CASUAL
  const textareaMinHeight = isProMode
    ? COMPOSER_CONSTANTS.TEXTAREA_MIN_HEIGHT_PRO
    : COMPOSER_CONSTANTS.TEXTAREA_MIN_HEIGHT_CASUAL
  const storageKey = draftKey || STORAGE_KEYS.SIDEPANEL_CHAT_DRAFT
  const form = useSimpleForm({
    initialValues: {
      message: "",
      image: ""
    }
  })
  const messageInputProps = form.getInputProps("message")
  const [knowledgeMentionActive, setKnowledgeMentionActive] = React.useState(false)
  const [contextFiles, setContextFiles] = React.useState<UploadedFile[]>([])
  const [mentionActiveIndex, setMentionActiveIndex] = React.useState(0)
  const {
    transcript,
    isListening,
    resetTranscript,
    start: startListening,
    stop: stopSpeechRecognition,
    supported: browserSupportsSpeechRecognition
  } = useSpeechRecognition()

  const {
    tabMentionsEnabled,
    mentionPosition,
    filteredTabs,
    selectedDocuments,
    handleTextChange,
    insertMention,
    closeMentions,
    addDocument,
    removeDocument,
    clearSelectedDocuments,
    reloadTabs,
    handleMentionsOpen
  } = useTabMentions(textareaRef, { includeActive: true })

  const stopListening = async () => {
    if (isListening) {
      stopSpeechRecognition()
    }
  }

  // Draft persistence - saves/restores message draft to local-only storage
  const { draftSaved } = useDraftPersistence({
    storageKey,
    getValue: () => form.values.message,
    setValue: (value) => form.setFieldValue("message", value)
  })
  const hasWarnedPrivateMode = React.useRef(false)

  // Warn Firefox private mode users on mount that data won't persist
  React.useEffect(() => {
    if (!isFireFoxPrivateMode || hasWarnedPrivateMode.current) return
    hasWarnedPrivateMode.current = true
    notification.warning({
      message: t(
        "sidepanel:errors.privateModeTitle",
        "tldw Assistant can't save data"
      ),
      description: t(
        "sidepanel:errors.privateModeDescription",
        "Firefox Private Mode does not support saving chat history. Your conversations won't be saved."
      ),
      duration: 6
    })
  }, [isFireFoxPrivateMode, notification, t])

  React.useEffect(() => {
    if (!onHeightChange) return
    const node = formContainerRef.current
    if (!node || typeof ResizeObserver === "undefined") return

    const notifyHeight = (height: number) => {
      onHeightChange(Math.max(0, Math.ceil(height)))
    }

    notifyHeight(node.getBoundingClientRect().height)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      notifyHeight(entry.contentRect.height)
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [onHeightChange])

  // tldw WS STT
  const {
    connect: sttConnect,
    sendAudio,
    close: sttClose,
    connected: sttConnected,
    lastError: sttError
  } = useTldwStt()
  const {
    start: micStart,
    stop: micStop,
    active: micActive
  } = useMicStream((chunk) => {
    try {
      sendAudio(chunk)
    } catch {}
  })
  const [wsSttActive, setWsSttActive] = React.useState(false)
  const [ingestOpen, setIngestOpen] = React.useState(false)
  const [autoProcessQueuedIngest, setAutoProcessQueuedIngest] =
    React.useState(false)
  const quickIngestBtnRef = React.useRef<HTMLButtonElement>(null)
  const { phase, isConnected, serverUrl } = useConnectionState()
  const { uxState } = useConnectionUxState()
  const isConnectionReady = isConnected && phase === ConnectionPhase.CONNECTED
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const hasServerAudio =
    isConnectionReady && !capsLoading && capabilities?.hasAudio
  const { healthState: audioHealthState } = useTldwAudioStatus()
  const canUseServerAudio = hasServerAudio && audioHealthState !== "unhealthy"
  const speechAvailable =
    browserSupportsSpeechRecognition || canUseServerAudio
  const speechUsesServer = canUseServerAudio

  const [isFlushingQueue, setIsFlushingQueue] = React.useState(false)
  const [debouncedPlaceholder, setDebouncedPlaceholder] = React.useState<string>(
    t("form.textarea.placeholder")
  )
  const placeholderTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    onSubmit,
    selectedModel,
    chatMode,
    stopStreamingRequest,
    streaming,
    setChatMode,
    webSearch,
    setWebSearch,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    speechToTextLanguage,
    useOCR,
    setUseOCR,
    defaultInternetSearchOn,
    defaultChatWithWebsite,
    temporaryChat,
    setTemporaryChat,
    toolChoice,
    setToolChoice,
    messages,
    clearChat,
    queuedMessages,
    addQueuedMessage,
    clearQueuedMessages,
    serverChatId
  } = useMessage()
  const previousServerChatIdRef = React.useRef<string | null | undefined>(
    serverChatId
  )

  React.useEffect(() => {
    const previous = previousServerChatIdRef.current
    const current = serverChatId

    if (previous && previous !== "" && !current && !temporaryChat) {
      notification.warning({
        message: t(
          "sidepanel:saveStatus.saveFailed",
          "Failed to save chat to server"
        ),
        description: t(
          "sidepanel:saveStatus.saveFailedDescription",
          "Chat is now saving locally only. Check your connection and try again."
        ),
        placement: "bottomRight",
        duration: 4
      })
    }

    previousServerChatIdRef.current = current
  }, [notification, serverChatId, t, temporaryChat])
  const hasImage = form.values.image.length > 0
  const replyLabel = replyTarget
    ? [
        t("common:replyingTo", "Replying to"),
        replyTarget.name ? `${replyTarget.name}:` : null,
        replyTarget.preview
      ]
        .filter(Boolean)
        .join(" ")
    : ""
  const pageContextActive = chatMode === "rag" && chatWithWebsiteEmbedding
  const contextChips = [
    ...(replyTarget && isProMode
      ? [
          {
            id: "reply",
            label: replyLabel,
            icon: <CornerUpLeft className="h-3 w-3 text-text-subtle" />,
            onRemove: clearReplyTarget,
            removeLabel: t("common:clearReply", "Clear reply target")
          }
        ]
      : []),
    ...(pageContextActive
      ? [
          {
            id: "page-context",
            label: t("sidepanel:composer.pageContext", "Current page"),
            icon: <Globe className="h-3 w-3 text-text-subtle" />,
            onRemove: () => setChatMode("normal"),
            removeLabel: t(
              "sidepanel:composer.removePageContext",
              "Remove page context"
            )
          }
        ]
      : []),
    ...selectedDocuments.map((doc) => ({
      id: `tab-${doc.id}`,
      label: doc.title,
      icon: <Globe className="h-3 w-3 text-text-subtle" />,
      onRemove: () => removeDocument(doc.id),
      removeLabel: t("sidepanel:composer.removeDocument", "Remove page")
    })),
    ...(knowledgeMentionActive
      ? [
          {
            id: "knowledge",
            label: t("sidepanel:composer.knowledgeContext", "Knowledge base"),
            icon: <Search className="h-3 w-3 text-text-subtle" />,
            onRemove: () => {
              setKnowledgeMentionActive(false)
              window.dispatchEvent(new CustomEvent("tldw:toggle-rag"))
            },
            removeLabel: t(
              "sidepanel:composer.removeKnowledge",
              "Remove knowledge context"
            )
          }
        ]
      : []),
    ...contextFiles.map((file) => ({
      id: `file-${file.id}`,
      label: file.filename,
      icon: <FileText className="h-3 w-3 text-text-subtle" />,
      onRemove: () =>
        setContextFiles((prev) => prev.filter((item) => item.id !== file.id)),
      removeLabel: t("sidepanel:composer.removeFile", "Remove file")
    })),
    ...(hasImage
      ? [
          {
            id: "image",
            label: t("playground:actions.upload", "Attach image"),
            previewSrc: form.values.image,
            onRemove: () => {
              form.setFieldValue("image", "")
            },
            removeLabel: t(
              "sidepanel:composer.removeImage",
              "Remove uploaded image"
            )
          }
        ]
      : [])
  ]

  const sendButtonTitle = !isConnectionReady
    ? (t(
        "playground:composer.connectToSend",
        "Connect to your tldw server to start chatting."
      ) as string)
    : sendWhenEnter
      ? (t("playground:sendWhenEnter") as string)
      : undefined

  const openUploadDialog = () => {
    fileInputRef.current?.click()
  }

  const onInputChange = async (
    e: React.ChangeEvent<HTMLInputElement> | File
  ) => {
    try {
      let file: File
      if (e instanceof File) {
        file = e
      } else if (e.target.files && e.target.files[0]) {
        file = e.target.files[0]
      } else {
        return
      }

      // Validate that the file is an image
      if (!file.type.startsWith("image/")) {
        message.error({
          content: t(
            "sidepanel:composer.imageTypeError",
            "Please select an image file"
          ),
          duration: 3
        })
        return
      }

      const base64 = await toBase64(file)
      form.setFieldValue("image", base64)

      // Show success feedback
      message.success({
        content: t("sidepanel:composer.imageUploaded", {
          defaultValue: "Image added: {{name}}",
          name: file.name.length > 20 ? `${file.name.slice(0, 17)}...` : file.name
        }),
        duration: 2
      })
    } catch (err) {
      message.error({
        content: t("sidepanel:composer.imageUploadError", "Failed to process image"),
        duration: 3
      })
    }
  }
  const textAreaFocus = React.useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // When sidepanel connection transitions to CONNECTED, focus the composer
  useFocusComposerOnConnect(phase)

  // Server-side dictation hook
  const {
    isServerDictating,
    startServerDictation,
    stopServerDictation
  } = useServerDictation({
    canUseServerAudio,
    speechToTextLanguage,
    sttSettings,
    onTranscript: (text) => form.setFieldValue("message", text)
  })

  // Composer window events hook
  const handleOpenQuickIngest = React.useCallback(() => {
    setAutoProcessQueuedIngest(false)
    setIngestOpen(true)
    requestAnimationFrame(() => {
      quickIngestBtnRef.current?.focus()
    })
  }, [])

  const {
    openActorSettings,
    setOpenActorSettings,
    openModelSettings,
    setOpenModelSettings,
    documentGeneratorOpen,
    setDocumentGeneratorOpen,
    documentGeneratorSeed,
    setDocumentGeneratorSeed
  } = useComposerEvents({
    serverChatId,
    onFocusComposer: textAreaFocus,
    onOpenQuickIngest: handleOpenQuickIngest
  })

  // Temporary chat toggle hook
  const { handleToggleTemporaryChat } = useTemporaryChatToggle({
    temporaryChat,
    setTemporaryChat,
    messagesLength: messages.length,
    clearChat
  })
  const temporaryChatLocked = temporaryChat && messages.length > 0
  const temporaryChatToggleLabel = temporaryChat
    ? t("playground:actions.temporaryOn", "Temporary chat (not saved)")
    : t("playground:actions.temporaryOff", "Save chat to history")
  const persistenceModeLabel = React.useMemo(() => {
    if (temporaryChat) {
      return t(
        "playground:composer.persistence.ephemeral",
        "Not saved: cleared when you close this window."
      )
    }
    if (serverChatId || isConnectionReady) {
      return t(
        "playground:composer.persistence.server",
        "Saved to your tldw server (and locally)."
      )
    }
    return t(
      "playground:composer.persistence.local",
      "Saved locally until your tldw server is connected."
    )
  }, [isConnectionReady, serverChatId, t, temporaryChat])
  const persistencePillLabel = React.useMemo(() => {
    if (temporaryChat) {
      return t("playground:composer.persistence.ephemeralPill", "Not saved")
    }
    if (serverChatId || isConnectionReady) {
      return t("playground:composer.persistence.serverPill", "Server")
    }
    return t("playground:composer.persistence.localPill", "Local")
  }, [isConnectionReady, serverChatId, t, temporaryChat])
  const persistenceTooltip = React.useMemo(
    () => (
      <div className="flex flex-col gap-0.5 text-xs">
        <span className="font-medium">{persistencePillLabel}</span>
        <span className="text-text-subtle">{persistenceModeLabel}</span>
      </div>
    ),
    [persistenceModeLabel, persistencePillLabel]
  )

  // Character selection state
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<
    string | null
  >(storedCharacter?.id ? String(storedCharacter.id) : null)

  React.useEffect(() => {
    const nextId = storedCharacter?.id ? String(storedCharacter.id) : null
    setSelectedCharacterId((prev) => (prev === nextId ? prev : nextId))
  }, [storedCharacter?.id])

  const {
    filteredSlashCommands,
    showSlashMenu,
    slashActiveIndex,
    setSlashActiveIndex,
    applySlashCommand,
    handleSlashCommandSelect
  } = useSlashCommands({
    chatMode,
    webSearch,
    setChatMode,
    setWebSearch,
    onOpenModelSettings: () => setOpenModelSettings(true),
    inputValue: form.values.message,
    setInputValue: (value) => form.setFieldValue("message", value)
  })

  const handleSlashCommandPick = React.useCallback(
    (command: SlashCommandItem) => {
      handleSlashCommandSelect(command)
      requestAnimationFrame(() => textareaRef.current?.focus())
    },
    [handleSlashCommandSelect, textareaRef]
  )

  const removeMentionToken = React.useCallback(() => {
    if (!mentionPosition || !textareaRef.current) return
    const current = form.values.message || ""
    const before = current.substring(0, mentionPosition.start)
    const after = current.substring(mentionPosition.end)
    const nextValue = before + after
    form.setFieldValue("message", nextValue)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(
        mentionPosition.start,
        mentionPosition.start
      )
    })
    closeMentions()
  }, [closeMentions, form, mentionPosition, textareaRef])

  const handleCurrentPageMention = React.useCallback(async () => {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTab = tabs.find((tab) => tab.id && tab.title && tab.url)
      if (!activeTab) {
        console.error("[Sidepanel] No active tab found for page mention.")
        return
      }
      const tabInfo: TabInfo = {
        id: activeTab.id!,
        title: activeTab.title!,
        url: activeTab.url!,
        favIconUrl: activeTab.favIconUrl
      }
      addDocument(tabInfo)
    } catch (error) {
      console.error("[Sidepanel] Failed to fetch active tab for mention:", error)
    } finally {
      removeMentionToken()
    }
  }, [addDocument, removeMentionToken])

  const handleKnowledgeMention = React.useCallback(() => {
    setKnowledgeMentionActive(true)
    window.dispatchEvent(new CustomEvent("tldw:toggle-rag"))
    removeMentionToken()
  }, [removeMentionToken])

  const handleFileMention = React.useCallback(() => {
    contextFileInputRef.current?.click()
    removeMentionToken()
  }, [removeMentionToken])

  const handleContextFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return
      const oversized = files.find(
        (file) => file.size > maxContextFileSizeBytes
      )
      if (oversized) {
        notification.error({
          message: t("option:upload.fileTooLargeTitle", "File Too Large"),
          description: t(
            "option:upload.fileTooLargeDescription",
            {
              defaultValue: "File size must be less than {{size}}",
              size: maxContextFileSizeLabel
            }
          )
        })
        event.target.value = ""
        return
      }
      try {
        const { processFileUpload } = await import("~/utils/file-processor")
        const nextFiles: UploadedFile[] = []
        const failedFiles: string[] = []
        for (const file of files) {
          try {
            const source = await processFileUpload(file)
            const content =
              source && typeof (source as any).content === "string"
                ? (source as any).content
                : null
            if (!content) {
              failedFiles.push(file.name)
              continue
            }
            nextFiles.push({
              id: generateID(),
              filename: file.name,
              type: file.type,
              content,
              size: file.size,
              uploadedAt: Date.now(),
              processed: false
            })
          } catch {
            failedFiles.push(file.name)
          }
        }
        if (nextFiles.length > 0) {
          setContextFiles((prev) => [...prev, ...nextFiles])
          notification.success({
            message: t("sidepanel:composer.filesAdded", {
              defaultValue: "{{count}} file(s) added to context",
              count: nextFiles.length
            })
          })
        }
        if (failedFiles.length > 0) {
          notification.warning({
            message: t("sidepanel:composer.someFilesFailed", {
              defaultValue: "Failed to process: {{files}}",
              files: failedFiles.join(", ")
            })
          })
        }
      } catch (error: any) {
        notification.error({
          message: t("sidepanel:composer.fileAddError", "Failed to add file"),
          description: error?.message || ""
        })
      } finally {
        event.target.value = ""
      }
    },
    [
      maxContextFileSizeBytes,
      maxContextFileSizeLabel,
      notification,
      setContextFiles,
      t
    ]
  )

  const mentionQuery = (mentionPosition?.query || "").toLowerCase()
  const staticMentionItems = React.useMemo<MentionMenuItem[]>(
    () => [
      {
        id: "mention-current-page",
        label: t("sidepanel:composer.mentionCurrentPage", "Current page"),
        description: t(
          "sidepanel:composer.mentionCurrentPageDesc",
          "Use the active tab as context"
        ),
        icon: <Globe className="size-3.5" />,
        kind: "page"
      },
      {
        id: "mention-knowledge",
        label: t("sidepanel:composer.mentionKnowledge", "Knowledge base"),
        description: t(
          "sidepanel:composer.mentionKnowledgeDesc",
          "Search your knowledge base"
        ),
        icon: <Search className="size-3.5" />,
        kind: "knowledge"
      },
      {
        id: "mention-file",
        label: t("sidepanel:composer.mentionFile", "File"),
        description: t(
          "sidepanel:composer.mentionFileDesc",
          "Attach a file as context"
        ),
        icon: <FileText className="size-3.5" />,
        kind: "file"
      }
    ],
    [t]
  )

  const mentionItems = React.useMemo<MentionMenuItem[]>(() => {
    if (!tabMentionsEnabled) return []
    const filteredStatic =
      mentionQuery.length === 0
        ? staticMentionItems
        : staticMentionItems.filter((item) =>
            item.label.toLowerCase().includes(mentionQuery)
          )
    const tabItems: MentionMenuItem[] = filteredTabs.map((tab) => ({
      id: `tab-${tab.id}`,
      label: tab.title,
      description: tab.url,
      icon: <Globe className="size-3.5" />,
      kind: "tab",
      payload: tab
    }))
    return [...filteredStatic, ...tabItems]
  }, [filteredTabs, mentionQuery, staticMentionItems, tabMentionsEnabled])

  const showMentionMenu = Boolean(mentionPosition) && tabMentionsEnabled

  React.useEffect(() => {
    if (!showMentionMenu) {
      setMentionActiveIndex(0)
      return
    }
    setMentionActiveIndex((prev) => {
      if (mentionItems.length === 0) return 0
      return Math.min(prev, mentionItems.length - 1)
    })
  }, [mentionItems.length, showMentionMenu])

  React.useEffect(() => {
    if (!showMentionMenu) return
    let cancelled = false
    void handleMentionsOpen().catch((error) => {
      if (cancelled) return
      console.error("Failed to open mentions menu:", error)
    })
    return () => {
      cancelled = true
    }
  }, [handleMentionsOpen, showMentionMenu])

  const handleMentionSelect = React.useCallback(
    (item: MentionMenuItem) => {
      if (item.kind === "tab" && item.payload) {
        const tab = item.payload as TabInfo
        const alreadySelected = selectedDocuments.some((doc) => doc.id === tab.id)
        if (alreadySelected) {
          removeMentionToken()
          return
        }
        insertMention(tab, form.values.message, (value) =>
          form.setFieldValue("message", value)
        )
        return
      }
      if (item.kind === "page") {
        void handleCurrentPageMention()
        return
      }
      if (item.kind === "knowledge") {
        handleKnowledgeMention()
        return
      }
      if (item.kind === "file") {
        handleFileMention()
      }
    },
    [
      form,
      handleCurrentPageMention,
      handleFileMention,
      handleKnowledgeMention,
      insertMention,
      removeMentionToken,
      selectedDocuments
    ]
  )


  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0]
      // Only handle image files from paste
      if (file.type.startsWith("image/")) {
        e.preventDefault()
        onInputChange(file)
      }
    }
  }

  useFocusShortcuts(textareaRef, true)

  const ensureEmbeddingModelAvailable = async (): Promise<boolean> => {
    // Fast path: no RAG or web search enabled
    if (chatMode !== "rag" && !webSearch) {
      return true
    }

    let defaultEM: string | null | undefined

    // When chatting with the current page via embeddings, require a default embedding model
    if (chatMode === "rag" && chatWithWebsiteEmbedding) {
      defaultEM = await defaultEmbeddingModelForRag()
      if (!defaultEM) {
        form.setFieldError("message", t("formError.noEmbeddingModel"))
        return false
      }
    }

    // When web search is enabled and not in simple-search mode, also require an embedding model
    if (webSearch) {
      if (typeof defaultEM === "undefined") {
        defaultEM = await defaultEmbeddingModelForRag()
      }
      const simpleSearch = await getIsSimpleInternetSearch()
      if (!defaultEM && !simpleSearch) {
        form.setFieldError("message", t("formError.noEmbeddingModel"))
        return false
      }
    }

    return true
  }

  async function sendCurrentFormMessage(
    rawMessage: string,
    image: string
  ): Promise<void> {
    const slashResult = applySlashCommand(rawMessage)
    if (slashResult.handled) {
      form.setFieldValue("message", slashResult.message)
    }
    const nextMessage = slashResult.handled ? slashResult.message : rawMessage
    const trimmed = nextMessage.trim()
    if (
      trimmed.length === 0 &&
      image.length === 0 &&
      selectedDocuments.length === 0 &&
      contextFiles.length === 0
    ) {
      return
    }
    await stopListening()
    if (!selectedModel || selectedModel.length === 0) {
      form.setFieldError("message", t("formError.noModel"))
      return
    }
    const hasEmbedding = await ensureEmbeddingModelAvailable()
    if (!hasEmbedding) {
      return
    }
    form.reset()
    textAreaFocus()
    await sendMessage({
      image,
      message: trimmed,
      docs: selectedDocuments.map((doc) => ({
        type: "tab",
        tabId: doc.id,
        title: doc.title,
        url: doc.url,
        favIconUrl: doc.favIconUrl
      })),
      uploadedFiles: contextFiles
    })
    clearSelectedDocuments()
    setContextFiles([])
    setKnowledgeMentionActive(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionMenu) {
      if (e.key === "ArrowDown" && mentionItems.length > 0) {
        e.preventDefault()
        setMentionActiveIndex((prev) =>
          prev + 1 >= mentionItems.length ? 0 : prev + 1
        )
        return
      }
      if (e.key === "ArrowUp" && mentionItems.length > 0) {
        e.preventDefault()
        setMentionActiveIndex((prev) =>
          prev <= 0 ? mentionItems.length - 1 : prev - 1
        )
        return
      }
      if (
        (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) &&
        mentionItems.length > 0
      ) {
        e.preventDefault()
        const item = mentionItems[mentionActiveIndex]
        if (item) {
          handleMentionSelect(item)
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        closeMentions()
        return
      }
    }
    if (showSlashMenu) {
      if (e.key === "ArrowDown" && filteredSlashCommands.length > 0) {
        e.preventDefault()
        setSlashActiveIndex((prev) =>
          prev + 1 >= filteredSlashCommands.length ? 0 : prev + 1
        )
        return
      }
      if (e.key === "ArrowUp" && filteredSlashCommands.length > 0) {
        e.preventDefault()
        setSlashActiveIndex((prev) =>
          prev <= 0 ? filteredSlashCommands.length - 1 : prev - 1
        )
        return
      }
      if (
        (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) &&
        filteredSlashCommands.length > 0
      ) {
        e.preventDefault()
        const command = filteredSlashCommands[slashActiveIndex]
        if (command) {
          handleSlashCommandPick(command)
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        form.setFieldValue(
          "message",
          form.values.message.replace(/^\s*\//, "")
        )
        return
      }
    }
    if (!isConnectionReady) {
      if (e.key === "Enter") {
        e.preventDefault()
        form.onSubmit(async (value) => {
          const slashResult = applySlashCommand(value.message)
          if (slashResult.handled) {
            form.setFieldValue("message", slashResult.message)
          }
          const nextMessage = slashResult.handled
            ? slashResult.message
            : value.message
          const trimmed = nextMessage.trim()
          if (
            trimmed.length === 0 &&
            value.image.length === 0 &&
            selectedDocuments.length === 0 &&
            contextFiles.length === 0
          ) {
            return
          }
          if (selectedDocuments.length > 0 || contextFiles.length > 0) {
            notification.info({
              message: t(
                "sidepanel:composer.attachmentsRequireConnection",
                "Connect to send attachments"
              )
            })
            return
          }
          addQueuedMessage({
            message: trimmed,
            image: value.image
          })
          form.reset()
        })()
      }
      return
    }
    if (e.key === "Process" || e.key === "229") return
    if (
      handleChatInputKeyDown({
        e,
        sendWhenEnter,
        typing,
        isSending
      })
    ) {
      e.preventDefault()
      form.onSubmit(async (value) => {
        await sendCurrentFormMessage(value.message, value.image)
      })()
    }
  }

  const openSettings = React.useCallback(() => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage()
        return
      }
    } catch {}
    window.open("/options.html#/", "_blank")
  }, [])

  const openDiagnostics = React.useCallback(() => {
    window.open("/options.html#/settings/health", "_blank")
  }, [])

  const handleWebSearchToggle = React.useCallback(() => {
    setWebSearch(!webSearch)
  }, [setWebSearch, webSearch])

  const handleSpeechToggle = React.useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening({
        continuous: true,
        lang: speechToTextLanguage
      })
    }
  }, [
    isListening,
    resetTranscript,
    speechToTextLanguage,
    startListening,
    stopListening
  ])

  const handleLiveCaptionsToggle = React.useCallback(async () => {
    if (wsSttActive) {
      try {
        micStop()
      } catch {}
      try {
        sttClose()
      } catch {}
      setWsSttActive(false)
    } else {
      try {
        sttConnect()
        await micStart()
        setWsSttActive(true)
      } catch (e: any) {
        notification.error({
          message: t(
            "playground:actions.streamErrorTitle",
            "Live captions unavailable"
          ),
          description:
            e?.message ||
            t(
              "playground:actions.streamMicError",
              "Unable to start live captions. Check microphone permissions and server health, then try again."
            )
        })
        try {
          micStop()
        } catch {}
        try {
          sttClose()
        } catch {}
        setWsSttActive(false)
      }
    }
  }, [micStart, micStop, notification, sttClose, sttConnect, t, wsSttActive])

  const handleVisionToggle = React.useCallback(() => {
    setChatMode(chatMode === "vision" ? "normal" : "vision")
  }, [chatMode, setChatMode])

  const handleImageUpload = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRagToggle = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("tldw:toggle-rag"))
  }, [])

  const handleQuickIngestOpen = React.useCallback(() => {
    setAutoProcessQueuedIngest(false)
    setIngestOpen(true)
  }, [])

  const handleProcessQueuedIngest = React.useCallback(() => {
    if (!isConnectionReady) return

    // Snapshot the current queue size; if it has been cleared between
    // render and click, we still open the modal but skip auto-processing.
    if (queuedQuickIngestCount <= 0) {
      setAutoProcessQueuedIngest(false)
      setIngestOpen(true)
      return
    }

    setAutoProcessQueuedIngest(true)
    setIngestOpen(true)
  }, [isConnectionReady, queuedQuickIngestCount])

  React.useEffect(() => {
    if (!sttError) return
    notification.error({
      message: t(
        "playground:actions.streamErrorTitle",
        "Live captions unavailable"
      ),
      description: sttError
    })
    try {
      micStop()
    } catch {}
    try {
      sttClose()
    } catch {}
    setWsSttActive(false)
  }, [micStop, setWsSttActive, sttClose, sttError, t])

  React.useEffect(() => {
    if (dropedFile) {
      onInputChange(dropedFile)
    }
  }, [dropedFile])

  useDynamicTextareaSize(textareaRef, form.values.message, textareaMaxHeight)

  React.useEffect(() => {
    if (isListening) {
      form.setFieldValue("message", transcript)
    }
  }, [transcript])

  React.useEffect(() => {
    if (selectedQuickPrompt) {
      const word = getVariable(selectedQuickPrompt)
      form.setFieldValue("message", selectedQuickPrompt)
      if (word) {
        textareaRef.current?.focus()
        const interval = setTimeout(() => {
          textareaRef.current?.setSelectionRange(word.start, word.end)
          setSelectedQuickPrompt(null)
        }, 100)
        return () => {
          clearInterval(interval)
        }
      }
    }
  }, [selectedQuickPrompt])
  const { mutateAsync: sendMessage, isPending: isSending } = useMutation({
    mutationFn: onSubmit,
    onSuccess: () => {
      textAreaFocus()
    },
    onError: (error) => {
      textAreaFocus()
    }
  })

  const submitQueuedInSidepanel = async (message: string, image: string) => {
    if (!isConnectionReady) return
    await stopListening()
    stopServerDictation()
    if (!selectedModel || selectedModel.length === 0) {
      form.setFieldError("message", t("formError.noModel"))
      return
    }
    await sendMessage({
      image,
      message
    })
  }

  const handleFlushQueue = React.useCallback(async () => {
    if (!isConnectionReady || isFlushingQueue) return
    setIsFlushingQueue(true)
    try {
      const hasEmbedding = await ensureEmbeddingModelAvailable()
      if (!hasEmbedding) {
        return
      }
      const successfullySentIndices = new Set<number>()
      for (const [index, item] of queuedMessages.entries()) {
        try {
          await submitQueuedInSidepanel(item.message, item.image)
          successfullySentIndices.add(index)
        } catch (error) {
          console.error("Failed to send queued sidepanel message", error)
        }
      }

      if (successfullySentIndices.size > 0) {
        const remainingQueued = queuedMessages.filter(
          (_, index) => !successfullySentIndices.has(index)
        )
        clearQueuedMessages()
        for (const item of remainingQueued) {
          addQueuedMessage(item)
        }
      }
    } finally {
      setIsFlushingQueue(false)
    }
  }, [
    isConnectionReady,
    isFlushingQueue,
    queuedMessages,
    ensureEmbeddingModelAvailable,
    submitQueuedInSidepanel,
    clearQueuedMessages,
    addQueuedMessage
  ])

  React.useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          if (e.dataTransfer.items[i].type === "text/plain") {
            e.dataTransfer.items[i].getAsString((text) => {
              form.setFieldValue("message", text)
            })
          }
        }
      }
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const el = textareaRef.current
    if (el) {
      el.addEventListener("drop", handleDrop)
      el.addEventListener("dragover", handleDragOver)
    }

    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }

    if (defaultChatWithWebsite) {
      setChatMode("rag")
    }

    return () => {
      if (el) {
        el.removeEventListener("drop", handleDrop)
        el.removeEventListener("dragover", handleDragOver)
      }
    }
  }, [])

  React.useEffect(() => {
    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }
  }, [defaultInternetSearchOn])

  // Clear error messages when user starts typing (they're taking action)
  // Errors persist until user interaction rather than auto-dismissing
  React.useEffect(() => {
    if (form.values.message && form.errors.message) {
      form.clearFieldError("message")
    }
  }, [form.values.message, form.errors.message, form.clearFieldError])

  // Clear "no model" error when a model is selected
  React.useEffect(() => {
    if (selectedModel && form.errors.message) {
      form.clearFieldError("message")
    }
  }, [selectedModel, form.errors.message, form.clearFieldError])

  // Debounce placeholder changes to prevent flashing on flaky connections
  React.useEffect(() => {
    const targetPlaceholder = isConnectionReady
      ? t("form.textarea.placeholder")
      : uxState === "testing"
        ? t(
            "sidepanel:composer.connectingPlaceholder",
            "Connecting..."
          )
        : t(
            "sidepanel:composer.disconnectedPlaceholder",
            "Not connected — open Settings to connect"
          )

    // Clear any existing timeout
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current)
    }

    // Debounce by ~400ms to avoid flashing while keeping the UI responsive
    placeholderTimeoutRef.current = setTimeout(() => {
      setDebouncedPlaceholder(targetPlaceholder)
    }, 400)

    return () => {
      if (placeholderTimeoutRef.current) {
        clearTimeout(placeholderTimeoutRef.current)
        placeholderTimeoutRef.current = null
      }
    }
  }, [isConnectionReady, uxState, t])

  return (
    <div
      ref={formContainerRef}
      className={`flex w-full flex-col items-center ${composerPadding}`}>
      <div
        className={`relative z-10 flex w-full flex-col items-center justify-center ${composerGap} text-body`}>
        <div className="relative flex w-full flex-row justify-center gap-2">
          <div
            aria-disabled={!isConnectionReady}
            className={`relative w-full max-w-[48rem] rounded-3xl border border-border/80 bg-surface/95 shadow-card backdrop-blur-lg duration-100 ${cardPadding}`}>
            <div>
              {/* Inline Model Parameters Panel (Pro mode only) */}
              <ModelParamsPanel
                onOpenFullSettings={() => setOpenModelSettings(true)}
              />
              <div className="flex">
                <form
                  onSubmit={form.onSubmit(async (value) => {
                    await sendCurrentFormMessage(value.message, value.image)
                  })}
                  className="shrink-0 flex-grow  flex flex-col items-center ">
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={onInputChange}
                  />
                  <input
                    id="context-file-upload"
                    name="context-file-upload"
                    type="file"
                    className="sr-only"
                    ref={contextFileInputRef}
                    multiple
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={handleContextFileChange}
                  />
                  <div
                    className={`w-full flex flex-col px-1 ${
                      !isConnectionReady
                        ? "rounded-md border border-dashed border-amber-400 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-900/10"
                        : ""
                    }`}>
                    {/* Connection status indicator when disconnected */}
                    <ConnectionStatusIndicator
                      isConnectionReady={isConnectionReady}
                      uxState={uxState}
                      onOpenSettings={openSettings}
                    />
                    {/* RAG Search Bar: search KB, insert snippets, ask directly */}
                    {isProMode && (
                      <RagSearchBar
                        onInsert={(text) => {
                          const current = form.values.message || ""
                          const next = current ? `${current}\n\n${text}` : text
                          form.setFieldValue("message", next)
                          // Focus textarea for quick edits
                          textareaRef.current?.focus()
                        }}
                        onAsk={async (text) => {
                          // Set message and submit immediately
                          const trimmed = text.trim()
                          if (!trimmed) return
                          form.setFieldValue("message", text)
                          if (!isConnectionReady) {
                            addQueuedMessage({
                              message: trimmed,
                              image: form.values.image
                            })
                            form.reset()
                            return
                          }
                          await sendCurrentFormMessage(trimmed, "")
                        }}
                      />
                    )}
                    {/* Queued messages banner - shown above input area */}
                    <QueuedMessagesBanner
                      queuedMessages={queuedMessages}
                      isConnectionReady={isConnectionReady}
                      isFlushingQueue={isFlushingQueue}
                      onFlushQueue={handleFlushQueue}
                      onClearQueue={clearQueuedMessages}
                      onOpenDiagnostics={openDiagnostics}
                    />
                    {contextChips.length > 0 && (
                      <div className="px-2 pb-2">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-subtle">
                          {t("playground:composer.contextLabel", "Context")}
                        </div>
                        <ContextChips
                          items={contextChips}
                          ariaLabel={t("playground:composer.contextLabel", "Context:")}
                          className="flex flex-wrap items-center gap-2"
                        />
                      </div>
                    )}
                    <div className="relative">
                      <div className="relative rounded-2xl border border-border/70 bg-surface/80 px-1 py-1.5 transition focus-within:border-focus/60 focus-within:ring-2 focus-within:ring-focus/30">
                        <SlashCommandMenu
                          open={showSlashMenu}
                          commands={filteredSlashCommands}
                          activeIndex={slashActiveIndex}
                          onActiveIndexChange={setSlashActiveIndex}
                          onSelect={handleSlashCommandPick}
                          emptyLabel={t(
                            "common:commandPalette.noResults",
                            "No results found"
                          )}
                          className="absolute bottom-full left-3 right-3 mb-2"
                        />
                        <MentionsMenu
                          open={showMentionMenu}
                          items={mentionItems}
                          activeIndex={mentionActiveIndex}
                          onActiveIndexChange={setMentionActiveIndex}
                          onSelect={handleMentionSelect}
                          emptyLabel={t(
                            "sidepanel:composer.noMentions",
                            "No matches found"
                          )}
                          className="absolute bottom-full left-3 right-3 mb-2"
                        />
                        <textarea
                          onKeyDown={(e) => handleKeyDown(e)}
                          ref={textareaRef}
                          data-testid="chat-input"
                          className={`w-full resize-none border-0 bg-transparent px-3 py-2 text-body text-text placeholder:text-text-muted/80 focus-within:outline-none focus:ring-0 focus-visible:ring-0 ring-0 dark:ring-0 ${
                            !isConnectionReady
                              ? "cursor-not-allowed text-text-muted placeholder:text-text-subtle"
                              : ""
                          }`}
                          readOnly={!isConnectionReady}
                          aria-readonly={!isConnectionReady}
                          aria-disabled={!isConnectionReady}
                          aria-label={
                            !isConnectionReady
                              ? t(
                                  "sidepanel:composer.disconnectedAriaLabel",
                                  "Message input (read-only: not connected to server)"
                                )
                              : t("sidepanel:composer.messageAriaLabel", "Message input")
                          }
                          onPaste={handlePaste}
                          rows={1}
                          style={{ minHeight: `${textareaMinHeight}px` }}
                          tabIndex={0}
                          onCompositionStart={() => {
                          if (!isFirefoxTarget) {
                              setTyping(true)
                            }
                          }}
                          onCompositionEnd={() => {
                          if (!isFirefoxTarget) {
                              setTyping(false)
                            }
                          }}
                          placeholder={debouncedPlaceholder || t("form.textarea.placeholder")}
                          {...messageInputProps}
                          onChange={(event) => {
                            messageInputProps.onChange(event)
                            if (tabMentionsEnabled && textareaRef.current) {
                              handleTextChange(
                                event.target.value,
                                textareaRef.current.selectionStart || 0
                              )
                            }
                          }}
                          onSelect={() => {
                            if (tabMentionsEnabled && textareaRef.current) {
                              handleTextChange(
                                textareaRef.current.value,
                                textareaRef.current.selectionStart || 0
                              )
                            }
                          }}
                        />
                      </div>
                      {/* Draft saved indicator */}
                      {draftSaved && (
                        <span
                          className="absolute bottom-1 right-2 text-label text-text-subtle transition-opacity pointer-events-none"
                          role="status"
                          aria-live="polite"
                        >
                          {t("sidepanel:composer.draftSaved", "Draft saved")}
                        </span>
                      )}
                    </div>
                    {/* Inline error message - positioned right after textarea for visibility */}
                    {form.errors.message && (
                      <div
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                        className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-red-600 dark:text-red-400 animate-shake"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{form.errors.message}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => form.clearFieldError("message")}
                          className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          aria-label={t("common:dismiss", "Dismiss")}
                          title={t("common:dismiss", "Dismiss")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {/* Proactive validation hints - show why send might be disabled */}
                    {!form.errors.message && isConnectionReady && !streaming && isProMode && (
                      <div className="px-2 py-1 text-label text-text-subtle">
                        {!selectedModel ? (
                          <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t("sidepanel:composer.hints.selectModel", "Select a model above to start chatting")}
                          </span>
                        ) : form.values.message.trim().length === 0 && form.values.image.length === 0 ? (
                          <span>
                            {sendWhenEnter
                              ? t("sidepanel:composer.hints.typeAndEnter", "Type a message and press Enter to send")
                              : t("sidepanel:composer.hints.typeAndClick", "Type a message and click Send")}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <div className="mt-2 flex flex-col gap-2">
                      <Tooltip title={persistenceTooltip}>
                        <div className="flex items-center gap-2">
                          <Switch
                            size="small"
                            checked={!temporaryChat}
                            disabled={temporaryChatLocked || isFireFoxPrivateMode}
                            onChange={(checked) =>
                              handleToggleTemporaryChat(!checked)
                            }
                            aria-label={temporaryChatToggleLabel as string}
                          />
                          <span className="text-xs text-text whitespace-nowrap">
                            {temporaryChatToggleLabel}
                          </span>
                        </div>
                      </Tooltip>
                      <div className="flex w-full flex-row items-center justify-between gap-1.5">
                      {isProMode ? (
                        <>
                          {/* Control Row - contains Prompt, Model, RAG, and More tools */}
                          <ControlRow
                            selectedSystemPrompt={selectedSystemPrompt}
                            setSelectedSystemPrompt={setSelectedSystemPrompt}
                            setSelectedQuickPrompt={setSelectedQuickPrompt}
                            selectedCharacterId={selectedCharacterId}
                            setSelectedCharacterId={setSelectedCharacterId}
                            webSearch={webSearch}
                            setWebSearch={setWebSearch}
                            chatMode={chatMode}
                            setChatMode={setChatMode}
                            onImageUpload={onInputChange}
                            onToggleRag={handleRagToggle}
                            isConnected={isConnectionReady}
                            toolChoice={toolChoice}
                            setToolChoice={setToolChoice}
                          />
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <div
                              role="group"
                              aria-label={t(
                                "playground:composer.actions",
                                "Send options"
                              )}
                              className="flex items-center gap-2">
                              {/* L15: gap-2 provides visual separation */}
                              {!streaming ? (
                                <>
                                  {(browserSupportsSpeechRecognition || hasServerAudio) && (
                                    <Tooltip
                                      title={
                                        !speechAvailable
                                          ? t(
                                              "playground:actions.speechUnavailableBody",
                                              "Connect to a tldw server that exposes the audio transcriptions API to use dictation."
                                            )
                                          : speechUsesServer
                                            ? t(
                                                "playground:tooltip.speechToTextServer",
                                                "Dictation via your tldw server"
                                              )
                                            : t(
                                                "playground:tooltip.speechToTextBrowser",
                                                "Dictation via browser speech recognition"
                                              )
                                      }
                                    >
                                      <button
                                        type="button"
                                        onClick={speechUsesServer ? startServerDictation : handleSpeechToggle}
                                        disabled={!speechAvailable}
                                        className={`rounded-md border border-border p-1 text-text-muted hover:bg-surface2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50 ${
                                          speechAvailable &&
                                          ((speechUsesServer && isServerDictating) ||
                                            (!speechUsesServer && isListening))
                                            ? "border-primary text-primaryStrong"
                                            : ""
                                        }`}
                                        aria-label={
                                          !speechAvailable
                                            ? (t(
                                                "playground:actions.speechUnavailableTitle",
                                                "Dictation unavailable"
                                              ) as string)
                                            : speechUsesServer
                                              ? (isServerDictating
                                                  ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                                  : (t("playground:actions.speechStart", "Start dictation") as string))
                                            : (isListening
                                                ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                                : (t("playground:actions.speechStart", "Start dictation") as string))
                                        }
                                        title={
                                          !speechAvailable
                                            ? (t(
                                                "playground:actions.speechUnavailableTitle",
                                                "Dictation unavailable"
                                              ) as string)
                                            : speechUsesServer
                                              ? (isServerDictating
                                                  ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                                  : (t("playground:actions.speechStart", "Start dictation") as string))
                                              : (isListening
                                                  ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                                  : (t("playground:actions.speechStart", "Start dictation") as string))
                                        }
                                      >
                                        <MicIcon className="h-4 w-4" />
                                      </button>
                                    </Tooltip>
                                  )}
                                  <Dropdown.Button
                                    aria-label={t(
                                      "playground:composer.submitAria",
                                      "Send message"
                                    )}
                                    data-testid="chat-send"
                                    title={sendButtonTitle}
                                    htmlType="submit"
                                    disabled={isSending || !isConnectionReady}
                                    className="!justify-end !w-auto"
                                    icon={
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-4 h-4">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="m19.5 8.25-7.5 7.5-7.5-7.5"
                                        />
                                      </svg>
                                    }
                                    menu={{
                                      items: [
                                        {
                                          key: "send-section",
                                          type: "group",
                                          label: t(
                                            "playground:composer.actions",
                                            "Send options"
                                          ),
                                          children: [
                                            {
                                              key: 1,
                                              label: (
                                                <Checkbox
                                                  checked={sendWhenEnter}
                                                  onChange={(e) =>
                                                    setSendWhenEnter(e.target.checked)
                                                  }>
                                                  {t("sendWhenEnter")}
                                                </Checkbox>
                                              )
                                            }
                                          ]
                                        },
                                        {
                                          type: "divider",
                                          key: "divider-1"
                                        },
                                        {
                                          key: "context-section",
                                          type: "group",
                                          label: t(
                                            "playground:composer.coreTools",
                                            "Conversation options"
                                          ),
                                          children: [
                                            {
                                              key: 2,
                                              label: (
                                                <Checkbox
                                                  checked={chatMode === "rag"}
                                                  onChange={(e) => {
                                                    setChatMode(
                                                      e.target.checked
                                                        ? "rag"
                                                        : "normal"
                                                    )
                                                  }}>
                                                  {t("common:chatWithCurrentPage")}
                                                </Checkbox>
                                              )
                                            },
                                            {
                                              key: 3,
                                              label: (
                                                <Checkbox
                                                  checked={useOCR}
                                                  onChange={(e) =>
                                                    setUseOCR(e.target.checked)
                                                  }>
                                                  {t("useOCR")}
                                                </Checkbox>
                                              )
                                            }
                                          ]
                                        }
                                      ]
                                    }}>
                                    <div className="inline-flex gap-2">
                                      {sendWhenEnter ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth="2"
                                          className="h-4 w-4"
                                          viewBox="0 0 24 24">
                                          <path d="M9 10L4 15 9 20"></path>
                                          <path d="M20 4v7a4 4 0 01-4 4H4"></path>
                                        </svg>
                                      ) : null}
                                      {t("common:send", "Send")}
                                    </div>
                                  </Dropdown.Button>
                                  {/* Current Conversation Settings button to the right of submit */}
                                  <Tooltip
                                    title={
                                      t("common:currentChatModelSettings") as string
                                    }>
                                    <button
                                      type="button"
                                      onClick={() => setOpenModelSettings(true)}
                                      className="rounded-md p-1 text-text-muted hover:bg-surface2 hover:text-text"
                                      title={t(
                                        "playground:composer.openModelSettings",
                                        "Open current chat settings"
                                      )}
                                    >
                                      <Gauge className="h-5 w-5" />
                                      <span className="sr-only">
                                        {t(
                                          "playground:composer.openModelSettings",
                                          "Open current chat settings"
                                        )}
                                      </span>
                                    </button>
                                  </Tooltip>
                                </>
                              ) : (
                                <>
                                  <Tooltip title={t("tooltip.stopStreaming")}>
                                    <button
                                      type="button"
                                      onClick={stopStreamingRequest}
                                      data-testid="chat-stop-streaming"
                                      className="rounded-md border border-border p-1 text-text-muted hover:bg-surface2 hover:text-text"
                                      title={t(
                                        "playground:composer.stopStreaming",
                                        "Stop streaming response"
                                      )}
                                    >
                                      <StopCircleIcon className="h-5 w-5" />
                                      <span className="sr-only">
                                        {t(
                                          "playground:composer.stopStreaming",
                                          "Stop streaming response"
                                        )}
                                      </span>
                                    </button>
                                  </Tooltip>
                                  {/* L15: Visual separator between Stop and settings buttons */}
                                  <Tooltip
                                    title={
                                      t("common:currentChatModelSettings") as string
                                    }>
                                    <button
                                      type="button"
                                      onClick={() => setOpenModelSettings(true)}
                                      className="rounded-md border border-border p-1 text-text-muted hover:bg-surface2 hover:text-text"
                                      title={t(
                                        "playground:composer.openModelSettings",
                                        "Open current chat settings"
                                      )}
                                    >
                                      <Gauge className="h-5 w-5" />
                                      <span className="sr-only">
                                        {t(
                                          "playground:composer.openModelSettings",
                                          "Open current chat settings"
                                        )}
                                      </span>
                                    </button>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Tooltip
                              title={t("playground:actions.upload", "Attach image")}
                            >
                              <button
                                type="button"
                                onClick={openUploadDialog}
                                className="h-9 w-9 rounded-full border border-border p-0 text-text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                aria-label={t(
                                  "playground:actions.upload",
                                  "Attach image"
                                )}
                                title={t(
                                  "playground:actions.upload",
                                  "Attach image"
                                )}
                              >
                                <ImageIcon className="h-4 w-4" />
                              </button>
                            </Tooltip>
                            {(browserSupportsSpeechRecognition || hasServerAudio) && (
                              <Tooltip
                                title={
                                  !speechAvailable
                                    ? t(
                                        "playground:actions.speechUnavailableBody",
                                        "Connect to a tldw server that exposes the audio transcriptions API to use dictation."
                                      )
                                    : speechUsesServer
                                      ? t(
                                          "playground:tooltip.speechToTextServer",
                                          "Dictation via your tldw server"
                                        )
                                      : t(
                                          "playground:tooltip.speechToTextBrowser",
                                          "Dictation via browser speech recognition"
                                        )
                                }
                              >
                                <button
                                  type="button"
                                  onClick={speechUsesServer ? startServerDictation : handleSpeechToggle}
                                  disabled={!speechAvailable}
                                  className={`h-9 w-9 rounded-full border border-border p-0 text-text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${
                                    speechAvailable &&
                                    ((speechUsesServer && isServerDictating) ||
                                      (!speechUsesServer && isListening))
                                      ? "border-primary text-primaryStrong"
                                      : ""
                                  }`}
                                  aria-label={
                                    !speechAvailable
                                      ? (t(
                                          "playground:actions.speechUnavailableTitle",
                                          "Dictation unavailable"
                                        ) as string)
                                      : speechUsesServer
                                        ? (isServerDictating
                                            ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                            : (t("playground:actions.speechStart", "Start dictation") as string))
                                      : (isListening
                                          ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                          : (t("playground:actions.speechStart", "Start dictation") as string))
                                  }
                                  title={
                                    !speechAvailable
                                      ? (t(
                                          "playground:actions.speechUnavailableTitle",
                                          "Dictation unavailable"
                                        ) as string)
                                      : speechUsesServer
                                        ? (isServerDictating
                                            ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                            : (t("playground:actions.speechStart", "Start dictation") as string))
                                        : (isListening
                                            ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                            : (t("playground:actions.speechStart", "Start dictation") as string))
                                  }
                                >
                                  <MicIcon className="h-4 w-4" />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!streaming ? (
                              <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={isSending || !isConnectionReady}
                                ariaLabel={t(
                                  "playground:composer.submitAria",
                                  "Send message"
                                )}
                                title={sendButtonTitle}
                                className="rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.12em]"
                              >
                                {t("common:send", "Send")}
                              </Button>
                            ) : (
                              <Tooltip title={t("tooltip.stopStreaming")}>
                                <button
                                  type="button"
                                  onClick={stopStreamingRequest}
                                  data-testid="chat-stop-streaming"
                                  className="h-9 w-9 rounded-full border border-border p-0 text-text-muted hover:bg-surface2 hover:text-text"
                                  aria-label={t(
                                    "playground:composer.stopStreaming",
                                    "Stop streaming response"
                                  )}
                                  title={t(
                                    "playground:composer.stopStreaming",
                                    "Stop streaming response"
                                  )}
                                >
                                  <StopCircleIcon className="h-4 w-4" />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Modal/Drawer for current conversation settings */}
      <CurrentChatModelSettings
        open={openModelSettings}
        setOpen={setOpenModelSettings}
        isOCREnabled={useOCR}
      />
      <ActorPopout open={openActorSettings} setOpen={setOpenActorSettings} />
      <DocumentGeneratorDrawer
        open={documentGeneratorOpen}
        onClose={() => {
          setDocumentGeneratorOpen(false)
          setDocumentGeneratorSeed({})
        }}
        conversationId={
          documentGeneratorSeed?.conversationId ?? serverChatId ?? null
        }
        defaultModel={selectedModel || null}
        seedMessage={documentGeneratorSeed?.message ?? null}
        seedMessageId={documentGeneratorSeed?.messageId ?? null}
      />
      {/* Quick ingest modal */}
      <QuickIngestModal
        open={ingestOpen}
        autoProcessQueued={autoProcessQueuedIngest}
        onClose={() => {
          setIngestOpen(false)
          setAutoProcessQueuedIngest(false)
          requestAnimationFrame(() => quickIngestBtnRef.current?.focus())
        }}
      />
    </div>
  )
}
