import { useEffect, useState } from "react"
import { getVoice } from "@/services/tts"
import { splitMessageContent } from "@/utils/tts"
import { resolveTtsProviderContext } from "@/services/tts-provider"
import { useAntdNotification } from "./useAntdNotification"
import { useTranslation } from "react-i18next"
import { isChromiumTarget } from "@/config/platform"

export interface VoiceOptions {
  utterance: string
}

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  )
  const notification = useAntdNotification()
  const { t } = useTranslation("playground")

  const speak = async ({ utterance }: VoiceOptions) => {
    try {
      const context = await resolveTtsProviderContext(utterance)
      const {
        provider,
        utterance: processedUtterance,
        playbackSpeed,
        synthesize,
        supported
      } = context

      if (!supported) {
        throw new Error(`Unsupported TTS provider: ${provider}`)
      }

      if (provider === "browser") {
        const voice = await getVoice()
        if (isChromiumTarget) {
          chrome.tts.speak(processedUtterance, {
            voiceName: voice,
            rate: playbackSpeed,
            onEvent(event) {
              if (event.type === "start") {
                setIsSpeaking(true)
              } else if (event.type === "end") {
                setIsSpeaking(false)
              }
            }
          })
        } else {
          const synthesisUtterance = new SpeechSynthesisUtterance(processedUtterance)
          synthesisUtterance.rate = playbackSpeed
          synthesisUtterance.onstart = () => {
            setIsSpeaking(true)
          }
          synthesisUtterance.onend = () => {
            setIsSpeaking(false)
          }
          const voices = window.speechSynthesis.getVoices()
          const selectedVoice = voices.find((v) => v.name === voice)
          if (selectedVoice) {
            synthesisUtterance.voice = selectedVoice
          } else {
            window.speechSynthesis.onvoiceschanged = () => {
              const updatedVoices = window.speechSynthesis.getVoices()
              const newVoice = updatedVoices.find((v) => v.name === voice)
              if (newVoice) {
                synthesisUtterance.voice = newVoice
              }
            }
          }
          window.speechSynthesis.speak(synthesisUtterance)
        }
        return
      }

      if (!synthesize) {
        throw new Error(`Unsupported TTS provider: ${provider}`)
      }

      const synthesizeSegment = synthesize
      type AudioResult = Awaited<ReturnType<typeof synthesizeSegment>>
      const sentences = splitMessageContent(processedUtterance)
      let nextAudioData: AudioResult | null = null
      let nextAudioPromise: Promise<AudioResult> | null = null

      for (let i = 0; i < sentences.length; i++) {
        setIsSpeaking(true)

        let currentAudioData: AudioResult
        if (nextAudioData) {
          currentAudioData = nextAudioData
          nextAudioData = null
        } else {
          currentAudioData = await synthesizeSegment(sentences[i])
        }

        if (i < sentences.length - 1) {
          nextAudioPromise = synthesizeSegment(sentences[i + 1])
        }

        const blob = new Blob([currentAudioData.buffer], {
          type: currentAudioData.mimeType
        })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.playbackRate = playbackSpeed
        setAudioElement(audio)

        await Promise.all([
          new Promise((resolve) => {
            audio.onended = resolve
            audio.play()
          }),
          nextAudioPromise
            ?.then((data) => {
              nextAudioData = data
            })
            .catch(console.error) || Promise.resolve()
        ])

        URL.revokeObjectURL(url)
      }

      setIsSpeaking(false)
      setAudioElement(null)
    } catch (error) {
      setIsSpeaking(false)
      setAudioElement(null)
      notification.error({
        message: t("tts.playErrorTitle", "Error"),
        description: t(
          "tts.playErrorDescription",
          "Something went wrong while trying to play the audio"
        )
      })
    }
  }

  const cancel = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      setAudioElement(null)
      setIsSpeaking(false)
      return
    }

    if (
      isChromiumTarget
    ) {
      chrome.tts.stop()
    } else {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }

  useEffect(() => {
    return () => {
      cancel()
    }
  }, [])

  return {
    speak,
    cancel,
    isSpeaking
  }
}
