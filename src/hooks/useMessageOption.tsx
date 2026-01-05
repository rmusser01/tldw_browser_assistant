import React from "react"
import { type ChatHistory, type Message } from "~/store/option"
import { useStoreMessageOption } from "~/store/option"
import { usePlaygroundSessionStore } from "@/store/playground-session"
import {
  removeMessageUsingHistoryId,
  generateID,
  getCompareState,
  saveCompareState,
  saveHistory,
  saveMessage,
  updateHistory,
  formatToChatHistory,
  formatToMessage,
  getSessionFiles,
  getPromptById
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
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { getActorSettingsForChat } from "@/services/actor-settings"
import { generateTitle } from "@/services/title"
import { FEATURE_FLAGS, useFeatureFlag } from "@/hooks/useFeatureFlags"
import { trackCompareMetric } from "@/utils/compare-metrics"

// Default max models per compare turn (Phase 3 polish)
export const MAX_COMPARE_MODELS = 3

export const useMessageOption = () => {
  // Controllers come from Context (for aborting streaming requests)
  const {
    controller: abortController,
    setController: setAbortController
  } = usePageAssist()

  // Messages now come from Zustand store (single source of truth)
  const messages = useStoreMessageOption((state) => state.messages)
  const setMessages = useStoreMessageOption((state) => state.setMessages)

  const {
    history,
    setHistory,
    setStreaming,
    streaming,
    setIsFirstMessage,
    historyId,
    setHistoryId,
    isLoading,
    setIsLoading,
    isProcessing,
    setIsProcessing,
    chatMode,
    setChatMode,
    webSearch,
    setWebSearch,
    toolChoice,
    setToolChoice,
    isSearchingInternet,
    setIsSearchingInternet,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    queuedMessages: storeQueuedMessages,
    addQueuedMessage: storeAddQueuedMessage,
    clearQueuedMessages: storeClearQueuedMessages,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    selectedKnowledge,
    setSelectedKnowledge,
    temporaryChat,
    setTemporaryChat,
    useOCR,
    setUseOCR,
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
    isEmbedding,
    setIsEmbedding,
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
  const notification = useAntdNotification()

  const navigate = useNavigate()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const messagesRef = React.useRef(messages)
  const compareHydratingRef = React.useRef(false)
  const compareSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const compareNewHistoryIdsRef = React.useRef<Set<string>>(new Set())
  const compareModeActive = compareFeatureEnabled && compareMode
  const compareModeActiveRef = React.useRef(compareModeActive)
  const compareFeatureEnabledRef = React.useRef(compareFeatureEnabled)

  React.useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  React.useEffect(() => {
    if (!serverChatId) return
    const loadChatMeta = async () => {
      try {
        await tldwClient.initialize().catch(() => null)
        const chat = await tldwClient.getChat(serverChatId)
        setServerChatState(
          (chat as any)?.state ??
            (chat as any)?.conversation_state ??
            "in-progress"
        )
        setServerChatVersion((chat as any)?.version ?? null)
        setServerChatTopic((chat as any)?.topic_label ?? null)
        setServerChatClusterId((chat as any)?.cluster_id ?? null)
        setServerChatSource((chat as any)?.source ?? null)
        setServerChatExternalRef((chat as any)?.external_ref ?? null)
      } catch {
        // ignore metadata hydration failures
      }
    }
    void loadChatMeta()
  }, [
    serverChatId,
    setServerChatClusterId,
    setServerChatExternalRef,
    setServerChatSource,
    setServerChatState,
    setServerChatTopic,
    setServerChatVersion
  ])

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
    setHistoryId as (id: string) => void
  )
  const saveMessageOnError = createSaveMessageOnError(
    temporaryChat,
    history,
    setHistory,
    setHistoryId as (id: string) => void
  )

  const saveMessageOnSuccess = async (payload: any): Promise<string | null> => {
    const historyKey = await baseSaveMessageOnSuccess(payload)

    if (!payload?.historyId && historyKey) {
      compareNewHistoryIdsRef.current.add(historyKey)
    }

    // When resuming a server-backed chat, mirror new turns to /api/v1/chats.
    if (
      serverChatId &&
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
    const actorSettings = await getActorSettingsForChat({
      historyId: overrides.historyId ?? historyId,
      serverChatId: overrides.serverChatId ?? serverChatId
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
      historyId,
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
    docs
  }: {
    message: string
    image: string
    isRegenerate?: boolean
    isContinue?: boolean
    messages?: Message[]
    memory?: ChatHistory
    controller?: AbortController
    docs?: ChatDocuments
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
          chatModeParamsWithReply
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
          chatModeParamsWithReply
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
          chatModeParamsWithReply
        )
      } else {
        // Include uploaded files info even in normal mode
        const enhancedChatModeParams = {
          ...chatModeParamsWithReply,
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
    historyId,
    removeMessageUsingHistoryIdFn: removeMessageUsingHistoryId,
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
    messages,
    setMessages,
    onSubmit,
    setStreaming,
    streaming,
    setHistory,
    historyId,
    setHistoryId,
    setIsFirstMessage,
    isLoading,
    setIsLoading,
    isProcessing,
    stopStreamingRequest,
    clearChat,
    selectedModel,
    setSelectedModel,
    chatMode,
    setChatMode,
    isEmbedding,
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
