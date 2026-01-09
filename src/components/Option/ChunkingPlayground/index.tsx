import React, { useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Tabs,
  Segmented,
  Space,
  Alert,
  Spin,
  Typography,
  Upload,
  message
} from "antd"
import type { UploadProps } from "antd"
import { UploadOutlined, ScissorOutlined } from "@ant-design/icons"
import { useQuery } from "@tanstack/react-query"

import {
  chunkText,
  chunkFile,
  getChunkingCapabilities,
  calculateChunkStats,
  DEFAULT_CHUNKING_OPTIONS,
  type Chunk,
  type ChunkingOptions,
  type ChunkingCapabilities
} from "@/services/chunking"

import { ChunkCardView } from "./ChunkCardView"
import { ChunkInlineView } from "./ChunkInlineView"
import { SampleTexts } from "./SampleTexts"
import { MediaSelector } from "./MediaSelector"
import { CompareView } from "./CompareView"
import { getLanguageOptions } from "./constants"

const { TextArea } = Input
const { Text, Title } = Typography

type InputSource = "paste" | "upload" | "sample" | "media"
type ViewMode = "cards" | "inline"
type PlaygroundMode = "single" | "compare"

interface ChunkingPlaygroundProps {
  className?: string
}

export const ChunkingPlayground: React.FC<ChunkingPlaygroundProps> = ({
  className
}) => {
  const { t } = useTranslation(["settings", "common"])

  // Input state
  const [inputSource, setInputSource] = useState<InputSource>("paste")
  const [inputText, setInputText] = useState("")
  const [inputFile, setInputFile] = useState<File | null>(null)

  // Settings state
  const [method, setMethod] = useState(DEFAULT_CHUNKING_OPTIONS.method!)
  const [maxSize, setMaxSize] = useState(DEFAULT_CHUNKING_OPTIONS.max_size!)
  const [overlap, setOverlap] = useState(DEFAULT_CHUNKING_OPTIONS.overlap!)
  const [language, setLanguage] = useState(DEFAULT_CHUNKING_OPTIONS.language!)

  // Results state
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("cards")
  const [playgroundMode, setPlaygroundMode] = useState<PlaygroundMode>("single")
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<
    number | null
  >(null)

  // Fetch capabilities from server
  const { data: capabilities, isLoading: capabilitiesLoading } =
    useQuery<ChunkingCapabilities>({
      queryKey: ["chunking-capabilities"],
      queryFn: getChunkingCapabilities,
      staleTime: 5 * 60 * 1000 // Cache for 5 minutes
    })

  const methodOptions = React.useMemo(() => {
    if (!capabilities?.methods) {
      return [
        { value: "words", label: "Words" },
        { value: "sentences", label: "Sentences" },
        { value: "paragraphs", label: "Paragraphs" }
      ]
    }
    return capabilities.methods.map((m) => ({
      value: m,
      label: m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, " ")
    }))
  }, [capabilities])

  const languageOptions = React.useMemo(() => getLanguageOptions(t), [t])

  const handleChunk = useCallback(async () => {
    if (!inputText.trim() && !inputFile) {
      message.warning(
        t("settings:chunkingPlayground.noInput", "Please provide text to chunk")
      )
      return
    }

    setIsLoading(true)
    setError(null)
    setChunks([])

    const options: ChunkingOptions = {
      method,
      max_size: maxSize,
      overlap,
      language: language === "auto" ? undefined : language
    }

    try {
      let response
      if (inputFile) {
        response = await chunkFile(inputFile, options)
      } else {
        response = await chunkText(inputText, options)
      }
      setChunks(response.chunks)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Chunking failed"
      setError(errorMsg)
      message.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [inputText, inputFile, method, maxSize, overlap, language, t])

  const handleSampleSelect = useCallback((text: string) => {
    setInputText(text)
    setInputFile(null)
    setInputSource("paste")
    setChunks([])
  }, [])

  const handleMediaSelect = useCallback((content: string) => {
    setInputText(content)
    setInputFile(null)
    setInputSource("paste")
    setChunks([])
  }, [])

  const uploadProps: UploadProps = {
    accept: ".txt,.md,.text",
    maxCount: 1,
    beforeUpload: (file) => {
      // Read file content directly
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setInputText(content)
        setInputFile(file)
        setChunks([])
      }
      reader.readAsText(file)
      return false // Prevent automatic upload
    },
    onRemove: () => {
      setInputFile(null)
      setInputText("")
    }
  }

  const stats = React.useMemo(() => calculateChunkStats(chunks), [chunks])

  const renderInputSection = () => (
    <div className="space-y-4">
      <Segmented
        value={inputSource}
        onChange={(v) => setInputSource(v as InputSource)}
        options={[
          {
            value: "paste",
            label: t("settings:chunkingPlayground.inputSource.paste", "Paste Text")
          },
          {
            value: "upload",
            label: t("settings:chunkingPlayground.inputSource.upload", "Upload File")
          },
          {
            value: "sample",
            label: t("settings:chunkingPlayground.inputSource.sample", "Sample Text")
          },
          {
            value: "media",
            label: t(
              "settings:chunkingPlayground.inputSource.media",
              "From Media Library"
            )
          }
        ]}
      />

      {inputSource === "paste" && (
        <TextArea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t(
            "settings:chunkingPlayground.inputPlaceholder",
            "Paste text here..."
          )}
          rows={8}
          className="font-mono text-sm"
        />
      )}

      {inputSource === "upload" && (
        <div className="space-y-2">
          <Upload.Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">
              {t(
                "settings:chunkingPlayground.uploadDragText",
                "Click or drag file to upload"
              )}
            </p>
            <p className="ant-upload-hint">
              {t(
                "settings:chunkingPlayground.uploadHint",
                "Supports .txt and .md files"
              )}
            </p>
          </Upload.Dragger>
          {inputFile && (
            <div className="mt-2">
              <Text type="secondary">
                {inputFile.name} ({(inputText.length / 1024).toFixed(1)} KB)
              </Text>
            </div>
          )}
        </div>
      )}

      {inputSource === "sample" && (
        <SampleTexts onSelect={handleSampleSelect} />
      )}

      {inputSource === "media" && (
        <MediaSelector onSelect={handleMediaSelect} />
      )}

      {/* Show text preview when not in paste mode but we have text */}
      {inputSource !== "paste" && inputText && (
        <div className="mt-2">
          <Text type="secondary" className="text-xs">
            {t("settings:chunkingPlayground.textLoaded", "Text loaded")}: {inputText.length}{" "}
            {t("settings:chunkingPlayground.characters", "characters")}
          </Text>
        </div>
      )}
    </div>
  )

  const renderSettingsSection = () => (
    <Card
      size="small"
      title={t("settings:chunkingPlayground.settingsTitle", "Settings")}
      className="h-full">
      <Form layout="vertical" size="small">
        <Form.Item
          label={t("settings:chunkingPlayground.methodLabel", "Chunking Method")}>
          <Select
            value={method}
            onChange={setMethod}
            options={methodOptions}
            loading={capabilitiesLoading}
          />
        </Form.Item>

        <Form.Item
          label={t("settings:chunkingPlayground.maxSizeLabel", "Max Chunk Size")}>
          <InputNumber
            value={maxSize}
            onChange={(v) => setMaxSize(v ?? 400)}
            min={50}
            max={10000}
            className="w-full"
          />
        </Form.Item>

        <Form.Item
          label={t("settings:chunkingPlayground.overlapLabel", "Overlap")}>
          <InputNumber
            value={overlap}
            onChange={(v) => setOverlap(v ?? 0)}
            min={0}
            max={maxSize - 1}
            className="w-full"
          />
        </Form.Item>

        <Form.Item
          label={t("settings:chunkingPlayground.languageLabel", "Language")}>
          <Select
            value={language}
            onChange={setLanguage}
            options={languageOptions}
          />
        </Form.Item>
      </Form>
    </Card>
  )

  const renderResultsSection = () => (
    <div className="space-y-4">
      {/* View toggle and stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            {
              value: "cards",
              label: t("settings:chunkingPlayground.viewCards", "Cards")
            },
            {
              value: "inline",
              label: t("settings:chunkingPlayground.viewInline", "Inline")
            }
          ]}
        />

        {chunks.length > 0 && (
          <Text type="secondary">
            {t("settings:chunkingPlayground.stats", "{{count}} chunks, avg {{avgSize}} chars", {
              count: stats.count,
              avgSize: stats.avgCharCount
            })}
          </Text>
        )}
      </div>

      {/* Error display */}
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      )}

      {/* Results */}
      {!isLoading && chunks.length > 0 && (
        <>
          {viewMode === "cards" ? (
            <ChunkCardView
              chunks={chunks}
              highlightedIndex={highlightedChunkIndex}
              onChunkHover={setHighlightedChunkIndex}
            />
          ) : (
            <ChunkInlineView
              originalText={inputText}
              chunks={chunks}
              highlightedIndex={highlightedChunkIndex}
              onChunkClick={setHighlightedChunkIndex}
            />
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && chunks.length === 0 && !error && (
        <div className="text-center py-8 text-text-muted ">
          <ScissorOutlined className="text-4xl mb-2" />
          <p>
            {t(
              "settings:chunkingPlayground.emptyState",
              "Enter text and click 'Chunk Text' to see results"
            )}
          </p>
        </div>
      )}
    </div>
  )

  const renderSingleMode = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Input section - 3 cols */}
      <div className="lg:col-span-3 space-y-4">
        {renderInputSection()}

        <Button
          type="primary"
          icon={<ScissorOutlined />}
          onClick={handleChunk}
          loading={isLoading}
          disabled={!inputText.trim() && !inputFile}
          size="large">
          {t("settings:chunkingPlayground.chunkButton", "Chunk Text")}
        </Button>

        {renderResultsSection()}
      </div>

      {/* Settings section - 1 col */}
      <div className="lg:col-span-1">{renderSettingsSection()}</div>
    </div>
  )

  return (
    <div className={className}>
      <div className="mb-6">
        <Title level={3}>
          {t("settings:chunkingPlayground.title", "Chunking Playground")}
        </Title>
        <Text type="secondary">
          {t(
            "settings:chunkingPlayground.description",
            "Experiment with different chunking settings to see how text gets split"
          )}
        </Text>
      </div>

      <Tabs
        activeKey={playgroundMode}
        onChange={(k) => setPlaygroundMode(k as PlaygroundMode)}
        items={[
          {
            key: "single",
            label: t("settings:chunkingPlayground.tabSingle", "Single"),
            children: renderSingleMode()
          },
          {
            key: "compare",
            label: t("settings:chunkingPlayground.tabCompare", "Compare"),
            children: (
              <CompareView
                inputText={inputText}
                onTextChange={setInputText}
                capabilities={capabilities}
              />
            )
          }
        ]}
      />
    </div>
  )
}

export default ChunkingPlayground
