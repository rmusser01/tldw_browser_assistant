import React from "react"
import { Input, Button, Card, Space, Radio, Typography, Alert, Segmented } from "antd"
import { useTranslation } from "react-i18next"
import { Scissors, FileText, Hash, Type, Eye, Edit2, Columns, Database } from "lucide-react"
import { useAudiobookStudioStore, type SplitMode } from "@/store/audiobook-studio"
import Markdown from "@/components/Common/Markdown"
import { ImportFromKnowledgeBase } from "./ImportFromKnowledgeBase"

const { TextArea } = Input
const { Text, Paragraph } = Typography

type ViewMode = "edit" | "preview" | "split"

type TextEditorProps = {
  onSplitComplete?: () => void
}

const SAMPLE_TEXT = `# Introduction

Welcome to this sample audiobook. This text demonstrates how the splitting feature works with markdown headings.

# Chapter 1: Getting Started

This is the first chapter of our sample content. It contains multiple paragraphs that could be split individually.

The chapter splitting feature recognizes markdown headings and creates separate audio segments for each section.

# Chapter 2: Advanced Topics

In this chapter, we explore more complex subjects. Each chapter will be converted to a separate audio file.

You can customize the voice settings for each chapter individually, or use a default voice for the entire project.

# Conclusion

Thank you for using the Audiobook Studio. We hope this tool helps you create amazing audio content!`

export const TextEditor: React.FC<TextEditorProps> = ({ onSplitComplete }) => {
  const { t } = useTranslation(["audiobook", "common"])
  const [splitMode, setSplitMode] = React.useState<SplitMode>("headings")
  const [customDelimiter, setCustomDelimiter] = React.useState("---")
  const [viewMode, setViewMode] = React.useState<ViewMode>("edit")
  const [importModalOpen, setImportModalOpen] = React.useState(false)

  const rawContent = useAudiobookStudioStore((s) => s.rawContent)
  const setRawContent = useAudiobookStudioStore((s) => s.setRawContent)
  const setProjectTitle = useAudiobookStudioStore((s) => s.setProjectTitle)
  const splitIntoChapters = useAudiobookStudioStore((s) => s.splitIntoChapters)
  const chapters = useAudiobookStudioStore((s) => s.chapters)

  const handleSplit = () => {
    splitIntoChapters(splitMode, customDelimiter)
    onSplitComplete?.()
  }

  const handleInsertSample = () => {
    setRawContent(SAMPLE_TEXT)
  }

  const handleImportContent = (content: string, title?: string) => {
    setRawContent(content)
    if (title) {
      setProjectTitle(title)
    }
  }

  const charCount = rawContent.length
  const wordCount = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0
  const estimatedReadingTime = Math.ceil(wordCount / 150) // ~150 words per minute for TTS

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Text strong className="block mb-1">
                {t("audiobook:content.inputLabel", "Paste or type your content")}
              </Text>
              <Text type="secondary" className="text-xs">
                {t(
                  "audiobook:content.inputHint",
                  "Supports plain text and markdown formatting. Use headings (# H1, ## H2) to define chapters."
                )}
              </Text>
            </div>
            <Space>
              <Segmented
                size="small"
                value={viewMode}
                onChange={(val) => setViewMode(val as ViewMode)}
                options={[
                  {
                    value: "edit",
                    icon: <Edit2 className="h-3.5 w-3.5" />,
                    label: t("audiobook:content.edit", "Edit")
                  },
                  {
                    value: "preview",
                    icon: <Eye className="h-3.5 w-3.5" />,
                    label: t("audiobook:content.preview", "Preview")
                  },
                  {
                    value: "split",
                    icon: <Columns className="h-3.5 w-3.5" />,
                    label: t("audiobook:content.split", "Split")
                  }
                ]}
              />
              <Button
                size="small"
                icon={<Database className="h-3.5 w-3.5" />}
                onClick={() => setImportModalOpen(true)}
              >
                {t("audiobook:content.import", "Import")}
              </Button>
              <Button size="small" onClick={handleInsertSample}>
                {t("audiobook:content.insertSample", "Insert sample")}
              </Button>
            </Space>
          </div>

          <ImportFromKnowledgeBase
            open={importModalOpen}
            onClose={() => setImportModalOpen(false)}
            onImport={handleImportContent}
          />

          {viewMode === "edit" && (
            <TextArea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder={t(
                "audiobook:content.placeholder",
                "Paste your book content here...\n\nUse markdown headings to define chapters:\n# Chapter 1\n\nChapter content goes here..."
              )}
              autoSize={{ minRows: 12, maxRows: 24 }}
              className="font-mono text-sm"
            />
          )}

          {viewMode === "preview" && (
            <div className="min-h-[300px] max-h-[600px] overflow-y-auto rounded-md border border-border bg-surface p-4">
              {rawContent.trim() ? (
                <Markdown message={rawContent} />
              ) : (
                <Text type="secondary" className="italic">
                  {t("audiobook:content.noContentPreview", "No content to preview. Enter text in Edit mode.")}
                </Text>
              )}
            </div>
          )}

          {viewMode === "split" && (
            <div className="flex gap-4 min-h-[300px] max-h-[600px]">
              <div className="flex-1">
                <TextArea
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder={t(
                    "audiobook:content.placeholder",
                    "Paste your book content here...\n\nUse markdown headings to define chapters:\n# Chapter 1\n\nChapter content goes here..."
                  )}
                  className="font-mono text-sm h-full"
                  style={{ minHeight: 300, maxHeight: 600, resize: "none" }}
                />
              </div>
              <div className="flex-1 overflow-y-auto rounded-md border border-border bg-surface p-4">
                {rawContent.trim() ? (
                  <Markdown message={rawContent} />
                ) : (
                  <Text type="secondary" className="italic">
                    {t("audiobook:content.noContentPreview", "No content to preview. Enter text in Edit mode.")}
                  </Text>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
            <span>
              {t("audiobook:content.chars", "{{count}} characters", {
                count: charCount
              })}
            </span>
            <span>
              {t("audiobook:content.words", "{{count}} words", {
                count: wordCount
              })}
            </span>
            {estimatedReadingTime > 0 && (
              <span>
                {t("audiobook:content.estimatedTime", "~{{minutes}} min audio", {
                  minutes: estimatedReadingTime
                })}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <Text strong className="block mb-2">
              {t("audiobook:split.title", "Split into chapters")}
            </Text>
            <Text type="secondary" className="text-sm">
              {t(
                "audiobook:split.description",
                "Choose how to divide your content into separate audio chapters."
              )}
            </Text>
          </div>

          <Radio.Group
            value={splitMode}
            onChange={(e) => setSplitMode(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="headings" className="flex items-start">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                <div>
                  <Text strong>
                    {t("audiobook:split.headings", "By headings")}
                  </Text>
                  <Text type="secondary" className="block text-xs">
                    {t(
                      "audiobook:split.headingsDesc",
                      "Split at markdown headings (# ## ###)"
                    )}
                  </Text>
                </div>
              </div>
            </Radio>
            <Radio value="paragraphs" className="flex items-start">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <div>
                  <Text strong>
                    {t("audiobook:split.paragraphs", "By paragraphs")}
                  </Text>
                  <Text type="secondary" className="block text-xs">
                    {t(
                      "audiobook:split.paragraphsDesc",
                      "Split at double line breaks"
                    )}
                  </Text>
                </div>
              </div>
            </Radio>
            <Radio value="custom" className="flex items-start">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                <div>
                  <Text strong>
                    {t("audiobook:split.custom", "Custom delimiter")}
                  </Text>
                  <Text type="secondary" className="block text-xs">
                    {t(
                      "audiobook:split.customDesc",
                      "Split at a custom text pattern"
                    )}
                  </Text>
                </div>
              </div>
            </Radio>
          </Radio.Group>

          {splitMode === "custom" && (
            <Input
              value={customDelimiter}
              onChange={(e) => setCustomDelimiter(e.target.value)}
              placeholder={t("audiobook:split.delimiterPlaceholder", "---")}
              className="max-w-xs"
              addonBefore={t("audiobook:split.delimiter", "Delimiter")}
            />
          )}

          {chapters.length > 0 && (
            <Alert
              type="info"
              message={t(
                "audiobook:split.existingChapters",
                "You have {{count}} chapters. Splitting again will replace them.",
                { count: chapters.length }
              )}
              showIcon
            />
          )}

          <Space>
            <Button
              type="primary"
              icon={<Scissors className="h-4 w-4" />}
              onClick={handleSplit}
              disabled={!rawContent.trim()}
            >
              {t("audiobook:split.button", "Split into chapters")}
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}

export default TextEditor
