import { create } from "zustand"

/**
 * Chat model settings - state values only (no actions)
 */
export type ChatModelSettings = {
  // Inference parameters
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
  useMlock?: boolean
  vocabOnly?: boolean
  seed?: number
  minP?: number

  // System configuration
  systemPrompt?: string
  reasoningEffort?: string
  thinking?: boolean
  ocrLanguage?: string

  // History & injection settings
  historyMessageLimit?: number
  historyMessageOrder?: string
  slashCommandInjectionMode?: string

  // API configuration
  apiProvider?: string
  extraHeaders?: string
  extraBody?: string

  // Response format
  jsonMode?: boolean
}

/**
 * Store type combining settings with actions
 */
type ChatModelSettingsStore = ChatModelSettings & {
  // Generic typed update method (replaces setX)
  updateSetting: <K extends keyof ChatModelSettings>(
    key: K,
    value: ChatModelSettings[K]
  ) => void
  updateSettings: (updates: Partial<ChatModelSettings>) => void
  reset: () => void

  // Individual setters (for backwards compatibility)
  setF16KV: (value: boolean) => void
  setFrequencyPenalty: (value: number) => void
  setKeepAlive: (value: string) => void
  setLogitsAll: (value: boolean) => void
  setMirostat: (value: number) => void
  setMirostatEta: (value: number) => void
  setMirostatTau: (value: number) => void
  setNumBatch: (value: number) => void
  setNumCtx: (value: number) => void
  setNumGpu: (value: number) => void
  setNumGqa: (value: number) => void
  setNumKeep: (value: number) => void
  setNumPredict: (value: number | undefined) => void
  setNumThread: (value: number) => void
  setPenalizeNewline: (value: boolean) => void
  setPresencePenalty: (value: number) => void
  setRepeatLastN: (value: number) => void
  setRepeatPenalty: (value: number) => void
  setRopeFrequencyBase: (value: number) => void
  setRopeFrequencyScale: (value: number) => void
  setTemperature: (value: number) => void
  setTfsZ: (value: number) => void
  setTopK: (value: number) => void
  setTopP: (value: number) => void
  setTypicalP: (value: number) => void
  setUseMLock: (value: boolean) => void
  setUseMMap: (value: boolean) => void
  setUseMlock: (value: boolean) => void
  setVocabOnly: (value: boolean) => void
  setSeed: (value: number | undefined) => void
  setMinP: (value: number) => void
  setSystemPrompt: (value: string) => void
  setReasoningEffort: (value: string) => void
  setThinking: (value: boolean) => void
  setOcrLanguage: (value: string) => void
  setHistoryMessageLimit: (value: number) => void
  setHistoryMessageOrder: (value: string) => void
  setSlashCommandInjectionMode: (value: string) => void
  setApiProvider: (value: string) => void
  setExtraHeaders: (value: string) => void
  setExtraBody: (value: string) => void
  setJsonMode: (value: boolean | undefined) => void
}

const INITIAL_STATE: ChatModelSettings = {
  f16KV: undefined,
  frequencyPenalty: undefined,
  keepAlive: undefined,
  logitsAll: undefined,
  mirostat: undefined,
  mirostatEta: undefined,
  mirostatTau: undefined,
  numBatch: undefined,
  numCtx: undefined,
  numGpu: undefined,
  numGqa: undefined,
  numKeep: undefined,
  numPredict: undefined,
  numThread: undefined,
  penalizeNewline: undefined,
  presencePenalty: undefined,
  repeatLastN: undefined,
  repeatPenalty: undefined,
  ropeFrequencyBase: undefined,
  ropeFrequencyScale: undefined,
  temperature: undefined,
  tfsZ: undefined,
  topK: undefined,
  topP: undefined,
  typicalP: undefined,
  useMLock: undefined,
  useMMap: undefined,
  useMlock: undefined,
  vocabOnly: undefined,
  seed: undefined,
  minP: undefined,
  systemPrompt: undefined,
  reasoningEffort: undefined,
  thinking: undefined,
  ocrLanguage: undefined,
  historyMessageLimit: undefined,
  historyMessageOrder: undefined,
  slashCommandInjectionMode: undefined,
  apiProvider: undefined,
  extraHeaders: undefined,
  extraBody: undefined,
  jsonMode: undefined
}

export const useStoreChatModelSettings = create<ChatModelSettingsStore>(
  (set) => ({
    ...INITIAL_STATE,

    // Generic typed update methods
    updateSetting: (key, value) => set({ [key]: value }),
    updateSettings: (updates) => set(updates),
    reset: () => set(INITIAL_STATE),

    // Individual setters
    setF16KV: (value) => set({ f16KV: value }),
    setFrequencyPenalty: (value) => set({ frequencyPenalty: value }),
    setKeepAlive: (value) => set({ keepAlive: value }),
    setLogitsAll: (value) => set({ logitsAll: value }),
    setMirostat: (value) => set({ mirostat: value }),
    setMirostatEta: (value) => set({ mirostatEta: value }),
    setMirostatTau: (value) => set({ mirostatTau: value }),
    setNumBatch: (value) => set({ numBatch: value }),
    setNumCtx: (value) => set({ numCtx: value }),
    setNumGpu: (value) => set({ numGpu: value }),
    setNumGqa: (value) => set({ numGqa: value }),
    setNumKeep: (value) => set({ numKeep: value }),
    setNumPredict: (value) => set({ numPredict: value }),
    setNumThread: (value) => set({ numThread: value }),
    setPenalizeNewline: (value) => set({ penalizeNewline: value }),
    setPresencePenalty: (value) => set({ presencePenalty: value }),
    setRepeatLastN: (value) => set({ repeatLastN: value }),
    setRepeatPenalty: (value) => set({ repeatPenalty: value }),
    setRopeFrequencyBase: (value) => set({ ropeFrequencyBase: value }),
    setRopeFrequencyScale: (value) => set({ ropeFrequencyScale: value }),
    setTemperature: (value) => set({ temperature: value }),
    setTfsZ: (value) => set({ tfsZ: value }),
    setTopK: (value) => set({ topK: value }),
    setTopP: (value) => set({ topP: value }),
    setTypicalP: (value) => set({ typicalP: value }),
    setUseMLock: (value) => set({ useMLock: value }),
    setUseMMap: (value) => set({ useMMap: value }),
    setUseMlock: (value) => set({ useMlock: value }),
    setVocabOnly: (value) => set({ vocabOnly: value }),
    setSeed: (value) => set({ seed: value }),
    setMinP: (value) => set({ minP: value }),
    setSystemPrompt: (value) => set({ systemPrompt: value }),
    setReasoningEffort: (value) => set({ reasoningEffort: value }),
    setThinking: (value) => set({ thinking: value }),
    setOcrLanguage: (value) => set({ ocrLanguage: value }),
    setHistoryMessageLimit: (value) => set({ historyMessageLimit: value }),
    setHistoryMessageOrder: (value) => set({ historyMessageOrder: value }),
    setSlashCommandInjectionMode: (value) =>
      set({ slashCommandInjectionMode: value }),
    setApiProvider: (value) => set({ apiProvider: value }),
    setExtraHeaders: (value) => set({ extraHeaders: value }),
    setExtraBody: (value) => set({ extraBody: value }),
    setJsonMode: (value) => set({ jsonMode: value })
  })
)

// Expose for Playwright tests and debugging (development only)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  ;(window as any).__tldw_useStoreChatModelSettings = useStoreChatModelSettings
}
