import React from "react"
import {
  Card,
  Typography,
  Button,
  Space,
  Empty,
  Table,
  Tag,
  Tooltip
} from "antd"
import { useTranslation } from "react-i18next"
import {
  Download,
  Play,
  Pause,
  Check,
  Clock,
  AlertCircle,
  FileAudio
} from "lucide-react"
import { useAudiobookStudioStore, type AudioChapter } from "@/store/audiobook-studio"
import { useAudiobookGeneration } from "@/hooks/useAudiobookGeneration"

const { Text, Title } = Typography

export const OutputPanel: React.FC = () => {
  const { t } = useTranslation(["audiobook", "common"])
  const [playingId, setPlayingId] = React.useState<string | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const chapters = useAudiobookStudioStore((s) => s.chapters)
  const projectTitle = useAudiobookStudioStore((s) => s.projectTitle)
  const getTotalDuration = useAudiobookStudioStore((s) => s.getTotalDuration)

  const { downloadChapter, downloadAllChapters } = useAudiobookGeneration()

  const completedChapters = chapters.filter(
    (ch) => ch.status === "completed" && ch.audioBlob
  )
  const totalDuration = getTotalDuration()

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handlePlay = (chapter: AudioChapter) => {
    if (!chapter.audioUrl) return

    if (playingId === chapter.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setPlayingId(null)
      return
    }

    // Start playing new chapter
    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(chapter.audioUrl)
    audioRef.current = audio
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audio.play()
    setPlayingId(chapter.id)
  }

  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const getStatusIcon = (status: AudioChapter["status"]) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4 text-green-500" />
      case "generating":
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const columns = [
    {
      title: "#",
      dataIndex: "order",
      key: "order",
      width: 50,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: t("audiobook:output.title", "Title"),
      dataIndex: "title",
      key: "title",
      render: (title: string, record: AudioChapter) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(record.status)}
          <Text>{title}</Text>
        </div>
      )
    },
    {
      title: t("audiobook:output.duration", "Duration"),
      dataIndex: "audioDuration",
      key: "duration",
      width: 100,
      render: (duration: number | undefined) =>
        duration ? formatDuration(duration) : "-"
    },
    {
      title: t("audiobook:output.status", "Status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: AudioChapter["status"]) => {
        const colors: Record<string, string> = {
          completed: "success",
          generating: "processing",
          error: "error",
          pending: "default"
        }
        const labels: Record<string, string> = {
          completed: t("audiobook:status.completed", "Completed"),
          generating: t("audiobook:status.generating", "Generating"),
          error: t("audiobook:status.error", "Error"),
          pending: t("audiobook:status.pending", "Pending")
        }
        return <Tag color={colors[status]}>{labels[status]}</Tag>
      }
    },
    {
      title: t("audiobook:output.actions", "Actions"),
      key: "actions",
      width: 150,
      render: (_: any, record: AudioChapter) => (
        <Space size="small">
          {record.status === "completed" && record.audioUrl && (
            <>
              <Tooltip
                title={
                  playingId === record.id
                    ? t("audiobook:output.stop", "Stop")
                    : t("audiobook:output.play", "Play")
                }
              >
                <Button
                  size="small"
                  icon={
                    playingId === record.id ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )
                  }
                  onClick={() => handlePlay(record)}
                />
              </Tooltip>
              <Tooltip title={t("audiobook:output.download", "Download")}>
                <Button
                  size="small"
                  icon={<Download className="h-3 w-3" />}
                  onClick={() => downloadChapter(record)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      )
    }
  ]

  if (chapters.length === 0) {
    return (
      <Card>
        <Empty
          description={
            <Text type="secondary">
              {t(
                "audiobook:output.noChapters",
                "No chapters to export. Add content and generate audio first."
              )}
            </Text>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <Title level={5} className="!mb-1">
              {t("audiobook:output.title", "Output")}
            </Title>
            <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
              <span>
                {t("audiobook:output.completedChapters", "{{count}} chapters ready", {
                  count: completedChapters.length
                })}
              </span>
              {totalDuration > 0 && (
                <span>
                  {t("audiobook:output.totalDuration", "Total: {{duration}}", {
                    duration: formatDuration(totalDuration)
                  })}
                </span>
              )}
            </div>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<Download className="h-4 w-4" />}
              onClick={() => downloadAllChapters(chapters, projectTitle)}
              disabled={completedChapters.length === 0}
            >
              {t("audiobook:output.downloadAll", "Download all")}
            </Button>
          </Space>
        </div>

        <Table
          dataSource={chapters}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Card>

      {completedChapters.length > 0 && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileAudio className="h-5 w-5 text-primary" />
              <Title level={5} className="!mb-0">
                {t("audiobook:output.audioPlayer", "Audio Player")}
              </Title>
            </div>
            <Text type="secondary" className="text-sm block">
              {t(
                "audiobook:output.audioPlayerDesc",
                "Listen to your completed chapters. Click a chapter in the table above to play it, or use the combined player below."
              )}
            </Text>

            {completedChapters.length > 0 && (
              <div className="space-y-2">
                <Text strong className="text-sm">
                  {t("audiobook:output.nowPlaying", "Now playing:")}
                </Text>
                {playingId ? (
                  <Text>
                    {chapters.find((ch) => ch.id === playingId)?.title ||
                      t("audiobook:output.unknownChapter", "Unknown chapter")}
                  </Text>
                ) : (
                  <Text type="secondary">
                    {t(
                      "audiobook:output.nothingPlaying",
                      "Click play on a chapter to start"
                    )}
                  </Text>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="space-y-3">
          <Title level={5} className="!mb-1">
            {t("audiobook:output.exportInfo", "Export Information")}
          </Title>
          <div className="text-sm text-text-muted space-y-1">
            <p>
              {t(
                "audiobook:output.exportInfoDesc1",
                "Each chapter is exported as a separate audio file in MP3 format."
              )}
            </p>
            <p>
              {t(
                "audiobook:output.exportInfoDesc2",
                "Files are named with the project title and chapter number for easy organization."
              )}
            </p>
            <p>
              {t(
                "audiobook:output.exportInfoDesc3",
                "Tip: Use an audio editing tool to combine chapters into a single audiobook file if needed."
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default OutputPanel
