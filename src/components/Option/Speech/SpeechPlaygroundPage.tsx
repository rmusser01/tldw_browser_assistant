import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { useTranslation } from "react-i18next"
import {
  Button,
  Alert,
  Card,
  Divider,
  Dropdown,
  Input,
  List,
  Popover,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  notification
} from "antd"
import { ArrowRight, Copy, Download, Lock, Mic, Pause, Save, Trash2, Unlock } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageShell } from "@/components/Common/PageShell"
import WaveformCanvas from "@/components/Common/WaveformCanvas"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useServerOnline } from "@/hooks/useServerOnline"
import {
  fetchTtsProviders,
  type TldwTtsProviderCapabilities,
  type TldwTtsVoiceInfo,
  type TldwTtsProvidersInfo
} from "@/services/tldw/audio-providers"
import { fetchTldwTtsModels, type TldwTtsModel } from "@/services/tldw/audio-models"
import { fetchTldwVoiceCatalog } from "@/services/tldw/audio-voices"
import { getModels, getVoices } from "@/services/elevenlabs"
import { useTtsPlayground } from "@/hooks/useTtsPlayground"
import { getTTSProvider, getTTSSettings, setTTSSettings } from "@/services/tts"
import { TTSModeSettings } from "@/components/Option/Settings/tts-mode"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { copyToClipboard } from "@/utils/clipboard"

const { Text, Title, Paragraph } = Typography

type SpeechMode = "roundtrip" | "speak" | "listen"

type SpeechHistoryItem = {
  id: string
  type: "stt" | "tts"
  createdAt: string
  text: string
  durationMs?: number
  model?: string
  language?: string
  provider?: string
  voice?: string
  format?: string
  mode?: "short" | "long"
}

const SAMPLE_TEXT =
  "Sample: Hi there, this is the speech playground reading a short passage so you can preview voice and speed."

const OPENAI_TTS_MODELS = [
  { label: "tts-1", value: "tts-1" },
  { label: "tts-1-hd", value: "tts-1-hd" }
]

const OPENAI_TTS_VOICES: Record<string, { label: string; value: string }[]> = {
  "tts-1": [
    { label: "alloy", value: "alloy" },
    { label: "echo", value: "echo" },
    { label: "fable", value: "fable" },
    { label: "onyx", value: "onyx" },
    { label: "nova", value: "nova" },
    { label: "shimmer", value: "shimmer" }
  ],
  "tts-1-hd": [
    { label: "alloy", value: "alloy" },
    { label: "echo", value: "echo" },
    { label: "fable", value: "fable" },
    { label: "onyx", value: "onyx" },
    { label: "nova", value: "nova" },
    { label: "shimmer", value: "shimmer" }
  ]
}

const inferProviderFromModel = (model?: string | null): string | null => {
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

const MAX_HISTORY_ITEMS = 100

const formatHistoryDate = (value: string) => {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

type SpeechPlaygroundPageProps = {
  initialMode?: SpeechMode
}

export const SpeechPlaygroundPage: React.FC<SpeechPlaygroundPageProps> = ({
  initialMode
}) => {
  const { t } = useTranslation(["playground", "settings", "option"])
  const queryClient = useQueryClient()

  const [mode, setMode] = useStorage<SpeechMode>("speechPlaygroundMode", "roundtrip")
  const [historyItems, setHistoryItems] = useStorage<SpeechHistoryItem[]>(
    "speechPlaygroundHistory",
    []
  )
  const [historyFilter, setHistoryFilter] = React.useState<"all" | "stt" | "tts">(
    "all"
  )
  const [historyQuery, setHistoryQuery] = React.useState("")

  React.useEffect(() => {
    if (initialMode && mode !== initialMode) {
      setMode(initialMode)
    }
  }, [initialMode, mode, setMode])

  const addHistoryItem = React.useCallback(
    (item: SpeechHistoryItem) => {
      setHistoryItems((prev) => {
        const next = [item, ...(prev || [])]
        return next.slice(0, MAX_HISTORY_ITEMS)
      })
    },
    [setHistoryItems]
  )

  const removeHistoryItem = React.useCallback(
    (id: string) => {
      setHistoryItems((prev) => (prev || []).filter((item) => item.id !== id))
    },
    [setHistoryItems]
  )

  const clearHistory = React.useCallback(() => {
    setHistoryItems([])
  }, [setHistoryItems])

  const filteredHistory = React.useMemo(() => {
    const query = historyQuery.trim().toLowerCase()
    return (historyItems || []).filter((item) => {
      if (historyFilter !== "all" && item.type !== historyFilter) return false
      if (!query) return true
      return item.text.toLowerCase().includes(query)
    })
  }, [historyFilter, historyItems, historyQuery])

  const [speechToTextLanguage] = useStorage("speechToTextLanguage", "en-US")
  const [sttModel] = useStorage("sttModel", "whisper-1")
  const [sttTask] = useStorage("sttTask", "transcribe")
  const [sttResponseFormat] = useStorage("sttResponseFormat", "json")
  const [sttTemperature] = useStorage("sttTemperature", 0)
  const [sttUseSegmentation] = useStorage("sttUseSegmentation", false)
  const [sttTimestampGranularities] = useStorage("sttTimestampGranularities", "segment")
  const [sttPrompt] = useStorage("sttPrompt", "")
  const [sttSegK] = useStorage("sttSegK", 6)
  const [sttSegMinSegmentSize] = useStorage("sttSegMinSegmentSize", 5)
  const [sttSegLambdaBalance] = useStorage("sttSegLambdaBalance", 0.01)
  const [sttSegUtteranceExpansionWidth] = useStorage("sttSegUtteranceExpansionWidth", 2)
  const [sttSegEmbeddingsProvider] = useStorage("sttSegEmbeddingsProvider", "")
  const [sttSegEmbeddingsModel] = useStorage("sttSegEmbeddingsModel", "")

  const [serverModels, setServerModels] = React.useState<string[]>([])
  const [serverModelsLoading, setServerModelsLoading] = React.useState(false)
  const [activeModel, setActiveModel] = React.useState<string | undefined>()
  const [isRecording, setIsRecording] = React.useState(false)
  const [isTranscribing, setIsTranscribing] = React.useState(false)
  const [useLongRunning, setUseLongRunning] = React.useState(false)
  const [liveText, setLiveText] = React.useState("")
  const [lastTranscript, setLastTranscript] = React.useState("")
  const [transcriptLocked, setTranscriptLocked] = React.useState(true)
  const [recordingError, setRecordingError] = React.useState<string | null>(null)
  const [recordingStream, setRecordingStream] = React.useState<MediaStream | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<BlobPart[]>([])
  const startedAtRef = React.useRef<number | null>(null)
  const liveTextRef = React.useRef<string>("")

  React.useEffect(() => {
    let cancelled = false
    const fetchModels = async () => {
      setServerModelsLoading(true)
      try {
        const res = await tldwClient.getTranscriptionModels()
        const all = Array.isArray(res?.all_models) ? (res.all_models as string[]) : []
        if (!cancelled && all.length > 0) {
          const unique = Array.from(new Set(all)).sort()
          setServerModels(unique)
          if (!activeModel) {
            const initial = sttModel && unique.includes(sttModel) ? sttModel : unique[0]
            setActiveModel(initial)
          }
        }
      } catch (e) {
        if ((import.meta as any)?.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn("Failed to load transcription models for Speech Playground", e)
        }
      } finally {
        if (!cancelled) {
          setServerModelsLoading(false)
        }
      }
    }
    fetchModels()
    return () => {
      cancelled = true
    }
  }, [activeModel, sttModel])

  const appendLiveText = React.useCallback((textChunk: string) => {
    if (!textChunk) return
    setLiveText((prev) => {
      const next = prev ? `${prev} ${textChunk}` : textChunk
      liveTextRef.current = next
      return next
    })
  }, [])

  const canEditTranscript = !transcriptLocked && !isRecording && !isTranscribing

  const handleTranscriptChange = (value: string) => {
    setLiveText(value)
    liveTextRef.current = value
    setLastTranscript(value)
  }

  const transcribeBlob = React.useCallback(
    async (blob: Blob, modelOverride?: string): Promise<string> => {
      const sttOptions: Record<string, any> = {
        language: speechToTextLanguage
      }
      const modelToUse = modelOverride || activeModel || sttModel
      if (modelToUse && modelToUse.trim().length > 0) {
        sttOptions.model = modelToUse.trim()
      }
      if (sttTimestampGranularities) {
        sttOptions.timestamp_granularities = sttTimestampGranularities
      }
      if (sttPrompt && sttPrompt.trim().length > 0) {
        sttOptions.prompt = sttPrompt.trim()
      }
      if (sttTask) {
        sttOptions.task = sttTask
      }
      if (sttResponseFormat) {
        sttOptions.response_format = sttResponseFormat
      }
      if (typeof sttTemperature === "number") {
        sttOptions.temperature = sttTemperature
      }
      if (sttUseSegmentation) {
        sttOptions.segment = true
        if (typeof sttSegK === "number") {
          sttOptions.seg_K = sttSegK
        }
        if (typeof sttSegMinSegmentSize === "number") {
          sttOptions.seg_min_segment_size = sttSegMinSegmentSize
        }
        if (typeof sttSegLambdaBalance === "number") {
          sttOptions.seg_lambda_balance = sttSegLambdaBalance
        }
        if (typeof sttSegUtteranceExpansionWidth === "number") {
          sttOptions.seg_utterance_expansion_width = sttSegUtteranceExpansionWidth
        }
        if (sttSegEmbeddingsProvider?.trim()) {
          sttOptions.seg_embeddings_provider = sttSegEmbeddingsProvider.trim()
        }
        if (sttSegEmbeddingsModel?.trim()) {
          sttOptions.seg_embeddings_model = sttSegEmbeddingsModel.trim()
        }
      }
      const res = await tldwClient.transcribeAudio(blob, sttOptions)
      let text = ""
      if (res) {
        if (typeof res === "string") {
          text = res
        } else if (typeof (res as any).text === "string") {
          text = (res as any).text
        } else if (typeof (res as any).transcript === "string") {
          text = (res as any).transcript
        } else if (Array.isArray((res as any).segments)) {
          text = (res as any).segments
            .map((s: any) => s?.text || "")
            .join(" ")
            .trim()
        }
      }
      return text
    },
    [
      activeModel,
      speechToTextLanguage,
      sttModel,
      sttPrompt,
      sttResponseFormat,
      sttSegEmbeddingsModel,
      sttSegEmbeddingsProvider,
      sttSegK,
      sttSegLambdaBalance,
      sttSegMinSegmentSize,
      sttSegUtteranceExpansionWidth,
      sttTask,
      sttTemperature,
      sttTimestampGranularities,
      sttUseSegmentation
    ]
  )

  const handleStartRecording = async () => {
    if (isTranscribing) return
    if (isRecording) {
      recorderRef.current?.stop()
      setIsRecording(false)
      setIsTranscribing(true)
      return
    }
    try {
      setRecordingError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      startedAtRef.current = Date.now()
      liveTextRef.current = ""
      setLiveText("")
      setRecordingStream(stream)

      recorder.ondataavailable = async (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return
        if (useLongRunning) {
          try {
            const text = await transcribeBlob(ev.data)
            if (text) {
              appendLiveText(text)
            }
          } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error("Streaming STT chunk failed", e)
          }
        } else {
          chunksRef.current.push(ev.data)
        }
      }

      recorder.onerror = (event: Event) => {
        // eslint-disable-next-line no-console
        console.error("MediaRecorder error", event)
        setRecordingError(
          t(
            "playground:actions.speechErrorBody",
            "Microphone recording error. Check your permissions and try again."
          )
        )
        notification.error({
          message: t("playground:actions.speechErrorTitle", "Dictation failed"),
          description: t(
            "playground:actions.speechErrorBody",
            "Microphone recording error. Check your permissions and try again."
          )
        })
        setIsRecording(false)
        setIsTranscribing(false)
      }

      recorder.onstop = async () => {
        try {
          const startedAt = startedAtRef.current
          startedAtRef.current = null
          if (useLongRunning) {
            const text = liveTextRef.current.trim()
            if (!text) {
              return
            }
            setLiveText(text)
            liveTextRef.current = text
            const nowIso = new Date().toISOString()
            const durationMs = startedAt != null ? Date.now() - startedAt : undefined
            addHistoryItem({
              id: `${nowIso}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: nowIso,
              durationMs,
              model: activeModel || sttModel,
              language: speechToTextLanguage,
              text,
              type: "stt",
              mode: "long"
            })
            setLastTranscript(text)
          } else {
            const blob = new Blob(chunksRef.current, {
              type: recorder.mimeType || "audio/webm"
            })
            chunksRef.current = []
            if (blob.size === 0) return
            const text = await transcribeBlob(blob)
            if (!text) {
              notification.error({
                message: t("playground:actions.speechErrorTitle", "Dictation failed"),
                description: t(
                  "playground:actions.speechNoText",
                  "The transcription did not return any text."
                )
              })
              return
            }
            setLiveText(text)
            liveTextRef.current = text
            const nowIso = new Date().toISOString()
            const durationMs = startedAt != null ? Date.now() - startedAt : undefined
            addHistoryItem({
              id: `${nowIso}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: nowIso,
              durationMs,
              model: activeModel || sttModel,
              language: speechToTextLanguage,
              text,
              type: "stt",
              mode: "short"
            })
            setLastTranscript(text)
          }
        } catch (e: any) {
          notification.error({
            message: t("playground:actions.speechErrorTitle", "Dictation failed"),
            description:
              e?.message ||
              t(
                "playground:actions.speechErrorBody",
                "Transcription request failed. Check tldw server health."
              )
          })
        } finally {
          try {
            recorder.stream.getTracks().forEach((trk) => trk.stop())
          } catch {}
          setRecordingStream(null)
          setIsRecording(false)
          setIsTranscribing(false)
        }
      }

      recorder.start(useLongRunning ? 5000 : undefined)
      setIsRecording(true)
    } catch (e: any) {
      setRecordingError(
        t(
          "playground:actions.speechMicError",
          "Unable to access your microphone. Check browser permissions and try again."
        )
      )
      notification.error({
        message: t("playground:actions.speechErrorTitle", "Dictation failed"),
        description: t(
          "playground:actions.speechMicError",
          "Unable to access your microphone. Check browser permissions and try again."
        )
      })
      setIsRecording(false)
    }
  }

  const handleSaveToNotes = async (item: SpeechHistoryItem) => {
    const title = `STT: ${new Date(item.createdAt).toLocaleString()}`
    try {
      await tldwClient.createNote(item.text, {
        title,
        metadata: {
          origin: "speech-playground",
          stt_model: item.model,
          stt_language: item.language
        }
      })
      notification.success({
        message: t("settings:healthPage.copyDiagnostics", "Saved to Notes"),
        description: t("playground:tts.savedToNotes", "Transcription saved as a note.")
      })
    } catch (e: any) {
      notification.error({
        message: t("error", "Error"),
        description: e?.message || t("somethingWentWrong", "Something went wrong")
      })
    }
  }

  const {
    segments,
    isGenerating,
    generateSegments,
    clearSegments
  } = useTtsPlayground()
  const [activeSegmentIndex, setActiveSegmentIndex] = React.useState<number | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [ttsText, setTtsText] = React.useState("")

  const { data: ttsSettings } = useQuery({
    queryKey: ["fetchTTSSettings"],
    queryFn: getTTSSettings
  })
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const isOnline = useServerOnline()
  const hasAudio = isOnline && !capsLoading && capabilities?.hasAudio

  const provider = ttsSettings?.ttsProvider || "browser"

  const { data: providersInfo } = useQuery<TldwTtsProvidersInfo | null>({
    queryKey: ["tldw-tts-providers"],
    queryFn: fetchTtsProviders,
    enabled: hasAudio
  })

  const { data: tldwTtsModels } = useQuery<TldwTtsModel[]>({
    queryKey: ["tldw-tts-models"],
    queryFn: fetchTldwTtsModels,
    enabled: hasAudio
  })

  const { data: elevenLabsData } = useQuery({
    queryKey: ["tts-playground-elevenlabs", ttsSettings?.ttsProvider, ttsSettings?.elevenLabsApiKey],
    queryFn: async () => {
      if (ttsSettings?.ttsProvider !== "elevenlabs" || !ttsSettings.elevenLabsApiKey) {
        return null
      }
      try {
        const [voices, models] = await Promise.all([
          getVoices(ttsSettings.elevenLabsApiKey),
          getModels(ttsSettings.elevenLabsApiKey)
        ])
        return { voices, models }
      } catch (e) {
        console.error(e)
        return null
      }
    },
    enabled: ttsSettings?.ttsProvider === "elevenlabs" && !!ttsSettings?.elevenLabsApiKey
  })

  const [elevenVoiceId, setElevenVoiceId] = React.useState<string | undefined>(undefined)
  const [elevenModelId, setElevenModelId] = React.useState<string | undefined>(undefined)
  const [tldwModel, setTldwModel] = React.useState<string | undefined>(undefined)
  const [tldwVoice, setTldwVoice] = React.useState<string | undefined>(undefined)
  const [openAiModel, setOpenAiModel] = React.useState<string | undefined>(undefined)
  const [openAiVoice, setOpenAiVoice] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    if (!ttsSettings) return
    setElevenVoiceId(ttsSettings.elevenLabsVoiceId || undefined)
    setElevenModelId(ttsSettings.elevenLabsModel || undefined)
    setTldwModel(ttsSettings.tldwTtsModel || undefined)
    setTldwVoice(ttsSettings.tldwTtsVoice || undefined)
    setOpenAiModel(ttsSettings.openAITTSModel || undefined)
    setOpenAiVoice(ttsSettings.openAITTSVoice || undefined)
  }, [ttsSettings])

  const handleAudioTimeUpdate = () => {
    const el = audioRef.current
    if (!el) return
    setCurrentTime(el.currentTime || 0)
    setDuration(el.duration || 0)
  }

  const handleSegmentSelect = (idx: number) => {
    setActiveSegmentIndex(idx)
    setCurrentTime(0)
    setDuration(0)
  }

  const isTtsDisabled = ttsSettings?.ttsEnabled === false
  const handlePlay = async () => {
    if (!ttsText.trim() || isTtsDisabled) return
    clearSegments()
    setActiveSegmentIndex(null)
    setCurrentTime(0)
    setDuration(0)

    const effectiveProvider = ttsSettings?.ttsProvider || (await getTTSProvider())
    const created = await generateSegments(ttsText, {
      provider: effectiveProvider,
      elevenLabsModel: elevenModelId,
      elevenLabsVoiceId: elevenVoiceId,
      tldwModel,
      tldwVoice,
      openAiModel,
      openAiVoice
    })

    if (created.length > 0) {
      const nowIso = new Date().toISOString()
      addHistoryItem({
        id: `${nowIso}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        type: "tts",
        text: ttsText,
        provider: effectiveProvider,
        model: tldwModel || openAiModel || elevenModelId,
        voice: tldwVoice || openAiVoice || elevenVoiceId,
        format: created[0]?.format
      })
    }

    if (ttsSettings) {
      void setTTSSettings({
        ttsEnabled: ttsSettings.ttsEnabled,
        ttsProvider: ttsSettings.ttsProvider,
        voice: ttsSettings.voice,
        ssmlEnabled: ttsSettings.ssmlEnabled,
        elevenLabsApiKey: ttsSettings.elevenLabsApiKey,
        elevenLabsVoiceId: elevenVoiceId ?? ttsSettings.elevenLabsVoiceId,
        elevenLabsModel: elevenModelId ?? ttsSettings.elevenLabsModel,
        responseSplitting: ttsSettings.responseSplitting,
        removeReasoningTagTTS: ttsSettings.removeReasoningTagTTS,
        openAITTSBaseUrl: ttsSettings.openAITTSBaseUrl,
        openAITTSApiKey: ttsSettings.openAITTSApiKey,
        openAITTSModel: openAiModel ?? ttsSettings.openAITTSModel,
        openAITTSVoice: openAiVoice ?? ttsSettings.openAITTSVoice,
        ttsAutoPlay: ttsSettings.ttsAutoPlay,
        playbackSpeed: ttsSettings.playbackSpeed,
        tldwTtsModel: tldwModel ?? ttsSettings.tldwTtsModel,
        tldwTtsVoice: tldwVoice ?? ttsSettings.tldwTtsVoice,
        tldwTtsResponseFormat: ttsSettings.tldwTtsResponseFormat,
        tldwTtsSpeed: ttsSettings.tldwTtsSpeed
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["fetchTTSSettings"] })
      })
    }

    setActiveSegmentIndex(0)
  }

  const handleStop = () => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    setCurrentTime(0)
    setDuration(0)
  }

  const providerLabel = React.useMemo(() => {
    const p = ttsSettings?.ttsProvider || "browser"
    if (p === "browser") return "Browser TTS"
    if (p === "elevenlabs") return "ElevenLabs"
    if (p === "openai") return "OpenAI TTS"
    if (p === "tldw") return "tldw server (audio/speech)"
    return p
  }, [ttsSettings?.ttsProvider])

  const isTldw = ttsSettings?.ttsProvider === "tldw"

  const inferredProviderKey = React.useMemo(() => {
    if (!isTldw) return null
    return inferProviderFromModel(tldwModel || ttsSettings?.tldwTtsModel)
  }, [isTldw, tldwModel, ttsSettings?.tldwTtsModel])

  const { data: tldwVoiceCatalog } = useQuery<TldwTtsVoiceInfo[]>({
    queryKey: ["tldw-voice-catalog", inferredProviderKey],
    queryFn: async () => {
      if (!inferredProviderKey) return []
      const voices = await fetchTldwVoiceCatalog(inferredProviderKey)
      return voices.map((v) => ({
        id: v.voice_id || v.id || v.name,
        name: v.name || v.voice_id || v.id,
        language: (v as any)?.language,
        gender: (v as any)?.gender,
        description: v.description,
        preview_url: (v as any)?.preview_url
      })) as TldwTtsVoiceInfo[]
    },
    enabled: hasAudio && isTldw && Boolean(inferredProviderKey)
  })

  const activeProviderCaps = React.useMemo(
    (): { key: string; caps: TldwTtsProviderCapabilities } | null => {
      if (!providersInfo || !inferredProviderKey) return null
      const entries = Object.entries(providersInfo.providers || {})
      const match = entries.find(([k]) => k.toLowerCase() === inferredProviderKey.toLowerCase())
      if (!match) return null
      return { key: match[0], caps: match[1] }
    },
    [providersInfo, inferredProviderKey]
  )

  const activeVoices = React.useMemo((): TldwTtsVoiceInfo[] => {
    if (tldwVoiceCatalog && tldwVoiceCatalog.length > 0) {
      return tldwVoiceCatalog.slice(0, 4)
    }
    if (!providersInfo || !activeProviderCaps) return []
    const allVoices = providersInfo.voices || {}
    const direct = allVoices[activeProviderCaps.key]
    if (Array.isArray(direct) && direct.length > 0) {
      return direct.slice(0, 4)
    }
    const fallbackKey = activeProviderCaps.key.toLowerCase()
    const fallback = allVoices[fallbackKey]
    if (Array.isArray(fallback) && fallback.length > 0) {
      return fallback.slice(0, 4)
    }
    return []
  }, [providersInfo, activeProviderCaps, tldwVoiceCatalog])

  const providerVoices = React.useMemo((): TldwTtsVoiceInfo[] => {
    if (tldwVoiceCatalog && tldwVoiceCatalog.length > 0) {
      return tldwVoiceCatalog
    }
    if (!providersInfo || !activeProviderCaps) return []
    const allVoices = providersInfo.voices || {}
    const direct = allVoices[activeProviderCaps.key]
    if (Array.isArray(direct) && direct.length > 0) {
      return direct
    }
    const fallbackKey = activeProviderCaps.key.toLowerCase()
    const fallback = allVoices[fallbackKey]
    if (Array.isArray(fallback) && fallback.length > 0) {
      return fallback
    }
    return []
  }, [providersInfo, activeProviderCaps, tldwVoiceCatalog])

  const openAiVoiceOptions = React.useMemo(() => {
    if (!openAiModel) {
      const seen = new Set<string>()
      const all: { label: string; value: string }[] = []
      Object.values(OPENAI_TTS_VOICES).forEach((list) => {
        list.forEach((v) => {
          if (!seen.has(v.value)) {
            seen.add(v.value)
            all.push(v)
          }
        })
      })
      return all
    }
    return OPENAI_TTS_VOICES[openAiModel] || []
  }, [openAiModel])

  const playDisabledReason = isTtsDisabled
    ? t("playground:tts.playDisabledTtsOff", "Enable text-to-speech above to play audio.")
    : !ttsText.trim()
      ? t("playground:tts.playDisabledNoText", "Enter text to enable Play.")
      : null
  const isPlayDisabled = isGenerating || Boolean(playDisabledReason)
  const canStop = Boolean(segments.length || audioRef.current)
  const stopDisabledReason =
    !canStop && t("playground:tts.stopDisabled", "Stop activates after audio starts.")

  const downloadBlob = React.useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  const handleCopy = React.useCallback(
    async (text: string) => {
      try {
        await copyToClipboard({ text })
        notification.success({
          message: t("playground:speech.copySuccess", "Copied to clipboard")
        })
      } catch (e: any) {
        notification.error({
          message: t("error", "Error"),
          description:
            e?.message ||
            t("playground:speech.copyError", "Failed to copy transcript.")
        })
      }
    },
    [t]
  )

  const handleDownloadSegment = React.useCallback(
    (segmentIndex?: number) => {
      const idx = typeof segmentIndex === "number" ? segmentIndex : activeSegmentIndex ?? 0
      const seg = segments[idx]
      if (!seg) return
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      const base = `speech-tts-${stamp}-${provider}`
      const filename = `${base}-part-${idx + 1}.${seg.format || "mp3"}`
      downloadBlob(seg.blob, filename)
    },
    [activeSegmentIndex, downloadBlob, provider, segments]
  )

  const handleDownloadAll = React.useCallback(() => {
    segments.forEach((seg, idx) => handleDownloadSegment(idx))
  }, [handleDownloadSegment, segments])

  const downloadMenu = {
    items: [
      {
        key: "download-active",
        label: t("playground:speech.downloadCurrent", "Download current segment"),
        disabled: segments.length === 0 || provider === "browser"
      },
      {
        key: "download-all",
        label: t("playground:speech.downloadAll", "Download all segments"),
        disabled: segments.length <= 1 || provider === "browser"
      }
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "download-active") handleDownloadSegment()
      if (key === "download-all") handleDownloadAll()
    }
  }

  const downloadDisabledReason =
    provider === "browser"
      ? t(
          "playground:speech.downloadDisabledBrowser",
          "Browser TTS does not create downloadable audio."
        )
      : segments.length === 0
        ? t(
            "playground:speech.downloadDisabledEmpty",
            "Generate audio to enable downloads."
          )
        : null

  const handleSendToTts = () => {
    const text = liveText.trim() ? liveText : lastTranscript
    if (!text.trim()) return
    setTtsText(text)
  }

  const historyEmptyState = t(
    "playground:speech.emptyHistory",
    "Start a recording or generate audio to see history here."
  )

  return (
    <PageShell maxWidthClassName="max-w-5xl" className="py-6">
      <Title level={3} className="!mb-1">
        {t("playground:speech.title", "Speech Playground")}
      </Title>
      <Text type="secondary">
        {t(
          "playground:speech.subtitle",
          "Record speech, edit transcripts, and synthesize audio in one place."
        )}
      </Text>

      <div className="mt-4 space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Space direction="vertical" size={2}>
              <Text strong>{t("playground:speech.modeLabel", "Mode")}</Text>
              <Segmented
                value={mode}
                onChange={(value) => setMode(value as SpeechMode)}
                options={[
                  { label: t("playground:speech.modeRoundTrip", "Round-trip"), value: "roundtrip" },
                  { label: t("playground:speech.modeSpeak", "Speak"), value: "speak" },
                  { label: t("playground:speech.modeListen", "Listen"), value: "listen" }
                ]}
              />
            </Space>
            <Text type="secondary" className="text-xs">
              {t(
                "playground:speech.modeHint",
                "Your last mode is remembered for this device."
              )}
            </Text>
          </div>
        </Card>

        <div className={mode === "roundtrip" ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
          {mode !== "listen" && (
            <Card className="h-full">
              <Space direction="vertical" className="w-full" size="middle">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Text strong>
                      {t("playground:stt.currentModelLabel", "Current transcription model")}:
                    </Text>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        showSearch
                        allowClear
                        placeholder={sttModel || "whisper-1"}
                        loading={serverModelsLoading}
                        value={activeModel}
                        onChange={(value) => setActiveModel(value)}
                        style={{ minWidth: 220 }}
                        options={serverModels.map((m) => ({ label: m, value: m }))}
                      />
                      {sttModel && (
                        <Tag bordered>
                          {t("playground:stt.defaultModel", "Default from Settings")}:{" "}
                          <Text code className="ml-1">
                            {sttModel}
                          </Text>
                        </Tag>
                      )}
                    </div>
                    <div className="text-xs text-text-subtle">
                      {t(
                        "playground:stt.settingsNotice",
                        "Language, task, response format, segmentation, and prompt reuse your Speech-to-Text defaults from Settings."
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Text type="secondary" className="block text-xs">
                      {t("playground:stt.sessionMode", "Session mode")}
                    </Text>
                    <div className="flex items-center gap-2">
                      <Switch checked={useLongRunning} onChange={setUseLongRunning} size="small" />
                      <span className="text-xs text-text-muted">
                        {useLongRunning
                          ? t("playground:stt.modeLong", "Long-running (chunked recording)")
                          : t("playground:stt.modeShort", "Short dictation (single clip)")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Tag color="blue" bordered>
                      {t("playground:stt.languageTag", "Language")}:{" "}
                      <Text code className="ml-1">
                        {speechToTextLanguage || "auto"}
                      </Text>
                    </Tag>
                    <Tag bordered>
                      {t("playground:stt.taskTag", "Task")}{" "}
                      <Text code className="ml-1">
                        {sttTask || "transcribe"}
                      </Text>
                    </Tag>
                    <Tag bordered>
                      {t("playground:stt.formatTag", "Format")}{" "}
                      <Text code className="ml-1">
                        {sttResponseFormat || "json"}
                      </Text>
                    </Tag>
                    {sttUseSegmentation && (
                      <Tag color="purple" bordered>
                        {t("playground:stt.segmentationEnabled", "Segmentation enabled")}
                      </Tag>
                    )}
                  </div>
                  <Tooltip
                    placement="left"
                    title={
                      isTranscribing
                        ? (t("playground:stt.transcribingTooltip", "Transcribing audio...") as string)
                        : isRecording
                          ? (t("playground:stt.stopTooltip", "Stop and send to server") as string)
                          : (t(
                              "playground:stt.startTooltip",
                              "Start recording audio for transcription"
                            ) as string)
                    }
                  >
                    <Button
                      type={isRecording || isTranscribing ? "default" : "primary"}
                      danger={isRecording}
                      loading={isTranscribing}
                      disabled={isTranscribing}
                      icon={
                        isRecording ? (
                          <Pause className="h-4 w-4" />
                        ) : !isTranscribing ? (
                          <Mic className="h-4 w-4" />
                        ) : undefined
                      }
                      onClick={handleStartRecording}
                    >
                      {isRecording
                        ? t("playground:stt.stopButton", "Stop")
                        : isTranscribing
                          ? t("playground:stt.transcribingButton", "Transcribing...")
                          : t("playground:stt.recordButton", "Record")}
                    </Button>
                  </Tooltip>
                </div>

                <div className="text-xs text-text-subtle">
                  {t(
                    "playground:tooltip.speechToTextDetails",
                    "Uses {{model}} · {{task}} · {{format}}. Configure in Settings → General → Speech-to-Text.",
                    {
                      model: activeModel || sttModel || "whisper-1",
                      task: sttTask === "translate" ? "translate" : "transcribe",
                      format: (sttResponseFormat || "json").toUpperCase()
                    } as any
                  ) as string}
                </div>

                <WaveformCanvas
                  stream={recordingStream}
                  active={isRecording || isTranscribing}
                  label={t("playground:speech.recordingWaveform", "Live recording waveform") as string}
                />

                {recordingError && (
                  <Text type="danger" className="text-xs">
                    {recordingError}
                  </Text>
                )}

                {(liveText || isRecording || isTranscribing) && (
                  <div className="pt-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Text strong className="text-xs block">
                        {t("playground:stt.currentTranscriptTitle", "Current session transcript")}
                      </Text>
                      <Button
                        size="small"
                        type="text"
                        icon={transcriptLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        onClick={() => setTranscriptLocked((prev) => !prev)}
                        disabled={isRecording || isTranscribing}
                      >
                        {transcriptLocked
                          ? t("playground:speech.transcriptUnlock", "Unlock")
                          : t("playground:speech.transcriptLock", "Lock")}
                      </Button>
                    </div>
                    <Input.TextArea
                      value={liveText}
                      readOnly={!canEditTranscript}
                      onChange={(e) => handleTranscriptChange(e.target.value)}
                      autoSize={{ minRows: 3, maxRows: 8 }}
                      placeholder={t(
                        "playground:stt.currentTranscriptPlaceholder",
                        "Live transcript will appear here while recording."
                      )}
                    />
                    <Text type="secondary" className="text-xs">
                      {isRecording || isTranscribing
                        ? t(
                            "playground:speech.transcriptRecordingHint",
                            "Recording in progress; transcript is locked."
                          )
                        : canEditTranscript
                          ? t(
                              "playground:speech.transcriptEditHint",
                              "Editing enabled for this transcript."
                            )
                          : t(
                              "playground:speech.transcriptLockedHint",
                              "Locked to live transcription updates."
                            )}
                    </Text>
                  </div>
                )}

                {mode === "roundtrip" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="primary"
                      icon={<ArrowRight className="h-4 w-4" />}
                      onClick={handleSendToTts}
                      disabled={!lastTranscript && !liveText}
                    >
                      {t("playground:speech.sendToTts", "Send to TTS")}
                    </Button>
                    <Text type="secondary" className="text-xs">
                      {t(
                        "playground:speech.sendHint",
                        "Use the latest transcript as the TTS draft."
                      )}
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          )}

          {mode !== "speak" && (
            <Card className="h-full">
              <Space direction="vertical" className="w-full" size="middle">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="space-y-1">
                    <Text strong>
                      {t("playground:tts.currentProvider", "Current provider")}: {providerLabel}
                    </Text>
                    <div>
                      <Tooltip
                        title={t(
                          "playground:tts.providerChangeHelper",
                          "Open the provider selector below to switch between Browser, tldw, OpenAI, or Supersonic."
                        ) as string}
                      >
                        <Button
                          size="small"
                          type="link"
                          onClick={() => {
                            const el = document.getElementById("tts-provider-select")
                            if (el) {
                              ;(el as HTMLElement).focus()
                              ;(el as HTMLElement).click()
                            }
                          }}
                        >
                          {t("playground:tts.changeProvider", "Change provider")}
                        </Button>
                      </Tooltip>
                    </div>
                    {isTldw && ttsSettings && (
                      <div className="text-xs text-text-subtle space-y-0.5">
                        <div>
                          <Text strong>Model:</Text>{" "}
                          <Text code>{ttsSettings.tldwTtsModel || "kokoro"}</Text>
                        </div>
                        <div>
                          <Text strong>Voice:</Text>{" "}
                          <Text code>{ttsSettings.tldwTtsVoice || "af_heart"}</Text>
                        </div>
                        <div>
                          <Text strong>Response format:</Text>{" "}
                          <Text code>{ttsSettings.tldwTtsResponseFormat || "mp3"}</Text>
                        </div>
                        <div>
                          <Text strong>Speed:</Text>{" "}
                          <Text code>
                            {ttsSettings.tldwTtsSpeed != null ? ttsSettings.tldwTtsSpeed : 1}
                          </Text>
                        </div>
                        {activeProviderCaps && (
                          <div className="pt-1 flex flex-wrap items-center gap-1">
                            <Text className="mr-1">
                              {t("playground:tts.providerCapabilities", "Provider capabilities")}:
                            </Text>
                            {activeProviderCaps.caps.supports_streaming && (
                              <Tag color="blue" bordered>
                                Streaming
                              </Tag>
                            )}
                            {activeProviderCaps.caps.supports_voice_cloning && (
                              <Tag color="magenta" bordered>
                                Voice cloning
                              </Tag>
                            )}
                            {activeProviderCaps.caps.supports_ssml && (
                              <Tag color="gold" bordered>
                                SSML
                              </Tag>
                            )}
                            {activeProviderCaps.caps.supports_speech_rate && (
                              <Tag color="green" bordered>
                                Speed control
                              </Tag>
                            )}
                            {activeProviderCaps.caps.supports_emotion_control && (
                              <Tag color="purple" bordered>
                                Emotion/style
                              </Tag>
                            )}
                          </div>
                        )}
                        {activeVoices.length > 0 && (
                          <div className="pt-1 text-[11px]">
                            <Text strong>
                              {t("playground:tts.voicesPreview", "Server voices")}:
                            </Text>{" "}
                            {activeVoices.map((v, idx) => (
                              <span key={v.id || v.name || idx}>
                                <Text code>{v.name || v.id}</Text>
                                {v.language && (
                                  <span className="ml-0.5 text-text-subtle">({v.language})</span>
                                )}
                                {idx < activeVoices.length - 1 && <span>, </span>}
                              </span>
                            ))}
                            {providersInfo &&
                              activeProviderCaps &&
                              Array.isArray(providersInfo.voices?.[activeProviderCaps.key]) &&
                              providersInfo.voices[activeProviderCaps.key].length >
                                activeVoices.length && (
                                <span className="ml-1 text-text-subtle">…</span>
                              )}
                          </div>
                        )}
                        {activeProviderCaps && (
                          <div className="pt-1">
                            <Popover
                              placement="right"
                              content={
                                <pre className="max-w-xs max-h-64 overflow-auto text-[11px] leading-snug">
                                  {JSON.stringify(activeProviderCaps.caps, null, 2)}
                                </pre>
                              }
                              title={t(
                                "playground:tts.providerDetailsTitle",
                                "Provider details"
                              )}
                            >
                              <Button size="small" type="link">
                                {t("playground:tts.providerDetails", "View raw provider config")}
                              </Button>
                            </Popover>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isTldw && (
                    <Text type="secondary" className="text-xs">
                      {hasAudio
                        ? t(
                            "playground:tts.tldwStatusOnline",
                            "tldw server audio API detected (audio/speech)"
                          )
                        : t(
                            "playground:tts.tldwStatusOffline",
                            "Audio API not detected; check your tldw server version."
                          )}
                    </Text>
                  )}
                </div>

                <Divider className="!my-2" />

                <div>
                  <Paragraph className="!mb-1">
                    {t(
                      "playground:tts.settingsIntro",
                      "Adjust your TTS provider, model, and voice. These settings are reused when you play audio from chat or media."
                    )}
                  </Paragraph>
                  {provider === "browser" && (
                    <Text type="secondary" className="text-xs block">
                      {t(
                        "playground:tts.browserInfoDescription",
                        "Browser TTS plays using your system synthesizer and does not expose an audio file. Use another provider to choose voices and see segments."
                      )}
                    </Text>
                  )}
                  <TTSModeSettings hideBorder />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Paragraph className="!mb-2 !mr-2">
                      {t("playground:tts.inputLabel", "Enter some text to hear it spoken.")}
                    </Paragraph>
                    <Button
                      size="small"
                      onClick={() => setTtsText(SAMPLE_TEXT)}
                      aria-label={t("playground:tts.sampleText", "Insert sample text") as string}
                    >
                      {t("playground:tts.sampleText", "Insert sample text")}
                    </Button>
                  </div>
                  <Input.TextArea
                    aria-label={t("playground:tts.inputLabel", "Enter some text to hear it spoken.") as string}
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    autoSize={{ minRows: 4, maxRows: 10 }}
                    placeholder={t(
                      "playground:tts.inputPlaceholder",
                      "Type or paste text here, then use Play to listen."
                    ) as string}
                  />
                </div>

                {ttsSettings?.ttsProvider === "elevenlabs" && elevenLabsData && (
                  <div className="flex flex-col gap-2">
                    <Text type="secondary">
                      {t(
                        "playground:tts.voiceSelector.elevenLabs",
                        "Choose an ElevenLabs voice and model for this run."
                      )}
                    </Text>
                    <Space className="flex flex-wrap" size="middle">
                      <div>
                        <label
                          className="block text-xs mb-1 text-text"
                          htmlFor="speech-eleven-voice"
                        >
                          Voice
                        </label>
                        <Select
                          id="speech-eleven-voice"
                          aria-label="ElevenLabs voice"
                          style={{ minWidth: 160 }}
                          placeholder="Select voice"
                          className="focus-ring"
                          options={elevenLabsData.voices.map((v: any) => ({
                            label: v.name,
                            value: v.voice_id
                          }))}
                          value={elevenVoiceId}
                          onChange={(val) => setElevenVoiceId(val)}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs mb-1 text-text"
                          htmlFor="speech-eleven-model"
                        >
                          Model
                        </label>
                        <Select
                          id="speech-eleven-model"
                          aria-label="ElevenLabs model"
                          style={{ minWidth: 160 }}
                          placeholder="Select model"
                          className="focus-ring"
                          options={elevenLabsData.models.map((m: any) => ({
                            label: m.name,
                            value: m.model_id
                          }))}
                          value={elevenModelId}
                          onChange={(val) => setElevenModelId(val)}
                        />
                      </div>
                    </Space>
                  </div>
                )}

                {isTldw && providerVoices.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Text type="secondary">
                      {t(
                        "playground:tts.voiceSelector.tldw",
                        "Choose a server voice and model for this run."
                      )}
                    </Text>
                    <Space className="flex flex-wrap" size="middle">
                      <div>
                        <label
                          className="block text-xs mb-1 text-text"
                          htmlFor="speech-tldw-voice"
                        >
                          Voice
                        </label>
                        <Select
                          id="speech-tldw-voice"
                          aria-label="tldw server voice"
                          style={{ minWidth: 200 }}
                          placeholder="Select voice"
                          className="focus-ring"
                          options={providerVoices.map((v, idx) => ({
                            label: `${v.name || v.id || `Voice ${idx + 1}`}${
                              v.language ? ` (${v.language})` : ""
                            }`,
                            value: v.id || v.name || ""
                          }))}
                          value={tldwVoice}
                          onChange={(val) => setTldwVoice(val)}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs mb-1 text-text"
                          htmlFor="speech-tldw-model"
                        >
                          Model
                        </label>
                        {tldwTtsModels && tldwTtsModels.length > 0 ? (
                          <Select
                            id="speech-tldw-model"
                            aria-label="tldw server model"
                            style={{ minWidth: 160 }}
                            placeholder="Select model"
                            showSearch
                            optionFilterProp="label"
                            className="focus-ring"
                            options={tldwTtsModels.map((m) => ({
                              label: m.label,
                              value: m.id
                            }))}
                            value={tldwModel}
                            onChange={(val) => setTldwModel(val)}
                          />
                        ) : (
                          <Input
                            aria-label="tldw server model"
                            style={{ minWidth: 160 }}
                            value={tldwModel || ""}
                            onChange={(e) => setTldwModel(e.target.value)}
                            placeholder="kokoro"
                          />
                        )}
                      </div>
                    </Space>
                  </div>
                )}

                {ttsSettings?.ttsProvider === "openai" && (
                  <div className="flex flex-col gap-2">
                    <Text type="secondary">
                      {t(
                        "playground:tts.voiceSelector.openai",
                        "Choose an OpenAI TTS model and voice for this run."
                      )}
                    </Text>
                    <Space className="flex flex-wrap" size="middle">
                      <div>
                        <label
                          className="block text-xs mb-1 text-text"
                          htmlFor="speech-openai-model"
                        >
                          Model
                        </label>
                        <Select
                          id="speech-openai-model"
                          aria-label="OpenAI TTS model"
                          style={{ minWidth: 160 }}
                          placeholder="Select model"
                          className="focus-ring"
                          options={OPENAI_TTS_MODELS}
                          value={openAiModel}
                          onChange={(val) => {
                            setOpenAiModel(val)
                            const voicesForModel = OPENAI_TTS_VOICES[val] || openAiVoiceOptions
                            if (
                              voicesForModel.length > 0 &&
                              !voicesForModel.find((v) => v.value === openAiVoice)
                            ) {
                              setOpenAiVoice(voicesForModel[0].value)
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs mb-1 text-text"
                          htmlFor="speech-openai-voice"
                        >
                          Voice
                        </label>
                        <Select
                          id="speech-openai-voice"
                          aria-label="OpenAI TTS voice"
                          style={{ minWidth: 160 }}
                          placeholder="Select voice"
                          className="focus-ring"
                          options={openAiVoiceOptions}
                          value={openAiVoice}
                          onChange={(val) => setOpenAiVoice(val)}
                        />
                      </div>
                    </Space>
                  </div>
                )}

                <Space>
                  <Button
                    type="primary"
                    onClick={handlePlay}
                    disabled={isPlayDisabled}
                    loading={isGenerating}
                  >
                    {isGenerating
                      ? t("playground:tts.playing", "Playing…")
                      : t("playground:tts.play", "Play")}
                  </Button>
                  <Button onClick={handleStop} disabled={!canStop}>
                    {t("playground:tts.stop", "Stop")}
                  </Button>
                  <Tooltip
                    title={downloadDisabledReason as string}
                    open={Boolean(downloadDisabledReason) ? undefined : false}
                  >
                    <span>
                      <Dropdown menu={downloadMenu} disabled={Boolean(downloadDisabledReason)}>
                        <Button
                          icon={<Download className="h-4 w-4" />}
                          disabled={Boolean(downloadDisabledReason)}
                        >
                          {t("playground:speech.download", "Download")}
                        </Button>
                      </Dropdown>
                    </span>
                  </Tooltip>
                </Space>
                <Text type="secondary" className="text-xs">
                  {playDisabledReason ||
                    t("playground:tts.playHelper", "Play uses your selected provider, voice, and speed.")}
                  {!canStop && stopDisabledReason ? ` ${stopDisabledReason}` : ""}
                </Text>

                {segments.length > 0 && (
                  <div className="mt-2 space-y-2 w-full">
                    <div>
                      <Text strong>{t("playground:tts.outputTitle", "Generated audio segments")}</Text>
                      <Paragraph className="!mb-1 text-xs text-text-subtle">
                        {t(
                          "playground:tts.outputHelp",
                          "Select a segment, then use the player controls to play, pause, or seek."
                        )}
                      </Paragraph>
                    </div>
                    <div className="border border-border rounded-md p-3 space-y-2">
                      <audio
                        ref={audioRef}
                        controls
                        className="w-full"
                        src={
                          activeSegmentIndex != null
                            ? segments[activeSegmentIndex]?.url
                            : segments[0]?.url
                        }
                        onTimeUpdate={handleAudioTimeUpdate}
                      />
                      <WaveformCanvas
                        audioRef={audioRef}
                        active={Boolean(segments.length)}
                        label={t("playground:speech.playbackWaveform", "Playback waveform") as string}
                      />
                      <div className="flex items-center justify-between text-xs text-text-subtle">
                        <span>
                          {activeSegmentIndex != null
                            ? t("playground:tts.currentSegment", "Segment") +
                              ` ${activeSegmentIndex + 1}/${segments.length}`
                            : t("playground:tts.currentSegmentNone", "No segment selected")}
                        </span>
                        {duration > 0 && (
                          <span>
                            {t("playground:tts.timeLabel", "Time")}: {Math.floor(currentTime)}s /{" "}
                            {Math.floor(duration)}s
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {segments.map((seg, idx) => (
                          <Button
                            key={seg.id}
                            size="small"
                            type={
                              idx === (activeSegmentIndex != null ? activeSegmentIndex : 0)
                                ? "primary"
                                : "default"
                            }
                            onClick={() => handleSegmentSelect(idx)}
                          >
                            {t("playground:tts.segmentLabel", "Part")} {idx + 1}
                          </Button>
                        ))}
                      </div>
                      <Text type="secondary" className="text-xs">
                        {t("playground:speech.segmentFormat", "Format")}:{" "}
                        {(segments[0]?.format || "mp3").toUpperCase()}
                      </Text>
                    </div>
                  </div>
                )}

                {isTldw && !hasAudio && (
                  <Alert
                    type="warning"
                    showIcon
                    message={t(
                      "playground:tts.tldwWarningTitle",
                      "tldw audio/speech API not detected"
                    )}
                    description={t(
                      "playground:tts.tldwWarningBody",
                      "Ensure your tldw_server version includes /api/v1/audio/speech and that your extension is connected with a valid API key."
                    )}
                  />
                )}
              </Space>
            </Card>
          )}
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text strong>{t("playground:speech.historyTitle", "Speech history")}</Text>
            <Space size="small" className="flex flex-wrap">
              <Select
                size="small"
                value={historyFilter}
                onChange={(value) => setHistoryFilter(value)}
                options={[
                  { label: t("playground:speech.historyAll", "All"), value: "all" },
                  { label: t("playground:speech.historyStt", "STT"), value: "stt" },
                  { label: t("playground:speech.historyTts", "TTS"), value: "tts" }
                ]}
              />
              <Input
                size="small"
                placeholder={t("playground:speech.historySearch", "Search transcripts")}
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                style={{ width: 200 }}
              />
              {filteredHistory.length > 0 && (
                <Button size="small" type="text" icon={<Trash2 className="h-3 w-3" />} onClick={clearHistory}>
                  {t("playground:stt.clearAll", "Clear all")}
                </Button>
              )}
            </Space>
          </div>
          <Text type="secondary" className="text-xs">
            {t(
              "playground:speech.historyRetentionHint",
              "Keeps the most recent {{count}} items. Use Clear all to remove everything.",
              { count: MAX_HISTORY_ITEMS }
            )}
          </Text>

          {filteredHistory.length === 0 ? (
            <Text type="secondary" className="text-xs">
              {historyEmptyState}
            </Text>
          ) : (
            <List
              itemLayout="vertical"
              dataSource={filteredHistory}
              renderItem={(item) => {
                const actions: React.ReactNode[] = []
                if (item.type === "stt") {
                  actions.push(
                    <Button
                      key="save"
                      size="small"
                      icon={<Save className="h-3 w-3" />}
                      onClick={() => handleSaveToNotes(item)}
                    >
                      {t("playground:stt.saveToNotes", "Save to Notes")}
                    </Button>
                  )
                }
                actions.push(
                  <Button
                    key="use"
                    size="small"
                    onClick={() => setTtsText(item.text)}
                  >
                    {t("playground:speech.useInTts", "Use in TTS")}
                  </Button>
                )
                actions.push(
                  <Button
                    key="copy"
                    size="small"
                    icon={<Copy className="h-3 w-3" />}
                    onClick={() => handleCopy(item.text)}
                  >
                    {t("playground:speech.copy", "Copy")}
                  </Button>
                )
                actions.push(
                  <Button
                    key="delete"
                    size="small"
                    type="text"
                    icon={<Trash2 className="h-3 w-3" />}
                    onClick={() => removeHistoryItem(item.id)}
                  >
                    {t("playground:stt.delete", "Delete")}
                  </Button>
                )

                return (
                  <List.Item key={item.id} actions={actions}>
                    <List.Item.Meta
                      title={
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag color={item.type === "stt" ? "blue" : "gold"} bordered>
                            {item.type.toUpperCase()}
                          </Tag>
                          <Text>{formatHistoryDate(item.createdAt)}</Text>
                          {item.durationMs != null && (
                            <Tag bordered>
                              {t("playground:stt.durationTag", "Duration")}:{" "}
                              <Text code className="ml-1">
                                {(item.durationMs / 1000).toFixed(1)}s
                              </Text>
                            </Tag>
                          )}
                          {item.model && (
                            <Tag bordered>
                              {t("playground:stt.modelTag", "Model")}{" "}
                              <Text code className="ml-1">
                                {item.model}
                              </Text>
                            </Tag>
                          )}
                          {item.provider && (
                            <Tag bordered>
                              {t("playground:speech.providerTag", "Provider")}{" "}
                              <Text code className="ml-1">
                                {item.provider}
                              </Text>
                            </Tag>
                          )}
                          {item.voice && (
                            <Tag bordered>
                              {t("playground:speech.voiceTag", "Voice")}{" "}
                              <Text code className="ml-1">
                                {item.voice}
                              </Text>
                            </Tag>
                          )}
                        </div>
                      }
                      description={
                        item.language ? (
                          <Text type="secondary" className="text-xs">
                            {t("playground:stt.languageTag", "Language")}: {item.language}
                          </Text>
                        ) : null
                      }
                    />
                    <Input.TextArea
                      value={item.text}
                      autoSize={{ minRows: 3, maxRows: 8 }}
                      readOnly
                    />
                  </List.Item>
                )
              }}
            />
          )}
        </Card>
      </div>
    </PageShell>
  )
}

export default SpeechPlaygroundPage
