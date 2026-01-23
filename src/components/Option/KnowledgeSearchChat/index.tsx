import React from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Switch, Spin, Tooltip } from "antd"
import {
  Search,
  Sparkles,
  Settings2,
  MessageSquare,
  ExternalLink,
  Copy,
  Database,
  Zap,
  Scale,
  Target
} from "lucide-react"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useKnowledgeStatus } from "@/hooks/useConnectionState"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { getNoOfRetrievedDocs } from "@/services/app"
import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import ConnectFeatureBanner from "@/components/Common/ConnectFeatureBanner"
import { useDemoMode } from "@/context/demo-mode"
import { useKnowledgeWorkspaceStore } from "@/store/knowledge-workspace"
import { AdvancedRagDrawer } from "./AdvancedRagDrawer"
import { ChatThread } from "./ChatThread"

type RagResult = {
  id?: string
  content?: string
  text?: string
  chunk?: string
  metadata?: {
    title?: string
    source?: string
    url?: string
    [key: string]: any
  }
  score?: number
}

type PresetType = "fast" | "balanced" | "thorough"

const PRESETS: Record<PresetType, { topK: number; reranking: boolean }> = {
  fast: { topK: 5, reranking: false },
  balanced: { topK: 10, reranking: true },
  thorough: { topK: 20, reranking: true }
}

/**
 * KnowledgeSearchChat - Perplexity-style search-first knowledge interface
 *
 * Features:
 * - Search-first layout with prominent search bar
 * - Auto-answer toggle for question-like queries
 * - Inline AI answer with numbered citations [1], [2]
 * - Prominent source display (not collapsed)
 * - "Ask about this" opens chat thread below
 * - Fast/Balanced/Thorough presets visible
 * - Advanced settings behind gear icon
 */
export const KnowledgeSearchChat: React.FC = () => {
  const { t } = useTranslation(["knowledge", "common"])
  const navigate = useNavigate()
  const isOnline = useServerOnline()
  const { demoEnabled } = useDemoMode()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const { knowledgeStatus } = useKnowledgeStatus()
  const {
    ragSearchMode,
    ragTopK,
    setRagTopK,
    ragEnableGeneration,
    ragEnableCitations,
    ragSources
  } = useKnowledgeWorkspaceStore()

  // Search state
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<RagResult[]>([])
  const [answer, setAnswer] = React.useState<string | null>(null)
  const [citations, setCitations] = React.useState<number[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [hasSearched, setHasSearched] = React.useState(false)

  // Settings state
  const [preset, setPreset] = React.useState<PresetType>("balanced")
  const [autoAnswer, setAutoAnswer] = React.useState(true)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  // Chat thread state
  const [chatOpen, setChatOpen] = React.useState(false)
  const [chatContext, setChatContext] = React.useState<RagResult | null>(null)

  const ragUnsupported = !capsLoading && capabilities && !capabilities.hasRag

  // Check if query looks like a question
  const isQuestion = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return (
      trimmed.endsWith("?") ||
      /^(what|how|why|when|where|who|which|can|does|is|are|will|should)\b/i.test(
        trimmed
      )
    )
  }, [query])

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError(null)
    setResults([])
    setAnswer(null)
    setCitations([])
    setHasSearched(true)

    try {
      await tldwClient.initialize()
      const defaultTopK = await getNoOfRetrievedDocs()
      const presetConfig = PRESETS[preset]
      const resolvedTopK = ragTopK ?? presetConfig.topK ?? defaultTopK
      const resolvedSearchMode = ragSearchMode || "hybrid"
      const enableGeneration =
        autoAnswer && isQuestion && Boolean(ragEnableGeneration)
      const enableCitations = enableGeneration && Boolean(ragEnableCitations)
      const resolvedSources =
        Array.isArray(ragSources) && ragSources.length > 0 ? ragSources : undefined

      const options: any = {
        top_k: resolvedTopK,
        search_mode: resolvedSearchMode,
        enable_reranking: presetConfig.reranking,
        enable_generation: enableGeneration,
        enable_citations: enableCitations
      }

      if (resolvedSources) {
        options.sources = resolvedSources
      }

      const ragRes = await tldwClient.ragSearch(q, options)
      const docs = ragRes?.results || ragRes?.documents || ragRes?.docs || []
      setResults(Array.isArray(docs) ? docs : [])

      // Extract answer if available
      const generatedAnswer =
        ragRes?.generated_answer ||
        ragRes?.answer ||
        ragRes?.response ||
        ""
      setAnswer(
        typeof generatedAnswer === "string" && generatedAnswer.trim().length > 0
          ? generatedAnswer
          : null
      )

      // Extract citation indices from answer (look for [1], [2], etc.)
      if (generatedAnswer) {
        const citationMatches = generatedAnswer.match(/\[(\d+)\]/g) || []
        const indices = citationMatches
          .map((m: string) => parseInt(m.replace(/[\[\]]/g, ""), 10) - 1)
          .filter((i: number) => i >= 0 && i < docs.length)
        setCitations([...new Set(indices)] as number[])
      }
    } catch (e: any) {
      setResults([])
      setError(
        e?.message ||
          t("knowledge:search.failed", "Search failed. Please try again.")
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleAskAbout = (result: RagResult) => {
    setChatContext(result)
    setChatOpen(true)
  }

  const handleCopySnippet = (result: RagResult) => {
    const content = result.content || result.text || result.chunk || ""
    const source = result.metadata?.url || result.metadata?.source || ""
    const text = `${content}${source ? `\n\nSource: ${source}` : ""}`
    navigator.clipboard.writeText(text)
  }

  const getSourceTitle = (result: RagResult, index: number) => {
    const meta = result.metadata || {}
    return (
      meta.title ||
      meta.source ||
      t("knowledge:search.source", "Source {{num}}", { num: index + 1 })
    )
  }

  const getSourceSnippet = (result: RagResult) => {
    const content = result.content || result.text || result.chunk || ""
    return content.slice(0, 300)
  }

  // Handle offline/empty states
  if (!isOnline) {
    return demoEnabled ? (
      <FeatureEmptyState
        title={t("knowledge:empty.demoTitle", "Explore Knowledge in demo mode")}
        description={t(
          "knowledge:empty.demoDescription",
          "This demo shows how Knowledge can organize your sources. Connect your server to index your real documents."
        )}
        primaryActionLabel={t("settings:tldw.setupLink", "Set up server")}
        onPrimaryAction={() => navigate("/settings/tldw")}
      />
    ) : (
      <ConnectFeatureBanner
        title={t("knowledge:empty.connectTitle", "Connect to use Knowledge")}
        description={t(
          "knowledge:empty.connectDescription",
          "Connect to your tldw server to search your knowledge base."
        )}
      />
    )
  }

  if (knowledgeStatus === "empty") {
    return (
      <FeatureEmptyState
        title={t("knowledge:empty.noSourcesTitle", "Index knowledge to search")}
        description={t(
          "knowledge:empty.noSourcesDescription",
          "Your server is online, but no knowledge indexes were found. Add documents to start searching."
        )}
        primaryActionLabel={t("knowledge:empty.noSourcesPrimaryCta", "Open Quick ingest")}
        onPrimaryAction={() => {
          window.dispatchEvent(new CustomEvent("tldw:open-quick-ingest-intro"))
        }}
      />
    )
  }

  if (ragUnsupported) {
    return (
      <FeatureEmptyState
        title={t("knowledge:search.unsupported", "RAG not available")}
        description={t(
          "knowledge:search.unsupportedDesc",
          "This server does not support RAG search. Upgrade your server or check Diagnostics."
        )}
        primaryActionLabel={t("common:diagnostics", "Open Diagnostics")}
        onPrimaryAction={() => navigate("/settings/health")}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-semibold text-text">
                  {t("knowledge:search.title", "Knowledge Search")}
                </h1>
                <p className="text-sm text-text-muted">
                  {t(
                    "knowledge:search.subtitle",
                    "Search your knowledge and get AI-powered answers"
                  )}
                </p>
              </div>
            </div>
            <Tooltip title={t("knowledge:search.settings", "Advanced settings")}>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface2 hover:text-text"
              >
                <Settings2 className="h-5 w-5" />
              </button>
            </Tooltip>
          </div>

          {/* Search input */}
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t(
                  "knowledge:search.placeholder",
                  "Search your knowledge base..."
                )}
                className="w-full rounded-xl border border-border bg-bg py-4 pl-12 pr-28 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primaryStrong disabled:opacity-50"
              >
                {loading && <Spin size="small" />}
                {t("common:search", "Search")}
              </button>
            </div>
          </div>

          {/* Presets and auto-answer toggle */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {/* Presets */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreset("fast")
                  setRagTopK(PRESETS.fast.topK)
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === "fast"
                    ? "bg-primary text-white"
                    : "bg-surface2 text-text hover:bg-surface3"
                }`}
              >
                <Zap className="h-4 w-4" />
                {t("knowledge:presets.fast", "Fast")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreset("balanced")
                  setRagTopK(PRESETS.balanced.topK)
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === "balanced"
                    ? "bg-primary text-white"
                    : "bg-surface2 text-text hover:bg-surface3"
                }`}
              >
                <Scale className="h-4 w-4" />
                {t("knowledge:presets.balanced", "Balanced")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreset("thorough")
                  setRagTopK(PRESETS.thorough.topK)
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === "thorough"
                    ? "bg-primary text-white"
                    : "bg-surface2 text-text hover:bg-surface3"
                }`}
              >
                <Target className="h-4 w-4" />
                {t("knowledge:presets.thorough", "Thorough")}
              </button>
            </div>

            {/* Auto-answer toggle */}
            <div className="flex items-center gap-2">
              <Switch
                size="small"
                checked={autoAnswer}
                onChange={setAutoAnswer}
              />
              <span className="flex items-center gap-1.5 text-sm text-text-muted">
                <Sparkles className="h-4 w-4" />
                {t("knowledge:search.autoAnswer", "Auto-answer questions")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spin size="large" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              <div className="font-semibold">
                {t("knowledge:search.errorTitle", "Search failed")}
              </div>
              <p className="mt-1">{error}</p>
            </div>
          ) : !hasSearched ? (
            <div className="py-16 text-center">
              <Database className="mx-auto h-16 w-16 text-text-muted/30" />
              <p className="mt-4 text-text-muted">
                {t(
                  "knowledge:search.hint",
                  "Enter a query above to search your knowledge base"
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* AI Answer */}
              {answer && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                    <Sparkles className="h-4 w-4" />
                    {t("knowledge:search.aiAnswer", "AI Answer")}
                  </div>
                  <div className="prose prose-sm max-w-none text-text">
                    <p className="whitespace-pre-wrap">{answer}</p>
                  </div>
                </div>
              )}

              {/* Sources */}
              {results.length > 0 ? (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text">
                    {t("knowledge:search.sources", "Sources")}
                    <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-text-muted">
                      {results.length}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {results.map((result, index) => {
                      const isCited = citations.includes(index)
                      return (
                        <div
                          key={result.id || index}
                          className={`rounded-lg border p-4 transition-colors ${
                            isCited
                              ? "border-primary/50 bg-primary/5"
                              : "border-border bg-surface hover:border-border-hover"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-text-muted">
                                  {index + 1}
                                </span>
                                <h4 className="font-medium text-text truncate">
                                  {getSourceTitle(result, index)}
                                </h4>
                                {isCited && (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    {t("knowledge:search.cited", "Cited")}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-text-muted line-clamp-3">
                                {getSourceSnippet(result)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Tooltip title={t("knowledge:search.askAbout", "Ask about this")}>
                                <button
                                  type="button"
                                  onClick={() => handleAskAbout(result)}
                                  className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface2 hover:text-primary"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </button>
                              </Tooltip>
                              <Tooltip title={t("common:copy", "Copy")}>
                                <button
                                  type="button"
                                  onClick={() => handleCopySnippet(result)}
                                  className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface2 hover:text-text"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </Tooltip>
                              {result.metadata?.url && (
                                <Tooltip title={t("common:open", "Open source")}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      window.open(result.metadata!.url, "_blank")
                                    }
                                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface2 hover:text-text"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-text-muted">
                    {t("knowledge:search.noResults", "No results found for your query")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Chat thread */}
          {chatOpen && chatContext && (
            <div className="mt-8 border-t border-border pt-6">
              <ChatThread
                context={chatContext}
                onClose={() => {
                  setChatOpen(false)
                  setChatContext(null)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Advanced settings drawer */}
      <AdvancedRagDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

export default KnowledgeSearchChat
