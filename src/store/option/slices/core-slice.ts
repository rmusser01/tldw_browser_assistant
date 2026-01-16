import type { StoreSlice } from "@/store/option/slices/types"
import { isFireFoxPrivateMode } from "@/utils/is-private-mode"

export const createCoreSlice: StoreSlice<
  Pick<
    import("@/store/option/types").State,
    | "messages"
    | "setMessages"
    | "history"
    | "setHistory"
    | "streaming"
    | "setStreaming"
    | "isFirstMessage"
    | "setIsFirstMessage"
    | "historyId"
    | "setHistoryId"
    | "isLoading"
    | "setIsLoading"
    | "isProcessing"
    | "setIsProcessing"
    | "selectedModel"
    | "setSelectedModel"
    | "chatMode"
    | "setChatMode"
    | "isEmbedding"
    | "setIsEmbedding"
    | "webSearch"
    | "setWebSearch"
    | "toolChoice"
    | "setToolChoice"
    | "isSearchingInternet"
    | "setIsSearchingInternet"
    | "selectedSystemPrompt"
    | "setSelectedSystemPrompt"
    | "selectedQuickPrompt"
    | "setSelectedQuickPrompt"
    | "queuedMessages"
    | "addQueuedMessage"
    | "setQueuedMessages"
    | "clearQueuedMessages"
    | "selectedKnowledge"
    | "setSelectedKnowledge"
    | "speechToTextLanguage"
    | "setSpeechToTextLanguage"
    | "temporaryChat"
    | "setTemporaryChat"
    | "useOCR"
    | "setUseOCR"
    | "documentContext"
    | "setDocumentContext"
    | "uploadedFiles"
    | "setUploadedFiles"
    | "contextFiles"
    | "setContextFiles"
    | "actionInfo"
    | "setActionInfo"
    | "fileRetrievalEnabled"
    | "setFileRetrievalEnabled"
  >
> = (set, get) => ({
  messages: [],
  setMessages: (messagesOrUpdater) =>
    set({
      messages:
        typeof messagesOrUpdater === "function"
          ? messagesOrUpdater(get().messages)
          : messagesOrUpdater
    }),
  history: [],
  setHistory: (historyOrUpdater) =>
    set({
      history:
        typeof historyOrUpdater === "function"
          ? historyOrUpdater(get().history)
          : historyOrUpdater
    }),
  streaming: false,
  setStreaming: (streaming) => set({ streaming }),
  isFirstMessage: true,
  setIsFirstMessage: (isFirstMessage) => set({ isFirstMessage }),
  historyId: null,
  setHistoryId: (historyId, options) =>
    set((state) => {
      if (options?.preserveServerChatId) {
        return { historyId }
      }
      return {
        historyId,
        // When switching to a local Dexie-backed chat, clear any active server-backed session id.
        serverChatId: historyId ? null : state.serverChatId,
        serverChatState: historyId ? null : state.serverChatState,
        serverChatVersion: historyId ? null : state.serverChatVersion,
        serverChatTitle: historyId ? null : state.serverChatTitle,
        serverChatCharacterId: historyId ? null : state.serverChatCharacterId,
        serverChatMetaLoaded: historyId ? false : state.serverChatMetaLoaded,
        serverChatTopic: historyId ? null : state.serverChatTopic,
        serverChatClusterId: historyId ? null : state.serverChatClusterId,
        serverChatSource: historyId ? null : state.serverChatSource,
        serverChatExternalRef: historyId ? null : state.serverChatExternalRef
      }
    }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  speechToTextLanguage: "en-US",
  setSpeechToTextLanguage: (language) =>
    set({ speechToTextLanguage: language }),
  selectedModel: null,
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  chatMode: "normal",
  setChatMode: (chatMode) => set({ chatMode }),
  isEmbedding: false,
  setIsEmbedding: (isEmbedding) => set({ isEmbedding }),
  webSearch: false,
  setWebSearch: (webSearch) => set({ webSearch }),
  toolChoice: "none",
  setToolChoice: (toolChoice) => set({ toolChoice }),
  isSearchingInternet: false,
  setIsSearchingInternet: (isSearchingInternet) => set({ isSearchingInternet }),
  selectedSystemPrompt: null,
  setSelectedSystemPrompt: (selectedSystemPrompt) =>
    set({ selectedSystemPrompt }),
  selectedQuickPrompt: null,
  setSelectedQuickPrompt: (selectedQuickPrompt) => set({ selectedQuickPrompt }),
  queuedMessages: [],
  addQueuedMessage: (payload) =>
    set((state) => ({
      queuedMessages: [...state.queuedMessages, payload]
    })),
  setQueuedMessages: (queuedMessages) => set({ queuedMessages }),
  clearQueuedMessages: () => set({ queuedMessages: [] }),
  selectedKnowledge: null,
  setSelectedKnowledge: (selectedKnowledge) => set({ selectedKnowledge }),
  temporaryChat: isFireFoxPrivateMode,
  setTemporaryChat: (temporaryChat) => set({ temporaryChat }),
  useOCR: false,
  setUseOCR: (useOCR) => set({ useOCR }),
  documentContext: null,
  setDocumentContext: (documentContext) => set({ documentContext }),
  uploadedFiles: [],
  setUploadedFiles: (uploadedFiles) => set({ uploadedFiles }),
  contextFiles: [],
  setContextFiles: (contextFiles) => set({ contextFiles }),
  actionInfo: null,
  setActionInfo: (actionInfo) => set({ actionInfo }),
  fileRetrievalEnabled: false,
  setFileRetrievalEnabled: (fileRetrievalEnabled) =>
    set({ fileRetrievalEnabled })
})
