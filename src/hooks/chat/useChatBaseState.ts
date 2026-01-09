import { shallow } from "zustand/shallow"

type StoreHook<State> = <T>(
  selector: (state: State) => T,
  equalityFn?: (a: T, b: T) => boolean
) => T

type ChatBaseKeys =
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
  | "chatMode"
  | "setChatMode"
  | "isEmbedding"
  | "setIsEmbedding"
  | "selectedSystemPrompt"
  | "setSelectedSystemPrompt"
  | "selectedQuickPrompt"
  | "setSelectedQuickPrompt"
  | "useOCR"
  | "setUseOCR"

type ChatBaseShape = Record<ChatBaseKeys, unknown>

export type ChatBaseState<State extends ChatBaseShape> = Pick<State, ChatBaseKeys>

const selectChatBaseState = <State extends ChatBaseShape>(
  state: State
): ChatBaseState<State> => ({
  messages: state.messages,
  setMessages: state.setMessages,
  history: state.history,
  setHistory: state.setHistory,
  streaming: state.streaming,
  setStreaming: state.setStreaming,
  isFirstMessage: state.isFirstMessage,
  setIsFirstMessage: state.setIsFirstMessage,
  historyId: state.historyId,
  setHistoryId: state.setHistoryId,
  isLoading: state.isLoading,
  setIsLoading: state.setIsLoading,
  isProcessing: state.isProcessing,
  setIsProcessing: state.setIsProcessing,
  chatMode: state.chatMode,
  setChatMode: state.setChatMode,
  isEmbedding: state.isEmbedding,
  setIsEmbedding: state.setIsEmbedding,
  selectedSystemPrompt: state.selectedSystemPrompt,
  setSelectedSystemPrompt: state.setSelectedSystemPrompt,
  selectedQuickPrompt: state.selectedQuickPrompt,
  setSelectedQuickPrompt: state.setSelectedQuickPrompt,
  useOCR: state.useOCR,
  setUseOCR: state.setUseOCR
})

export const useChatBaseState = <State extends ChatBaseShape>(
  useStore: StoreHook<State>
) => useStore(selectChatBaseState, shallow)
