import React, { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Segmented,
  Space,
  Alert,
  Spin,
  Typography,
  Divider,
  Row,
  Col
} from "antd"
import { ScissorOutlined } from "@ant-design/icons"
import { message } from "antd"

import {
  chunkText,
  calculateChunkStats,
  DEFAULT_CHUNKING_OPTIONS,
  type Chunk,
  type ChunkingOptions,
  type ChunkingCapabilities
} from "@/services/chunking"

import { ChunkCardView } from "./ChunkCardView"
import { ChunkInlineView } from "./ChunkInlineView"
import { getLanguageOptions } from "./constants"

const { TextArea } = Input
const { Text, Title } = Typography

type ViewMode = "cards" | "inline"

interface ConfigState {
  method: string
  maxSize: number
  overlap: number
  language: string
}

interface ResultState {
  chunks: Chunk[]
  isLoading: boolean
  error: string | null
  viewMode: ViewMode
  highlightedIndex: number | null
}

interface CompareViewProps {
  inputText: string
  onTextChange: (text: string) => void
  capabilities?: ChunkingCapabilities
}

export const CompareView: React.FC<CompareViewProps> = ({
  inputText,
  onTextChange,
  capabilities
}) => {
  const { t } = useTranslation(["settings"])

  // Config A state
  const [configA, setConfigA] = useState<ConfigState>({
    method: "words",
    maxSize: 300,
    overlap: 100,
    language: "auto"
  })

  // Config B state
  const [configB, setConfigB] = useState<ConfigState>({
    method: "sentences",
    maxSize: 500,
    overlap: 50,
    language: "auto"
  })

  // Results A state
  const [resultA, setResultA] = useState<ResultState>({
    chunks: [],
    isLoading: false,
    error: null,
    viewMode: "cards",
    highlightedIndex: null
  })

  // Results B state
  const [resultB, setResultB] = useState<ResultState>({
    chunks: [],
    isLoading: false,
    error: null,
    viewMode: "cards",
    highlightedIndex: null
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

  const handleChunk = useCallback(
    async (config: ConfigState, setResult: React.Dispatch<React.SetStateAction<ResultState>>) => {
      if (!inputText.trim()) {
        message.warning(
          t("settings:chunkingPlayground.noInput", "Please provide text to chunk")
        )
        return
      }

      setResult((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        chunks: []
      }))

      const options: ChunkingOptions = {
        method: config.method,
        max_size: config.maxSize,
        overlap: config.overlap,
        language: config.language === "auto" ? undefined : config.language
      }

      try {
        const response = await chunkText(inputText, options)
        setResult((prev) => ({
          ...prev,
          chunks: response.chunks,
          isLoading: false
        }))
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Chunking failed"
        setResult((prev) => ({
          ...prev,
          error: errorMsg,
          isLoading: false
        }))
      }
    },
    [inputText, t]
  )

  const handleChunkBoth = useCallback(async () => {
    await Promise.all([
      handleChunk(configA, setResultA),
      handleChunk(configB, setResultB)
    ])
  }, [configA, configB, handleChunk])

  const statsA = React.useMemo(
    () => calculateChunkStats(resultA.chunks),
    [resultA.chunks]
  )
  const statsB = React.useMemo(
    () => calculateChunkStats(resultB.chunks),
    [resultB.chunks]
  )

  const renderConfigPanel = (
    config: ConfigState,
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>,
    label: string
  ) => (
    <Card size="small" title={label} className="h-full">
      <Form layout="vertical" size="small">
        <Form.Item label={t("settings:chunkingPlayground.methodLabel", "Method")}>
          <Select
            value={config.method}
            onChange={(v) => setConfig((c) => ({ ...c, method: v }))}
            options={methodOptions}
          />
        </Form.Item>

        <Form.Item label={t("settings:chunkingPlayground.maxSizeLabel", "Max Size")}>
          <InputNumber
            value={config.maxSize}
            onChange={(v) => setConfig((c) => ({ ...c, maxSize: v ?? 400 }))}
            min={50}
            max={10000}
            className="w-full"
          />
        </Form.Item>

        <Form.Item label={t("settings:chunkingPlayground.overlapLabel", "Overlap")}>
          <InputNumber
            value={config.overlap}
            onChange={(v) => setConfig((c) => ({ ...c, overlap: v ?? 0 }))}
            min={0}
            max={config.maxSize - 1}
            className="w-full"
          />
        </Form.Item>

        <Form.Item label={t("settings:chunkingPlayground.languageLabel", "Language")}>
          <Select
            value={config.language}
            onChange={(v) => setConfig((c) => ({ ...c, language: v }))}
            options={languageOptions}
          />
        </Form.Item>
      </Form>
    </Card>
  )

  const renderResultPanel = (
    result: ResultState,
    setResult: React.Dispatch<React.SetStateAction<ResultState>>,
    stats: ReturnType<typeof calculateChunkStats>
  ) => (
    <div className="space-y-3">
      {/* View toggle and stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Segmented
          size="small"
          value={result.viewMode}
          onChange={(v) =>
            setResult((r) => ({ ...r, viewMode: v as ViewMode }))
          }
          options={[
            { value: "cards", label: t("settings:chunkingPlayground.viewCards", "Cards") },
            { value: "inline", label: t("settings:chunkingPlayground.viewInline", "Inline") }
          ]}
        />

        {result.chunks.length > 0 && (
          <Text type="secondary" className="text-xs">
            {stats.count} chunks, avg {stats.avgCharCount} chars
          </Text>
        )}
      </div>

      {/* Error */}
      {result.error && (
        <Alert
          type="error"
          message={result.error}
          closable
          onClose={() => setResult((r) => ({ ...r, error: null }))}
        />
      )}

      {/* Loading */}
      {result.isLoading && (
        <div className="flex justify-center py-4">
          <Spin size="small" />
        </div>
      )}

      {/* Results */}
      {!result.isLoading && result.chunks.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          {result.viewMode === "cards" ? (
            <ChunkCardView
              chunks={result.chunks}
              highlightedIndex={result.highlightedIndex}
              onChunkHover={(idx) =>
                setResult((r) => ({ ...r, highlightedIndex: idx }))
              }
            />
          ) : (
            <ChunkInlineView
              originalText={inputText}
              chunks={result.chunks}
              highlightedIndex={result.highlightedIndex}
              onChunkClick={(idx) =>
                setResult((r) => ({ ...r, highlightedIndex: idx }))
              }
            />
          )}
        </div>
      )}

      {/* Empty state */}
      {!result.isLoading && result.chunks.length === 0 && !result.error && (
        <div className="text-center py-4 text-gray-400 text-sm">
          {t("settings:chunkingPlayground.clickToChunk", "Click 'Compare' to see results")}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Shared input */}
      <Card size="small" title={t("settings:chunkingPlayground.sharedInput", "Shared Input Text")}>
        <TextArea
          value={inputText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t(
            "settings:chunkingPlayground.inputPlaceholder",
            "Paste text here..."
          )}
          rows={6}
          className="font-mono text-sm"
        />
        <div className="mt-3">
          <Button
            type="primary"
            icon={<ScissorOutlined />}
            onClick={handleChunkBoth}
            loading={resultA.isLoading || resultB.isLoading}
            disabled={!inputText.trim()}>
            {t("settings:chunkingPlayground.compareButton", "Compare Both")}
          </Button>
        </div>
      </Card>

      {/* Side by side comparison */}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <div className="space-y-4">
            {renderConfigPanel(
              configA,
              setConfigA,
              t("settings:chunkingPlayground.compare.configA", "Configuration A")
            )}
            {renderResultPanel(resultA, setResultA, statsA)}
          </div>
        </Col>

        <Col xs={24} lg={12}>
          <div className="space-y-4">
            {renderConfigPanel(
              configB,
              setConfigB,
              t("settings:chunkingPlayground.compare.configB", "Configuration B")
            )}
            {renderResultPanel(resultB, setResultB, statsB)}
          </div>
        </Col>
      </Row>

      {/* Comparison summary */}
      {resultA.chunks.length > 0 && resultB.chunks.length > 0 && (
        <Card size="small" title={t("settings:chunkingPlayground.comparison", "Comparison")}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Text type="secondary">Config A</Text>
              <div className="text-lg font-medium">{statsA.count} chunks</div>
              <div className="text-xs text-gray-400">avg {statsA.avgCharCount} chars</div>
            </div>
            <div className="flex items-center justify-center">
              <Text type="secondary">vs</Text>
            </div>
            <div>
              <Text type="secondary">Config B</Text>
              <div className="text-lg font-medium">{statsB.count} chunks</div>
              <div className="text-xs text-gray-400">avg {statsB.avgCharCount} chars</div>
            </div>
          </div>
          <Divider className="my-3" />
          <div className="text-center text-sm text-gray-500">
            {statsA.count < statsB.count
              ? t(
                  "settings:chunkingPlayground.fewerChunks",
                  "Config A produces {{diff}} fewer chunks",
                  { diff: statsB.count - statsA.count }
                )
              : statsA.count > statsB.count
              ? t(
                  "settings:chunkingPlayground.moreChunks",
                  "Config A produces {{diff}} more chunks",
                  { diff: statsA.count - statsB.count }
                )
              : t("settings:chunkingPlayground.sameChunks", "Both configs produce the same number of chunks")}
          </div>
        </Card>
      )}
    </div>
  )
}
