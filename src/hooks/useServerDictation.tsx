import React from "react"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { SttSettings } from "@/hooks/useSttSettings"
import { useAntdNotification } from "@/hooks/useAntdNotification"

export interface UseServerDictationOptions {
  canUseServerAudio: boolean
  speechToTextLanguage: string
  sttSettings: SttSettings
  onTranscript: (text: string) => void
}

export interface UseServerDictationResult {
  isServerDictating: boolean
  startServerDictation: () => Promise<void>
  stopServerDictation: () => void
}

export const useServerDictation = (
  options: UseServerDictationOptions
): UseServerDictationResult => {
  const { t } = useTranslation(["playground"])
  const notification = useAntdNotification()
  const { canUseServerAudio, speechToTextLanguage, sttSettings, onTranscript } =
    options

  const serverRecorderRef = React.useRef<MediaRecorder | null>(null)
  const serverChunksRef = React.useRef<BlobPart[]>([])
  const [isServerDictating, setIsServerDictating] = React.useState(false)

  const stopServerDictation = React.useCallback(() => {
    const rec = serverRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
  }, [])

  const startServerDictation = React.useCallback(async () => {
    if (isServerDictating) {
      stopServerDictation()
      return
    }

    if (!canUseServerAudio) {
      notification.error({
        message: t(
          "playground:actions.speechUnavailableTitle",
          "Dictation unavailable"
        ),
        description: t(
          "playground:actions.speechUnavailableBody",
          "Connect to a tldw server that exposes the audio transcriptions API to use dictation."
        )
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      serverChunksRef.current = []

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          serverChunksRef.current.push(ev.data)
        }
      }

      recorder.onerror = (event: Event) => {
        console.error("MediaRecorder error", event)
        notification.error({
          message: t("playground:actions.speechErrorTitle", "Dictation failed"),
          description: t(
            "playground:actions.speechErrorBody",
            "Microphone recording error. Check your permissions and try again."
          )
        })
        setIsServerDictating(false)
      }

      recorder.onstop = async () => {
        try {
          const blob = new Blob(serverChunksRef.current, {
            type: recorder.mimeType || "audio/webm"
          })
          if (blob.size === 0) {
            return
          }

          // Build STT options from settings
          const sttOptions: Record<string, any> = {
            language: speechToTextLanguage
          }
          if (sttSettings.model && sttSettings.model.trim().length > 0) {
            sttOptions.model = sttSettings.model.trim()
          }
          if (sttSettings.timestampGranularities) {
            sttOptions.timestamp_granularities = sttSettings.timestampGranularities
          }
          if (sttSettings.prompt && sttSettings.prompt.trim().length > 0) {
            sttOptions.prompt = sttSettings.prompt.trim()
          }
          if (sttSettings.task) {
            sttOptions.task = sttSettings.task
          }
          if (sttSettings.responseFormat) {
            sttOptions.response_format = sttSettings.responseFormat
          }
          if (typeof sttSettings.temperature === "number") {
            sttOptions.temperature = sttSettings.temperature
          }
          if (sttSettings.useSegmentation) {
            sttOptions.segment = true
            if (typeof sttSettings.segK === "number") {
              sttOptions.seg_K = sttSettings.segK
            }
            if (typeof sttSettings.segMinSegmentSize === "number") {
              sttOptions.seg_min_segment_size = sttSettings.segMinSegmentSize
            }
            if (typeof sttSettings.segLambdaBalance === "number") {
              sttOptions.seg_lambda_balance = sttSettings.segLambdaBalance
            }
            if (typeof sttSettings.segUtteranceExpansionWidth === "number") {
              sttOptions.seg_utterance_expansion_width =
                sttSettings.segUtteranceExpansionWidth
            }
            if (sttSettings.segEmbeddingsProvider?.trim()) {
              sttOptions.seg_embeddings_provider =
                sttSettings.segEmbeddingsProvider.trim()
            }
            if (sttSettings.segEmbeddingsModel?.trim()) {
              sttOptions.seg_embeddings_model = sttSettings.segEmbeddingsModel.trim()
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

          if (text) {
            onTranscript(text)
          } else {
            notification.error({
              message: t(
                "playground:actions.speechErrorTitle",
                "Dictation failed"
              ),
              description: t(
                "playground:actions.speechNoText",
                "The transcription did not return any text."
              )
            })
          }
        } catch (e: any) {
          notification.error({
            message: t(
              "playground:actions.speechErrorTitle",
              "Dictation failed"
            ),
            description:
              e?.message ||
              t(
                "playground:actions.speechErrorBody",
                "Transcription request failed. Check tldw server health."
              )
          })
        } finally {
          try {
            stream.getTracks().forEach((trk) => trk.stop())
          } catch {}
          serverRecorderRef.current = null
          setIsServerDictating(false)
        }
      }

      serverRecorderRef.current = recorder
      recorder.start()
      setIsServerDictating(true)
    } catch (e: any) {
      // Add permissions guidance for microphone errors
      const isChromeOrEdge =
        typeof chrome !== "undefined" && chrome.permissions
      notification.error({
        message: t("playground:actions.speechErrorTitle", "Dictation failed"),
        description: (
          <div>
            <p className="mb-2">
              {t(
                "playground:actions.speechMicError",
                "Unable to access your microphone. Check browser permissions and try again."
              )}
            </p>
            {isChromeOrEdge && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {t(
                  "playground:actions.micPermissionsHint",
                  "Check Site Settings > Microphone in your browser"
                )}
              </span>
            )}
          </div>
        )
      })
    }
  }, [
    canUseServerAudio,
    isServerDictating,
    speechToTextLanguage,
    sttSettings,
    stopServerDictation,
    onTranscript,
    t
  ])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopServerDictation()
    }
  }, [stopServerDictation])

  return {
    isServerDictating,
    startServerDictation,
    stopServerDictation
  }
}
