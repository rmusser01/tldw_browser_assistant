import {
  coerceBoolean,
  coerceNumber,
  defineSetting,
  getSetting
} from "@/services/settings/registry"

const CHAT_WITH_WEBSITE_SETTING = defineSetting(
  "chatWithWebsiteEmbedding",
  false,
  (value) => coerceBoolean(value, false)
)

const MAX_WEBSITE_CONTEXT_SETTING = defineSetting(
  "maxWebsiteContext",
  7028,
  (value) => coerceNumber(value, 7028)
)

/**
 * Whether to use local embeddings for website chat.
 * When false, just uses raw text truncation.
 */
export const isChatWithWebsiteEnabled = async (): Promise<boolean> => {
  return await getSetting(CHAT_WITH_WEBSITE_SETTING)
}

/**
 * Maximum context size for inline document content.
 */
export const getMaxContextSize = async (): Promise<number> => {
  return await getSetting(MAX_WEBSITE_CONTEXT_SETTING)
}
