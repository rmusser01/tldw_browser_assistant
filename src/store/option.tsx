import { ChatDocuments } from "@/models/ChatTypes"
import { create } from "zustand"
import { type UploadedFile } from "@/db/dexie/types"
import { isFireFoxPrivateMode } from "@/utils/is-private-mode"
import { type ConversationState } from "@/services/tldw/TldwApiClient"

// Knowledge type is now server-side only; this is a placeholder for legacy compatibility
type Knowledge = {
  id: string
  title: string
  [key: string]: any
}

type WebSearch = {
  search_engine: string
  search_url: string
  search_query: string
  search_results: {
    title: string
    link: string
  }[]
}
export type ToolChoice = "auto" | "none" | "required"
export type ReplyTarget = {
  id: string
  preview: string
  name?: string
  isBot?: boolean
}
export type MessageVariant = {
  id?: string
  message: string
  sources?: any[]
  images?: string[]
  generationInfo?: any
  reasoning_time_taken?: number
  createdAt?: number
  serverMessageId?: string
  serverMessageVersion?: number
}
export type Message = {
  isBot: boolean
  name: string
  message: string
  sources: any[]
  images?: string[]
  search?: WebSearch
  reasoning_time_taken?: number
  createdAt?: number
  id?: string
  messageType?: string
  generationInfo?: any
  modelName?: string
  modelImage?: string
  documents?: ChatDocuments
  serverMessageId?: string
  serverMessageVersion?: number
  variants?: MessageVariant[]
  activeVariantIndex?: number
  // Compare/multi-model metadata (in-memory only)
  clusterId?: string
  modelId?: string
  parentMessageId?: string | null
}

export type ChatHistory = {
  role: "user" | "assistant" | "system"
  content: string
  image?: string
  messageType?: string
}[]

type State = {
  messages: Message[]
  // Accepts either direct Message[] or functional update (like React setState)
  setMessages: (
    messagesOrUpdater: Message[] | ((prev: Message[]) => Message[])
  ) => void
  history: ChatHistory
  setHistory: (history: ChatHistory) => void
  streaming: boolean
  setStreaming: (streaming: boolean) => void
  isFirstMessage: boolean
  setIsFirstMessage: (isFirstMessage: boolean) => void
  historyId: string | null
  setHistoryId: (
    history_id: string | null,
    options?: { preserveServerChatId?: boolean }
  ) => void
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  isProcessing: boolean
  setIsProcessing: (isProcessing: boolean) => void
  selectedModel: string | null
  setSelectedModel: (selectedModel: string) => void
  chatMode: "normal" | "rag"
  setChatMode: (chatMode: "normal" | "rag") => void
  isEmbedding: boolean
  setIsEmbedding: (isEmbedding: boolean) => void
  webSearch: boolean
  setWebSearch: (webSearch: boolean) => void
  toolChoice: ToolChoice
  setToolChoice: (toolChoice: ToolChoice) => void
  isSearchingInternet: boolean
  setIsSearchingInternet: (isSearchingInternet: boolean) => void

  selectedSystemPrompt: string | null
  setSelectedSystemPrompt: (selectedSystemPrompt: string) => void

  selectedQuickPrompt: string | null
  setSelectedQuickPrompt: (selectedQuickPrompt: string) => void

  queuedMessages: { message: string; image: string }[]
  addQueuedMessage: (payload: { message: string; image: string }) => void
  setQueuedMessages: (messages: { message: string; image: string }[]) => void
  clearQueuedMessages: () => void

  selectedKnowledge: Knowledge | null
  setSelectedKnowledge: (selectedKnowledge: Knowledge) => void

  setSpeechToTextLanguage: (language: string) => void
  speechToTextLanguage: string

  temporaryChat: boolean
  setTemporaryChat: (temporaryChat: boolean) => void

  useOCR: boolean
  setUseOCR: (useOCR: boolean) => void

  documentContext: ChatDocuments | null
  setDocumentContext: (documentContext: ChatDocuments) => void

  uploadedFiles: UploadedFile[]
  setUploadedFiles: (uploadedFiles: UploadedFile[]) => void

  contextFiles: UploadedFile[]
  setContextFiles: (contextFiles: UploadedFile[]) => void

  actionInfo: string | null
  setActionInfo: (actionInfo: string) => void

  fileRetrievalEnabled: boolean
  setFileRetrievalEnabled: (fileRetrievalEnabled: boolean) => void

  // RAG media-scoped filters (e.g., "chat about this media")
  ragMediaIds: number[] | null
  setRagMediaIds: (ids: number[] | null) => void

  // Unified RAG configuration (shared between Chat and Knowledge views)
  ragSearchMode: "hybrid" | "vector" | "fts"
  setRagSearchMode: (mode: "hybrid" | "vector" | "fts") => void
  ragTopK: number | null
  setRagTopK: (value: number | null) => void
  ragEnableGeneration: boolean
  setRagEnableGeneration: (value: boolean) => void
  ragEnableCitations: boolean
  setRagEnableCitations: (value: boolean) => void
  ragSources: string[]
  setRagSources: (sources: string[]) => void

  // Advanced RAG options (free-form UnifiedRAGRequest fields)
  ragAdvancedOptions: Record<string, any>
  setRagAdvancedOptions: (opts: Record<string, any>) => void

  // Server-backed character chat id
  serverChatId: string | null
  setServerChatId: (id: string | null) => void
  serverChatTitle: string | null
  setServerChatTitle: (title: string | null) => void
  serverChatCharacterId: string | number | null
  setServerChatCharacterId: (id: string | number | null) => void
  serverChatMetaLoaded: boolean
  setServerChatMetaLoaded: (loaded: boolean) => void
  serverChatState: ConversationState | null
  setServerChatState: (state: ConversationState | null) => void
  serverChatVersion: number | null
  setServerChatVersion: (version: number | null) => void
  serverChatTopic: string | null
  setServerChatTopic: (topic: string | null) => void
  serverChatClusterId: string | null
  setServerChatClusterId: (clusterId: string | null) => void
  serverChatSource: string | null
  setServerChatSource: (source: string | null) => void
  serverChatExternalRef: string | null
  setServerChatExternalRef: (ref: string | null) => void

  // Compare mode (multi-model) state
  compareMode: boolean
  setCompareMode: (on: boolean) => void
  compareSelectedModels: string[]
  setCompareSelectedModels: (models: string[]) => void
  compareSelectionByCluster: Record<string, string[]>
  setCompareSelectionForCluster: (clusterId: string, models: string[]) => void
  compareActiveModelsByCluster: Record<string, string[]>
  setCompareActiveModelsForCluster: (clusterId: string, models: string[]) => void
  // Compare breadcrumbs / canonical state
  compareParentByHistory: Record<
    string,
    {
      parentHistoryId: string
      clusterId?: string
    }
  >
  setCompareParentForHistory: (
    historyId: string,
    meta: { parentHistoryId: string; clusterId?: string }
  ) => void
  compareCanonicalByCluster: Record<string, string | null>
  setCompareCanonicalForCluster: (clusterId: string, messageId: string | null) => void
  // Split-off chats per compare cluster/model
  compareSplitChats: Record<string, Record<string, string>>
  setCompareSplitChat: (clusterId: string, modelKey: string, historyId: string) => void

  replyTarget: ReplyTarget | null
  setReplyTarget: (target: ReplyTarget) => void
  clearReplyTarget: () => void
}

export const useStoreMessageOption = create<State>((set, get) => ({
  messages: [],
  setMessages: (messagesOrUpdater) =>
    set({
      messages:
        typeof messagesOrUpdater === "function"
          ? messagesOrUpdater(get().messages)
          : messagesOrUpdater
    }),
  history: [],
  setHistory: (history) => set({ history }),
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
        serverChatState: historyId ? "in-progress" : state.serverChatState,
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
  toolChoice: "auto",
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
    set({ fileRetrievalEnabled }),

  ragMediaIds: null,
  setRagMediaIds: (ragMediaIds) => set({ ragMediaIds }),

  ragSearchMode: "hybrid",
  setRagSearchMode: (ragSearchMode) => set({ ragSearchMode }),
  ragTopK: null,
  setRagTopK: (ragTopK) => set({ ragTopK }),
  ragEnableGeneration: false,
  setRagEnableGeneration: (ragEnableGeneration) =>
    set({ ragEnableGeneration }),
  ragEnableCitations: false,
  setRagEnableCitations: (ragEnableCitations) =>
    set({ ragEnableCitations }),
  ragSources: [],
  setRagSources: (ragSources) => set({ ragSources }),

  ragAdvancedOptions: {},
  setRagAdvancedOptions: (ragAdvancedOptions) => set({ ragAdvancedOptions }),

  serverChatId: null,
  setServerChatId: (id) =>
    set(() => ({
      serverChatId: id,
      serverChatState: id ? "in-progress" : "in-progress",
      serverChatVersion: null,
      serverChatTitle: null,
      serverChatCharacterId: null,
      serverChatMetaLoaded: false,
      serverChatTopic: id ? null : null,
      serverChatClusterId: id ? null : null,
      serverChatSource: id ? null : null,
      serverChatExternalRef: id ? null : null
    })),
  serverChatTitle: null,
  setServerChatTitle: (serverChatTitle) =>
    set({ serverChatTitle: serverChatTitle != null ? serverChatTitle : null }),
  serverChatCharacterId: null,
  setServerChatCharacterId: (serverChatCharacterId) =>
    set({
      serverChatCharacterId:
        serverChatCharacterId != null ? serverChatCharacterId : null
    }),
  serverChatMetaLoaded: false,
  setServerChatMetaLoaded: (serverChatMetaLoaded) =>
    set({ serverChatMetaLoaded }),
  serverChatState: "in-progress",
  setServerChatState: (state) =>
    set({ serverChatState: state ?? "in-progress" }),
  serverChatVersion: null,
  setServerChatVersion: (version) =>
    set({ serverChatVersion: version != null ? version : null }),
  serverChatTopic: null,
  setServerChatTopic: (topic) =>
    set({ serverChatTopic: topic != null ? topic : null }),
  serverChatClusterId: null,
  setServerChatClusterId: (clusterId) =>
    set({ serverChatClusterId: clusterId != null ? clusterId : null }),
  serverChatSource: null,
  setServerChatSource: (source) =>
    set({ serverChatSource: source != null ? source : null }),
  serverChatExternalRef: null,
  setServerChatExternalRef: (ref) =>
    set({ serverChatExternalRef: ref != null ? ref : null }),

  compareMode: false,
  setCompareMode: (compareMode) => set({ compareMode }),
  compareSelectedModels: [],
  setCompareSelectedModels: (compareSelectedModels) =>
    set({ compareSelectedModels }),
  compareSelectionByCluster: {},
  setCompareSelectionForCluster: (clusterId, models) =>
    set((state) => ({
      compareSelectionByCluster: {
        ...state.compareSelectionByCluster,
        [clusterId]: models
      }
    })),
  compareActiveModelsByCluster: {},
  setCompareActiveModelsForCluster: (clusterId, models) =>
    set((state) => ({
      compareActiveModelsByCluster: {
        ...state.compareActiveModelsByCluster,
        [clusterId]: models
      }
    })),
  compareParentByHistory: {},
  setCompareParentForHistory: (historyId, meta) =>
    set((state) => ({
      compareParentByHistory: {
        ...state.compareParentByHistory,
        [historyId]: meta
      }
    })),
  compareCanonicalByCluster: {},
  setCompareCanonicalForCluster: (clusterId, messageId) =>
    set((state) => ({
      compareCanonicalByCluster: {
        ...state.compareCanonicalByCluster,
        [clusterId]: messageId
      }
    })),
  compareSplitChats: {},
  setCompareSplitChat: (clusterId, modelKey, historyId) =>
    set((state) => ({
      compareSplitChats: {
        ...state.compareSplitChats,
        [clusterId]: {
          ...(state.compareSplitChats[clusterId] || {}),
          [modelKey]: historyId
        }
      }
    })),
  replyTarget: null,
  setReplyTarget: (target) => set({ replyTarget: target }),
  clearReplyTarget: () => set({ replyTarget: null })
}))

if (typeof window !== "undefined") {
  // Expose for Playwright tests and debugging only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__tldw_useStoreMessageOption = useStoreMessageOption
}
