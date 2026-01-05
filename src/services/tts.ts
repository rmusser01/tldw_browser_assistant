import { Storage } from "@plasmohq/storage"
import { createSafeStorage } from "@/utils/safe-storage"
import { isChromiumTarget } from "@/config/platform"
import {
  TTS_PROVIDER_VALUES,
  type TtsProviderValue
} from "@/services/tts-providers"

const storage = createSafeStorage()
const storage2 = createSafeStorage({
  area: "local"
})

const DEFAULT_TTS_PROVIDER: TtsProviderValue = "browser"

export const getTTSProvider = async (): Promise<TtsProviderValue> => {
  const ttsProvider = await storage.get("ttsProvider")
  if (!ttsProvider || ttsProvider.length === 0) {
    return DEFAULT_TTS_PROVIDER
  }
  if (TTS_PROVIDER_VALUES.includes(ttsProvider as TtsProviderValue)) {
    return ttsProvider as TtsProviderValue
  }
  return DEFAULT_TTS_PROVIDER
}

export const setTTSProvider = async (ttsProvider: string) => {
  await storage.set("ttsProvider", ttsProvider)
}

export const getBrowserTTSVoices = async () => {
  if (isChromiumTarget) {
    const tts = await chrome.tts.getVoices()
    return tts
  } else {
    const tts = await speechSynthesis.getVoices()
    return tts.map((voice) => ({
      voiceName: voice.name,
      lang: voice.lang
    }))
  }
}

export const getVoice = async () => {
  const voice = await storage.get("voice")
  return voice
}

export const setVoice = async (voice: string) => {
  await storage.set("voice", voice)
}

export const isTTSEnabled = async () => {
  const data = await storage.get("isTTSEnabled")
  if (!data || data.length === 0) {
    return true
  }
  return data === "true"
}

export const setTTSEnabled = async (isTTSEnabled: boolean) => {
  await storage.set("isTTSEnabled", isTTSEnabled.toString())
}

export const isSSMLEnabled = async () => {
  const data = await storage.get("isSSMLEnabled")
  return data === "true"
}

export const setSSMLEnabled = async (isSSMLEnabled: boolean) => {
  await storage.set("isSSMLEnabled", isSSMLEnabled.toString())
}

export const getElevenLabsApiKey = async () => {
  const data = await storage.get("elevenLabsApiKey")
  return data
}

export const setElevenLabsApiKey = async (elevenLabsApiKey: string) => {
  await storage.set("elevenLabsApiKey", elevenLabsApiKey)
}

export const getElevenLabsVoiceId = async () => {
  const data = await storage.get("elevenLabsVoiceId")
  return data
}

export const setElevenLabsVoiceId = async (elevenLabsVoiceId: string) => {
  await storage.set("elevenLabsVoiceId", elevenLabsVoiceId)
}

export const getElevenLabsModel = async () => {
  const data = await storage.get("elevenLabsModel")
  return data
}

export const setElevenLabsModel = async (elevenLabsModel: string) => {
  await storage.set("elevenLabsModel", elevenLabsModel)
}

export const getOpenAITTSBaseUrl = async () => {
  const data = await storage.get("openAITTSBaseUrl")
  if (!data || data.length === 0) {
    return "https://api.openai.com/v1"
  }
  return data
}

export const setOpenAITTSBaseUrl = async (openAITTSBaseUrl: string) => {
  await storage.set("openAITTSBaseUrl", openAITTSBaseUrl)
}

export const getOpenAITTSApiKey = async () => {
  const data = await storage.get("openAITTSApiKey")
  return data || ''
}

export const getOpenAITTSModel = async () => {
  const data = await storage.get("openAITTSModel")
  if (!data || data.length === 0) {
    return "tts-1"
  }
  return data
}

export const setOpenAITTSModel = async (openAITTSModel: string) => {
  await storage.set("openAITTSModel", openAITTSModel)
}


export const setOpenAITTSApiKey = async (openAITTSApiKey: string) => {
  await storage.set("openAITTSApiKey", openAITTSApiKey)
}

export const getOpenAITTSVoice = async () => {
  const data = await storage.get("openAITTSVoice")
  if (!data || data.length === 0) {
    return "alloy"
  }
  return data
}

export const setOpenAITTSVoice = async (openAITTSVoice: string) => {
  await storage.set("openAITTSVoice", openAITTSVoice)
}


export const getResponseSplitting = async () => {
  const data = await storage.get("ttsResponseSplitting")
  if (!data || data.length === 0 || data === "") {
    return "punctuation"
  }
  return data
}

export const getRemoveReasoningTagTTS = async () => {
  const data = await storage2.get("removeReasoningTagTTS")
  if (!data || data.length === 0 || data === "") {
    return true
  }
  return data === "true"
}

export const setResponseSplitting = async (responseSplitting: string) => {
  await storage.set("ttsResponseSplitting", responseSplitting)
}

export const setRemoveReasoningTagTTS = async (removeReasoningTagTTS: boolean) => {
  await storage2.set("removeReasoningTagTTS", removeReasoningTagTTS.toString())
}


export const isTTSAutoPlayEnabled = async () => {
  const data = await storage.get<boolean | undefined>("isTTSAutoPlayEnabled")
  return data || false
}

export const setTTSAutoPlayEnabled = async (isTTSAutoPlayEnabled: boolean) => {
  await storage.set("isTTSAutoPlayEnabled", isTTSAutoPlayEnabled)
}

export const getSpeechPlaybackSpeed = async () => {
  const data = await storage.get<number | undefined>("speechPlaybackSpeed")
  return data || 1
}

export const setSpeechPlaybackSpeed = async (speechPlaybackSpeed: number) => {
  await storage.set("speechPlaybackSpeed", speechPlaybackSpeed)
}

export const getTldwTTSModel = async () => {
  const data = await storage.get<string | undefined>("tldwTtsModel")
  return data && data.length > 0 ? data : "kokoro"
}

export const setTldwTTSModel = async (model: string) => {
  await storage.set("tldwTtsModel", model)
}

export const getTldwTTSVoice = async () => {
  const data = await storage.get<string | undefined>("tldwTtsVoice")
  return data && data.length > 0 ? data : "af_heart"
}

export const setTldwTTSVoice = async (voice: string) => {
  await storage.set("tldwTtsVoice", voice)
}

export const SUPPORTED_TLDW_TTS_FORMATS = ["mp3", "ogg", "wav"] as const
type SupportedTldwTtsFormat = (typeof SUPPORTED_TLDW_TTS_FORMATS)[number]
const SUPPORTED_TLDW_TTS_FORMAT_SET = new Set(SUPPORTED_TLDW_TTS_FORMATS)

export const isSupportedTldwTtsResponseFormat = (
  format?: string | null
): format is SupportedTldwTtsFormat => {
  const normalized = (format || "").trim().toLowerCase()
  return SUPPORTED_TLDW_TTS_FORMAT_SET.has(normalized as SupportedTldwTtsFormat)
}

export const normalizeTldwTtsResponseFormat = (
  format?: string | null
): SupportedTldwTtsFormat => {
  const normalized = (format || "").trim().toLowerCase()
  return SUPPORTED_TLDW_TTS_FORMAT_SET.has(normalized as SupportedTldwTtsFormat)
    ? (normalized as SupportedTldwTtsFormat)
    : "mp3"
}

export const getTldwTTSResponseFormat = async () => {
  const data = await storage.get<string | undefined>("tldwTtsResponseFormat")
  return normalizeTldwTtsResponseFormat(data)
}

export const setTldwTTSResponseFormat = async (fmt: string) => {
  await storage.set("tldwTtsResponseFormat", normalizeTldwTtsResponseFormat(fmt))
}

export const getTldwTTSSpeed = async () => {
  const data = await storage.get<number | undefined>("tldwTtsSpeed")
  return typeof data === "number" && data > 0 ? data : 1
}

export const setTldwTTSSpeed = async (speed: number) => {
  await storage.set("tldwTtsSpeed", speed)
}

export const getTTSSettings = async () => {
  const [
    ttsEnabled,
    ttsProvider,
    browserTTSVoices,
    voice,
    ssmlEnabled,
    elevenLabsApiKey,
    elevenLabsVoiceId,
    elevenLabsModel,
    responseSplitting,
    removeReasoningTagTTS,
    // OPENAI
    openAITTSBaseUrl,
    openAITTSApiKey,
    openAITTSModel,
    openAITTSVoice,
    // UTILS
    ttsAutoPlay,
    playbackSpeed,
    // tldw_server TTS
    tldwTtsModel,
    tldwTtsVoice,
    tldwTtsResponseFormat,
    tldwTtsSpeed,
  ] = await Promise.all([
    isTTSEnabled(),
    getTTSProvider(),
    getBrowserTTSVoices(),
    getVoice(),
    isSSMLEnabled(),
    getElevenLabsApiKey(),
    getElevenLabsVoiceId(),
    getElevenLabsModel(),
    getResponseSplitting(),
    getRemoveReasoningTagTTS(),
    // OPENAI 
    getOpenAITTSBaseUrl(),
    getOpenAITTSApiKey(),
    getOpenAITTSModel(),
    getOpenAITTSVoice(),
    // UTILS
    isTTSAutoPlayEnabled(),
    getSpeechPlaybackSpeed(),
    // tldw_server TTS
    getTldwTTSModel(),
    getTldwTTSVoice(),
    getTldwTTSResponseFormat(),
    getTldwTTSSpeed(),
  ])

  return {
    ttsEnabled,
    ttsProvider,
    browserTTSVoices,
    voice,
    ssmlEnabled,
    elevenLabsApiKey,
    elevenLabsVoiceId,
    elevenLabsModel,
    responseSplitting,
    removeReasoningTagTTS,
    // OPENAI
    openAITTSBaseUrl,
    openAITTSApiKey,
    openAITTSModel,
    openAITTSVoice,
    ttsAutoPlay,
    playbackSpeed,
    tldwTtsModel,
    tldwTtsVoice,
    tldwTtsResponseFormat,
    tldwTtsSpeed,
  }
}

export const setTTSSettings = async ({
  ttsEnabled,
  ttsProvider,
  voice,
  ssmlEnabled,
  elevenLabsApiKey,
  elevenLabsVoiceId,
  elevenLabsModel,
  responseSplitting,
  removeReasoningTagTTS,
  openAITTSBaseUrl,
  openAITTSApiKey,
  openAITTSModel,
  openAITTSVoice,
  ttsAutoPlay,
  playbackSpeed,
  tldwTtsModel,
  tldwTtsVoice,
  tldwTtsResponseFormat,
  tldwTtsSpeed,
}: {
  ttsEnabled: boolean
  ttsProvider: string
  voice: string
  ssmlEnabled: boolean
  elevenLabsApiKey: string
  elevenLabsVoiceId: string
  elevenLabsModel: string
  responseSplitting: string
  removeReasoningTagTTS: boolean
  openAITTSBaseUrl: string,
  openAITTSApiKey: string,
  openAITTSModel: string,
  openAITTSVoice: string,
  ttsAutoPlay: boolean,
  playbackSpeed: number,
  tldwTtsModel: string,
  tldwTtsVoice: string,
  tldwTtsResponseFormat: string,
  tldwTtsSpeed: number,
}) => {
  await Promise.all([
    setTTSEnabled(ttsEnabled),
    setTTSProvider(ttsProvider),
    setVoice(voice),
    setSSMLEnabled(ssmlEnabled),
    setElevenLabsApiKey(elevenLabsApiKey),
    setElevenLabsVoiceId(elevenLabsVoiceId),
    setElevenLabsModel(elevenLabsModel),
    setResponseSplitting(responseSplitting),
    setRemoveReasoningTagTTS(removeReasoningTagTTS),
    setOpenAITTSBaseUrl(openAITTSBaseUrl),
    setOpenAITTSApiKey(openAITTSApiKey),
    setOpenAITTSModel(openAITTSModel),
    setOpenAITTSVoice(openAITTSVoice),
    setTTSAutoPlayEnabled(ttsAutoPlay),
    setSpeechPlaybackSpeed(playbackSpeed),
    setTldwTTSModel(tldwTtsModel),
    setTldwTTSVoice(tldwTtsVoice),
    setTldwTTSResponseFormat(tldwTtsResponseFormat),
    setTldwTTSSpeed(tldwTtsSpeed),
  ])
}
