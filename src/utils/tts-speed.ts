import type { TtsProviderOverrides } from "@/services/tts-provider"

export type TtsVoiceConfig = TtsProviderOverrides & { speed?: number }

export const applyVoiceSpeedOverrides = (
  overrides?: TtsVoiceConfig
): TtsProviderOverrides => {
  if (!overrides) return {}
  const { speed, ...rest } = overrides
  if (speed == null) return rest

  if (!rest.provider) {
    return {
      ...rest,
      tldwSpeed: speed,
      openAiSpeed: speed,
      elevenLabsSpeed: speed
    }
  }

  if (rest.provider === "tldw") {
    return { ...rest, tldwSpeed: speed }
  }

  if (rest.provider === "openai") {
    return { ...rest, openAiSpeed: speed }
  }

  if (rest.provider === "elevenlabs") {
    return { ...rest, elevenLabsSpeed: speed }
  }

  return rest
}
