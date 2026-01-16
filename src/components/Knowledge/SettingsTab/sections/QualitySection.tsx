import React from "react"
import { Radio } from "antd"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import type { RagSettings } from "@/services/rag/unified-rag"
import { SettingField } from "../shared/SettingField"
import { CollapsibleSection } from "../shared/CollapsibleSection"

type QualitySectionProps = {
  settings: RagSettings
  onUpdate: <K extends keyof RagSettings>(key: K, value: RagSettings[K]) => void
  searchFilter?: string
}

const SEARCH_MODE_OPTIONS = [
  { label: "FTS", value: "fts" },
  { label: "Vector", value: "vector" },
  { label: "Hybrid", value: "hybrid" }
]

const FTS_LEVEL_OPTIONS = [
  { label: "Media", value: "media" },
  { label: "Chunk", value: "chunk" }
]

const RERANK_STRATEGY_OPTIONS = [
  { label: "FlashRank", value: "flashrank" },
  { label: "Cross-encoder", value: "cross_encoder" },
  { label: "Hybrid", value: "hybrid" },
  { label: "llama.cpp", value: "llama_cpp" },
  { label: "LLM scoring", value: "llm_scoring" },
  { label: "Two-tier", value: "two_tier" },
  { label: "None", value: "none" }
]

export const getQualitySectionVisible = (
  searchFilter: string,
  t: TFunction
) => {
  const normalizedFilter = searchFilter.trim().toLowerCase()
  if (!normalizedFilter) return true
  const labels = [
    t("sidepanel:rag.quality", "Quality"),
    t("sidepanel:rag.searchMode", "Search mode"),
    t("sidepanel:rag.ftsLevel", "FTS level"),
    t("sidepanel:rag.hybridAlpha", "Hybrid alpha"),
    t("sidepanel:rag.intentRouting", "Intent routing"),
    t("sidepanel:rag.topK", "Top results"),
    t("sidepanel:rag.minScore", "Min relevance"),
    t("sidepanel:rag.reranking", "Reranking")
  ]
  return labels.some((label) => label.toLowerCase().includes(normalizedFilter))
}

/**
 * Quality section - search mode, retrieval settings, and reranking
 */
export const QualitySection: React.FC<QualitySectionProps> = ({
  settings,
  onUpdate,
  searchFilter = ""
}) => {
  const { t } = useTranslation(["sidepanel"])
  const qualityTitle = t("sidepanel:rag.quality", "Quality")
  const searchModeLabel = t("sidepanel:rag.searchMode", "Search mode")
  const ftsLevelLabel = t("sidepanel:rag.ftsLevel", "FTS level")
  const hybridAlphaLabel = t("sidepanel:rag.hybridAlpha", "Hybrid alpha")
  const hybridAlphaHelper = t(
    "sidepanel:rag.hybridAlphaHelper",
    "0 = full FTS, 1 = full vector"
  )
  const intentRoutingLabel = t("sidepanel:rag.intentRouting", "Intent routing")
  const topKLabel = t("sidepanel:rag.topK", "Top results")
  const minScoreLabel = t("sidepanel:rag.minScore", "Min relevance")
  const rerankingLabel = t("sidepanel:rag.reranking", "Reranking")
  const enableRerankingLabel = t(
    "sidepanel:rag.enableReranking",
    "Enable reranking"
  )
  const rerankStrategyLabel = t("sidepanel:rag.rerankStrategy", "Strategy")
  const rerankTopKLabel = t("sidepanel:rag.rerankTopK", "Rerank top_k")
  const rerankingModelLabel = t(
    "sidepanel:rag.rerankingModel",
    "Reranking model"
  )
  const rerankMinProbLabel = t(
    "sidepanel:rag.rerankMinProb",
    "Min relevance prob"
  )
  const rerankSentinelLabel = t(
    "sidepanel:rag.rerankSentinel",
    "Sentinel margin"
  )

  const normalizedFilter = searchFilter.trim().toLowerCase()
  const matchesFilter = (label: string) =>
    !normalizedFilter || label.toLowerCase().includes(normalizedFilter)

  const sectionVisible = getQualitySectionVisible(searchFilter, t)

  return (
    <CollapsibleSection
      title={qualityTitle}
      defaultExpanded={true}
      visible={sectionVisible}
    >
      {/* Search Mode */}
      {matchesFilter(searchModeLabel) && (
        <div className="col-span-2">
          <span className="text-xs text-text mb-2 block">
            {searchModeLabel}
          </span>
          <Radio.Group
            value={settings.search_mode}
            onChange={(e) => onUpdate("search_mode", e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            {SEARCH_MODE_OPTIONS.map((opt) => (
              <Radio.Button key={opt.value} value={opt.value}>
                {opt.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>
      )}

      {/* FTS Level (only for fts or hybrid mode) */}
      {(settings.search_mode === "fts" || settings.search_mode === "hybrid") &&
        matchesFilter(ftsLevelLabel) && (
          <SettingField
            type="select"
            label={ftsLevelLabel}
            value={settings.fts_level}
            onChange={(val) =>
              onUpdate("fts_level", val as RagSettings["fts_level"])
            }
            options={FTS_LEVEL_OPTIONS}
          />
        )}

      {/* Hybrid Alpha (only for hybrid mode) */}
      {settings.search_mode === "hybrid" &&
        matchesFilter(hybridAlphaLabel) && (
        <SettingField
          type="number"
          label={hybridAlphaLabel}
          value={settings.hybrid_alpha}
          onChange={(val) => onUpdate("hybrid_alpha", val)}
          min={0}
          max={1}
          step={0.05}
          helper={hybridAlphaHelper}
        />
      )}

      {/* Intent Routing */}
      {matchesFilter(intentRoutingLabel) && (
        <SettingField
          type="switch"
          label={intentRoutingLabel}
          value={settings.enable_intent_routing}
          onChange={(val) => onUpdate("enable_intent_routing", val)}
        />
      )}

      {/* Top K */}
      {matchesFilter(topKLabel) && (
        <SettingField
          type="number"
          label={topKLabel}
          value={settings.top_k}
          onChange={(val) => onUpdate("top_k", val)}
          min={1}
          max={50}
        />
      )}

      {/* Min Score */}
      {matchesFilter(minScoreLabel) && (
        <SettingField
          type="number"
          label={minScoreLabel}
          value={settings.min_score}
          onChange={(val) => onUpdate("min_score", val)}
          min={0}
          max={1}
          step={0.05}
        />
      )}

      {/* Reranking Section */}
      {matchesFilter(rerankingLabel) && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {rerankingLabel}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={enableRerankingLabel}
              value={settings.enable_reranking}
              onChange={(val) => onUpdate("enable_reranking", val)}
            />

            {settings.enable_reranking && (
              <>
                <SettingField
                  type="select"
                  label={rerankStrategyLabel}
                  value={settings.reranking_strategy}
                  onChange={(val) =>
                    onUpdate(
                      "reranking_strategy",
                      val as RagSettings["reranking_strategy"]
                    )
                  }
                  options={RERANK_STRATEGY_OPTIONS}
                />

                <SettingField
                  type="number"
                  label={rerankTopKLabel}
                  value={settings.rerank_top_k}
                  onChange={(val) => onUpdate("rerank_top_k", val)}
                  min={1}
                />

                <SettingField
                  type="text"
                  label={rerankingModelLabel}
                  value={settings.reranking_model || ""}
                  onChange={(val) => onUpdate("reranking_model", val || null)}
                />

                <SettingField
                  type="number"
                  label={rerankMinProbLabel}
                  value={settings.rerank_min_relevance_prob}
                  onChange={(val) => onUpdate("rerank_min_relevance_prob", val)}
                  min={0}
                  max={1}
                  step={0.05}
                />

                <SettingField
                  type="number"
                  label={rerankSentinelLabel}
                  value={settings.rerank_sentinel_margin}
                  onChange={(val) => onUpdate("rerank_sentinel_margin", val)}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </>
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
