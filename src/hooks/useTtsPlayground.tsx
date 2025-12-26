import { useState } from "react"
import {
  getElevenLabsApiKey,
  getElevenLabsModel,
  getElevenLabsVoiceId,
  getRemoveReasoningTagTTS,
  getSpeechPlaybackSpeed,
  getTTSProvider,
  isSupportedTldwTtsResponseFormat,
  getTldwTTSModel,
  normalizeTldwTtsResponseFormat,
  getTldwTTSVoice,
  getTldwTTSResponseFormat,
  getTldwTTSSpeed,
  isSSMLEnabled
} from "@/services/tts"
import { markdownToSSML } from "@/utils/markdown-to-ssml"
import { splitMessageContent } from "@/utils/tts"
import { removeReasoning } from "@/libs/reasoning"
import { markdownToText } from "@/utils/markdown-to-text"
import { generateSpeech } from "@/services/elevenlabs"
import { generateOpenAITTS } from "@/services/openai-tts"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useAntdNotification } from "./useAntdNotification"
import { useTranslation } from "react-i18next"

export type TtsPlaygroundSegment = {
  id: string
  index: number
  text: string
  url?: string
  blob?: Blob
  format?: string
  mimeType?: string
  source?: "browser" | "generated"
}

export type TtsPlaygroundOverrides = {
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

const normalizeFormat = (format?: string | null): string => {
  const value = (format || "").toLowerCase()
  if (value === "wav" || value === "wave") return "wav"
  if (value === "ogg" || value === "oga") return "ogg"
  if (value === "mp3" || value === "mpeg") return "mp3"
  return "mp3"
}

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

const createObjectUrl = (
  data: ArrayBuffer,
  format?: string | null
): { url: string; blob: Blob; format: string; mimeType: string } => {
  const normalized = normalizeFormat(format)
  const mimeType = formatToMimeType(normalized)
  const blob = new Blob([data], { type: mimeType })
  return { url: URL.createObjectURL(blob), blob, format: normalized, mimeType }
}

export const useTtsPlayground = () => {
  const [segments, setSegments] = useState<TtsPlaygroundSegment[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const notification = useAntdNotification()
  const { t } = useTranslation("playground")

  const revokeAll = (urls: (string | undefined)[]) => {
    urls.filter(Boolean).forEach((u) => {
      try {
        URL.revokeObjectURL(u as string)
      } catch {
        // ignore
      }
    })
  }

  const generateSegments = async (
    text: string,
    overrides?: TtsPlaygroundOverrides
  ): Promise<TtsPlaygroundSegment[]> => {
    if (!text.trim()) {
      setSegments([])
      return []
    }

    setIsGenerating(true)
    const createdUrls: string[] = []

    try {
      let processed = text
      const shouldRemoveReasoning = await getRemoveReasoningTagTTS()
      const ssmlEnabled = await isSSMLEnabled()

      if (shouldRemoveReasoning) {
        processed = removeReasoning(processed)
      }

      if (ssmlEnabled) {
        processed = markdownToSSML(processed)
      } else {
        processed = markdownToText(processed)
      }

      const provider = overrides?.provider || (await getTTSProvider())
      const playbackSpeed = await getSpeechPlaybackSpeed()
      const sentences = splitMessageContent(processed)

      const outSegments: TtsPlaygroundSegment[] = []

      if (provider === "browser") {
        notification.info({
          message: t(
            "tts.browserInfoTitle",
            "Browser TTS uses system audio"
          ),
          description: t(
            "tts.browserInfoDescription",
            "Browser TTS plays using your system synthesizer and does not expose a downloadable audio file. Use the segment controls below, or switch providers for a track list and player."
          )
        })
        const browserSegments = sentences.map((sentence, i) => ({
          id: `browser-${i}`,
          index: i,
          text: sentence,
          source: "browser" as const
        }))
        setSegments(browserSegments)
        return browserSegments
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

        for (let i = 0; i < sentences.length; i++) {
          const buf = await generateSpeech(apiKey, sentences[i], voiceId, modelId)
          const created = createObjectUrl(buf, "mp3")
          createdUrls.push(created.url)
          outSegments.push({
            id: `eleven-${i}`,
            index: i,
            text: sentences[i],
            url: created.url,
            blob: created.blob,
            format: created.format,
            mimeType: created.mimeType,
            source: "generated"
          })
        }
      } else if (provider === "openai") {
        for (let i = 0; i < sentences.length; i++) {
          const buf = await generateOpenAITTS({
            text: sentences[i],
            model: overrides?.openAiModel,
            voice: overrides?.openAiVoice
          })
          const created = createObjectUrl(buf, "mp3")
          createdUrls.push(created.url)
          outSegments.push({
            id: `openai-${i}`,
            index: i,
            text: sentences[i],
            url: created.url,
            blob: created.blob,
            format: created.format,
            mimeType: created.mimeType,
            source: "generated"
          })
        }
      } else if (provider === "tldw") {
        const baseModel = await getTldwTTSModel()
        const baseVoice = await getTldwTTSVoice()
        const baseFmt = await getTldwTTSResponseFormat()
        const baseSpeed = await getTldwTTSSpeed()

        const model = overrides?.tldwModel || baseModel
        const voice = overrides?.tldwVoice || baseVoice
        const rawResponseFormat = overrides?.tldwResponseFormat || baseFmt
        const responseFormat = normalizeTldwTtsResponseFormat(rawResponseFormat)
        if (rawResponseFormat && !isSupportedTldwTtsResponseFormat(rawResponseFormat)) {
          notification.warning({
            message: t(
              "tts.unsupportedFormatTitle",
              "Unsupported audio format"
            ),
            description: t(
              "tts.unsupportedFormatDescription",
              'The response format "{{format}}" is not supported. Falling back to MP3.',
              { format: rawResponseFormat }
            )
          })
        }
        const speed =
          overrides?.tldwSpeed != null ? overrides.tldwSpeed : baseSpeed

        for (let i = 0; i < sentences.length; i++) {
          const buf = await tldwClient.synthesizeSpeech(sentences[i], {
            model,
            voice,
            responseFormat,
            speed
          })
          const created = createObjectUrl(buf, responseFormat)
          createdUrls.push(created.url)
          outSegments.push({
            id: `tldw-${i}`,
            index: i,
            text: sentences[i],
            url: created.url,
            blob: created.blob,
            format: created.format,
            mimeType: created.mimeType,
            source: "generated"
          })
        }
      } else {
        notification.warning({
          message: t(
            "tts.unsupportedProviderTitle",
            "Unsupported TTS provider"
          ),
          description: t(
            "tts.unsupportedProviderDescription",
            'The provider "{{provider}}" is not yet supported in the playground player.',
            { provider }
          )
        })
        setSegments([])
        return []
      }

      // We do not apply playbackSpeed here because <audio> controls can be used directly.
      setSegments(outSegments)
      return outSegments
    } catch (error) {
      revokeAll(createdUrls)
      setSegments([])
      notification.error({
        message: t("tts.generateErrorTitle", "Error generating audio"),
        description:
          error instanceof Error
            ? error.message
            : t(
                "tts.generateErrorDescription",
                "Something went wrong while generating TTS audio."
              )
      })
      return []
    } finally {
      setIsGenerating(false)
    }
  }

  const clearSegments = () => {
    revokeAll(segments.map((s) => s.url))
    setSegments([])
  }

  return {
    segments,
    isGenerating,
    generateSegments,
    clearSegments
  }
}
