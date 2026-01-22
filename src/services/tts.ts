import { isChromiumTarget } from "@/config/platform"
import {
  defineSetting,
  getSetting,
  setSetting,
  coerceBoolean,
  coerceNumber,
  coerceOptionalString,
  coerceString
} from "@/services/settings/registry"
import {
  TTS_PROVIDER_VALUES,
  type TtsProviderValue
} from "@/services/tts-providers"

const DEFAULT_TTS_PROVIDER: TtsProviderValue = "browser"

export const SUPPORTED_TLDW_TTS_FORMATS = [
  "mp3",
  "opus",
  "aac",
  "flac",
  "wav",
  "pcm"
] as const
type SupportedTldwTtsFormat = (typeof SUPPORTED_TLDW_TTS_FORMATS)[number]
const SUPPORTED_TLDW_TTS_FORMAT_SET = new Set(SUPPORTED_TLDW_TTS_FORMATS)

const normalizeTldwTtsFormatInput = (format?: string | null): string => {
  const normalized = (format || "").trim().toLowerCase()
  return normalized === "ogg" ? "opus" : normalized
}

export const isSupportedTldwTtsResponseFormat = (
  format?: string | null
): format is SupportedTldwTtsFormat => {
  const normalized = normalizeTldwTtsFormatInput(format)
  return SUPPORTED_TLDW_TTS_FORMAT_SET.has(normalized as SupportedTldwTtsFormat)
}

export const normalizeTldwTtsResponseFormat = (
  format?: string | null
): SupportedTldwTtsFormat => {
  const normalized = normalizeTldwTtsFormatInput(format)
  return SUPPORTED_TLDW_TTS_FORMAT_SET.has(normalized as SupportedTldwTtsFormat)
    ? (normalized as SupportedTldwTtsFormat)
    : "mp3"
}

const coercePositiveNumber = (value: unknown, fallback: number): number => {
  const num = coerceNumber(value, fallback)
  return num > 0 ? num : fallback
}

const TTS_PROVIDER_SETTING = defineSetting(
  "ttsProvider",
  DEFAULT_TTS_PROVIDER,
  (value) => {
    const normalized = String(value || "").toLowerCase()
    return TTS_PROVIDER_VALUES.includes(normalized as TtsProviderValue)
      ? (normalized as TtsProviderValue)
      : DEFAULT_TTS_PROVIDER
  }
)
const VOICE_SETTING = defineSetting("voice", undefined as string | undefined, coerceOptionalString)
const TTS_ENABLED_SETTING = defineSetting("isTTSEnabled", true, (value) =>
  coerceBoolean(value, true)
)
const SSML_ENABLED_SETTING = defineSetting("isSSMLEnabled", false, (value) =>
  coerceBoolean(value, false)
)
const ELEVEN_LABS_API_KEY_SETTING = defineSetting(
  "elevenLabsApiKey",
  undefined as string | undefined,
  coerceOptionalString
)
const ELEVEN_LABS_VOICE_ID_SETTING = defineSetting(
  "elevenLabsVoiceId",
  undefined as string | undefined,
  coerceOptionalString
)
const ELEVEN_LABS_MODEL_SETTING = defineSetting(
  "elevenLabsModel",
  undefined as string | undefined,
  coerceOptionalString
)
const OPENAI_TTS_BASE_URL_SETTING = defineSetting(
  "openAITTSBaseUrl",
  "https://api.openai.com/v1",
  (value) => coerceString(value, "https://api.openai.com/v1")
)
const OPENAI_TTS_API_KEY_SETTING = defineSetting(
  "openAITTSApiKey",
  "",
  (value) => coerceString(value, "")
)
const OPENAI_TTS_MODEL_SETTING = defineSetting(
  "openAITTSModel",
  "tts-1",
  (value) => coerceString(value, "tts-1")
)
const OPENAI_TTS_VOICE_SETTING = defineSetting(
  "openAITTSVoice",
  "alloy",
  (value) => coerceString(value, "alloy")
)
const RESPONSE_SPLITTING_SETTING = defineSetting(
  "ttsResponseSplitting",
  "punctuation",
  (value) => coerceString(value, "punctuation")
)
const REMOVE_REASONING_TAG_SETTING = defineSetting(
  "removeReasoningTagTTS",
  true,
  (value) => coerceBoolean(value, true)
)
const TTS_AUTOPLAY_SETTING = defineSetting("isTTSAutoPlayEnabled", false, (value) =>
  coerceBoolean(value, false)
)
const SPEECH_PLAYBACK_SPEED_SETTING = defineSetting(
  "speechPlaybackSpeed",
  1,
  (value) => coercePositiveNumber(value, 1)
)
const TLDW_TTS_MODEL_SETTING = defineSetting(
  "tldwTtsModel",
  "kokoro",
  (value) => coerceString(value, "kokoro")
)
const TLDW_TTS_VOICE_SETTING = defineSetting(
  "tldwTtsVoice",
  "af_heart",
  (value) => coerceString(value, "af_heart")
)
const TLDW_TTS_RESPONSE_FORMAT_SETTING = defineSetting(
  "tldwTtsResponseFormat",
  "mp3" as SupportedTldwTtsFormat,
  (value) => normalizeTldwTtsResponseFormat(String(value || ""))
)
const TLDW_TTS_SPEED_SETTING = defineSetting(
  "tldwTtsSpeed",
  1,
  (value) => coercePositiveNumber(value, 1)
)

export const getTTSProvider = async (): Promise<TtsProviderValue> =>
  getSetting(TTS_PROVIDER_SETTING)

export const setTTSProvider = async (ttsProvider: string) => {
  await setSetting(TTS_PROVIDER_SETTING, ttsProvider as TtsProviderValue)
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

export const getVoice = async () => getSetting(VOICE_SETTING)

export const setVoice = async (voice: string) => {
  await setSetting(VOICE_SETTING, voice)
}

export const isTTSEnabled = async () => getSetting(TTS_ENABLED_SETTING)

export const setTTSEnabled = async (isTTSEnabled: boolean) => {
  await setSetting(TTS_ENABLED_SETTING, isTTSEnabled)
}

export const isSSMLEnabled = async () => getSetting(SSML_ENABLED_SETTING)

export const setSSMLEnabled = async (isSSMLEnabled: boolean) => {
  await setSetting(SSML_ENABLED_SETTING, isSSMLEnabled)
}

export const getElevenLabsApiKey = async () =>
  getSetting(ELEVEN_LABS_API_KEY_SETTING)

export const setElevenLabsApiKey = async (elevenLabsApiKey: string) => {
  await setSetting(ELEVEN_LABS_API_KEY_SETTING, elevenLabsApiKey)
}

export const getElevenLabsVoiceId = async () =>
  getSetting(ELEVEN_LABS_VOICE_ID_SETTING)

export const setElevenLabsVoiceId = async (elevenLabsVoiceId: string) => {
  await setSetting(ELEVEN_LABS_VOICE_ID_SETTING, elevenLabsVoiceId)
}

export const getElevenLabsModel = async () =>
  getSetting(ELEVEN_LABS_MODEL_SETTING)

export const setElevenLabsModel = async (elevenLabsModel: string) => {
  await setSetting(ELEVEN_LABS_MODEL_SETTING, elevenLabsModel)
}

export const getOpenAITTSBaseUrl = async () =>
  getSetting(OPENAI_TTS_BASE_URL_SETTING)

export const setOpenAITTSBaseUrl = async (openAITTSBaseUrl: string) => {
  await setSetting(OPENAI_TTS_BASE_URL_SETTING, openAITTSBaseUrl)
}

export const getOpenAITTSApiKey = async () =>
  getSetting(OPENAI_TTS_API_KEY_SETTING)

export const getOpenAITTSModel = async () =>
  getSetting(OPENAI_TTS_MODEL_SETTING)

export const setOpenAITTSModel = async (openAITTSModel: string) => {
  await setSetting(OPENAI_TTS_MODEL_SETTING, openAITTSModel)
}

export const setOpenAITTSApiKey = async (openAITTSApiKey: string) => {
  await setSetting(OPENAI_TTS_API_KEY_SETTING, openAITTSApiKey)
}

export const getOpenAITTSVoice = async () =>
  getSetting(OPENAI_TTS_VOICE_SETTING)

export const setOpenAITTSVoice = async (openAITTSVoice: string) => {
  await setSetting(OPENAI_TTS_VOICE_SETTING, openAITTSVoice)
}

export const getResponseSplitting = async () =>
  getSetting(RESPONSE_SPLITTING_SETTING)

export const getRemoveReasoningTagTTS = async () =>
  getSetting(REMOVE_REASONING_TAG_SETTING)

export const setResponseSplitting = async (responseSplitting: string) => {
  await setSetting(RESPONSE_SPLITTING_SETTING, responseSplitting)
}

export const setRemoveReasoningTagTTS = async (removeReasoningTagTTS: boolean) => {
  await setSetting(REMOVE_REASONING_TAG_SETTING, removeReasoningTagTTS)
}

export const isTTSAutoPlayEnabled = async () => getSetting(TTS_AUTOPLAY_SETTING)

export const setTTSAutoPlayEnabled = async (isTTSAutoPlayEnabled: boolean) => {
  await setSetting(TTS_AUTOPLAY_SETTING, isTTSAutoPlayEnabled)
}

export const getSpeechPlaybackSpeed = async () =>
  getSetting(SPEECH_PLAYBACK_SPEED_SETTING)

export const setSpeechPlaybackSpeed = async (speechPlaybackSpeed: number) => {
  await setSetting(SPEECH_PLAYBACK_SPEED_SETTING, speechPlaybackSpeed)
}

export const getTldwTTSModel = async () => getSetting(TLDW_TTS_MODEL_SETTING)

export const setTldwTTSModel = async (model: string) => {
  await setSetting(TLDW_TTS_MODEL_SETTING, model)
}

export const getTldwTTSVoice = async () => getSetting(TLDW_TTS_VOICE_SETTING)

export const setTldwTTSVoice = async (voice: string) => {
  await setSetting(TLDW_TTS_VOICE_SETTING, voice)
}

export const getTldwTTSResponseFormat = async () =>
  getSetting(TLDW_TTS_RESPONSE_FORMAT_SETTING)

export const setTldwTTSResponseFormat = async (fmt: string) => {
  await setSetting(
    TLDW_TTS_RESPONSE_FORMAT_SETTING,
    normalizeTldwTtsResponseFormat(fmt)
  )
}

export const getTldwTTSSpeed = async () => getSetting(TLDW_TTS_SPEED_SETTING)

export const setTldwTTSSpeed = async (speed: number) => {
  await setSetting(TLDW_TTS_SPEED_SETTING, speed)
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
    tldwTtsSpeed
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
    getTldwTTSSpeed()
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
    tldwTtsSpeed
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
  tldwTtsSpeed
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
  openAITTSBaseUrl: string
  openAITTSApiKey: string
  openAITTSModel: string
  openAITTSVoice: string
  ttsAutoPlay: boolean
  playbackSpeed: number
  tldwTtsModel: string
  tldwTtsVoice: string
  tldwTtsResponseFormat: string
  tldwTtsSpeed: number
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
    setTldwTTSSpeed(tldwTtsSpeed)
  ])
}
