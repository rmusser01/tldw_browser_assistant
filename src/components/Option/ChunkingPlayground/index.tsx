import React, { useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Card,
  Form,
  Input,
  AutoComplete,
  Select,
  InputNumber,
  Button,
  Tabs,
  Segmented,
  Space,
  Collapse,
  Switch,
  Divider,
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
  listChunkingTemplates,
  calculateChunkStats,
  DEFAULT_CHUNKING_OPTIONS,
  type Chunk,
  type ChunkingOptions,
  type ChunkingCapabilities,
  type ChunkingResponse,
  type ChunkingTemplateListResponse,
  type LLMOptionsForInternalSteps
} from "@/services/chunking"

import { ChunkCardView } from "./ChunkCardView"
import { ChunkInlineView } from "./ChunkInlineView"
import { SampleTexts } from "./SampleTexts"
import { MediaSelector } from "./MediaSelector"
import { CompareView } from "./CompareView"
import { ChunkingTemplatesPanel } from "./ChunkingTemplatesPanel"
import { ChunkingCapabilitiesPanel } from "./ChunkingCapabilitiesPanel"
import { getLanguageOptions } from "./constants"

const { TextArea } = Input
const { Text, Title } = Typography

type InputSource = "paste" | "upload" | "sample" | "media"
type ViewMode = "cards" | "inline"
type PlaygroundMode = "single" | "compare" | "templates" | "capabilities"
type RequestMode = "json" | "file"

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
  const [templateName, setTemplateName] = useState("")
  const [tokenizerName, setTokenizerName] = useState(
    DEFAULT_CHUNKING_OPTIONS.tokenizer_name_or_path ?? "gpt2"
  )
  const [adaptive, setAdaptive] = useState(
    Boolean(DEFAULT_CHUNKING_OPTIONS.adaptive)
  )
  const [multiLevel, setMultiLevel] = useState(
    Boolean(DEFAULT_CHUNKING_OPTIONS.multi_level)
  )
  const [codeMode, setCodeMode] = useState<"auto" | "ast" | "heuristic">(
    "auto"
  )
  const [semanticSimilarityThreshold, setSemanticSimilarityThreshold] =
    useState<number | null>(
      DEFAULT_CHUNKING_OPTIONS.semantic_similarity_threshold ?? null
    )
  const [semanticOverlapSentences, setSemanticOverlapSentences] =
    useState<number | null>(
      DEFAULT_CHUNKING_OPTIONS.semantic_overlap_sentences ?? null
    )
  const [jsonChunkableDataKey, setJsonChunkableDataKey] = useState(
    DEFAULT_CHUNKING_OPTIONS.json_chunkable_data_key ?? "data"
  )
  const [enableFrontmatterParsing, setEnableFrontmatterParsing] = useState(
    DEFAULT_CHUNKING_OPTIONS.enable_frontmatter_parsing ?? true
  )
  const [frontmatterSentinelKey, setFrontmatterSentinelKey] = useState(
    DEFAULT_CHUNKING_OPTIONS.frontmatter_sentinel_key ?? "__tldw_frontmatter__"
  )
  const [customChapterPattern, setCustomChapterPattern] = useState("")
  const [summarizationDetail, setSummarizationDetail] = useState<number | null>(
    DEFAULT_CHUNKING_OPTIONS.summarization_detail ?? null
  )
  const [propositionEngine, setPropositionEngine] = useState(
    DEFAULT_CHUNKING_OPTIONS.proposition_engine ?? "heuristic"
  )
  const [propositionAggressiveness, setPropositionAggressiveness] =
    useState<number | null>(
      DEFAULT_CHUNKING_OPTIONS.proposition_aggressiveness ?? null
    )
  const [propositionMinLength, setPropositionMinLength] = useState<
    number | null
  >(DEFAULT_CHUNKING_OPTIONS.proposition_min_proposition_length ?? null)
  const [propositionPromptProfile, setPropositionPromptProfile] = useState(
    DEFAULT_CHUNKING_OPTIONS.proposition_prompt_profile ?? "generic"
  )
  const [llmTemperature, setLlmTemperature] = useState<number | null>(null)
  const [llmSystemPrompt, setLlmSystemPrompt] = useState("")
  const [llmMaxTokens, setLlmMaxTokens] = useState<number | null>(null)

  const [requestMode, setRequestMode] = useState<RequestMode>("json")

  // Results state
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<ChunkingResponse | null>(null)

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("cards")
  const [playgroundMode, setPlaygroundMode] = useState<PlaygroundMode>("single")
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<
    number | null
  >(null)

  // Fetch capabilities from server
  const {
    data: capabilities,
    isLoading: capabilitiesLoading,
    refetch: refetchCapabilities
  } = useQuery<ChunkingCapabilities>({
    queryKey: ["chunking-capabilities"],
    queryFn: getChunkingCapabilities,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  })

  const {
    data: templateList,
    isLoading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates
  } = useQuery<ChunkingTemplateListResponse>({
    queryKey: ["chunking-templates", "playground"],
    queryFn: () =>
      listChunkingTemplates({ includeBuiltin: true, includeCustom: true }),
    staleTime: 60 * 1000
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
  const codeModeOptions = React.useMemo(() => {
    const available =
      capabilities?.method_specific_options?.code?.code_mode ?? [
        "auto",
        "ast",
        "heuristic"
      ]
    return available.map((mode) => ({
      value: mode,
      label: mode.toUpperCase()
    }))
  }, [capabilities])
  const templateOptions = React.useMemo(() => {
    return (
      templateList?.templates?.map((template) => ({
        value: template.name,
        label: template.name
      })) ?? []
    )
  }, [templateList])

  const buildChunkingOptions = useCallback((): ChunkingOptions => {
    const options: ChunkingOptions = {
      method,
      max_size: maxSize,
      overlap,
      language: language === "auto" ? undefined : language,
      template_name: templateName.trim() || undefined,
      tokenizer_name_or_path: tokenizerName.trim() || undefined,
      adaptive,
      multi_level: multiLevel,
      json_chunkable_data_key: jsonChunkableDataKey.trim() || undefined,
      enable_frontmatter_parsing: enableFrontmatterParsing,
      frontmatter_sentinel_key: frontmatterSentinelKey.trim() || undefined,
      custom_chapter_pattern: customChapterPattern.trim() || undefined,
      semantic_similarity_threshold:
        semanticSimilarityThreshold != null
          ? semanticSimilarityThreshold
          : undefined,
      semantic_overlap_sentences:
        semanticOverlapSentences != null ? semanticOverlapSentences : undefined,
      summarization_detail:
        summarizationDetail != null ? summarizationDetail : undefined,
      proposition_engine: propositionEngine || undefined,
      proposition_aggressiveness:
        propositionAggressiveness != null ? propositionAggressiveness : undefined,
      proposition_min_proposition_length:
        propositionMinLength != null ? propositionMinLength : undefined,
      proposition_prompt_profile: propositionPromptProfile || undefined
    }

    if (method === "code") {
      options.code_mode = codeMode
    }

    const llmOptions: LLMOptionsForInternalSteps = {}
    if (llmTemperature != null) llmOptions.temperature = llmTemperature
    if (llmSystemPrompt.trim()) {
      llmOptions.system_prompt_for_step = llmSystemPrompt.trim()
    }
    if (llmMaxTokens != null) llmOptions.max_tokens_per_step = llmMaxTokens
    if (Object.keys(llmOptions).length > 0) {
      options.llm_options_for_internal_steps = llmOptions
    }

    return options
  }, [
    method,
    maxSize,
    overlap,
    language,
    templateName,
    tokenizerName,
    adaptive,
    multiLevel,
    jsonChunkableDataKey,
    enableFrontmatterParsing,
    frontmatterSentinelKey,
    customChapterPattern,
    semanticSimilarityThreshold,
    semanticOverlapSentences,
    summarizationDetail,
    propositionEngine,
    propositionAggressiveness,
    propositionMinLength,
    propositionPromptProfile,
    codeMode,
    llmTemperature,
    llmSystemPrompt,
    llmMaxTokens
  ])

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

    const options = buildChunkingOptions()

    try {
      let response: ChunkingResponse
      if (inputFile && requestMode === "file") {
        response = await chunkFile(inputFile, options)
      } else {
        response = await chunkText(inputText, options, inputFile?.name)
      }
      setChunks(response.chunks)
      setLastResponse(response)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Chunking failed"
      setError(errorMsg)
      message.error(errorMsg)
      setLastResponse(null)
    } finally {
      setIsLoading(false)
    }
  }, [inputText, inputFile, requestMode, buildChunkingOptions, t])

  const resetToDefaults = useCallback(() => {
    const defaults = capabilities?.default_options ?? DEFAULT_CHUNKING_OPTIONS
    const normalizeNumber = (value: any, fallback: number) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : fallback
    }

    setMethod(String(defaults.method ?? DEFAULT_CHUNKING_OPTIONS.method ?? "words"))
    setMaxSize(
      normalizeNumber(
        defaults.max_size,
        DEFAULT_CHUNKING_OPTIONS.max_size ?? 400
      )
    )
    setOverlap(
      normalizeNumber(
        defaults.overlap,
        DEFAULT_CHUNKING_OPTIONS.overlap ?? 0
      )
    )
    setLanguage(String(defaults.language ?? DEFAULT_CHUNKING_OPTIONS.language ?? "en"))
    setTokenizerName(
      String(
        defaults.tokenizer_name_or_path ??
          DEFAULT_CHUNKING_OPTIONS.tokenizer_name_or_path ??
          "gpt2"
      )
    )
    setAdaptive(Boolean(defaults.adaptive ?? DEFAULT_CHUNKING_OPTIONS.adaptive))
    setMultiLevel(
      Boolean(defaults.multi_level ?? DEFAULT_CHUNKING_OPTIONS.multi_level)
    )
    setSemanticSimilarityThreshold(
      defaults.semantic_similarity_threshold != null
        ? Number(defaults.semantic_similarity_threshold)
        : DEFAULT_CHUNKING_OPTIONS.semantic_similarity_threshold ?? null
    )
    setSemanticOverlapSentences(
      defaults.semantic_overlap_sentences != null
        ? Number(defaults.semantic_overlap_sentences)
        : DEFAULT_CHUNKING_OPTIONS.semantic_overlap_sentences ?? null
    )
    setJsonChunkableDataKey(
      String(
        defaults.json_chunkable_data_key ??
          DEFAULT_CHUNKING_OPTIONS.json_chunkable_data_key ??
          "data"
      )
    )
    setEnableFrontmatterParsing(
      Boolean(
        defaults.enable_frontmatter_parsing ??
          DEFAULT_CHUNKING_OPTIONS.enable_frontmatter_parsing
      )
    )
    setFrontmatterSentinelKey(
      String(
        defaults.frontmatter_sentinel_key ??
          DEFAULT_CHUNKING_OPTIONS.frontmatter_sentinel_key ??
          "__tldw_frontmatter__"
      )
    )
    setSummarizationDetail(
      defaults.summarization_detail != null
        ? Number(defaults.summarization_detail)
        : DEFAULT_CHUNKING_OPTIONS.summarization_detail ?? null
    )
    setPropositionEngine(
      String(
        defaults.proposition_engine ??
          DEFAULT_CHUNKING_OPTIONS.proposition_engine ??
          "heuristic"
      )
    )
    setPropositionAggressiveness(
      defaults.proposition_aggressiveness != null
        ? Number(defaults.proposition_aggressiveness)
        : DEFAULT_CHUNKING_OPTIONS.proposition_aggressiveness ?? null
    )
    setPropositionMinLength(
      defaults.proposition_min_proposition_length != null
        ? Number(defaults.proposition_min_proposition_length)
        : DEFAULT_CHUNKING_OPTIONS.proposition_min_proposition_length ?? null
    )
    setPropositionPromptProfile(
      String(
        defaults.proposition_prompt_profile ??
          DEFAULT_CHUNKING_OPTIONS.proposition_prompt_profile ??
          "generic"
      )
    )

    setTemplateName("")
    setCustomChapterPattern("")
    setCodeMode("auto")
    setLlmTemperature(null)
    setLlmSystemPrompt("")
    setLlmMaxTokens(null)
  }, [capabilities])

  const handleSampleSelect = useCallback((text: string) => {
    setInputText(text)
    setInputFile(null)
    setInputSource("paste")
    setChunks([])
    setLastResponse(null)
  }, [])

  const handleMediaSelect = useCallback((content: string) => {
    setInputText(content)
    setInputFile(null)
    setInputSource("paste")
    setChunks([])
    setLastResponse(null)
  }, [])

  useEffect(() => {
    if (inputSource !== "upload" && inputFile) {
      setInputFile(null)
    }
  }, [inputSource, inputFile])

  useEffect(() => {
    if (!inputFile) {
      setRequestMode("json")
    }
  }, [inputFile])

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
        setLastResponse(null)
      }
      reader.readAsText(file)
      return false // Prevent automatic upload
    },
    onRemove: () => {
      setInputFile(null)
      setInputText("")
      setLastResponse(null)
    }
  }

  const stats = React.useMemo(() => calculateChunkStats(chunks), [chunks])
  const methodLower = String(method || "").toLowerCase()
  const isCodeMethod = methodLower === "code"
  const isSemanticMethod = methodLower === "semantic"
  const isJsonMethod = methodLower.includes("json")
  const isRollingMethod = methodLower === "rolling_summarize"
  const isPropositionMethod = methodLower === "propositions"
  const isChapterMethod = methodLower === "ebook_chapters"
  const llmRequired =
    capabilities?.llm_required_methods?.includes(method) ?? false

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

  const renderSettingsSection = () => {
    const llmOptionsDisabled = !isRollingMethod && !isPropositionMethod

    return (
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

          {llmRequired && (
            <Text type="warning" className="text-xs">
              {t(
                "settings:chunkingPlayground.advanced.methodRequiresLlm",
                "This method requires an LLM provider on the server."
              )}
            </Text>
          )}

          <Form.Item
            label={t(
              "settings:chunkingPlayground.maxSizeLabel",
              "Max Chunk Size"
            )}>
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

          <Collapse
            ghost
            items={[
              {
                key: "advanced",
                label: t(
                  "settings:chunkingPlayground.advanced.title",
                  "Advanced Options"
                ),
                children: (
                  <div className="space-y-3">
                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.templateNameLabel",
                        "Template name"
                      )}>
                      <div className="flex gap-2">
                        <AutoComplete
                          value={templateName}
                          onChange={setTemplateName}
                          options={templateOptions}
                          placeholder={t(
                            "settings:chunkingPlayground.advanced.templateNamePlaceholder",
                            "Select or type a template name"
                          )}
                          filterOption={(inputValue, option) =>
                            (option?.value ?? "")
                              .toString()
                              .toLowerCase()
                              .includes(inputValue.toLowerCase())
                          }
                          className="flex-1"
                        />
                        <Button
                          size="small"
                          onClick={() => refetchTemplates()}
                          loading={templatesLoading}>
                          {t("common:refresh", "Refresh")}
                        </Button>
                      </div>
                    </Form.Item>

                    <Text type="secondary" className="text-xs">
                      {t(
                        "settings:chunkingPlayground.advanced.templateOverridesHint",
                        "Template defaults are applied first; form values override them."
                      )}
                    </Text>

                    {templatesError && (templatesError as Error)?.message && (
                      <Alert
                        type="warning"
                        showIcon
                        message={(templatesError as Error)?.message}
                      />
                    )}

                    {inputFile && (
                      <Form.Item
                        label={t(
                          "settings:chunkingPlayground.advanced.requestModeLabel",
                          "Request Endpoint"
                        )}>
                        <Space direction="vertical" size={4} className="w-full">
                          <Segmented
                            value={requestMode}
                            onChange={(v) =>
                              setRequestMode(v as RequestMode)
                            }
                            options={[
                              {
                                value: "json",
                                label: t(
                                  "settings:chunkingPlayground.advanced.requestModeJson",
                                  "JSON (/chunk_text)"
                                )
                              },
                              {
                                value: "file",
                                label: t(
                                  "settings:chunkingPlayground.advanced.requestModeFile",
                                  "Multipart (/chunk_file)"
                                )
                              }
                            ]}
                          />
                          <Text type="secondary" className="text-xs">
                            {t(
                              "settings:chunkingPlayground.advanced.requestModeHint",
                              "Use JSON for full option support; multipart matches /chunk_file."
                            )}
                          </Text>
                        </Space>
                      </Form.Item>
                    )}

                    <Divider className="my-2" />

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.tokenizerLabel",
                        "Tokenizer"
                      )}>
                      <Input
                        value={tokenizerName}
                        onChange={(e) => setTokenizerName(e.target.value)}
                        placeholder={t(
                          "settings:chunkingPlayground.advanced.tokenizerPlaceholder",
                          "Tokenizer name or path (e.g., gpt2)"
                        )}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.adaptiveLabel",
                        "Adaptive chunking"
                      )}>
                      <Switch checked={adaptive} onChange={setAdaptive} />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.multiLevelLabel",
                        "Multi-level chunking"
                      )}>
                      <Switch checked={multiLevel} onChange={setMultiLevel} />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.codeModeLabel",
                        "Code mode"
                      )}>
                      <Space direction="vertical" size={4} className="w-full">
                        <Select
                          value={codeMode}
                          onChange={(v) => setCodeMode(v)}
                          options={codeModeOptions}
                          disabled={!isCodeMethod}
                        />
                        <Text type="secondary" className="text-xs">
                          {t(
                            "settings:chunkingPlayground.advanced.codeModeHint",
                            "Controls how code is parsed when method is 'code'."
                          )}
                        </Text>
                      </Space>
                    </Form.Item>

                    <Divider className="my-2" />

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.semanticSimilarityLabel",
                        "Semantic similarity threshold"
                      )}>
                      <InputNumber
                        value={semanticSimilarityThreshold}
                        onChange={(v) =>
                          setSemanticSimilarityThreshold(v ?? null)
                        }
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                        disabled={!isSemanticMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.semanticOverlapLabel",
                        "Semantic overlap sentences"
                      )}>
                      <InputNumber
                        value={semanticOverlapSentences}
                        onChange={(v) => setSemanticOverlapSentences(v ?? null)}
                        min={0}
                        className="w-full"
                        disabled={!isSemanticMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.jsonKeyLabel",
                        "JSON chunkable key"
                      )}>
                      <Input
                        value={jsonChunkableDataKey}
                        onChange={(e) => setJsonChunkableDataKey(e.target.value)}
                        disabled={!isJsonMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.frontmatterLabel",
                        "Enable frontmatter parsing"
                      )}>
                      <Switch
                        checked={enableFrontmatterParsing}
                        onChange={setEnableFrontmatterParsing}
                        disabled={!isJsonMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.frontmatterSentinelLabel",
                        "Frontmatter sentinel key"
                      )}>
                      <Input
                        value={frontmatterSentinelKey}
                        onChange={(e) => setFrontmatterSentinelKey(e.target.value)}
                        disabled={!isJsonMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.customChapterPatternLabel",
                        "Custom chapter pattern"
                      )}>
                      <Input
                        value={customChapterPattern}
                        onChange={(e) => setCustomChapterPattern(e.target.value)}
                        disabled={!isChapterMethod}
                      />
                    </Form.Item>

                    <Divider className="my-2" />

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.summarizationDetailLabel",
                        "Summarization detail"
                      )}>
                      <InputNumber
                        value={summarizationDetail}
                        onChange={(v) => setSummarizationDetail(v ?? null)}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                        disabled={!isRollingMethod}
                      />
                    </Form.Item>

                    <Divider orientation="left" className="my-2">
                      {t(
                        "settings:chunkingPlayground.advanced.llmOptionsTitle",
                        "LLM Options (internal steps)"
                      )}
                    </Divider>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.llmTemperatureLabel",
                        "LLM temperature"
                      )}>
                      <InputNumber
                        value={llmTemperature}
                        onChange={(v) => setLlmTemperature(v ?? null)}
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full"
                        disabled={llmOptionsDisabled}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.llmSystemPromptLabel",
                        "LLM system prompt"
                      )}>
                      <Input
                        value={llmSystemPrompt}
                        onChange={(e) => setLlmSystemPrompt(e.target.value)}
                        disabled={llmOptionsDisabled}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.llmMaxTokensLabel",
                        "LLM max tokens"
                      )}>
                      <InputNumber
                        value={llmMaxTokens}
                        onChange={(v) => setLlmMaxTokens(v ?? null)}
                        min={1}
                        className="w-full"
                        disabled={llmOptionsDisabled}
                      />
                    </Form.Item>

                    <Divider className="my-2" />

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.propositionEngineLabel",
                        "Proposition engine"
                      )}>
                      <Select
                        value={propositionEngine}
                        onChange={setPropositionEngine}
                        options={[
                          { value: "heuristic", label: "HEURISTIC" },
                          { value: "spacy", label: "SPACY" },
                          { value: "llm", label: "LLM" },
                          { value: "auto", label: "AUTO" }
                        ]}
                        disabled={!isPropositionMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.propositionAggressivenessLabel",
                        "Proposition aggressiveness"
                      )}>
                      <InputNumber
                        value={propositionAggressiveness}
                        onChange={(v) => setPropositionAggressiveness(v ?? null)}
                        min={0}
                        max={2}
                        className="w-full"
                        disabled={!isPropositionMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.propositionMinLengthLabel",
                        "Min proposition length"
                      )}>
                      <InputNumber
                        value={propositionMinLength}
                        onChange={(v) => setPropositionMinLength(v ?? null)}
                        min={0}
                        className="w-full"
                        disabled={!isPropositionMethod}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t(
                        "settings:chunkingPlayground.advanced.propositionPromptProfileLabel",
                        "Proposition prompt profile"
                      )}>
                      <Select
                        value={propositionPromptProfile}
                        onChange={setPropositionPromptProfile}
                        options={[
                          { value: "generic", label: "GENERIC" },
                          { value: "claimify", label: "CLAIMIFY" },
                          { value: "gemma_aps", label: "GEMMA_APS" }
                        ]}
                        disabled={!isPropositionMethod}
                      />
                    </Form.Item>
                  </div>
                )
              }
            ]}
          />

          <Divider className="my-2" />

          <Button size="small" onClick={resetToDefaults}>
            {t(
              "settings:chunkingPlayground.advanced.resetDefaults",
              "Reset to defaults"
            )}
          </Button>
        </Form>
      </Card>
    )
  }

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

      {!isLoading && lastResponse && (
        <Collapse
          ghost
          items={[
            {
              key: "applied",
              label: t(
                "settings:chunkingPlayground.appliedOptionsTitle",
                "Applied options"
              ),
              children: (
                <pre className="text-xs bg-surface2 rounded p-2 overflow-x-auto">
                  {JSON.stringify(lastResponse.applied_options, null, 2)}
                </pre>
              )
            },
            {
              key: "meta",
              label: t(
                "settings:chunkingPlayground.responseMetaTitle",
                "Response metadata"
              ),
              children: (
                <div className="text-xs text-text-muted space-y-1">
                  {lastResponse.original_file_name && (
                    <div>
                      {lastResponse.original_file_name}
                    </div>
                  )}
                  <div>{chunks.length} chunks</div>
                </div>
              )
            }
          ]}
        />
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
          },
          {
            key: "templates",
            label: t("settings:chunkingPlayground.tabTemplates", "Templates"),
            children: (
              <ChunkingTemplatesPanel />
            )
          },
          {
            key: "capabilities",
            label: t("settings:chunkingPlayground.tabCapabilities", "Capabilities"),
            children: (
              <ChunkingCapabilitiesPanel
                capabilities={capabilities}
                loading={capabilitiesLoading}
                onRefresh={() => refetchCapabilities()}
              />
            )
          }
        ]}
      />
    </div>
  )
}

export default ChunkingPlayground
