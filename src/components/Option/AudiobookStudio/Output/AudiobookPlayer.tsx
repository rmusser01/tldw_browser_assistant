import React, { useState, useRef, useEffect, useCallback } from "react"
import { Card, Typography, Button, Space, Slider, List, Progress } from "antd"
import { useTranslation } from "react-i18next"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Headphones
} from "lucide-react"
import type { ChapterTiming } from "@/utils/audio-concat"

const { Text, Title } = Typography

type AudiobookPlayerProps = {
  audioUrl: string | null
  chapterTimings: ChapterTiming[]
  onClose?: () => void
}

export const AudiobookPlayer: React.FC<AudiobookPlayerProps> = ({
  audioUrl,
  chapterTimings,
  onClose
}) => {
  const { t } = useTranslation(["audiobook"])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)

  // Initialize audio element
  useEffect(() => {
    if (!audioUrl) return

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration)
    })

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime)
    })

    audio.addEventListener("ended", () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })

    audio.addEventListener("error", () => {
      setIsPlaying(false)
    })

    return () => {
      audio.pause()
      audio.src = ""
      audioRef.current = null
    }
  }, [audioUrl])

  // Update current chapter based on playback time
  useEffect(() => {
    if (chapterTimings.length === 0) return

    const chapter = chapterTimings.findIndex(
      (ch) => currentTime >= ch.startTime && currentTime < ch.endTime
    )

    if (chapter !== -1 && chapter !== currentChapterIndex) {
      setCurrentChapterIndex(chapter)
    }
  }, [currentTime, chapterTimings, currentChapterIndex])

  // Update volume on audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback((value: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = value
    setCurrentTime(value)
  }, [])

  const seekToChapter = useCallback((index: number) => {
    if (!audioRef.current || !chapterTimings[index]) return
    const chapter = chapterTimings[index]
    audioRef.current.currentTime = chapter.startTime
    setCurrentTime(chapter.startTime)
    setCurrentChapterIndex(index)
  }, [chapterTimings])

  const skipPrevious = useCallback(() => {
    if (currentChapterIndex > 0) {
      seekToChapter(currentChapterIndex - 1)
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
    }
  }, [currentChapterIndex, seekToChapter])

  const skipNext = useCallback(() => {
    if (currentChapterIndex < chapterTimings.length - 1) {
      seekToChapter(currentChapterIndex + 1)
    }
  }, [currentChapterIndex, chapterTimings.length, seekToChapter])

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted)
  }, [isMuted])

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!audioUrl) {
    return (
      <Card>
        <div className="text-center py-8 text-text-muted">
          <Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <Text type="secondary">
            {t("audiobook:player.noAudio", "No combined audiobook available. Generate and combine chapters first.")}
          </Text>
        </div>
      </Card>
    )
  }

  const currentChapter = chapterTimings[currentChapterIndex]

  return (
    <Card className="audiobook-player">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Headphones className="h-5 w-5 text-primary" />
          <Title level={5} className="!mb-0">
            {t("audiobook:player.title", "Audiobook Player")}
          </Title>
        </div>

        {/* Current chapter info */}
        {currentChapter && (
          <div className="bg-surface-elevated rounded-lg p-3">
            <Text type="secondary" className="text-xs block mb-1">
              {t("audiobook:player.nowPlaying", "Now playing")}
            </Text>
            <Text strong className="block">
              {t("audiobook:player.chapter", "Chapter {{num}}", { num: currentChapterIndex + 1 })}: {currentChapter.title}
            </Text>
          </div>
        )}

        {/* Progress bar with chapter markers */}
        <div className="space-y-2">
          <div className="relative">
            <Slider
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              tooltip={{ formatter: (v) => formatTime(v || 0) }}
              className="w-full"
            />
            {/* Chapter markers */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none">
              {chapterTimings.map((chapter, index) => {
                if (index === 0) return null
                const position = (chapter.startTime / duration) * 100
                return (
                  <div
                    key={chapter.id}
                    className="absolute w-0.5 h-3 bg-primary/50 -translate-x-1/2"
                    style={{ left: `${position}%` }}
                    title={chapter.title}
                  />
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            icon={<SkipBack className="h-4 w-4" />}
            onClick={skipPrevious}
            disabled={currentChapterIndex === 0 && currentTime < 1}
          />
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            onClick={togglePlay}
          />
          <Button
            icon={<SkipForward className="h-4 w-4" />}
            onClick={skipNext}
            disabled={currentChapterIndex >= chapterTimings.length - 1}
          />

          {/* Volume control */}
          <div className="ml-4 flex items-center gap-2">
            <Button
              type="text"
              size="small"
              icon={isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              onClick={toggleMute}
            />
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={isMuted ? 0 : volume}
              onChange={setVolume}
              style={{ width: 80 }}
              tooltip={{ formatter: (v) => `${Math.round((v || 0) * 100)}%` }}
            />
          </div>
        </div>

        {/* Chapter list */}
        {chapterTimings.length > 0 && (
          <div className="border-t border-border pt-4 mt-4">
            <Text strong className="block mb-2">
              {t("audiobook:player.chapters", "Chapters")}
            </Text>
            <div className="max-h-48 overflow-y-auto">
              <List
                size="small"
                dataSource={chapterTimings}
                renderItem={(chapter, index) => (
                  <List.Item
                    className={`cursor-pointer hover:bg-surface-elevated rounded px-2 ${
                      index === currentChapterIndex ? "bg-primary/10" : ""
                    }`}
                    onClick={() => seekToChapter(index)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Text type="secondary" className="text-xs w-6">
                          {index + 1}.
                        </Text>
                        <Text className={index === currentChapterIndex ? "text-primary font-medium" : ""}>
                          {chapter.title}
                        </Text>
                      </div>
                      <Text type="secondary" className="text-xs">
                        {formatTime(chapter.startTime)}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default AudiobookPlayer
