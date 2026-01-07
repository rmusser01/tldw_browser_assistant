import { getProviderLabel, getProvidersByCapability } from "@/utils/provider-registry"

const TTS_PROVIDERS = getProvidersByCapability("tts")

export const TTS_PROVIDER_OPTIONS = TTS_PROVIDERS.map(({ key }) => ({
  value: key,
  label: getProviderLabel(key, "tts")
}))

export const TTS_PROVIDER_VALUES = TTS_PROVIDER_OPTIONS.map(
  (option) => option.value
)

export type TtsProviderValue = (typeof TTS_PROVIDER_OPTIONS)[number]["value"]

export const getTtsProviderLabel = (provider?: string): string =>
  getProviderLabel(provider || "browser", "tts")
