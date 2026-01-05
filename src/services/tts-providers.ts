export const TTS_PROVIDER_OPTIONS = [
  { value: "browser", label: "Browser TTS" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "openai", label: "OpenAI TTS" },
  { value: "tldw", label: "tldw server (audio/speech)" }
] as const

export const TTS_PROVIDER_VALUES = TTS_PROVIDER_OPTIONS.map(
  (option) => option.value
)

export type TtsProviderValue = (typeof TTS_PROVIDER_OPTIONS)[number]["value"]

const TTS_PROVIDER_LABELS = TTS_PROVIDER_OPTIONS.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label
    return acc
  },
  {}
)

export const getTtsProviderLabel = (provider?: string): string => {
  const key = String(provider || "browser").toLowerCase()
  return TTS_PROVIDER_LABELS[key] || provider || "TTS"
}

