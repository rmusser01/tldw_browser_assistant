import { create } from "zustand"
import type { ChatHistory, Message as ChatMessage } from "@/store/option"
import type { ConversationState } from "@/services/tldw/TldwApiClient"

export type ChatModelSettingsSnapshot = {
  f16KV?: boolean
  frequencyPenalty?: number
  keepAlive?: string
  logitsAll?: boolean
  mirostat?: number
  mirostatEta?: number
  mirostatTau?: number
  numBatch?: number
  numCtx?: number
  numGpu?: number
  numGqa?: number
  numKeep?: number
  numPredict?: number
  numThread?: number
  penalizeNewline?: boolean
  presencePenalty?: number
  repeatLastN?: number
  repeatPenalty?: number
  ropeFrequencyBase?: number
  ropeFrequencyScale?: number
  temperature?: number
  tfsZ?: number
  topK?: number
  topP?: number
  typicalP?: number
  useMLock?: boolean
  useMMap?: boolean
  vocabOnly?: boolean
  seed?: number
  minP?: number
  systemPrompt?: string
  useMlock?: boolean
  reasoningEffort?: string
  ocrLanguage?: string
}

export type SidepanelChatSnapshot = {
  history: ChatHistory
  messages: ChatMessage[]
  chatMode: "normal" | "rag" | "vision"
  historyId: string | null
  webSearch: boolean
  selectedModel: string | null
  selectedSystemPrompt: string | null
  selectedQuickPrompt: string | null
  temporaryChat: boolean
  useOCR: boolean
  serverChatId: string | null
  serverChatState: ConversationState | null
  serverChatTopic: string | null
  serverChatClusterId: string | null
  serverChatSource: string | null
  serverChatExternalRef: string | null
  queuedMessages: { message: string; image: string }[]
  modelSettings: ChatModelSettingsSnapshot
}

export type SidepanelChatTab = {
  id: string
  label: string
  historyId: string | null
  serverChatId: string | null
  serverChatTopic: string | null
  updatedAt: number
}

type State = {
  tabs: SidepanelChatTab[]
  activeTabId: string | null
  snapshotsById: Record<string, SidepanelChatSnapshot>
  setTabsState: (state: {
    tabs: SidepanelChatTab[]
    activeTabId: string | null
    snapshotsById: Record<string, SidepanelChatSnapshot>
  }) => void
  setTabs: (tabs: SidepanelChatTab[]) => void
  setActiveTabId: (id: string | null) => void
  upsertTab: (tab: SidepanelChatTab) => void
  removeTab: (id: string) => void
  setSnapshot: (tabId: string, snapshot: SidepanelChatSnapshot) => void
  getSnapshot: (tabId: string) => SidepanelChatSnapshot | undefined
  clear: () => void
}

export const useSidepanelChatTabsStore = create<State>((set, get) => ({
  tabs: [],
  activeTabId: null,
  snapshotsById: {},
  setTabsState: (state) =>
    set({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      snapshotsById: state.snapshotsById
    }),
  setTabs: (tabs) => set({ tabs }),
  setActiveTabId: (id) => set({ activeTabId: id }),
  upsertTab: (tab) =>
    set((state) => {
      const existingIndex = state.tabs.findIndex((item) => item.id === tab.id)
      if (existingIndex === -1) {
        return { tabs: [...state.tabs, tab] }
      }
      const nextTabs = [...state.tabs]
      nextTabs[existingIndex] = { ...nextTabs[existingIndex], ...tab }
      return { tabs: nextTabs }
    }),
  removeTab: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.snapshotsById
      return {
        tabs: state.tabs.filter((tab) => tab.id !== id),
        snapshotsById: rest,
        activeTabId: state.activeTabId === id ? null : state.activeTabId
      }
    }),
  setSnapshot: (tabId, snapshot) =>
    set((state) => ({
      snapshotsById: {
        ...state.snapshotsById,
        [tabId]: snapshot
      }
    })),
  getSnapshot: (tabId) => get().snapshotsById[tabId],
  clear: () => set({ tabs: [], activeTabId: null, snapshotsById: {} })
}))
