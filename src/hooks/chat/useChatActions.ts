import React from "react"
import type { NotificationInstance } from "antd/es/notification/interface"
import type { TFunction } from "i18next"
import { type ChatHistory, type Message } from "~/store/option"
import {
  generateID,
  saveHistory,
  saveMessage,
  updateHistory,
  removeMessageByIndex,
  formatToChatHistory,
  formatToMessage,
  getSessionFiles,
  getPromptById
} from "@/db/dexie/helpers"
import { getModelNicknameByID } from "@/db/dexie/nickname"
import { isReasoningEnded, isReasoningStarted } from "@/libs/reasoning"
import type { ChatDocuments } from "@/models/ChatTypes"
import { normalChatMode } from "@/hooks/chat-modes/normalChatMode"
import { continueChatMode } from "@/hooks/chat-modes/continueChatMode"
import { ragMode } from "@/hooks/chat-modes/ragMode"
import { tabChatMode } from "@/hooks/chat-modes/tabChatMode"
import { documentChatMode } from "@/hooks/chat-modes/documentChatMode"
import {
  validateBeforeSubmit,
  createSaveMessageOnSuccess,
  createSaveMessageOnError
} from "@/hooks/utils/messageHelpers"
import {
  createRegenerateLastMessage,
  createEditMessage,
  createStopStreamingRequest,
  createBranchMessage
} from "@/hooks/handlers/messageHandlers"
import { generateBranchFromMessageIds } from "@/db/dexie/branch"
import { type UploadedFile } from "@/db/dexie/types"
import { buildAssistantErrorContent } from "@/utils/chat-error-message"
import {
  buildMessageVariant,
  getLastUserMessageId,
  normalizeMessageVariants,
  updateActiveVariant
} from "@/utils/message-variants"
import { resolveApiProviderForModel } from "@/utils/resolve-api-provider"
import { consumeStreamingChunk } from "@/utils/streaming-chunks"
import { updatePageTitle } from "@/utils/update-page-title"
import { normalizeConversationState } from "@/utils/conversation-state"
import {
  SELECTED_CHARACTER_STORAGE_KEY,
  selectedCharacterStorage,
  selectedCharacterSyncStorage,
  parseSelectedCharacterValue
} from "@/utils/selected-character-storage"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import { getServerCapabilities } from "@/services/tldw/server-capabilities"
import { generateTitle } from "@/services/title"
import { trackCompareMetric } from "@/utils/compare-metrics"
import { MAX_COMPARE_MODELS } from "@/hooks/chat/compare-constants"
import type { Character } from "@/types/character"
import type {
  Knowledge,
  ReplyTarget,
  ToolChoice
} from "@/store/option"
import type { ChatModelSettings } from "@/store/model"
import type { SaveMessageData } from "@/types/chat-modes"

type ChatModelSettingsStore = ChatModelSettings & {
  setSystemPrompt?: (prompt: string) => void
}

type ChatModeOverrides = {
  historyId?: string | null
  serverChatId?: string | null
} & Record<string, unknown>

const loadActorSettings = () => import("@/services/actor-settings")

type SaveMessagePayload = Omit<SaveMessageData, "setHistoryId"> & {
  setHistoryId?: SaveMessageData["setHistoryId"]
  conversationId?: string | number | null
  message_source?: "copilot" | "web-ui" | "server" | "branch"
  message_type?: string
}

type TldwChatMeta =
  | {
      id?: string | number
      chat_id?: string | number
      version?: number
      state?: string | null
      conversation_state?: string | null
      topic_label?: string | null
      cluster_id?: string | null
      source?: string | null
      external_ref?: string | null
      title?: string | null
      character_id?: string | number | null
    }
  | string
  | number
  | null
  | undefined

type UseChatActionsOptions = {
  t: TFunction
  notification: NotificationInstance
  abortController: AbortController | null
  setAbortController: (controller: AbortController | null) => void
  messages: Message[]
  setMessages: (
    messagesOrUpdater: Message[] | ((prev: Message[]) => Message[])
  ) => void
  history: ChatHistory
  setHistory: (history: ChatHistory) => void
  historyId: string | null
  setHistoryId: (
    historyId: string | null,
    options?: { preserveServerChatId?: boolean }
  ) => void
  temporaryChat: boolean
  selectedModel: string | null
  useOCR: boolean
  selectedSystemPrompt: string | null
  selectedKnowledge: Knowledge | null
  toolChoice: ToolChoice
  webSearch: boolean
  currentChatModelSettings: ChatModelSettingsStore
  setIsSearchingInternet: (isSearchingInternet: boolean) => void
  setIsProcessing: (isProcessing: boolean) => void
  setStreaming: (streaming: boolean) => void
  setActionInfo: (actionInfo: string) => void
  fileRetrievalEnabled: boolean
  ragMediaIds: number[] | null
  ragSearchMode: "hybrid" | "vector" | "fts"
  ragTopK: number | null
  ragEnableGeneration: boolean
  ragEnableCitations: boolean
  ragSources: string[]
  ragAdvancedOptions: Record<string, unknown>
  serverChatId: string | null
  serverChatTitle: string | null
  serverChatCharacterId: string | number | null
  serverChatState: ConversationState | null
  serverChatTopic: string | null
  serverChatClusterId: string | null
  serverChatSource: string | null
  serverChatExternalRef: string | null
  setServerChatId: (id: string | null) => void
  setServerChatTitle: (title: string | null) => void
  setServerChatCharacterId: (id: string | number | null) => void
  setServerChatMetaLoaded: (loaded: boolean) => void
  setServerChatState: (state: ConversationState | null) => void
  setServerChatVersion: (version: number | null) => void
  setServerChatTopic: (topic: string | null) => void
  setServerChatClusterId: (clusterId: string | null) => void
  setServerChatSource: (source: string | null) => void
  setServerChatExternalRef: (ref: string | null) => void
  ensureServerChatHistoryId: (
    chatId: string,
    title?: string
  ) => Promise<string | null>
  contextFiles: UploadedFile[]
  setContextFiles: (files: UploadedFile[]) => void
  documentContext: ChatDocuments | null
  setDocumentContext: (docs: ChatDocuments) => void
  uploadedFiles: UploadedFile[]
  compareModeActive: boolean
  compareSelectedModels: string[]
  compareMaxModels: number
  compareFeatureEnabled: boolean
  markCompareHistoryCreated: (historyId: string) => void
  replyTarget: ReplyTarget | null
  clearReplyTarget: () => void
  setSelectedSystemPrompt: (prompt: string) => void
  invalidateServerChatHistory: () => void
  selectedCharacter: Character | null
}

export const useChatActions = ({
  t,
  notification,
  abortController,
  setAbortController,
  messages,
  setMessages,
  history,
  setHistory,
  historyId,
  setHistoryId,
  temporaryChat,
  selectedModel,
  useOCR,
  selectedSystemPrompt,
  selectedKnowledge,
  toolChoice,
  webSearch,
  currentChatModelSettings,
  setIsSearchingInternet,
  setIsProcessing,
  setStreaming,
  setActionInfo,
  fileRetrievalEnabled,
  ragMediaIds,
  ragSearchMode,
  ragTopK,
  ragEnableGeneration,
  ragEnableCitations,
  ragSources,
  ragAdvancedOptions,
  serverChatId,
  serverChatTitle,
  serverChatCharacterId,
  serverChatState,
  serverChatTopic,
  serverChatClusterId,
  serverChatSource,
  serverChatExternalRef,
  setServerChatId,
  setServerChatTitle,
  setServerChatCharacterId,
  setServerChatMetaLoaded,
  setServerChatState,
  setServerChatVersion,
  setServerChatTopic,
  setServerChatClusterId,
  setServerChatSource,
  setServerChatExternalRef,
  ensureServerChatHistoryId,
  contextFiles,
  setContextFiles,
  documentContext,
  setDocumentContext,
  uploadedFiles,
  compareModeActive,
  compareSelectedModels,
  compareMaxModels,
  compareFeatureEnabled,
  markCompareHistoryCreated,
  replyTarget,
  clearReplyTarget,
  setSelectedSystemPrompt,
  invalidateServerChatHistory,
  selectedCharacter
}: UseChatActionsOptions) => {
  const messagesRef = React.useRef(messages)

  React.useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const resolveSelectedCharacter = React.useCallback(async () => {
    try {
      const storedRaw = await selectedCharacterStorage.get(
        SELECTED_CHARACTER_STORAGE_KEY
      )
      const stored = parseSelectedCharacterValue<Character>(storedRaw)
      if (stored?.id) {
        if (
          !selectedCharacter?.id ||
          String(stored.id) !== String(selectedCharacter.id)
        ) {
          return stored
        }
      }
      const storedSyncRaw = await selectedCharacterSyncStorage.get(
        SELECTED_CHARACTER_STORAGE_KEY
      )
      const storedSync = parseSelectedCharacterValue<Character>(storedSyncRaw)
      if (storedSync?.id) {
        await selectedCharacterStorage
          .set(SELECTED_CHARACTER_STORAGE_KEY, storedSync)
          .catch(() => {})
        if (
          !selectedCharacter?.id ||
          String(storedSync.id) !== String(selectedCharacter.id)
        ) {
          return storedSync
        }
      }
    } catch {
      // best-effort only
    }
    return selectedCharacter
  }, [selectedCharacter])

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

  const saveMessageOnSuccess = async (
    payload?: SaveMessagePayload
  ): Promise<string | null> => {
    const payloadWithHistory = payload
      ? {
          ...payload,
          setHistoryId:
            payload.setHistoryId ??
            ((id: string) => {
              setHistoryId(id)
            })
        }
      : undefined
    const historyKey = await baseSaveMessageOnSuccess(payloadWithHistory)

    if (!payload?.historyId && historyKey) {
      markCompareHistoryCreated(historyKey)
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

  const buildChatModeParams = async (overrides: ChatModeOverrides = {}) => {
    const hasHistoryOverride = Object.prototype.hasOwnProperty.call(
      overrides,
      "historyId"
    )
    const resolvedServerChatId =
      overrides.serverChatId === undefined ? serverChatId : overrides.serverChatId
    const resolvedHistoryId = hasHistoryOverride
      ? overrides.historyId
      : resolvedServerChatId && !temporaryChat
        ? await ensureServerChatHistoryId(
            resolvedServerChatId,
            serverChatTitle || undefined
          )
        : historyId

    const { getActorSettingsForChat } = await loadActorSettings()
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

  const characterChatMode = async ({
    message,
    image,
    isRegenerate,
    messages: chatHistory,
    history: chatMemory,
    signal,
    model,
    regenerateFromMessage,
    character
  }: {
    message: string
    image: string
    isRegenerate: boolean
    messages: Message[]
    history: ChatHistory
    signal: AbortSignal
    model: string
    regenerateFromMessage?: Message
    character?: Character | null
  }) => {
    const activeCharacter = character ?? selectedCharacter
    if (!activeCharacter?.id) {
      throw new Error("No character selected")
    }

    let fullText = ""
    let contentToSave = ""
    const resolvedAssistantMessageId = generateID()
    const resolvedUserMessageId = !isRegenerate ? generateID() : undefined
    let generateMessageId = resolvedAssistantMessageId
    const fallbackParentMessageId = getLastUserMessageId(chatHistory)
    const resolvedAssistantParentMessageId = isRegenerate
      ? regenerateFromMessage?.parentMessageId ?? fallbackParentMessageId
      : resolvedUserMessageId ?? null
    const regenerateVariants =
      isRegenerate && regenerateFromMessage
        ? normalizeMessageVariants(regenerateFromMessage)
        : []
    const resolvedModel = model?.trim()

    try {
      if (!resolvedModel) {
        notification.error({
          message: t("error"),
          description: t("validationSelectModel")
        })
        setIsProcessing(false)
        setStreaming(false)
        return
      }

      await tldwClient.initialize().catch(() => null)

      const modelInfo = await getModelNicknameByID(resolvedModel)
      const characterName =
        activeCharacter?.name || modelInfo?.model_name || resolvedModel
      const characterAvatar =
        activeCharacter?.avatar_url || modelInfo?.model_avatar
      const createdAt = Date.now()
      const assistantStub: Message = {
        isBot: true,
        role: "assistant",
        name: characterName,
        message: "▋",
        sources: [],
        createdAt,
        id: generateMessageId,
        modelImage: characterAvatar,
        modelName: characterName,
        parentMessageId: resolvedAssistantParentMessageId ?? null
      }
      if (regenerateVariants.length > 0) {
        const variants = [
          ...regenerateVariants,
          buildMessageVariant(assistantStub)
        ]
        assistantStub.variants = variants
        assistantStub.activeVariantIndex = variants.length - 1
      }

      const newMessageList: Message[] = !isRegenerate
        ? [
            ...chatHistory,
            {
              isBot: false,
              role: "user",
              name: "You",
              message,
              sources: [],
              images: [],
              createdAt,
              id: resolvedUserMessageId,
              parentMessageId: null
            },
            assistantStub
          ]
        : [...chatHistory, assistantStub]
      setMessages(newMessageList)

      const activeCharacterId = String(activeCharacter.id)
      const serverCharacterId =
        serverChatCharacterId != null ? String(serverChatCharacterId) : null
      const shouldResetServerChat =
        Boolean(serverChatId) &&
        (!serverCharacterId || serverCharacterId !== activeCharacterId)

      if (shouldResetServerChat) {
        setServerChatId(null)
        setServerChatCharacterId(null)
        setServerChatMetaLoaded(false)
        setServerChatTitle(null)
        setServerChatState("in-progress")
        setServerChatVersion(null)
        setServerChatTopic(null)
        setServerChatClusterId(null)
        setServerChatSource(null)
        setServerChatExternalRef(null)
      }

      let chatId = shouldResetServerChat ? null : serverChatId
      if (!chatId) {
        const created = await tldwClient.createChat({
          character_id: activeCharacter.id,
          state: serverChatState || "in-progress",
          topic_label: serverChatTopic || undefined,
          cluster_id: serverChatClusterId || undefined,
          source: serverChatSource || undefined,
          external_ref: serverChatExternalRef || undefined
        }) as TldwChatMeta

        let rawId: string | number | undefined
        if (created && typeof created === "object") {
          const {
            id,
            chat_id,
            version,
            state,
            conversation_state,
            topic_label,
            cluster_id,
            source,
            external_ref
          } = created
          rawId = id ?? chat_id
          const normalizedState = normalizeConversationState(
            state ?? conversation_state ?? null
          )
          setServerChatState(normalizedState)
          setServerChatVersion(typeof version === "number" ? version : null)
          setServerChatTopic(topic_label ?? null)
          setServerChatClusterId(cluster_id ?? null)
          setServerChatSource(source ?? null)
          setServerChatExternalRef(external_ref ?? null)
        } else if (typeof created === "string" || typeof created === "number") {
          rawId = created
        }

        const normalizedId = rawId != null ? String(rawId) : ""
        if (!normalizedId) {
          throw new Error("Failed to create character chat session")
        }
        chatId = normalizedId
        setServerChatId(normalizedId)
        const createdTitle =
          created && typeof created === "object"
            ? String(created.title ?? "")
            : ""
        const createdCharacterId =
          created && typeof created === "object"
            ? created.character_id ?? activeCharacter?.id ?? null
            : activeCharacter?.id ?? null
        setServerChatTitle(createdTitle)
        setServerChatCharacterId(createdCharacterId)
        setServerChatMetaLoaded(true)
        invalidateServerChatHistory()
      }

      if (!isRegenerate) {
        type TldwChatMessage = {
          id?: string | number
          version?: number
          role?: string
          content?: string
          image_base64?: string
        }

        const payload: TldwChatMessage = { role: "user", content: message }
        let normalizedImage = image
        if (normalizedImage.length > 0 && !normalizedImage.startsWith("data:")) {
          const payloadValue = normalizedImage.includes(",")
            ? normalizedImage.split(",")[1]
            : normalizedImage
          if (payloadValue !== undefined && payloadValue.length > 0) {
            normalizedImage = `data:image/jpeg;base64,${payloadValue}`
          }
        }
        if (normalizedImage && normalizedImage.startsWith("data:")) {
          const b64 = normalizedImage.includes(",")
            ? normalizedImage.split(",")[1]
            : normalizedImage
          if (b64 !== undefined && b64.length > 0) {
            payload.image_base64 = b64
          }
        }
        const createdUser = (await tldwClient.addChatMessage(
          chatId,
          payload
        )) as TldwChatMessage | null
        setMessages((prev) => {
          const updated = [...prev] as (Message & {
            serverMessageId?: string
            serverMessageVersion?: number
          })[]
          const serverMessageId =
            createdUser?.id != null ? String(createdUser.id) : undefined
          const serverMessageVersion = createdUser?.version
          for (let i = updated.length - 1; i >= 0; i--) {
            if (!updated[i].isBot) {
              updated[i] = {
                ...updated[i],
                serverMessageId,
                serverMessageVersion
              }
              break
            }
          }
          return updated as Message[]
        })
      }

      let count = 0
      let reasoningStartTime: Date | null = null
      let reasoningEndTime: Date | null = null
      let timetaken = 0
      let apiReasoning = false

      const resolvedApiProvider = await resolveApiProviderForModel({
        modelId: resolvedModel,
        explicitProvider: currentChatModelSettings.apiProvider
      })
      const normalizedModel = resolvedModel.replace(/^tldw:/, "").trim()
      const streamModel =
        normalizedModel.length > 0 ? normalizedModel : resolvedModel

      for await (const chunk of tldwClient.streamCharacterChatCompletion(
        chatId,
        {
          include_character_context: true,
          model: streamModel,
          provider: resolvedApiProvider,
          save_to_db: false
        },
        { signal }
      )) {
        const chunkState = consumeStreamingChunk(
          { fullText, contentToSave, apiReasoning },
          chunk
        )
        fullText = chunkState.fullText
        contentToSave = chunkState.contentToSave
        apiReasoning = chunkState.apiReasoning

        if (chunkState.token) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === generateMessageId
                ? updateActiveVariant(m, {
                    message: fullText + "▋",
                    reasoning_time_taken: timetaken
                  })
                : m
            )
          )
        }
        if (count === 0) {
          setIsProcessing(true)
        }

        if (isReasoningStarted(fullText) && !reasoningStartTime) {
          reasoningStartTime = new Date()
        }

        if (
          reasoningStartTime &&
          !reasoningEndTime &&
          isReasoningEnded(fullText)
        ) {
          reasoningEndTime = new Date()
          const reasoningTime =
            reasoningEndTime.getTime() - reasoningStartTime.getTime()
          timetaken = reasoningTime
        }

        count++
        if (signal?.aborted) break
      }

      if (signal?.aborted) {
        const abortError = new Error("AbortError")
        ;(abortError as any).name = "AbortError"
        throw abortError
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === generateMessageId
            ? updateActiveVariant(m, {
                message: fullText,
                reasoning_time_taken: timetaken
              })
            : m
        )
      )

      const finalContent = contentToSave || fullText

      try {
        const createdAsst = (await tldwClient.addChatMessage(chatId, {
          role: "assistant",
          content: finalContent
        })) as { id?: string | number; version?: number } | null
        setMessages((prev) =>
          ((prev as any[]).map((m) => {
            if (m.id !== generateMessageId) return m
            const serverMessageId =
              createdAsst?.id != null ? String(createdAsst.id) : undefined
            return updateActiveVariant(m, {
              serverMessageId,
              serverMessageVersion: createdAsst?.version
            })
          }) as Message[])
        )
      } catch (e) {
        console.error("Failed to persist assistant message to server:", e)
      }

      const lastEntry = chatMemory[chatMemory.length - 1]
      const prevEntry = chatMemory[chatMemory.length - 2]
      const endsWithUser =
        lastEntry?.role === "user" && lastEntry.content === message
      const endsWithUserAssistant =
        lastEntry?.role === "assistant" &&
        prevEntry?.role === "user" &&
        prevEntry.content === message

      if (isRegenerate) {
        if (endsWithUser) {
          setHistory([
            ...chatMemory,
            { role: "assistant", content: finalContent }
          ])
        } else if (endsWithUserAssistant) {
          setHistory(
            chatMemory.map((entry, index) =>
              index === chatMemory.length - 1 && entry.role === "assistant"
                ? { ...entry, content: finalContent }
                : entry
            )
          )
        } else {
          setHistory([
            ...chatMemory,
            { role: "user", content: message, image },
            { role: "assistant", content: finalContent }
          ])
        }
      } else {
        setHistory([
          ...chatMemory,
          { role: "user", content: message, image },
          { role: "assistant", content: finalContent }
        ])
      }

      await saveMessageOnSuccess({
        historyId,
        isRegenerate,
        selectedModel: resolvedModel,
        modelId: resolvedModel,
        message,
        image,
        fullText: finalContent,
        source: [],
        message_source: "web-ui",
        reasoning_time_taken: timetaken,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      setIsProcessing(false)
      setStreaming(false)
    } catch (e) {
      const assistantContent = buildAssistantErrorContent(fullText, e)
      if (generateMessageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === generateMessageId
              ? updateActiveVariant(msg, { message: assistantContent })
              : msg
          )
        )
      }
      const errorSave = await saveMessageOnError({
        e,
        botMessage: assistantContent,
        history: chatMemory,
        historyId,
        image,
        selectedModel: resolvedModel,
        modelId: resolvedModel,
        userMessage: message,
        isRegenerating: isRegenerate,
        message_source: "web-ui",
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      if (!errorSave) {
        notification.error({
          message: t("error"),
          description: e instanceof Error ? e.message : t("somethingWentWrong")
        })
      }
      setIsProcessing(false)
      setStreaming(false)
    } finally {
      setAbortController(null)
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

  const refreshHistoryFromMessages = () => {
    const next = buildHistoryFromMessages(messagesRef.current)
    setHistory(next)
  }

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
      !isContinue &&
      !selectedCharacter?.id
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
          const resolvedSelectedCharacter = await resolveSelectedCharacter()
          if (resolvedSelectedCharacter?.id) {
            const resolvedModel = selectedModel?.trim()
            if (!resolvedModel) {
              notification.error({
                message: t("error"),
                description: t("validationSelectModel")
              })
              setIsProcessing(false)
              setStreaming(false)
              setAbortController(null)
              return
            }
            await characterChatMode({
              message,
              image,
              isRegenerate,
              messages: baseMessages,
              history: baseHistory,
              signal,
              model: resolvedModel,
              regenerateFromMessage,
              character: resolvedSelectedCharacter
            })
            return
          }
        }

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
            markCompareHistoryCreated(newHistory.id)
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
            ).catch((e) => {
              const errorMessage =
                e instanceof Error
                  ? e.message
                  : t("somethingWentWrong")
              notification.error({
                message: t("error"),
                description: errorMessage
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
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : t("somethingWentWrong")
      notification.error({
        message: t("error"),
        description: errorMessage
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
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : t("somethingWentWrong")
      notification.error({
        message: t("error"),
        description: errorMessage
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
    setHistoryId: setHistoryId as (id: string | null) => void,
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
    onSubmit,
    sendPerModelReply,
    regenerateLastMessage,
    stopStreamingRequest,
    editMessage,
    deleteMessage,
    createChatBranch,
    createCompareBranch
  }
}
