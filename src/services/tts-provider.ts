import {
  getElevenLabsApiKey,
  getElevenLabsModel,
  getElevenLabsVoiceId,
  getRemoveReasoningTagTTS,
  getSpeechPlaybackSpeed,
  getTTSProvider,
  getTldwTTSModel,
  getTldwTTSResponseFormat,
  getTldwTTSSpeed,
  getTldwTTSVoice,
  isSSMLEnabled,
  isSupportedTldwTtsResponseFormat,
  normalizeTldwTtsResponseFormat
} from "@/services/tts"
import { markdownToSSML } from "@/utils/markdown-to-ssml"
import { removeReasoning } from "@/libs/reasoning"
import { markdownToText } from "@/utils/markdown-to-text"
import { generateSpeech } from "@/services/elevenlabs"
import { generateOpenAITTS } from "@/services/openai-tts"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import {
  TTS_PROVIDER_VALUES,
  type TtsProviderValue
} from "@/services/tts-providers"

export type TtsProviderKey = TtsProviderValue

export type TtsProviderOverrides = {
  provider?: string
  elevenLabsModel?: string
  elevenLabsVoiceId?: string
  tldwModel?: string
  tldwVoice?: string
  tldwResponseFormat?: string
  tldwSpeed?: number
  openAiModel?: string
  openAiVoice?: string
}

export type TtsSynthesisResult = {
  buffer: ArrayBuffer
  format: string
  mimeType: string
}

export type TtsFormatInfo = {
  requested?: string | null
  resolved: string
  isFallback: boolean
}

export type TtsProviderContext = {
  provider: string
  utterance: string
  playbackSpeed: number
  supported: boolean
  synthesize?: (text: string) => Promise<TtsSynthesisResult>
  formatInfo?: TtsFormatInfo
}

const SUPPORTED_TTS_PROVIDERS = new Set<TtsProviderKey>(TTS_PROVIDER_VALUES)

const formatToMimeType = (format: string): string => {
  switch (format) {
    case "wav":
      return "audio/wav"
    case "ogg":
      return "audio/ogg"
    case "mp3":
    default:
      return "audio/mpeg"
  }
}

const normalizeUtterance = async (text: string): Promise<string> => {
  let utterance = text
  const shouldRemoveReasoning = await getRemoveReasoningTagTTS()
  const ssmlEnabled = await isSSMLEnabled()

  if (shouldRemoveReasoning) {
    utterance = removeReasoning(utterance)
  }

  if (ssmlEnabled) {
    return markdownToSSML(utterance)
  }

  return markdownToText(utterance)
}


export const inferTldwProviderFromModel = (
  model?: string | null
): string | null => {
  if (!model) return null
  const m = String(model).trim().toLowerCase()
  if (m === "tts-1" || m === "tts-1-hd" || m.startsWith("gpt-")) return "openai"
  if (m.startsWith("kokoro")) return "kokoro"
  if (m.startsWith("higgs")) return "higgs"
  if (m.startsWith("dia")) return "dia"
  if (m.startsWith("chatterbox")) return "chatterbox"
  if (m.startsWith("vibevoice")) return "vibevoice"
  if (m.startsWith("neutts")) return "neutts"
  if (m.startsWith("eleven")) return "elevenlabs"
  if (m.startsWith("index_tts") || m.startsWith("indextts")) return "index_tts"
  return null
}

export const resolveTtsProviderContext = async (
  text: string,
  overrides?: TtsProviderOverrides
): Promise<TtsProviderContext> => {
  const provider = overrides?.provider || (await getTTSProvider())
  const utterance = await normalizeUtterance(text)
  const playbackSpeed = await getSpeechPlaybackSpeed()

  if (!SUPPORTED_TTS_PROVIDERS.has(provider as TtsProviderKey)) {
    return {
      provider,
      utterance,
      playbackSpeed,
      supported: false
    }
  }

  if (provider === "browser") {
    return {
      provider,
      utterance,
      playbackSpeed,
      supported: true
    }
  }

  if (provider === "elevenlabs") {
    const apiKey = await getElevenLabsApiKey()
    const baseModel = await getElevenLabsModel()
    const baseVoice = await getElevenLabsVoiceId()
    const modelId = overrides?.elevenLabsModel || baseModel
    const voiceId = overrides?.elevenLabsVoiceId || baseVoice

    if (!apiKey || !modelId || !voiceId) {
      throw new Error("Missing ElevenLabs configuration")
    }

    return {
      provider,
      utterance,
      playbackSpeed,
      supported: true,
      synthesize: async (segment: string) => ({
        buffer: await generateSpeech(apiKey, segment, voiceId, modelId),
        format: "mp3",
        mimeType: "audio/mpeg"
      })
    }
  }

  if (provider === "openai") {
    return {
      provider,
      utterance,
      playbackSpeed,
      supported: true,
      synthesize: async (segment: string) => ({
        buffer: await generateOpenAITTS({
          text: segment,
          model: overrides?.openAiModel,
          voice: overrides?.openAiVoice
        }),
        format: "mp3",
        mimeType: "audio/mpeg"
      })
    }
  }

  const baseModel = await getTldwTTSModel()
  const baseVoice = await getTldwTTSVoice()
  const rawResponseFormat =
    overrides?.tldwResponseFormat || (await getTldwTTSResponseFormat())
  const responseFormat = normalizeTldwTtsResponseFormat(rawResponseFormat)
  const speed = overrides?.tldwSpeed ?? (await getTldwTTSSpeed())
  const model = overrides?.tldwModel || baseModel
  const voice = overrides?.tldwVoice || baseVoice
  const mimeType = formatToMimeType(responseFormat)
  const formatInfo: TtsFormatInfo = {
    requested: rawResponseFormat,
    resolved: responseFormat,
    isFallback: Boolean(rawResponseFormat) &&
      !isSupportedTldwTtsResponseFormat(rawResponseFormat)
  }

  return {
    provider,
    utterance,
    playbackSpeed,
    supported: true,
    formatInfo,
    synthesize: async (segment: string) => ({
      buffer: await tldwClient.synthesizeSpeech(segment, {
        model,
        voice,
        responseFormat,
        speed
      }),
      format: responseFormat,
      mimeType
    })
  }
}
