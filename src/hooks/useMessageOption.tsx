import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { type ChatHistory, type Message } from "~/store/option"
import { useStoreMessageOption } from "~/store/option"
import { usePlaygroundSessionStore } from "@/store/playground-session"
import {
  generateID,
  getCompareState,
  saveCompareState,
  saveHistory,
  saveMessage,
  updateHistory,
  removeMessageByIndex,
  formatToChatHistory,
  formatToMessage,
  getSessionFiles,
  getPromptById,
  getHistoryByServerChatId,
  setHistoryServerChatId,
  getHistoriesWithMetadata
} from "@/db/dexie/helpers"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageAssist } from "@/context"
import { useWebUI } from "@/store/webui"
import { useStorage } from "@plasmohq/storage/hook"
import { useStoreChatModelSettings } from "@/store/model"
import { ChatDocuments } from "@/models/ChatTypes"
import { normalChatMode } from "./chat-modes/normalChatMode"
import { continueChatMode } from "./chat-modes/continueChatMode"
import { ragMode } from "./chat-modes/ragMode"
import {
  focusTextArea,
  validateBeforeSubmit,
  createSaveMessageOnSuccess,
  createSaveMessageOnError
} from "./utils/messageHelpers"
import {
  createRegenerateLastMessage,
  createEditMessage,
  createStopStreamingRequest,
  createBranchMessage
} from "./handlers/messageHandlers"
import { tabChatMode } from "./chat-modes/tabChatMode"
import { documentChatMode } from "./chat-modes/documentChatMode"
import { generateBranchFromMessageIds } from "@/db/dexie/branch"
import { UploadedFile } from "@/db/dexie/types"
import { updatePageTitle } from "@/utils/update-page-title"
import { useAntdNotification } from "./useAntdNotification"
import { tldwClient, type ServerChatSummary } from "@/services/tldw/TldwApiClient"
import { getServerCapabilities } from "@/services/tldw/server-capabilities"
import { getActorSettingsForChat } from "@/services/actor-settings"
import { generateTitle } from "@/services/title"
import { FEATURE_FLAGS, useFeatureFlag } from "@/hooks/useFeatureFlags"
import { trackCompareMetric } from "@/utils/compare-metrics"
import { useChatBaseState } from "@/hooks/chat/useChatBaseState"
import { normalizeConversationState } from "@/utils/conversation-state"

// Default max models per compare turn (Phase 3 polish)
export const MAX_COMPARE_MODELS = 3

export const useMessageOption = () => {
  // Controllers come from Context (for aborting streaming requests)
  const {
    controller: abortController,
    setController: setAbortController
  } = usePageAssist()

  const {
    messages,
    setMessages,
    history,
    setHistory,
    streaming,
    setStreaming,
    isFirstMessage,
    setIsFirstMessage,
    historyId,
    setHistoryId,
    isLoading,
    setIsLoading,
    isProcessing,
    setIsProcessing,
    chatMode,
    setChatMode,
    isEmbedding,
    setIsEmbedding,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    useOCR,
    setUseOCR
  } = useChatBaseState(useStoreMessageOption)

  const {
    webSearch,
    setWebSearch,
    toolChoice,
    setToolChoice,
    isSearchingInternet,
    setIsSearchingInternet,
    queuedMessages: storeQueuedMessages,
    addQueuedMessage: storeAddQueuedMessage,
    clearQueuedMessages: storeClearQueuedMessages,
    selectedKnowledge,
    setSelectedKnowledge,
    temporaryChat,
    setTemporaryChat,
    documentContext,
    setDocumentContext,
    uploadedFiles,
    setUploadedFiles,
    contextFiles,
    setContextFiles,
    actionInfo,
    setActionInfo,
    setFileRetrievalEnabled,
    fileRetrievalEnabled,
    ragMediaIds,
    setRagMediaIds,
    ragSearchMode,
    setRagSearchMode,
    ragTopK,
    setRagTopK,
    ragEnableGeneration,
    setRagEnableGeneration,
    ragEnableCitations,
    setRagEnableCitations,
    ragSources,
    setRagSources,
    ragAdvancedOptions,
    setRagAdvancedOptions,
    serverChatId,
    setServerChatId,
    serverChatTitle,
    setServerChatTitle,
    serverChatCharacterId,
    setServerChatCharacterId,
    serverChatMetaLoaded,
    setServerChatMetaLoaded,
    serverChatState,
    setServerChatState,
    serverChatVersion,
    setServerChatVersion,
    serverChatTopic,
    setServerChatTopic,
    serverChatClusterId,
    setServerChatClusterId,
    serverChatSource,
    setServerChatSource,
    serverChatExternalRef,
    setServerChatExternalRef,
    compareMode,
    setCompareMode,
    compareSelectedModels,
    setCompareSelectedModels,
    compareSelectionByCluster,
    setCompareSelectionForCluster,
    compareActiveModelsByCluster,
    setCompareActiveModelsForCluster,
    compareParentByHistory,
    setCompareParentForHistory,
    compareCanonicalByCluster,
    setCompareCanonicalForCluster,
    compareSplitChats,
    setCompareSplitChat,
    replyTarget,
    clearReplyTarget
  } = useStoreMessageOption()

  const currentChatModelSettings = useStoreChatModelSettings()
  const [selectedModel, setSelectedModel] = useStorage("selectedModel")
  const [defaultInternetSearchOn] = useStorage("defaultInternetSearchOn", false)
  const [speechToTextLanguage, setSpeechToTextLanguage] = useStorage(
    "speechToTextLanguage",
    "en-US"
  )

  // Per-user configurable max compare models (2–4, default 3)
  const [compareMaxModels, setCompareMaxModels] = useStorage(
    "compareMaxModels",
    MAX_COMPARE_MODELS
  )
  const [compareFeatureEnabled, setCompareFeatureEnabled] = useFeatureFlag(
    FEATURE_FLAGS.COMPARE_MODE
  )
  const { ttsEnabled } = useWebUI()

  const { t } = useTranslation("option")
  const queryClient = useQueryClient()
  const invalidateServerChatHistory = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
  }, [queryClient])
  const notification = useAntdNotification()

  const navigate = useNavigate()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const messagesRef = React.useRef(messages)
  const serverChatHistoryIdRef = React.useRef<{
    chatId: string | null
    historyId: string | null
  }>({ chatId: null, historyId: null })
  const compareHydratingRef = React.useRef(false)
  const compareSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const compareNewHistoryIdsRef = React.useRef<Set<string>>(new Set())
  const compareModeActive = compareFeatureEnabled && compareMode
  const compareModeActiveRef = React.useRef(compareModeActive)
  const compareFeatureEnabledRef = React.useRef(compareFeatureEnabled)

  const selectServerChat = React.useCallback(
    (chat: ServerChatSummary) => {
      setIsLoading(true)
      setHistoryId(null)
      setHistory([])
      setMessages([])
      setServerChatId(chat.id)
      setServerChatTitle(chat.title || "")
      setServerChatCharacterId(chat.character_id ?? null)
      setIsProcessing(false)
      setStreaming(false)
      setIsEmbedding(false)
      setIsSearchingInternet(false)
      clearReplyTarget()
      setServerChatVersion(chat.version ?? null)
      setServerChatState(normalizeConversationState(chat.state))
      setServerChatTopic(chat.topic_label ?? null)
      setServerChatClusterId(chat.cluster_id ?? null)
      setServerChatSource(chat.source ?? null)
      setServerChatExternalRef(chat.external_ref ?? null)
      setServerChatMetaLoaded(true)
      updatePageTitle(chat.title)
      navigate("/")
    },
    [
      clearReplyTarget,
      navigate,
      setHistory,
      setHistoryId,
      setIsEmbedding,
      setIsLoading,
      setIsProcessing,
      setIsSearchingInternet,
      setMessages,
      setServerChatCharacterId,
      setServerChatClusterId,
      setServerChatExternalRef,
      setServerChatId,
      setServerChatMetaLoaded,
      setServerChatSource,
      setServerChatState,
      setServerChatTitle,
      setServerChatTopic,
      setServerChatVersion,
      setStreaming
    ]
  )

  React.useEffect(() => {
    if (serverChatHistoryIdRef.current.chatId !== serverChatId) {
      serverChatHistoryIdRef.current = {
        chatId: serverChatId ?? null,
        historyId: null
      }
    }
  }, [serverChatId])

  const ensureServerChatHistoryId = React.useCallback(
    async (chatId: string, title?: string) => {
      if (!chatId || temporaryChat) return null
      if (
        serverChatHistoryIdRef.current.chatId === chatId &&
        serverChatHistoryIdRef.current.historyId
      ) {
        const existingId = serverChatHistoryIdRef.current.historyId
        if (historyId !== existingId) {
          setHistoryId(existingId, { preserveServerChatId: true })
        }
        return existingId
      }

      const existing = await getHistoryByServerChatId(chatId)
      const trimmedTitle = (title || existing?.title || "").trim()
      const resolvedTitle =
        trimmedTitle ||
        t("common:untitled", { defaultValue: "Untitled" })

      if (existing) {
        if (resolvedTitle && resolvedTitle !== existing.title) {
          await updateHistory(existing.id, resolvedTitle)
        }
        serverChatHistoryIdRef.current = {
          chatId,
          historyId: existing.id
        }
        if (historyId !== existing.id) {
          setHistoryId(existing.id, { preserveServerChatId: true })
        }
        return existing.id
      }

      if (historyId && historyId !== "temp") {
        await setHistoryServerChatId(historyId, chatId)
        if (resolvedTitle) {
          await updateHistory(historyId, resolvedTitle)
        }
        serverChatHistoryIdRef.current = {
          chatId,
          historyId
        }
        setHistoryId(historyId, { preserveServerChatId: true })
        return historyId
      }

      const newHistory = await saveHistory(
        resolvedTitle,
        false,
        "server",
        undefined,
        chatId
      )
      serverChatHistoryIdRef.current = {
        chatId,
        historyId: newHistory.id
      }
      setHistoryId(newHistory.id, { preserveServerChatId: true })
      return newHistory.id
    },
    [historyId, setHistoryId, t, temporaryChat]
  )

  React.useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const serverChatLoadRef = React.useRef<{
    chatId: string | null
    controller: AbortController | null
    inFlight: boolean
  }>({ chatId: null, controller: null, inFlight: false })
  const serverChatDebounceRef = React.useRef<{
    chatId: string | null
    timer: ReturnType<typeof setTimeout> | null
  }>({ chatId: null, timer: null })

  React.useEffect(() => {
    return () => {
      if (serverChatDebounceRef.current.timer) {
        clearTimeout(serverChatDebounceRef.current.timer)
      }
      if (serverChatLoadRef.current.controller) {
        serverChatLoadRef.current.controller.abort()
      }
    }
  }, [])

  React.useEffect(() => {
    if (!serverChatId) return
    if (
      serverChatLoadRef.current.chatId === serverChatId &&
      messages.length > 0
    ) {
      return
    }
    if (serverChatLoadRef.current.inFlight) {
      if (serverChatLoadRef.current.chatId === serverChatId) {
        return
      }
      if (serverChatLoadRef.current.controller) {
        serverChatLoadRef.current.controller.abort()
      }
      serverChatLoadRef.current.inFlight = false
    }

    if (serverChatDebounceRef.current.timer) {
      clearTimeout(serverChatDebounceRef.current.timer)
    }

    serverChatDebounceRef.current.chatId = serverChatId
    serverChatDebounceRef.current.timer = setTimeout(() => {
      const controller = new AbortController()
      serverChatLoadRef.current = {
        chatId: serverChatId,
        controller,
        inFlight: true
      }

      const loadServerChat = async () => {
        try {
          setIsLoading(true)
          await tldwClient.initialize().catch(() => null)

          let assistantName = "Assistant"
          let chatTitle = serverChatTitle || ""
          let characterId = serverChatCharacterId ?? null

          if (!serverChatMetaLoaded) {
            try {
              const chat = await tldwClient.getChat(serverChatId)
              chatTitle = String((chat as any)?.title || chatTitle || "")
              const resolvedCharacterId =
                (chat as any)?.character_id ??
                (chat as any)?.characterId ??
                null
              if (resolvedCharacterId != null) {
                characterId = resolvedCharacterId
              }
              setServerChatTitle(chatTitle || "")
              setServerChatCharacterId(resolvedCharacterId ?? null)
              setServerChatState(
                normalizeConversationState(
                  (chat as any)?.state ?? (chat as any)?.conversation_state
                )
              )
              setServerChatVersion((chat as any)?.version ?? null)
              setServerChatTopic((chat as any)?.topic_label ?? null)
              setServerChatClusterId((chat as any)?.cluster_id ?? null)
              setServerChatSource((chat as any)?.source ?? null)
              setServerChatExternalRef((chat as any)?.external_ref ?? null)
              setServerChatMetaLoaded(true)
            } catch {
              // ignore metadata failures; still try to load messages
            }
          }

          if (characterId != null) {
            try {
              const character = await tldwClient.getCharacter(characterId)
              if (character) {
                assistantName = character.name || character.title || assistantName
              }
            } catch {
              // ignore character lookup failures
            }
          }

          const list = await tldwClient.listChatMessages(
            serverChatId,
            { include_deleted: "false" } as any,
            { signal: controller.signal }
          )

          const history = list.map((m) => ({
            role: (m as any).role,
            content: m.content
          }))

          const mappedMessages = list.map((m) => {
            const createdAt = Date.parse(m.created_at)
            return {
              createdAt: Number.isNaN(createdAt) ? undefined : createdAt,
              isBot: m.role === "assistant",
              name:
                m.role === "assistant"
                  ? assistantName
                  : m.role === "system"
                    ? "System"
                    : "You",
              message: m.content,
              sources: [],
              images: [],
              id: String(m.id),
              serverMessageId: String(m.id),
              serverMessageVersion: m.version,
              parentMessageId:
                (m as any)?.parent_message_id ??
                (m as any)?.parentMessageId ??
                null,
              messageType:
                (m as any)?.message_type ?? (m as any)?.messageType,
              clusterId: (m as any)?.cluster_id ?? (m as any)?.clusterId,
              modelId: (m as any)?.model_id ?? (m as any)?.modelId,
              modelName:
                (m as any)?.model_name ??
                (m as any)?.modelName ??
                assistantName,
              modelImage: (m as any)?.model_image ?? (m as any)?.modelImage
            }
          })

          setHistory(history)
          setMessages(mappedMessages)
          if (!temporaryChat) {
            try {
              const localHistoryId = await ensureServerChatHistoryId(
                serverChatId,
                chatTitle || undefined
              )
              if (localHistoryId) {
                const metadataMap = await getHistoriesWithMetadata([
                  localHistoryId
                ])
                const existingMeta = metadataMap.get(localHistoryId)
                if (!existingMeta || existingMeta.messageCount === 0) {
                  const now = Date.now()
                  await Promise.all(
                    list.map((m, index) => {
                      const parsedCreatedAt = Date.parse(m.created_at)
                      const resolvedCreatedAt = Number.isNaN(parsedCreatedAt)
                        ? now + index
                        : parsedCreatedAt
                      const role =
                        m.role === "assistant" ||
                        m.role === "system" ||
                        m.role === "user"
                          ? m.role
                          : "user"
                      const name =
                        role === "assistant"
                          ? assistantName
                          : role === "system"
                            ? "System"
                            : "You"
                      return saveMessage({
                        id: String(m.id),
                        history_id: localHistoryId,
                        name,
                        role,
                        content: m.content,
                        images: [],
                        source: [],
                        time: index,
                        message_type:
                          (m as any)?.message_type ?? (m as any)?.messageType,
                        clusterId: (m as any)?.cluster_id ?? (m as any)?.clusterId,
                        modelId: (m as any)?.model_id ?? (m as any)?.modelId,
                        modelName:
                          (m as any)?.model_name ??
                          (m as any)?.modelName ??
                          assistantName,
                        modelImage: (m as any)?.model_image ?? (m as any)?.modelImage,
                        parent_message_id:
                          (m as any)?.parent_message_id ??
                          (m as any)?.parentMessageId ??
                          null,
                        createdAt: resolvedCreatedAt
                      })
                    })
                  )
                }
              }
            } catch {
              // Local mirror is best-effort for server chats.
            }
          }
          if (chatTitle) {
            updatePageTitle(chatTitle)
          }
        } catch (e: any) {
          const errMessage = String(e?.message || "")
          const isAbort =
            e?.name === "AbortError" ||
            errMessage.toLowerCase().includes("abort")
          if (!isAbort) {
            notification.error({
              message: t("error", { defaultValue: "Error" }),
              description:
                errMessage ||
                t("common:serverChatLoadError", {
                  defaultValue:
                    "Failed to load server chat. Check your connection and try again."
                })
            })
          }
        } finally {
          if (serverChatLoadRef.current.controller === controller) {
            serverChatLoadRef.current = {
              chatId: serverChatId,
              controller: null,
              inFlight: false
            }
          }
          setIsLoading(false)
        }
      }

      void loadServerChat()
    }, 200)

    return () => {
      if (serverChatDebounceRef.current.timer) {
        clearTimeout(serverChatDebounceRef.current.timer)
        serverChatDebounceRef.current.timer = null
      }
    }
  }, [
    messages.length,
    notification,
    ensureServerChatHistoryId,
    serverChatId,
    serverChatCharacterId,
    serverChatMetaLoaded,
    serverChatTitle,
    temporaryChat,
    setHistory,
    setIsLoading,
    setMessages,
    setServerChatCharacterId,
    setServerChatClusterId,
    setServerChatExternalRef,
    setServerChatMetaLoaded,
    setServerChatSource,
    setServerChatState,
    setServerChatTitle,
    setServerChatTopic,
    setServerChatVersion,
    t
  ])

  React.useEffect(() => {
    if (!serverChatId || temporaryChat) return
    void ensureServerChatHistoryId(serverChatId, serverChatTitle || undefined)
  }, [ensureServerChatHistoryId, serverChatId, serverChatTitle, temporaryChat])

  // Persist prompt selections across views/contexts
  const [storedSystemPrompt, setStoredSystemPrompt] = useStorage<string | null>(
    "selectedSystemPrompt",
    null
  )
  const [storedQuickPrompt, setStoredQuickPrompt] = useStorage<string | null>(
    "selectedQuickPrompt",
    null
  )

  React.useEffect(() => {
    if (storedSystemPrompt && storedSystemPrompt !== selectedSystemPrompt) {
      setSelectedSystemPrompt(storedSystemPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedSystemPrompt])

  React.useEffect(() => {
    if (storedQuickPrompt && storedQuickPrompt !== selectedQuickPrompt) {
      setSelectedQuickPrompt(storedQuickPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedQuickPrompt])

  React.useEffect(() => {
    setStoredSystemPrompt(selectedSystemPrompt ?? null)
  }, [selectedSystemPrompt, setStoredSystemPrompt])

  React.useEffect(() => {
    setStoredQuickPrompt(selectedQuickPrompt ?? null)
  }, [selectedQuickPrompt, setStoredQuickPrompt])

  const compareParentForHistory = historyId
    ? compareParentByHistory?.[historyId]
    : undefined

  React.useEffect(() => {
    if (!compareFeatureEnabled && compareMode) {
      setCompareMode(false)
      setCompareSelectedModels([])
    }
  }, [
    compareFeatureEnabled,
    compareMode,
    setCompareMode,
    setCompareSelectedModels
  ])

  React.useEffect(() => {
    if (compareModeActiveRef.current === compareModeActive) {
      return
    }
    compareModeActiveRef.current = compareModeActive
    void trackCompareMetric({
      type: compareModeActive ? "compare_mode_enabled" : "compare_mode_disabled"
    })
  }, [compareModeActive])

  React.useEffect(() => {
    if (compareFeatureEnabledRef.current === compareFeatureEnabled) {
      return
    }
    compareFeatureEnabledRef.current = compareFeatureEnabled
    void trackCompareMetric({
      type: compareFeatureEnabled ? "feature_enabled" : "feature_disabled"
    })
  }, [compareFeatureEnabled])

  const resetCompareState = React.useCallback(() => {
    setCompareMode(false)
    setCompareSelectedModels([])
    useStoreMessageOption.setState({
      compareSelectionByCluster: {},
      compareCanonicalByCluster: {},
      compareSplitChats: {},
      compareActiveModelsByCluster: {}
    })
  }, [setCompareMode, setCompareSelectedModels])

  React.useEffect(() => {
    if (!historyId || historyId === "temp") {
      return
    }

    let cancelled = false
    compareHydratingRef.current = true

    const loadCompareState = async () => {
      try {
        const saved = await getCompareState(historyId)
        if (cancelled) return
        if (saved) {
          setCompareMode(saved.compareMode ?? false)
          setCompareSelectedModels(saved.compareSelectedModels ?? [])
          useStoreMessageOption.setState({
            compareSelectionByCluster: saved.compareSelectionByCluster || {},
            compareCanonicalByCluster: saved.compareCanonicalByCluster || {},
            compareSplitChats: saved.compareSplitChats || {},
            compareActiveModelsByCluster:
              saved.compareActiveModelsByCluster || {}
          })
          if (saved.compareParent) {
            setCompareParentForHistory(historyId, saved.compareParent)
          }
        } else if (!compareNewHistoryIdsRef.current.has(historyId)) {
          resetCompareState()
        }
      } finally {
        compareHydratingRef.current = false
      }
    }

    void loadCompareState()
    return () => {
      cancelled = true
      compareHydratingRef.current = false
    }
  }, [
    historyId,
    resetCompareState,
    setCompareMode,
    setCompareSelectedModels,
    setCompareParentForHistory
  ])

  React.useEffect(() => {
    if (!historyId || historyId === "temp") {
      return
    }
    if (compareHydratingRef.current) {
      return
    }

    if (compareSaveTimerRef.current) {
      clearTimeout(compareSaveTimerRef.current)
    }

    compareSaveTimerRef.current = setTimeout(() => {
      void saveCompareState({
        history_id: historyId,
        compareMode,
        compareSelectedModels,
        compareSelectionByCluster,
        compareCanonicalByCluster,
        compareSplitChats,
        compareActiveModelsByCluster,
        compareParent: compareParentForHistory ?? null,
        updatedAt: Date.now()
      })
    }, 200)

    return () => {
      if (compareSaveTimerRef.current) {
        clearTimeout(compareSaveTimerRef.current)
      }
    }
  }, [
    historyId,
    compareMode,
    compareSelectedModels,
    compareSelectionByCluster,
    compareCanonicalByCluster,
    compareSplitChats,
    compareActiveModelsByCluster,
    compareParentForHistory
  ])

  const handleFocusTextArea = () => focusTextArea(textareaRef)

  const handleFileUpload = async (file: File) => {
    try {
      const isImage = file.type.startsWith("image/")

      if (isImage) {
        return file
      }

      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        notification.error({
          message: t("upload.fileTooLargeTitle", "File Too Large"),
          description: t(
            "upload.fileTooLargeDescription",
            "File size must be less than 10MB"
          )
        })
        return
      }

      const fileId = generateID()

      const { processFileUpload } = await import("~/utils/file-processor")
      const source = await processFileUpload(file)

      const uploadedFile: UploadedFile = {
        id: fileId,
        filename: file.name,
        type: file.type,
        content: source.content,
        size: file.size,
        uploadedAt: Date.now(),
        processed: false
      }

      setUploadedFiles([...uploadedFiles, uploadedFile])
      setContextFiles([...contextFiles, uploadedFile])

      return file
    } catch (error) {
      console.error("Error uploading file:", error)
      notification.error({
        message: t("upload.uploadFailedTitle", "Upload Failed"),
        description: t(
          "upload.uploadFailedDescription",
          "Failed to upload file. Please try again."
        )
      })
      throw error
    }
  }

  const removeUploadedFile = async (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId))
    setContextFiles(contextFiles.filter((f) => f.id !== fileId))
  }

  const clearUploadedFiles = () => {
    setUploadedFiles([])
  }

  const handleSetFileRetrievalEnabled = async (enabled: boolean) => {
    setFileRetrievalEnabled(enabled)
  }

  const clearChat = () => {
    navigate("/")
    setMessages([])
    setHistory([])
    setHistoryId(null)
    setServerChatId(null)
    setServerChatVersion(null)
    setIsFirstMessage(true)
    setIsLoading(false)
    setIsProcessing(false)
    setStreaming(false)
    setContextFiles([])
    updatePageTitle()
    currentChatModelSettings.reset()
    // textareaRef?.current?.focus()
    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }
    handleFocusTextArea()
    setDocumentContext(null)
    // Clear uploaded files
    setUploadedFiles([])
    setFileRetrievalEnabled(false)
    setActionInfo(null)
    setRagMediaIds(null)
    setRagSearchMode("hybrid")
    setRagTopK(null)
    setRagEnableGeneration(false)
    setRagEnableCitations(false)
    setRagSources([])
    storeClearQueuedMessages()
    setServerChatId(null)
    setServerChatVersion(null)
    setCompareMode(false)
    setCompareSelectedModels([])
    useStoreMessageOption.setState({
      compareSelectionByCluster: {},
      compareCanonicalByCluster: {},
      compareSplitChats: {},
      compareActiveModelsByCluster: {}
    })
    clearReplyTarget()
    // Clear persisted session when starting new chat
    usePlaygroundSessionStore.getState().clearSession()
  }

  const baseSaveMessageOnSuccess = createSaveMessageOnSuccess(
    temporaryChat,
    setHistoryId as (
      id: string,
      options?: { preserveServerChatId?: boolean }
    ) => void
  )
  const saveMessageOnError = createSaveMessageOnError(
    temporaryChat,
    history,
    setHistory,
    setHistoryId as (
      id: string,
      options?: { preserveServerChatId?: boolean }
    ) => void
  )

  const saveMessageOnSuccess = async (payload: any): Promise<string | null> => {
    const historyKey = await baseSaveMessageOnSuccess(payload)

    if (!payload?.historyId && historyKey) {
      compareNewHistoryIdsRef.current.add(historyKey)
    }

    if (temporaryChat) {
      return historyKey
    }

    let skipServerWrite = false
    const payloadConversationId =
      typeof payload?.conversationId === "string"
        ? payload.conversationId
        : payload?.conversationId != null
          ? String(payload.conversationId)
          : null
    const isServerConversation =
      payloadConversationId && serverChatId
        ? payloadConversationId === String(serverChatId)
        : false
    const serverConversationMatches = payloadConversationId
      ? payloadConversationId === String(serverChatId)
      : true

    if (isServerConversation && payload?.saveToDb) {
      try {
        const caps = await getServerCapabilities()
        skipServerWrite = Boolean(caps?.hasChatSaveToDb)
      } catch {
        skipServerWrite = false
      }
    }

    // When resuming a server-backed chat, mirror new turns to /api/v1/chats.
    if (
      serverChatId &&
      serverConversationMatches &&
      !skipServerWrite &&
      !payload?.isRegenerate &&
      !payload?.isContinue &&
      typeof payload?.message === "string" &&
      typeof payload?.fullText === "string"
    ) {
      try {
        const cid = serverChatId
        const userContent = payload.message.trim()
        const assistantContent = payload.fullText.trim()

        if (userContent.length > 0) {
          await tldwClient.addChatMessage(cid, {
            role: "user",
            content: userContent
          })
        }

        if (assistantContent.length > 0) {
          await tldwClient.addChatMessage(cid, {
            role: "assistant",
            content: assistantContent
          })
        }
      } catch {
        // Ignore sync errors; local history is still saved.
      }
    }

    return historyKey
  }

  const buildChatModeParams = async (overrides: Record<string, any> = {}) => {
    const hasHistoryOverride = Object.prototype.hasOwnProperty.call(
      overrides,
      "historyId"
    )
    const resolvedServerChatId = overrides.serverChatId ?? serverChatId
    const resolvedHistoryId = hasHistoryOverride
      ? overrides.historyId
      : resolvedServerChatId && !temporaryChat
        ? await ensureServerChatHistoryId(
            resolvedServerChatId,
            serverChatTitle || undefined
          )
        : historyId

    const actorSettings = await getActorSettingsForChat({
      historyId: resolvedHistoryId ?? historyId,
      serverChatId: resolvedServerChatId
    })

    return {
      selectedModel,
      useOCR,
      selectedSystemPrompt,
      selectedKnowledge,
      toolChoice,
      currentChatModelSettings,
      setMessages,
      setIsSearchingInternet,
      saveMessageOnSuccess,
      saveMessageOnError,
      setHistory,
      setIsProcessing,
      setStreaming,
      setAbortController,
      historyId: resolvedHistoryId ?? historyId,
      setHistoryId,
      fileRetrievalEnabled,
      ragMediaIds,
      ragSearchMode,
      ragTopK,
      ragEnableGeneration,
      ragEnableCitations,
      ragSources,
      ragAdvancedOptions,
      setActionInfo,
      webSearch,
      actorSettings,
      ...overrides
    }
  }

  const buildCompareHistoryTitle = React.useCallback(
    (title: string) => {
      const trimmed =
        title?.trim() ||
        t("common:untitled", { defaultValue: "Untitled" })
      return t(
        "playground:composer.compareHistoryPrefix",
        "Compare: {{title}}",
        { title: trimmed }
      )
    },
    [t]
  )

  const buildCompareSplitTitle = React.useCallback(
    (title: string) => {
      const trimmed =
        title?.trim() ||
        t("common:untitled", { defaultValue: "Untitled" })
      const suffix = t(
        "playground:composer.compareHistorySuffix",
        "(from compare)"
      )
      if (trimmed.includes(suffix)) {
        return trimmed
      }
      return `${trimmed} ${suffix}`.trim()
    },
    [t]
  )

  const getMessageModelKey = (message: Message) =>
    message.modelId || message.modelName || message.name

  const shouldIncludeMessageForModel = (
    message: Message,
    modelId: string
  ) => {
    if (!message.isBot) {
      if (message.messageType === "compare:perModelUser") {
        return message.modelId === modelId
      }
      return true
    }
    const messageModel = getMessageModelKey(message)
    if (!messageModel) {
      return false
    }
    return messageModel === modelId
  }

  const buildHistoryFromMessages = (items: Message[]): ChatHistory =>
    items.map((message) => ({
      role: message.isBot ? "assistant" : "user",
      content: message.message,
      image: message.images?.[0],
      messageType: message.messageType
    }))

  const buildHistoryForModel = (
    items: Message[],
    modelId: string
  ): ChatHistory =>
    buildHistoryFromMessages(
      items.filter((message) => shouldIncludeMessageForModel(message, modelId))
    )

  const buildMessagesForModel = (items: Message[], modelId: string) =>
    items.filter((message) => shouldIncludeMessageForModel(message, modelId))

  const getCompareUserMessageId = (items: Message[], clusterId: string) =>
    items.find(
      (message) =>
        message.messageType === "compare:user" &&
        message.clusterId === clusterId
    )?.id || null

  const getLastThreadMessageId = (
    items: Message[],
    clusterId: string,
    modelId: string
  ) => {
    const threadMessages = items.filter(
      (message) =>
        message.clusterId === clusterId &&
        getMessageModelKey(message) === modelId
    )
    const lastThreadMessage = threadMessages[threadMessages.length - 1]
    return lastThreadMessage?.id || getCompareUserMessageId(items, clusterId)
  }

  const refreshHistoryFromMessages = React.useCallback(() => {
    const next = buildHistoryFromMessages(messagesRef.current)
    setHistory(next)
  }, [buildHistoryFromMessages, setHistory])

  const getCompareBranchMessageIds = (
    items: Message[],
    clusterId: string,
    modelId: string
  ) => {
    const userIndex = items.findIndex(
      (message) =>
        message.messageType === "compare:user" &&
        message.clusterId === clusterId
    )
    if (userIndex === -1) {
      return []
    }

    const messageIds = new Set<string>()
    items.forEach((message, index) => {
      if (!message.id) {
        return
      }
      if (index < userIndex) {
        if (shouldIncludeMessageForModel(message, modelId)) {
          messageIds.add(message.id)
        }
        return
      }
      if (message.clusterId !== clusterId) {
        return
      }
      if (message.messageType === "compare:user") {
        messageIds.add(message.id)
        return
      }
      if (shouldIncludeMessageForModel(message, modelId)) {
        messageIds.add(message.id)
      }
    })

    return Array.from(messageIds)
  }

  const validateBeforeSubmitFn = () => {
    if (compareModeActive) {
      const maxModels =
        typeof compareMaxModels === "number" && compareMaxModels > 0
          ? compareMaxModels
          : MAX_COMPARE_MODELS

      if (!compareSelectedModels || compareSelectedModels.length === 0) {
        notification.error({
          message: t("error"),
          description: t(
            "playground:composer.validationCompareSelectModels",
            "Select at least one model to use in Compare mode."
          )
        })
        return false
      }
      if (compareSelectedModels.length > maxModels) {
        notification.error({
          message: t("error"),
          description: t(
            "playground:composer.compareMaxModels",
            "You can compare up to {{limit}} models per turn.",
            { limit: maxModels }
          )
        })
        return false
      }
      return true
    }
    return validateBeforeSubmit(selectedModel, t, notification)
  }

  const onSubmit = async ({
    message,
    image,
    isRegenerate = false,
    messages: chatHistory,
    memory,
    controller,
    isContinue,
    docs,
    regenerateFromMessage
  }: {
    message: string
    image: string
    isRegenerate?: boolean
    isContinue?: boolean
    messages?: Message[]
    memory?: ChatHistory
    controller?: AbortController
    docs?: ChatDocuments
    regenerateFromMessage?: Message
  }) => {
    setStreaming(true)
    let signal: AbortSignal
    if (!controller) {
      const newController = new AbortController()
      signal = newController.signal
      setAbortController(newController)
    } else {
      setAbortController(controller)
      signal = controller.signal
    }

    const chatModeParams = await buildChatModeParams()
    const baseMessages = chatHistory || messages
    const baseHistory = memory || history
    const replyActive =
      Boolean(replyTarget) &&
      !compareModeActive &&
      !isRegenerate &&
      !isContinue
    const replyOverrides = replyActive
      ? (() => {
          const userMessageId = generateID()
          const assistantMessageId = generateID()
          return {
            userMessageId,
            assistantMessageId,
            userParentMessageId: replyTarget?.id ?? null,
            assistantParentMessageId: userMessageId
          }
        })()
      : {}
    const chatModeParamsWithReply = replyActive
      ? { ...chatModeParams, ...replyOverrides }
      : chatModeParams
    const chatModeParamsWithRegen = {
      ...chatModeParamsWithReply,
      regenerateFromMessage: isRegenerate ? regenerateFromMessage : undefined
    }

    try {
      if (isContinue) {
        await continueChatMode(
          chatHistory || messages,
          memory || history,
          signal,
          chatModeParams
        )
        return
      }
      // console.log("contextFiles", contextFiles)
      if (contextFiles.length > 0) {
        await documentChatMode(
          message,
          image,
          isRegenerate,
          chatHistory || messages,
          memory || history,
          signal,
          contextFiles,
          chatModeParamsWithRegen
        )
        // setFileRetrievalEnabled(false)
        return
      }

      if (docs?.length > 0 || documentContext?.length > 0) {
        const processingTabs = docs || documentContext || []

        if (docs?.length > 0) {
          setDocumentContext(
            Array.from(new Set([...(documentContext || []), ...docs]))
          )
        }
        await tabChatMode(
          message,
          image,
          processingTabs,
          isRegenerate,
          chatHistory || messages,
          memory || history,
          signal,
          chatModeParamsWithRegen
        )
        return
      }

      if (selectedKnowledge) {
        await ragMode(
          message,
          image,
          isRegenerate,
          chatHistory || messages,
          memory || history,
          signal,
          chatModeParamsWithRegen
        )
      } else {
        // Include uploaded files info even in normal mode
        const enhancedChatModeParams = {
          ...chatModeParamsWithRegen,
          uploadedFiles: uploadedFiles
        }
        const baseMessages = chatHistory || messages
        const baseHistory = memory || history

        if (!compareModeActive) {
          await normalChatMode(
            message,
            image,
            isRegenerate,
            baseMessages,
            baseHistory,
            signal,
            enhancedChatModeParams
          )
        } else {
          const maxModels =
            typeof compareMaxModels === "number" && compareMaxModels > 0
              ? compareMaxModels
              : MAX_COMPARE_MODELS

          const modelsRaw =
            compareSelectedModels && compareSelectedModels.length > 0
              ? compareSelectedModels
              : selectedModel
                ? [selectedModel]
                : []
          if (modelsRaw.length === 0) {
            throw new Error("No models selected for Compare mode")
          }
          const uniqueModels = Array.from(new Set(modelsRaw))
          const models =
            uniqueModels.length > maxModels
              ? uniqueModels.slice(0, maxModels)
              : uniqueModels

          if (uniqueModels.length > maxModels) {
            notification.warning({
              message: t("error"),
              description: t(
                "playground:composer.compareMaxModelsTrimmed",
                "Compare is limited to {{limit}} models per turn. Using the first {{limit}} selected models.",
                { count: maxModels, limit: maxModels }
              )
            })
          }
          const clusterId = generateID()
          const compareUserMessageId = generateID()
          const lastMessage = baseMessages[baseMessages.length - 1]
          const compareUserParentMessageId = lastMessage?.id || null
          const resolvedImage =
            image.length > 0
              ? `data:image/jpeg;base64,${image.split(",")[1]}`
              : ""
          const compareUserMessage: Message = {
            isBot: false,
            name: "You",
            message,
            sources: [],
            images: resolvedImage ? [resolvedImage] : [],
            createdAt: Date.now(),
            id: compareUserMessageId,
            messageType: "compare:user",
            clusterId,
            parentMessageId: compareUserParentMessageId,
            documents:
              uploadedFiles?.map((file) => ({
                type: "file",
                filename: file.filename,
                fileSize: file.size,
                processed: file.processed
              })) || []
          }

          setMessages((prev) => [...prev, compareUserMessage])

          let activeHistoryId = historyId
          if (temporaryChat) {
            if (historyId !== "temp") {
              setHistoryId("temp")
            }
            activeHistoryId = "temp"
          } else if (!activeHistoryId) {
            const title = await generateTitle(
              uniqueModels[0] || selectedModel || "",
              message,
              message
            )
            const compareTitle = buildCompareHistoryTitle(title)
            const newHistory = await saveHistory(compareTitle, false, "web-ui")
            updatePageTitle(compareTitle)
            activeHistoryId = newHistory.id
            setHistoryId(newHistory.id)
            compareNewHistoryIdsRef.current.add(newHistory.id)
          }

          if (!temporaryChat && activeHistoryId) {
            await saveMessage({
              id: compareUserMessageId,
              history_id: activeHistoryId,
              name: selectedModel || uniqueModels[0] || "You",
              role: "user",
              content: message,
              images: resolvedImage ? [resolvedImage] : [],
              time: 1,
              message_type: "compare:user",
              clusterId,
              parent_message_id: compareUserParentMessageId,
              documents:
                uploadedFiles?.map((file) => ({
                  type: "file",
                  filename: file.filename,
                  fileSize: file.size,
                  processed: file.processed
                })) || []
            })
          }

          setIsProcessing(true)

          const compareChatModeParams = await buildChatModeParams({
            historyId: activeHistoryId,
            setHistory: () => {},
            setStreaming: () => {},
            setIsProcessing: () => {},
            setAbortController: () => {}
          })
          const compareEnhancedParams = {
            ...compareChatModeParams,
            uploadedFiles: uploadedFiles
          }

          const comparePromises = models.map((modelId) => {
            const historyForModel = buildHistoryForModel(baseMessages, modelId)
            return normalChatMode(
              message,
              image,
              true,
              baseMessages,
              baseHistory,
              signal,
              {
                ...compareEnhancedParams,
                selectedModel: modelId,
                clusterId,
                assistantMessageType: "compare:reply",
                modelIdOverride: modelId,
                assistantParentMessageId: compareUserMessageId,
                historyForModel
              }
            ).catch((e: any) => {
              notification.error({
                message: t("error"),
                description: e?.message || t("somethingWentWrong")
              })
            })
          })

          await Promise.allSettled(comparePromises)
          refreshHistoryFromMessages()
          setIsProcessing(false)
          setStreaming(false)
          setAbortController(null)
        }
      }
    } catch (e: any) {
      notification.error({
        message: t("error"),
        description: e?.message || t("somethingWentWrong")
      })
      setIsProcessing(false)
      setStreaming(false)
    } finally {
      if (replyActive) {
        clearReplyTarget()
      }
    }
  }

  const sendPerModelReply = async ({
    clusterId,
    modelId,
    message
  }: {
    clusterId: string
    modelId: string
    message: string
  }) => {
    const trimmed = message.trim()
    if (!trimmed) {
      return
    }

    if (!compareFeatureEnabled) {
      notification.error({
        message: t("error"),
        description: t(
          "playground:composer.compareDisabled",
          "Compare mode is disabled in settings."
        )
      })
      return
    }

    setStreaming(true)
    const newController = new AbortController()
    setAbortController(newController)
    const signal = newController.signal

    const baseMessages = messages
    const baseHistory = history
    const userMessageId = generateID()
    const assistantMessageId = generateID()
    const userParentMessageId = getLastThreadMessageId(
      baseMessages,
      clusterId,
      modelId
    )

    try {
      const chatModeParams = await buildChatModeParams()
      const enhancedChatModeParams = {
        ...chatModeParams,
        uploadedFiles: uploadedFiles
      }
      const historyForModel = buildHistoryForModel(baseMessages, modelId)
      const perModelOverrides = {
        selectedModel: modelId,
        clusterId,
        userMessageType: "compare:perModelUser",
        assistantMessageType: "compare:reply",
        modelIdOverride: modelId,
        userMessageId,
        assistantMessageId,
        userParentMessageId,
        assistantParentMessageId: userMessageId,
        historyForModel
      }

      if (contextFiles.length > 0) {
        await documentChatMode(
          trimmed,
          "",
          false,
          baseMessages,
          baseHistory,
          signal,
          contextFiles,
          {
            ...chatModeParams,
            ...perModelOverrides
          }
        )
        return
      }

      if (documentContext && documentContext.length > 0) {
        await tabChatMode(
          trimmed,
          "",
          documentContext,
          false,
          baseMessages,
          baseHistory,
          signal,
          {
            ...chatModeParams,
            ...perModelOverrides
          }
        )
        return
      }

      if (selectedKnowledge) {
        await ragMode(
          trimmed,
          "",
          false,
          baseMessages,
          baseHistory,
          signal,
          {
            ...chatModeParams,
            ...perModelOverrides
          }
        )
        return
      }

      await normalChatMode(
        trimmed,
        "",
        false,
        baseMessages,
        baseHistory,
        signal,
        {
          ...enhancedChatModeParams,
          ...perModelOverrides
        }
      )
    } catch (e: any) {
      notification.error({
        message: t("error"),
        description: e?.message || t("somethingWentWrong")
      })
      setIsProcessing(false)
      setStreaming(false)
    }
  }

  const regenerateLastMessage = createRegenerateLastMessage({
    validateBeforeSubmitFn,
    history,
    messages,
    setHistory,
    setMessages,
    onSubmit
  })

  const stopStreamingRequest = createStopStreamingRequest(
    abortController,
    setAbortController
  )

  const editMessage = createEditMessage({
    messages,
    history,
    setMessages,
    setHistory,
    historyId,
    validateBeforeSubmitFn,
    onSubmit
  })

  const deleteMessage = React.useCallback(
    async (index: number) => {
      const target = messages[index]
      if (!target) return

      const targetId = target.serverMessageId ?? target.id
      if (replyTarget?.id && targetId && replyTarget.id === targetId) {
        clearReplyTarget()
      }

      if (target.serverMessageId) {
        await tldwClient.initialize().catch(() => null)
        let expectedVersion = target.serverMessageVersion
        if (expectedVersion == null) {
          const serverMessage = await tldwClient.getMessage(target.serverMessageId)
          expectedVersion = serverMessage?.version
        }
        if (expectedVersion == null) {
          throw new Error("Missing server message version")
        }
        await tldwClient.deleteMessage(
          target.serverMessageId,
          Number(expectedVersion),
          serverChatId ?? undefined
        )
        invalidateServerChatHistory()
      }

      if (historyId) {
        await removeMessageByIndex(historyId, index)
      }

      setMessages(messages.filter((_, idx) => idx !== index))
      setHistory(history.filter((_, idx) => idx !== index))
    },
    [
      clearReplyTarget,
      history,
      historyId,
      invalidateServerChatHistory,
      messages,
      replyTarget?.id,
      serverChatId,
      setHistory,
      setMessages
    ]
  )

  const createChatBranch = createBranchMessage({
    historyId,
    setHistory,
    setHistoryId,
    setMessages,
    setContext: setContextFiles,
    setSelectedSystemPrompt,
    setSystemPrompt: currentChatModelSettings.setSystemPrompt,
    serverChatId,
    setServerChatId,
    setServerChatTitle,
    setServerChatCharacterId,
    setServerChatMetaLoaded,
    serverChatState,
    setServerChatState,
    setServerChatVersion,
    serverChatTopic,
    setServerChatTopic,
    serverChatClusterId,
    setServerChatClusterId,
    serverChatSource,
    setServerChatSource,
    serverChatExternalRef,
    setServerChatExternalRef,
    onServerChatMutated: invalidateServerChatHistory,
    characterId: serverChatCharacterId ?? null,
    chatTitle: serverChatTitle ?? null,
    messages,
    history
  })

  const createCompareBranch = async ({
    clusterId,
    modelId,
    open = true
  }: {
    clusterId: string
    modelId: string
    open?: boolean
  }): Promise<string | null> => {
    if (!historyId || historyId === "temp") {
      return null
    }

    const messageIds = getCompareBranchMessageIds(messages, clusterId, modelId)
    if (messageIds.length === 0) {
      return null
    }

    try {
      const newBranch = await generateBranchFromMessageIds(
        historyId,
        messageIds
      )
      if (!newBranch) {
        return null
      }

      const splitTitle = buildCompareSplitTitle(newBranch.history.title || "")
      await updateHistory(newBranch.history.id, splitTitle)

      void trackCompareMetric({ type: "split_single" })

      if (open) {
        setHistory(formatToChatHistory(newBranch.messages))
        setMessages(formatToMessage(newBranch.messages))
        setHistoryId(newBranch.history.id)
        const systemFiles = await getSessionFiles(newBranch.history.id)
        setContextFiles(systemFiles)

        const lastUsedPrompt = newBranch?.history?.last_used_prompt
        if (lastUsedPrompt) {
          if (lastUsedPrompt.prompt_id) {
            const prompt = await getPromptById(lastUsedPrompt.prompt_id)
            if (prompt) {
              setSelectedSystemPrompt(lastUsedPrompt.prompt_id)
            }
          }
          if (currentChatModelSettings?.setSystemPrompt) {
            currentChatModelSettings.setSystemPrompt(
              lastUsedPrompt.prompt_content
            )
          }
        }
      }

      return newBranch.history.id
    } catch (e) {
      console.log("[compare-branch] failed", e)
      return null
    }
  }

  return {
    editMessage,
    deleteMessage,
    messages,
    setMessages,
    onSubmit,
    setStreaming,
    streaming,
    setHistory,
    historyId,
    setHistoryId,
    selectServerChat,
    setIsFirstMessage,
    isLoading,
    setIsLoading,
    isProcessing,
    setIsProcessing,
    stopStreamingRequest,
    clearChat,
    selectedModel,
    setSelectedModel,
    chatMode,
    setChatMode,
    isEmbedding,
    setIsEmbedding,
    speechToTextLanguage,
    setSpeechToTextLanguage,
    regenerateLastMessage,
    webSearch,
    setWebSearch,
    toolChoice,
    setToolChoice,
    isSearchingInternet,
    setIsSearchingInternet,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    textareaRef,
    selectedKnowledge,
    setSelectedKnowledge,
    ttsEnabled,
    temporaryChat,
    setTemporaryChat,
    useOCR,
    setUseOCR,
    defaultInternetSearchOn,
    history,
    uploadedFiles,
    contextFiles,
    fileRetrievalEnabled,
    setFileRetrievalEnabled: handleSetFileRetrievalEnabled,
    handleFileUpload,
    removeUploadedFile,
    clearUploadedFiles,
    actionInfo,
    setActionInfo,
    setContextFiles,
    createChatBranch,
    queuedMessages: storeQueuedMessages,
    addQueuedMessage: storeAddQueuedMessage,
    clearQueuedMessages: storeClearQueuedMessages,
    serverChatId,
    setServerChatId,
    serverChatTitle,
    setServerChatTitle,
    serverChatCharacterId,
    setServerChatCharacterId,
    serverChatMetaLoaded,
    setServerChatMetaLoaded,
    serverChatState,
    setServerChatState,
    serverChatVersion,
    setServerChatVersion,
    serverChatTopic,
    setServerChatTopic,
    serverChatClusterId,
    setServerChatClusterId,
    serverChatSource,
    setServerChatSource,
    serverChatExternalRef,
    setServerChatExternalRef,
    ragMediaIds,
    setRagMediaIds,
    ragSearchMode,
    setRagSearchMode,
    ragTopK,
    setRagTopK,
    ragEnableGeneration,
    setRagEnableGeneration,
    ragEnableCitations,
    setRagEnableCitations,
    ragSources,
    setRagSources,
    documentContext,
    compareMode,
    setCompareMode,
    compareFeatureEnabled,
    setCompareFeatureEnabled,
    compareSelectedModels,
    setCompareSelectedModels,
    compareSelectionByCluster,
    setCompareSelectionForCluster,
    compareActiveModelsByCluster,
    setCompareActiveModelsForCluster,
    sendPerModelReply,
    createCompareBranch,
    compareParentByHistory,
    setCompareParentForHistory,
    compareCanonicalByCluster,
    setCompareCanonicalForCluster,
    compareSplitChats,
    setCompareSplitChat,
    compareMaxModels,
    setCompareMaxModels,
    replyTarget,
    clearReplyTarget
  }
}
