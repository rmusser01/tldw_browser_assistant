import React from "react"
import {
  Card,
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Popconfirm,
  Collapse,
  Slider,
  InputNumber
} from "antd"
import { useTranslation } from "react-i18next"
import {
  Edit2,
  Trash2,
  Check,
  X,
  Play,
  Loader2,
  AlertCircle,
  Clock,
  Settings2
} from "lucide-react"
import { useAudiobookStudioStore, type AudioChapter } from "@/store/audiobook-studio"
import { useAudiobookGeneration } from "@/hooks/useAudiobookGeneration"
import { ChapterVoiceSelector } from "./ChapterVoiceSelector"
import { ChapterPreviewPlayer } from "./ChapterPreviewPlayer"
import type { TtsProviderOverrides } from "@/services/tts-provider"

const { Text, Paragraph } = Typography

type ChapterItemProps = {
  chapter: AudioChapter
  index: number
}

export const ChapterItem: React.FC<ChapterItemProps> = ({ chapter, index }) => {
  const { t } = useTranslation(["audiobook", "common"])
  const [isEditing, setIsEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState(chapter.title)
  const [editContent, setEditContent] = React.useState(chapter.content)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const updateChapter = useAudiobookStudioStore((s) => s.updateChapter)
  const removeChapter = useAudiobookStudioStore((s) => s.removeChapter)
  const isGenerating = useAudiobookStudioStore((s) => s.isGenerating)
  const currentGeneratingId = useAudiobookStudioStore(
    (s) => s.currentGeneratingId
  )

  const { generateSingleChapter, downloadChapter } = useAudiobookGeneration()

  const isThisGenerating = currentGeneratingId === chapter.id

  const handleSaveEdit = () => {
    updateChapter(chapter.id, {
      title: editTitle.trim() || `Chapter ${index + 1}`,
      content: editContent.trim()
    })
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditTitle(chapter.title)
    setEditContent(chapter.content)
    setIsEditing(false)
  }

  const handleGenerate = async () => {
    await generateSingleChapter(chapter)
  }

  const handleVoiceConfigChange = (config: TtsProviderOverrides) => {
    updateChapter(chapter.id, {
      voiceConfig: { ...chapter.voiceConfig, ...config }
    })
  }

  const handleSpeedChange = (speed: number | null) => {
    if (speed !== null) {
      updateChapter(chapter.id, {
        voiceConfig: { ...chapter.voiceConfig, speed }
      })
    }
  }

  const currentSpeed = chapter.voiceConfig.speed ?? 1.0

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getStatusTag = () => {
    switch (chapter.status) {
      case "generating":
        return (
          <Tag color="processing" icon={<Loader2 className="h-3 w-3 animate-spin" />}>
            {t("audiobook:status.generating", "Generating...")}
          </Tag>
        )
      case "completed":
        return (
          <Tag color="success" icon={<Check className="h-3 w-3" />}>
            {t("audiobook:status.completed", "Completed")}
            {chapter.audioDuration && ` (${formatDuration(chapter.audioDuration)})`}
          </Tag>
        )
      case "error":
        return (
          <Tag color="error" icon={<AlertCircle className="h-3 w-3" />}>
            {t("audiobook:status.error", "Error")}
          </Tag>
        )
      default:
        return (
          <Tag color="default" icon={<Clock className="h-3 w-3" />}>
            {t("audiobook:status.pending", "Pending")}
          </Tag>
        )
    }
  }

  const wordCount = chapter.content.trim().split(/\s+/).length

  return (
    <Card
      size="small"
      className={`${isThisGenerating ? "border-primary" : ""}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Text strong className="text-text-muted">
              {index + 1}.
            </Text>
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t(
                  "audiobook:chapters.titlePlaceholder",
                  "Chapter title"
                )}
                className="flex-1 max-w-xs"
              />
            ) : (
              <Text strong>{chapter.title}</Text>
            )}
            {getStatusTag()}
          </div>
          <Space size="small">
            {isEditing ? (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<Check className="h-3 w-3" />}
                  onClick={handleSaveEdit}
                />
                <Button
                  size="small"
                  icon={<X className="h-3 w-3" />}
                  onClick={handleCancelEdit}
                />
              </>
            ) : (
              <>
                <Button
                  size="small"
                  icon={<Edit2 className="h-3 w-3" />}
                  onClick={() => setIsEditing(true)}
                  disabled={chapter.status === "generating"}
                />
                <Popconfirm
                  title={t(
                    "audiobook:chapters.deleteConfirm",
                    "Delete this chapter?"
                  )}
                  onConfirm={() => removeChapter(chapter.id)}
                  okText={t("common:confirm", "Confirm")}
                  cancelText={t("common:cancel", "Cancel")}
                >
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 className="h-3 w-3" />}
                    disabled={chapter.status === "generating"}
                  />
                </Popconfirm>
              </>
            )}
          </Space>
        </div>

        {isEditing ? (
          <Input.TextArea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 8 }}
          />
        ) : (
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: "content",
                label: (
                  <Text type="secondary" className="text-xs">
                    {t("audiobook:chapters.showContent", "Show content")} (
                    {wordCount} {t("audiobook:chapters.words", "words")})
                  </Text>
                ),
                children: (
                  <Paragraph
                    className="!mb-0 text-sm text-text-muted whitespace-pre-wrap"
                    ellipsis={{ rows: 6, expandable: true }}
                  >
                    {chapter.content}
                  </Paragraph>
                )
              }
            ]}
          />
        )}

        {/* Voice & Speed Settings */}
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: "settings",
              label: (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Settings2 className="h-3 w-3" />
                  {t("audiobook:chapters.voiceSettings", "Voice settings")}
                  {chapter.voiceConfig.voiceId && (
                    <Tag size="small" className="ml-1">
                      {chapter.voiceConfig.voiceId}
                    </Tag>
                  )}
                  {currentSpeed !== 1.0 && (
                    <Tag size="small">{currentSpeed}x</Tag>
                  )}
                </div>
              ),
              children: (
                <div className="space-y-4 py-2">
                  <ChapterVoiceSelector
                    voiceConfig={chapter.voiceConfig}
                    onChange={handleVoiceConfigChange}
                    compact={true}
                  />
                  <div className="flex items-center gap-3">
                    <Text type="secondary" className="text-xs whitespace-nowrap">
                      {t("audiobook:chapters.speed", "Speed")}:
                    </Text>
                    <Slider
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={currentSpeed}
                      onChange={handleSpeedChange}
                      className="flex-1"
                      tooltip={{ formatter: (v) => `${v}x` }}
                    />
                    <InputNumber
                      size="small"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={currentSpeed}
                      onChange={handleSpeedChange}
                      style={{ width: 70 }}
                      formatter={(v) => `${v}x`}
                      parser={(v) => parseFloat(v?.replace("x", "") || "1")}
                    />
                  </div>
                </div>
              )
            }
          ]}
        />

        {chapter.errorMessage && (
          <Text type="danger" className="text-xs">
            {chapter.errorMessage}
          </Text>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <Space size="small">
            {chapter.status === "completed" && chapter.audioUrl && (
              <>
                <audio
                  ref={audioRef}
                  src={chapter.audioUrl}
                  controls
                  className="h-8"
                  style={{ maxWidth: 200 }}
                />
                <Button
                  size="small"
                  onClick={() => downloadChapter(chapter)}
                >
                  {t("audiobook:download", "Download")}
                </Button>
              </>
            )}
          </Space>
          <Space size="small">
            {(chapter.status === "pending" || chapter.status === "error") && (
              <>
                <ChapterPreviewPlayer
                  content={chapter.content}
                  voiceConfig={chapter.voiceConfig}
                />
                <Button
                  size="small"
                  type="primary"
                  icon={<Play className="h-3 w-3" />}
                  onClick={handleGenerate}
                  loading={isThisGenerating}
                  disabled={isGenerating && !isThisGenerating}
                >
                  {t("audiobook:generateChapter", "Generate")}
                </Button>
              </>
            )}
            {chapter.status === "completed" && (
              <Button
                size="small"
                icon={<Play className="h-3 w-3" />}
                onClick={handleGenerate}
                loading={isThisGenerating}
                disabled={isGenerating && !isThisGenerating}
              >
                {t("audiobook:regenerate", "Regenerate")}
              </Button>
            )}
          </Space>
        </div>
      </div>
    </Card>
  )
}

export default ChapterItem
