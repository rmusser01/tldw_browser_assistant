import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useStoreMessageOption } from "~/store/option"
import { generateID } from "@/db/dexie/helpers"
import { useTranslation } from "react-i18next"
import { usePageAssist } from "@/context"
import { useWebUI } from "@/store/webui"
import { useStorage } from "@plasmohq/storage/hook"
import { useStoreChatModelSettings } from "@/store/model"
import { UploadedFile } from "@/db/dexie/types"
import { formatFileSize } from "@/utils/format"
import { useAntdNotification } from "./useAntdNotification"
import { useChatBaseState } from "@/hooks/chat/useChatBaseState"
import { useSelectServerChat } from "@/hooks/chat/useSelectServerChat"
import { useServerChatHistoryId } from "@/hooks/chat/useServerChatHistoryId"
import { useServerChatLoader } from "@/hooks/chat/useServerChatLoader"
import { useClearChat } from "@/hooks/chat/useClearChat"
import { useCompareMode } from "@/hooks/chat/useCompareMode"
import { useChatActions } from "@/hooks/chat/useChatActions"
import type { Character } from "@/types/character"
import { useSelectedCharacter } from "@/hooks/useSelectedCharacter"
import { useSetting } from "@/hooks/useSetting"
import { CONTEXT_FILE_SIZE_MB_SETTING } from "@/services/settings/ui-settings"

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
    replyTarget,
    clearReplyTarget
  } = useStoreMessageOption()

  const {
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
    compareParentByHistory,
    setCompareParentForHistory,
    compareCanonicalByCluster,
    setCompareCanonicalForCluster,
    compareSplitChats,
    setCompareSplitChat,
    compareMaxModels,
    setCompareMaxModels,
    compareModeActive,
    markCompareHistoryCreated
  } = useCompareMode({ historyId })

  const currentChatModelSettings = useStoreChatModelSettings()
  const [selectedModel, setSelectedModel] = useStorage("selectedModel")
  const [selectedCharacter, setSelectedCharacter] =
    useSelectedCharacter<Character | null>(null)
  const [defaultInternetSearchOn] = useStorage("defaultInternetSearchOn", false)
  const [speechToTextLanguage, setSpeechToTextLanguage] = useStorage(
    "speechToTextLanguage",
    "en-US"
  )

  const { ttsEnabled } = useWebUI()

  const { t } = useTranslation("option")
  const [contextFileMaxSizeMb] = useSetting(CONTEXT_FILE_SIZE_MB_SETTING)
  const maxContextFileSizeBytes = React.useMemo(
    () => contextFileMaxSizeMb * 1024 * 1024,
    [contextFileMaxSizeMb]
  )
  const maxContextFileSizeLabel = React.useMemo(
    () => formatFileSize(maxContextFileSizeBytes),
    [maxContextFileSizeBytes]
  )
  const queryClient = useQueryClient()
  const invalidateServerChatHistory = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
  }, [queryClient])
  const notification = useAntdNotification()

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const selectServerChat = useSelectServerChat()
  const { ensureServerChatHistoryId } = useServerChatHistoryId({
    serverChatId,
    historyId,
    setHistoryId,
    temporaryChat,
    t
  })

  useServerChatLoader({ ensureServerChatHistoryId, notification, t })

  const resetServerChatState = React.useCallback(() => {
    setServerChatState("in-progress")
    setServerChatVersion(null)
    setServerChatTitle(null)
    setServerChatCharacterId(null)
    setServerChatMetaLoaded(false)
    setServerChatTopic(null)
    setServerChatClusterId(null)
    setServerChatSource(null)
    setServerChatExternalRef(null)
  }, [
    setServerChatCharacterId,
    setServerChatClusterId,
    setServerChatExternalRef,
    setServerChatMetaLoaded,
    setServerChatSource,
    setServerChatState,
    setServerChatTitle,
    setServerChatTopic,
    setServerChatVersion
  ])

  const lastCharacterIdRef = React.useRef<string | null>(
    selectedCharacter?.id ? String(selectedCharacter.id) : null
  )

  React.useEffect(() => {
    const nextId = selectedCharacter?.id ? String(selectedCharacter.id) : null
    if (lastCharacterIdRef.current === nextId) {
      return
    }
    lastCharacterIdRef.current = nextId
    setServerChatId(null)
    resetServerChatState()
    setMessages([])
    setHistory([])
    setHistoryId(null)
  }, [
    resetServerChatState,
    selectedCharacter?.id,
    setHistory,
    setHistoryId,
    setMessages,
    setServerChatId
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
  const storedSystemPromptRef = React.useRef<string | null>(storedSystemPrompt)
  const storedQuickPromptRef = React.useRef<string | null>(storedQuickPrompt)

  React.useEffect(() => {
    if (storedSystemPrompt && storedSystemPrompt !== selectedSystemPrompt) {
      storedSystemPromptRef.current = storedSystemPrompt
      setSelectedSystemPrompt(storedSystemPrompt)
    }
  }, [selectedSystemPrompt, setSelectedSystemPrompt, storedSystemPrompt])

  React.useEffect(() => {
    if (storedQuickPrompt && storedQuickPrompt !== selectedQuickPrompt) {
      storedQuickPromptRef.current = storedQuickPrompt
      setSelectedQuickPrompt(storedQuickPrompt)
    }
  }, [selectedQuickPrompt, setSelectedQuickPrompt, storedQuickPrompt])

  React.useEffect(() => {
    const nextValue = selectedSystemPrompt ?? null
    if (nextValue === storedSystemPromptRef.current) {
      return
    }
    storedSystemPromptRef.current = nextValue
    setStoredSystemPrompt(nextValue)
  }, [selectedSystemPrompt, setStoredSystemPrompt])

  React.useEffect(() => {
    const nextValue = selectedQuickPrompt ?? null
    if (nextValue === storedQuickPromptRef.current) {
      return
    }
    storedQuickPromptRef.current = nextValue
    setStoredQuickPrompt(nextValue)
  }, [selectedQuickPrompt, setStoredQuickPrompt])

  const handleFileUpload = async (file: File) => {
    try {
      const isImage = file.type.startsWith("image/")

      if (isImage) {
        return file
      }

      if (file.size > maxContextFileSizeBytes) {
        notification.error({
          message: t("upload.fileTooLargeTitle", "File Too Large"),
          description: t("upload.fileTooLargeDescription", {
            defaultValue: "File size must be less than {{size}}",
            size: maxContextFileSizeLabel
          })
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

  const clearChat = useClearChat({ textareaRef })
  const {
    onSubmit,
    sendPerModelReply,
    regenerateLastMessage,
    stopStreamingRequest,
    editMessage,
    deleteMessage,
    createChatBranch,
    createCompareBranch
  } = useChatActions({
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
  })

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
    selectedCharacter,
    setSelectedCharacter,
    replyTarget,
    clearReplyTarget
  }
}
