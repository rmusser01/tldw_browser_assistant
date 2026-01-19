import React, { useEffect } from "react"
import { Tabs, Typography, Input, Space, Tag } from "antd"
import { useTranslation } from "react-i18next"
import {
  FileText,
  ListOrdered,
  Play,
  Download,
  Headphones
} from "lucide-react"
import { PageShell } from "@/components/Common/PageShell"
import { useAudiobookStudioStore } from "@/store/audiobook-studio"
import { TextEditor } from "./ContentInput/TextEditor"
import { ChapterList } from "./ChapterEditor/ChapterList"
import { GenerationPanel } from "./Generation/GenerationPanel"
import { OutputPanel } from "./Output/OutputPanel"

const { Title, Text } = Typography

export const AudiobookStudioPage: React.FC = () => {
  const { t } = useTranslation(["audiobook", "common"])
  const [activeTab, setActiveTab] = React.useState("content")

  const chapters = useAudiobookStudioStore((s) => s.chapters)
  const isGenerating = useAudiobookStudioStore((s) => s.isGenerating)
  const projectTitle = useAudiobookStudioStore((s) => s.projectTitle)
  const setProjectTitle = useAudiobookStudioStore((s) => s.setProjectTitle)
  const revokeAllAudioUrls = useAudiobookStudioStore((s) => s.revokeAllAudioUrls)

  const completedCount = chapters.filter((ch) => ch.status === "completed").length
  const pendingCount = chapters.filter(
    (ch) => ch.status === "pending" || ch.status === "error"
  ).length

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      revokeAllAudioUrls()
    }
  }, [revokeAllAudioUrls])

  const tabItems = [
    {
      key: "content",
      label: (
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t("audiobook:tabs.content", "Content")}
        </span>
      ),
      children: <TextEditor onSplitComplete={() => setActiveTab("chapters")} />
    },
    {
      key: "chapters",
      label: (
        <span className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4" />
          {t("audiobook:tabs.chapters", "Chapters")}
          {chapters.length > 0 && (
            <Tag color="blue" className="ml-1">
              {chapters.length}
            </Tag>
          )}
        </span>
      ),
      children: <ChapterList />
    },
    {
      key: "generate",
      label: (
        <span className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          {t("audiobook:tabs.generate", "Generate")}
          {isGenerating && (
            <Tag color="processing" className="ml-1">
              {t("audiobook:generating", "Generating...")}
            </Tag>
          )}
        </span>
      ),
      children: <GenerationPanel />
    },
    {
      key: "output",
      label: (
        <span className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t("audiobook:tabs.output", "Output")}
          {completedCount > 0 && (
            <Tag color="green" className="ml-1">
              {completedCount}/{chapters.length}
            </Tag>
          )}
        </span>
      ),
      children: <OutputPanel />
    }
  ]

  return (
    <PageShell maxWidthClassName="max-w-5xl" className="py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Headphones className="h-6 w-6 text-primary" />
            <Title level={3} className="!mb-0">
              {t("audiobook:title", "Audiobook Studio")}
            </Title>
            <Tag color="blue">{t("common:beta", "Beta")}</Tag>
          </div>
          <Text type="secondary">
            {t(
              "audiobook:subtitle",
              "Convert text into professional audiobooks with AI-powered text-to-speech."
            )}
          </Text>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">
          {t("audiobook:projectTitle", "Project Title")}
        </label>
        <Input
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          placeholder={t("audiobook:projectTitlePlaceholder", "My Audiobook")}
          className="max-w-md"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-text-muted">
        <span>
          {t("audiobook:stats.chapters", "{{count}} chapters", {
            count: chapters.length
          })}
        </span>
        {completedCount > 0 && (
          <span className="text-green-600">
            {t("audiobook:stats.completed", "{{count}} completed", {
              count: completedCount
            })}
          </span>
        )}
        {pendingCount > 0 && (
          <span>
            {t("audiobook:stats.pending", "{{count}} pending", {
              count: pendingCount
            })}
          </span>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="audiobook-tabs"
      />
    </PageShell>
  )
}

export default AudiobookStudioPage
