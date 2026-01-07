import { createSafeStorage } from "@/utils/safe-storage"
import {
  coerceBoolean,
  defineSetting,
  getSetting,
  setSetting,
  type SettingDef
} from "@/services/settings/registry"

const storage = createSafeStorage()

type ModelSettings = {
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
  minP?: number
  useMlock?: boolean
  reasoningEffort?: any
}

const MODEL_SETTING_KEYS = [
  "f16KV",
  "frequencyPenalty",
  "keepAlive",
  "logitsAll",
  "mirostat",
  "mirostatEta",
  "mirostatTau",
  "numBatch",
  "numCtx",
  "numGpu",
  "numGqa",
  "numKeep",
  "numPredict",
  "numThread",
  "penalizeNewline",
  "presencePenalty",
  "repeatLastN",
  "repeatPenalty",
  "ropeFrequencyBase",
  "ropeFrequencyScale",
  "temperature",
  "tfsZ",
  "topK",
  "topP",
  "typicalP",
  "useMLock",
  "useMMap",
  "vocabOnly",
  "minP",
  "useMlock",
  "reasoningEffort"
] as const satisfies readonly (keyof ModelSettings)[]

type ModelSettingKey = (typeof MODEL_SETTING_KEYS)[number]

const RESTORE_LAST_CHAT_MODEL_SETTING = defineSetting(
  "restoreLastChatModel",
  false,
  (value) => coerceBoolean(value, false)
)

const MODEL_SETTING_DEFS = MODEL_SETTING_KEYS.reduce(
  (acc, key) => {
    acc[key] = defineSetting(key, undefined as ModelSettings[ModelSettingKey])
    return acc
  },
  {} as Record<ModelSettingKey, SettingDef<ModelSettings[ModelSettingKey]>>
)

const isModelSettingKey = (key: string): key is ModelSettingKey =>
  key in MODEL_SETTING_DEFS

export const getAllModelSettings = async (): Promise<ModelSettings> => {
  try {
    const entries = await Promise.all(
      MODEL_SETTING_KEYS.map(async (key) => {
        const value = await getSetting(MODEL_SETTING_DEFS[key])
        return [key, value] as const
      })
    )
    return Object.fromEntries(entries) as ModelSettings
  } catch (error) {
    console.error(error)
    return {} as ModelSettings
  }
}

export const setModelSetting = async (
  key: string,
  value: string | number | boolean
) => {
  if (!isModelSettingKey(key)) {
    console.warn(`[tldw] Unknown model setting key: ${key}`)
    return
  }
  await setSetting(MODEL_SETTING_DEFS[key], value as ModelSettings[ModelSettingKey])
}

export const getAllDefaultModelSettings = async (): Promise<ModelSettings> => {
  return await getAllModelSettings()
}

export const lastUsedChatModelEnabled = async (): Promise<boolean> => {
  return await getSetting(RESTORE_LAST_CHAT_MODEL_SETTING)
}

export const setLastUsedChatModelEnabled = async (
  enabled: boolean
): Promise<void> => {
  await setSetting(RESTORE_LAST_CHAT_MODEL_SETTING, enabled)
}

export const getLastUsedChatModel = async (
  historyId: string
): Promise<string | undefined> => {
  return await storage.get<string | undefined>(`lastUsedChatModel-${historyId}`)
}

export const setLastUsedChatModel = async (
  historyId: string,
  model: string
): Promise<void> => {
  await storage.set(`lastUsedChatModel-${historyId}`, model)
}


export const getLastUsedChatSystemPrompt = async (
  historyId: string
): Promise<{ prompt_id?: string; prompt_content?: string } | undefined> => {
  return await storage.get<{ prompt_id?: string; prompt_content?: string } | undefined>(
    `lastUsedChatSystemPrompt-${historyId}`
  )
}

export const setLastUsedChatSystemPrompt = async (
  historyId: string,
  prompt: {
    prompt_id?: string
    prompt_content?: string
  }
): Promise<void> => {
  await storage.set(`lastUsedChatSystemPrompt-${historyId}`, prompt)
}


export const getModelSettings = async (model_id: string) => {
  try {
    const settings = await storage.get<ModelSettings>(`modelSettings:${model_id}`)
    if (!settings) {
      return {}
    }
    return settings
  } catch (error) {
    console.error(error)
    return {}
  }
}

export const setModelSettings = async ({model_id,settings}: {model_id: string, settings: Partial<ModelSettings>}) => {
  try {
    await storage.set(`modelSettings:${model_id}`, settings)
  } catch (error) {
    console.error(error)
  }
}
