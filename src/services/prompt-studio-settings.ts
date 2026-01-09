import { defineSetting, getSetting, setSetting } from "@/services/settings/registry"

export type PromptStudioDefaults = {
  defaultProjectId?: number | null
  executeProvider?: string
  executeModel?: string
  executeTemperature?: number
  executeMaxTokens?: number
  evalModelName?: string
  evalTemperature?: number
  evalMaxTokens?: number
  pageSize?: number
  warnSeconds?: number
}

const STORAGE_KEY = "promptStudioDefaults"

const DEFAULTS: Required<PromptStudioDefaults> = {
  defaultProjectId: null,
  executeProvider: "openai",
  executeModel: "gpt-3.5-turbo",
  executeTemperature: 0.2,
  executeMaxTokens: 256,
  evalModelName: "gpt-3.5-turbo",
  evalTemperature: 0.2,
  evalMaxTokens: 512,
  pageSize: 10,
  warnSeconds: 30
}

const PROMPT_STUDIO_DEFAULTS_SETTING = defineSetting(
  STORAGE_KEY,
  DEFAULTS,
  (value) => ({
    ...DEFAULTS,
    ...(value && typeof value === "object" ? value : {})
  })
)

export async function getPromptStudioDefaults(): Promise<PromptStudioDefaults> {
  return await getSetting(PROMPT_STUDIO_DEFAULTS_SETTING)
}

export async function setPromptStudioDefaults(
  updates: Partial<PromptStudioDefaults>
): Promise<PromptStudioDefaults> {
  const current = await getPromptStudioDefaults()
  const next = { ...current, ...updates }
  await setSetting(PROMPT_STUDIO_DEFAULTS_SETTING, next)
  return next
}
