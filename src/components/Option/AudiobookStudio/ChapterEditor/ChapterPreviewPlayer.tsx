import React, { useState, useRef, useCallback } from "react"
import { Button, Spin, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { Play, Square, Loader2 } from "lucide-react"
import {
  resolveTtsProviderContext,
  type TtsProviderOverrides
} from "@/services/tts-provider"

type ChapterPreviewPlayerProps = {
  content: string
  voiceConfig: TtsProviderOverrides
  maxWords?: number
}

export const ChapterPreviewPlayer: React.FC<ChapterPreviewPlayerProps> = ({
  content,
  voiceConfig,
  maxWords = 50
}) => {
  const { t } = useTranslation(["audiobook"])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  // Get preview text (first N words)
  const previewText = React.useMemo(() => {
    const words = content.trim().split(/\s+/)
    if (words.length <= maxWords) return content.trim()
    return words.slice(0, maxWords).join(" ") + "..."
  }, [content, maxWords])

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const handleStop = useCallback(() => {
    cleanup()
    setIsPlaying(false)
    setIsLoading(false)
  }, [cleanup])

  const handlePlay = useCallback(async () => {
    if (isPlaying) {
      handleStop()
      return
    }

    setIsLoading(true)

    try {
      const context = await resolveTtsProviderContext(previewText, voiceConfig)

      if (!context.supported) {
        throw new Error(`TTS provider "${context.provider}" is not supported`)
      }

      // Browser TTS - play directly
      if (context.provider === "browser") {
        const utterance = new SpeechSynthesisUtterance(previewText)
        if (voiceConfig.speed) {
          utterance.rate = voiceConfig.speed
        }
        utterance.onend = () => setIsPlaying(false)
        utterance.onerror = () => setIsPlaying(false)
        window.speechSynthesis.speak(utterance)
        setIsLoading(false)
        setIsPlaying(true)
        return
      }

      // Other providers - synthesize and play
      if (!context.synthesize) {
        throw new Error("TTS synthesis function not available")
      }

      const result = await context.synthesize(context.utterance)
      const blob = new Blob([result.buffer], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      urlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlaying(false)
        cleanup()
      }
      audio.onerror = () => {
        setIsPlaying(false)
        cleanup()
      }

      await audio.play()
      setIsLoading(false)
      setIsPlaying(true)
    } catch (error) {
      console.error("Preview playback failed:", error)
      setIsLoading(false)
      setIsPlaying(false)
      cleanup()
    }
  }, [isPlaying, previewText, voiceConfig, handleStop, cleanup])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanup()
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }
    }
  }, [cleanup])

  if (!previewText) return null

  return (
    <Tooltip
      title={
        isPlaying
          ? t("audiobook:preview.stop", "Stop preview")
          : t("audiobook:preview.play", "Preview first {{count}} words", { count: maxWords })
      }
    >
      <Button
        size="small"
        type="text"
        onClick={handlePlay}
        disabled={isLoading}
        icon={
          isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isPlaying ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )
        }
      >
        {t("audiobook:preview.button", "Preview")}
      </Button>
    </Tooltip>
  )
}

export default ChapterPreviewPlayer
