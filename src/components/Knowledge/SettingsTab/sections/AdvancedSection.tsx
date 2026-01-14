import React from "react"
import { useTranslation } from "react-i18next"
import type { RagSettings } from "@/services/rag/unified-rag"
import { SettingField } from "../shared/SettingField"
import { CollapsibleSection } from "../shared/CollapsibleSection"

type AdvancedSectionProps = {
  settings: RagSettings
  onUpdate: <K extends keyof RagSettings>(key: K, value: RagSettings[K]) => void
  searchFilter?: string
}

const EXPANSION_STRATEGY_OPTIONS = [
  { label: "Acronym", value: "acronym" },
  { label: "Synonym", value: "synonym" },
  { label: "Semantic", value: "semantic" },
  { label: "Domain", value: "domain" },
  { label: "Entity", value: "entity" }
]

const TABLE_METHOD_OPTIONS = [
  { label: "Markdown", value: "markdown" },
  { label: "HTML", value: "html" },
  { label: "Hybrid", value: "hybrid" }
]

const CHUNK_TYPE_OPTIONS = [
  { label: "Text", value: "text" },
  { label: "Code", value: "code" },
  { label: "Table", value: "table" },
  { label: "List", value: "list" }
]

const CLAIM_EXTRACTOR_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "APS", value: "aps" },
  { label: "Claimify", value: "claimify" },
  { label: "NER", value: "ner" }
]

const CLAIM_VERIFIER_OPTIONS = [
  { label: "Hybrid", value: "hybrid" },
  { label: "NLI", value: "nli" },
  { label: "LLM", value: "llm" }
]

const LOW_CONFIDENCE_BEHAVIOR_OPTIONS = [
  { label: "Continue", value: "continue" },
  { label: "Ask user", value: "ask" },
  { label: "Decline", value: "decline" }
]

/**
 * Advanced section - all remaining expert settings
 */
export const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  settings,
  onUpdate,
  searchFilter = ""
}) => {
  const { t } = useTranslation(["sidepanel"])

  const matchesFilter = (label: string) =>
    !searchFilter || label.toLowerCase().includes(searchFilter.toLowerCase())

  const sectionVisible =
    !searchFilter ||
    matchesFilter("Advanced") ||
    matchesFilter("Query expansion") ||
    matchesFilter("Cache") ||
    matchesFilter("Context") ||
    matchesFilter("VLM") ||
    matchesFilter("Claims") ||
    matchesFilter("Agentic") ||
    matchesFilter("Monitoring") ||
    matchesFilter("Performance") ||
    matchesFilter("Batch") ||
    matchesFilter("Debug")

  return (
    <CollapsibleSection
      title={t("sidepanel:rag.advanced", "Advanced")}
      defaultExpanded={false}
      visible={sectionVisible}
      helperText={t(
        "sidepanel:rag.advancedHelper",
        "Expert settings for fine-tuning RAG behavior"
      )}
    >
      {/* Query Expansion */}
      {matchesFilter("Query expansion") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.queryExpansion", "Query Expansion")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.expandQuery", "Expand query")}
              value={settings.expand_query}
              onChange={(val) => onUpdate("expand_query", val)}
            />
            {settings.expand_query && (
              <SettingField
                type="multiselect"
                label={t("sidepanel:rag.expansionStrategies", "Strategies")}
                value={settings.expansion_strategies}
                onChange={(val) =>
                  onUpdate(
                    "expansion_strategies",
                    val as RagSettings["expansion_strategies"]
                  )
                }
                options={EXPANSION_STRATEGY_OPTIONS}
              />
            )}
            <SettingField
              type="switch"
              label={t("sidepanel:rag.spellCheck", "Spell check")}
              value={settings.spell_check}
              onChange={(val) => onUpdate("spell_check", val)}
            />
          </div>
        </div>
      )}

      {/* Caching */}
      {matchesFilter("Cache") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.caching", "Caching")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableCache", "Enable cache")}
              value={settings.enable_cache}
              onChange={(val) => onUpdate("enable_cache", val)}
            />
            {settings.enable_cache && (
              <>
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.cacheThreshold", "Cache threshold")}
                  value={settings.cache_threshold}
                  onChange={(val) => onUpdate("cache_threshold", val)}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <SettingField
                  type="switch"
                  label={t("sidepanel:rag.adaptiveCache", "Adaptive cache")}
                  value={settings.adaptive_cache}
                  onChange={(val) => onUpdate("adaptive_cache", val)}
                />
              </>
            )}
            <SettingField
              type="switch"
              label={t("sidepanel:rag.useEmbeddingCache", "Embedding cache")}
              value={settings.use_embedding_cache}
              onChange={(val) => onUpdate("use_embedding_cache", val)}
            />
          </div>
        </div>
      )}

      {/* Context Construction */}
      {matchesFilter("Context") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.contextConstruction", "Context Construction")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="multiselect"
              label={t("sidepanel:rag.chunkTypeFilter", "Chunk types")}
              value={settings.chunk_type_filter}
              onChange={(val) =>
                onUpdate("chunk_type_filter", val as RagSettings["chunk_type_filter"])
              }
              options={CHUNK_TYPE_OPTIONS}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableParentExpansion", "Parent expansion")}
              value={settings.enable_parent_expansion}
              onChange={(val) => onUpdate("enable_parent_expansion", val)}
            />
            {settings.enable_parent_expansion && (
              <SettingField
                type="number"
                label={t("sidepanel:rag.parentContextSize", "Parent context")}
                value={settings.parent_context_size}
                onChange={(val) => onUpdate("parent_context_size", val)}
                min={0}
                max={10}
              />
            )}
            <SettingField
              type="switch"
              label={t("sidepanel:rag.includeSiblingChunks", "Include siblings")}
              value={settings.include_sibling_chunks}
              onChange={(val) => onUpdate("include_sibling_chunks", val)}
            />
            {settings.include_sibling_chunks && (
              <SettingField
                type="number"
                label={t("sidepanel:rag.siblingWindow", "Sibling window")}
                value={settings.sibling_window}
                onChange={(val) => onUpdate("sibling_window", val)}
                min={0}
                max={5}
              />
            )}
            <SettingField
              type="switch"
              label={t("sidepanel:rag.includeParentDocument", "Include parent doc")}
              value={settings.include_parent_document}
              onChange={(val) => onUpdate("include_parent_document", val)}
            />
            {settings.include_parent_document && (
              <SettingField
                type="number"
                label={t("sidepanel:rag.parentMaxTokens", "Parent max tokens")}
                value={settings.parent_max_tokens}
                onChange={(val) => onUpdate("parent_max_tokens", val)}
                min={100}
                max={4000}
                step={100}
              />
            )}
          </div>
        </div>
      )}

      {/* Table Processing */}
      {matchesFilter("Table") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.tableProcessing", "Table Processing")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableTableProcessing", "Enable tables")}
              value={settings.enable_table_processing}
              onChange={(val) => onUpdate("enable_table_processing", val)}
            />
            {settings.enable_table_processing && (
              <>
                <SettingField
                  type="select"
                  label={t("sidepanel:rag.tableMethod", "Table method")}
                  value={settings.table_method}
                  onChange={(val) =>
                    onUpdate("table_method", val as RagSettings["table_method"])
                  }
                  options={TABLE_METHOD_OPTIONS}
                />
                <SettingField
                  type="switch"
                  label={t("sidepanel:rag.enableNumericTableBoost", "Numeric boost")}
                  value={settings.enable_numeric_table_boost}
                  onChange={(val) => onUpdate("enable_numeric_table_boost", val)}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* VLM Late Chunking */}
      {matchesFilter("VLM") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.vlm", "VLM Late Chunking")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableVlmLateChunking", "Enable VLM")}
              value={settings.enable_vlm_late_chunking}
              onChange={(val) => onUpdate("enable_vlm_late_chunking", val)}
            />
            {settings.enable_vlm_late_chunking && (
              <>
                <SettingField
                  type="text"
                  label={t("sidepanel:rag.vlmBackend", "VLM backend")}
                  value={settings.vlm_backend || ""}
                  onChange={(val) => onUpdate("vlm_backend", val || null)}
                  placeholder="auto"
                />
                <SettingField
                  type="switch"
                  label={t("sidepanel:rag.vlmDetectTablesOnly", "Tables only")}
                  value={settings.vlm_detect_tables_only}
                  onChange={(val) => onUpdate("vlm_detect_tables_only", val)}
                />
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.vlmMaxPages", "Max pages")}
                  value={settings.vlm_max_pages}
                  onChange={(val) => onUpdate("vlm_max_pages", val)}
                  min={1}
                  max={100}
                />
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.vlmLateChunkTopK", "Late chunk top_k")}
                  value={settings.vlm_late_chunk_top_k_docs}
                  onChange={(val) => onUpdate("vlm_late_chunk_top_k_docs", val)}
                  min={1}
                  max={20}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Claims Verification */}
      {matchesFilter("Claims") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.claims", "Claims Verification")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableClaims", "Enable claims")}
              value={settings.enable_claims}
              onChange={(val) => onUpdate("enable_claims", val)}
            />
            {settings.enable_claims && (
              <>
                <SettingField
                  type="select"
                  label={t("sidepanel:rag.claimExtractor", "Extractor")}
                  value={settings.claim_extractor}
                  onChange={(val) =>
                    onUpdate("claim_extractor", val as RagSettings["claim_extractor"])
                  }
                  options={CLAIM_EXTRACTOR_OPTIONS}
                />
                <SettingField
                  type="select"
                  label={t("sidepanel:rag.claimVerifier", "Verifier")}
                  value={settings.claim_verifier}
                  onChange={(val) =>
                    onUpdate("claim_verifier", val as RagSettings["claim_verifier"])
                  }
                  options={CLAIM_VERIFIER_OPTIONS}
                />
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.claimsTopK", "Claims top_k")}
                  value={settings.claims_top_k}
                  onChange={(val) => onUpdate("claims_top_k", val)}
                  min={1}
                  max={20}
                />
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.claimsConfThreshold", "Confidence")}
                  value={settings.claims_conf_threshold}
                  onChange={(val) => onUpdate("claims_conf_threshold", val)}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.claimsMax", "Max claims")}
                  value={settings.claims_max}
                  onChange={(val) => onUpdate("claims_max", val)}
                  min={1}
                  max={50}
                />
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.claimsConcurrency", "Concurrency")}
                  value={settings.claims_concurrency}
                  onChange={(val) => onUpdate("claims_concurrency", val)}
                  min={1}
                  max={10}
                />
                <SettingField
                  type="text"
                  label={t("sidepanel:rag.nliModel", "NLI model")}
                  value={settings.nli_model}
                  onChange={(val) => onUpdate("nli_model", val)}
                  placeholder="default"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Post-Verification / Adaptive */}
      {matchesFilter("Adaptive") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.adaptiveVerification", "Adaptive Verification")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enablePostVerification", "Post-verification")}
              value={settings.enable_post_verification}
              onChange={(val) => onUpdate("enable_post_verification", val)}
            />
            <SettingField
              type="select"
              label={t("sidepanel:rag.lowConfidenceBehavior", "Low confidence")}
              value={settings.low_confidence_behavior}
              onChange={(val) =>
                onUpdate(
                  "low_confidence_behavior",
                  val as RagSettings["low_confidence_behavior"]
                )
              }
              options={LOW_CONFIDENCE_BEHAVIOR_OPTIONS}
            />
            <SettingField
              type="number"
              label={t("sidepanel:rag.adaptiveMaxRetries", "Max retries")}
              value={settings.adaptive_max_retries}
              onChange={(val) => onUpdate("adaptive_max_retries", val)}
              min={0}
              max={5}
            />
            <SettingField
              type="number"
              label={t("sidepanel:rag.adaptiveTimeBudget", "Time budget (s)")}
              value={settings.adaptive_time_budget_sec}
              onChange={(val) => onUpdate("adaptive_time_budget_sec", val)}
              min={5}
              max={120}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.adaptiveRerunOnLowConf", "Rerun on low conf")}
              value={settings.adaptive_rerun_on_low_confidence}
              onChange={(val) => onUpdate("adaptive_rerun_on_low_confidence", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.adaptiveAdvancedRewrites", "Advanced rewrites")}
              value={settings.adaptive_advanced_rewrites}
              onChange={(val) => onUpdate("adaptive_advanced_rewrites", val)}
            />
          </div>
        </div>
      )}

      {/* Monitoring & Analytics */}
      {matchesFilter("Monitoring") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.monitoring", "Monitoring & Analytics")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableMonitoring", "Enable monitoring")}
              value={settings.enable_monitoring}
              onChange={(val) => onUpdate("enable_monitoring", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableAnalytics", "Enable analytics")}
              value={settings.enable_analytics}
              onChange={(val) => onUpdate("enable_analytics", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableObservability", "Observability")}
              value={settings.enable_observability}
              onChange={(val) => onUpdate("enable_observability", val)}
            />
            <SettingField
              type="text"
              label={t("sidepanel:rag.traceId", "Trace ID")}
              value={settings.trace_id}
              onChange={(val) => onUpdate("trace_id", val)}
              placeholder={t("sidepanel:rag.traceIdPlaceholder", "Auto-generated")}
            />
          </div>
        </div>
      )}

      {/* Performance */}
      {matchesFilter("Performance") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.performance", "Performance")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.useConnectionPool", "Connection pool")}
              value={settings.use_connection_pool}
              onChange={(val) => onUpdate("use_connection_pool", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enablePerfAnalysis", "Perf analysis")}
              value={settings.enable_performance_analysis}
              onChange={(val) => onUpdate("enable_performance_analysis", val)}
            />
            <SettingField
              type="number"
              label={t("sidepanel:rag.timeoutSeconds", "Timeout (s)")}
              value={settings.timeout_seconds}
              onChange={(val) => onUpdate("timeout_seconds", val)}
              min={5}
              max={300}
            />
          </div>
        </div>
      )}

      {/* Resilience */}
      {matchesFilter("Resilience") && (
        <div className="col-span-2 border-b border-border pb-3 mb-3">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.resilience", "Resilience")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableResilience", "Enable resilience")}
              value={settings.enable_resilience}
              onChange={(val) => onUpdate("enable_resilience", val)}
            />
            {settings.enable_resilience && (
              <>
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.retryAttempts", "Retry attempts")}
                  value={settings.retry_attempts}
                  onChange={(val) => onUpdate("retry_attempts", val)}
                  min={0}
                  max={5}
                />
                <SettingField
                  type="switch"
                  label={t("sidepanel:rag.circuitBreaker", "Circuit breaker")}
                  value={settings.circuit_breaker}
                  onChange={(val) => onUpdate("circuit_breaker", val)}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Debug & Display */}
      {matchesFilter("Debug") && (
        <div className="col-span-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.debugDisplay", "Debug & Display")}
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.highlightResults", "Highlight results")}
              value={settings.highlight_results}
              onChange={(val) => onUpdate("highlight_results", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.highlightQueryTerms", "Highlight query terms")}
              value={settings.highlight_query_terms}
              onChange={(val) => onUpdate("highlight_query_terms", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.trackCost", "Track cost")}
              value={settings.track_cost}
              onChange={(val) => onUpdate("track_cost", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.debugMode", "Debug mode")}
              value={settings.debug_mode}
              onChange={(val) => onUpdate("debug_mode", val)}
            />
            <SettingField
              type="switch"
              label={t("sidepanel:rag.explainOnly", "Explain only")}
              value={settings.explain_only}
              onChange={(val) => onUpdate("explain_only", val)}
              helper={t(
                "sidepanel:rag.explainOnlyHelper",
                "Return query plan without executing"
              )}
            />
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
