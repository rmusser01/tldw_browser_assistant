import {
  coerceBoolean,
  coerceNumber,
  coerceString,
  defineSetting,
  getSetting,
  setSetting
} from "@/services/settings/registry"
import { createSafeStorage } from "@/utils/safe-storage"

const storage = createSafeStorage()

const DEFAULT_URL_REWRITE_URL = "http://127.0.0.1:8000"

const URL_REWRITE_ENABLED_SETTING = defineSetting(
  "urlRewriteEnabled",
  false,
  (value) => coerceBoolean(value, false)
)

const AUTO_CORS_FIX_SETTING = defineSetting(
  "autoCORSFix",
  true,
  (value) => coerceBoolean(value, true)
)

const REWRITE_URL_SETTING = defineSetting(
  "rewriteUrl",
  DEFAULT_URL_REWRITE_URL,
  (value) => coerceString(value, DEFAULT_URL_REWRITE_URL)
)

const COPILOT_RESUME_LAST_CHAT_SETTING = defineSetting(
  "copilotResumeLastChat",
  false,
  (value) => coerceBoolean(value, false)
)

const WEBUI_RESUME_LAST_CHAT_SETTING = defineSetting(
  "webUIResumeLastChat",
  false,
  (value) => coerceBoolean(value, false)
)

const SIDEBAR_OPEN_SETTING = defineSetting(
  "sidebarOpen",
  "right_clk",
  (value) => coerceString(value, "right_clk")
)

const CUSTOM_HEADERS_SETTING = defineSetting(
  "customHeaders",
  [] as { key: string; value: string }[]
)

const OPEN_ON_CLICK_VALUES = ["webUI", "sidePanel"] as const
type OpenOnClickValue = (typeof OPEN_ON_CLICK_VALUES)[number]
const normalizeOpenOnClick = (value: unknown, fallback: OpenOnClickValue) => {
  const normalized = String(value || "")
  return OPEN_ON_CLICK_VALUES.includes(normalized as OpenOnClickValue)
    ? (normalized as OpenOnClickValue)
    : fallback
}

const OPEN_ON_ICON_CLICK_SETTING = defineSetting(
  "openOnIconClick",
  "webUI" as OpenOnClickValue,
  (value) => normalizeOpenOnClick(value, "webUI"),
  {
    validate: (value) => OPEN_ON_CLICK_VALUES.includes(value)
  }
)

const OPEN_ON_RIGHT_CLICK_SETTING = defineSetting(
  "openOnRightClick",
  "sidePanel" as OpenOnClickValue,
  (value) => normalizeOpenOnClick(value, "sidePanel"),
  {
    validate: (value) => OPEN_ON_CLICK_VALUES.includes(value)
  }
)

const TOTAL_FILE_PER_KB_SETTING = defineSetting(
  "totalFilePerKB",
  5,
  (value) => coerceNumber(value, 5)
)

const NO_OF_RETRIEVED_DOCS_SETTING = defineSetting(
  "noOfRetrievedDocs",
  4,
  (value) => coerceNumber(value, 4)
)

const REMOVE_REASONING_TAG_FROM_COPY_SETTING = defineSetting(
  "removeReasoningTagFromCopy",
  true,
  (value) => coerceBoolean(value, true)
)

export const isUrlRewriteEnabled = async () => {
  return await getSetting(URL_REWRITE_ENABLED_SETTING)
}
export const setUrlRewriteEnabled = async (enabled: boolean) => {
  await setSetting(URL_REWRITE_ENABLED_SETTING, enabled)
}

export const getIsAutoCORSFix = async () => {
  return await getSetting(AUTO_CORS_FIX_SETTING)
}

export const setAutoCORSFix = async (enabled: boolean) => {
  await setSetting(AUTO_CORS_FIX_SETTING, enabled)
}

export const getRewriteUrl = async () => {
  return await getSetting(REWRITE_URL_SETTING)
}

export const setRewriteUrl = async (url: string) => {
  await setSetting(REWRITE_URL_SETTING, url)
}

export const getAdvancedCORSSettings = async () => {
  const [isEnableRewriteUrl, rewriteUrl, autoCORSFix] = await Promise.all([
    isUrlRewriteEnabled(),
    getRewriteUrl(),
    getIsAutoCORSFix()
  ])

  return {
    isEnableRewriteUrl,
    rewriteUrl,
    autoCORSFix
  }
}

// Legacy alias for backward compatibility
export const getAdvancedOllamaSettings = getAdvancedCORSSettings

export const copilotResumeLastChat = async () => {
  return await getSetting(COPILOT_RESUME_LAST_CHAT_SETTING)
}

export const webUIResumeLastChat = async () => {
  return await getSetting(WEBUI_RESUME_LAST_CHAT_SETTING)
}

export const defaultSidebarOpen = async () => {
  return await getSetting(SIDEBAR_OPEN_SETTING)
}

export const setSidebarOpen = async (sidebarOpen: string) => {
  await setSetting(SIDEBAR_OPEN_SETTING, sidebarOpen)
}

export const customHeaders = async (): Promise<
  { key: string; value: string }[]
> => {
  const headers = await storage.get<
    { key: string; value: string }[] | undefined
  >("customHeaders")

  // One-time migration from old key
  if (!headers) {
    const oldHeaders = await storage.get<
      { key: string; value: string }[] | undefined
    >("customOllamaHeaders")
    if (oldHeaders) {
      await setSetting(CUSTOM_HEADERS_SETTING, oldHeaders)
      return oldHeaders
    }
  }

  if (!headers) {
    return await getSetting(CUSTOM_HEADERS_SETTING)
  }
  return headers
}

export const setCustomHeaders = async (headers: { key: string; value: string }[]) => {
  await setSetting(CUSTOM_HEADERS_SETTING, headers)
}

export const getCustomHeaders = async (): Promise<
  Record<string, string>
> => {
  const hdrs = await customHeaders()

  const headerMap: Record<string, string> = {}

  for (const header of hdrs) {
    headerMap[header.key] = header.value
  }

  return headerMap
}

// Legacy aliases for backward compatibility
export const customOllamaHeaders = customHeaders
export const setCustomOllamaHeaders = setCustomHeaders
export const getCustomOllamaHeaders = getCustomHeaders

export const getOpenOnIconClick = async (): Promise<OpenOnClickValue> => {
  return await getSetting(OPEN_ON_ICON_CLICK_SETTING)
}

export const setOpenOnIconClick = async (
  option: OpenOnClickValue
): Promise<void> => {
  await setSetting(OPEN_ON_ICON_CLICK_SETTING, option)
}

export const getOpenOnRightClick = async (): Promise<OpenOnClickValue> => {
  return await getSetting(OPEN_ON_RIGHT_CLICK_SETTING)
}

export const setOpenOnRightClick = async (
  option: OpenOnClickValue
): Promise<void> => {
  await setSetting(OPEN_ON_RIGHT_CLICK_SETTING, option)
}

export const getTotalFilePerKB = async (): Promise<number> => {
  return await getSetting(TOTAL_FILE_PER_KB_SETTING)
}

export const setTotalFilePerKB = async (
  totalFilePerKB: number
): Promise<void> => {
  await setSetting(TOTAL_FILE_PER_KB_SETTING, totalFilePerKB)
}

export const getNoOfRetrievedDocs = async (): Promise<number> => {
  return await getSetting(NO_OF_RETRIEVED_DOCS_SETTING)
}

export const setNoOfRetrievedDocs = async (
  noOfRetrievedDocs: number
): Promise<void> => {
  await setSetting(NO_OF_RETRIEVED_DOCS_SETTING, noOfRetrievedDocs)
}

export const isRemoveReasoningTagFromCopy = async (): Promise<boolean> => {
  return await getSetting(REMOVE_REASONING_TAG_FROM_COPY_SETTING)
}
