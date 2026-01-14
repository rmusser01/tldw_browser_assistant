import React from "react"
import { Input, Select } from "antd"
import { Search, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { RagPresetName, RagSettings } from "@/services/rag/unified-rag"
import {
  QualitySection,
  GenerationSection,
  CitationsSection,
  SafetySection,
  AdvancedSection
} from "./sections"

type SettingsTabProps = {
  settings: RagSettings
  preset: RagPresetName
  searchFilter: string
  onSearchFilterChange: (value: string) => void
  onUpdate: <K extends keyof RagSettings>(key: K, value: RagSettings[K]) => void
  onPresetChange: (preset: RagPresetName) => void
  onResetToBalanced: () => void
}

const PRESET_OPTIONS = [
  { label: "Fast", value: "fast" },
  { label: "Balanced", value: "balanced" },
  { label: "Thorough", value: "thorough" },
  { label: "Custom", value: "custom" }
]

/**
 * SettingsTab - Organized settings with search filtering
 *
 * Phase 3 implementation of the 3-tab architecture.
 * Sections are organized by task:
 * - Quality: Search mode, retrieval, reranking
 * - Generation: Answer generation, abstention, synthesis
 * - Citations: Citation style and formatting
 * - Safety: Security, PII, content filters
 * - Advanced: All expert settings
 */
export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  preset,
  searchFilter,
  onSearchFilterChange,
  onUpdate,
  onPresetChange,
  onResetToBalanced
}) => {
  const { t } = useTranslation(["sidepanel", "common"])
  const effectiveFilter = searchFilter.trim()
  const normalizedFilter = effectiveFilter.toLowerCase()
  const matchesFilter = (label: string) =>
    label.toLowerCase().includes(normalizedFilter)
  const hasMatchingSection =
    !normalizedFilter ||
    [
      "Quality",
      "Search mode",
      "Retrieval",
      "Reranking",
      "top_k",
      "relevance",
      "Generation",
      "Answer",
      "Abstention",
      "Synthesis",
      "extractive",
      "tokens",
      "Citations",
      "citation",
      "page numbers",
      "chunk",
      "APA",
      "MLA",
      "Safety",
      "Security",
      "PII",
      "filter",
      "injection",
      "sensitivity",
      "content policy",
      "Advanced",
      "Query expansion",
      "Cache",
      "Context",
      "VLM",
      "Claims",
      "Agentic",
      "Monitoring",
      "Performance",
      "Batch",
      "Debug"
    ].some((label) => matchesFilter(label))

  return (
    <div
      className="flex flex-col h-full"
      role="tabpanel"
      id="knowledge-tabpanel-settings"
      aria-labelledby="knowledge-tab-settings"
    >
      {/* Search Bar */}
      <div className="px-3 pt-3">
        <Input
          prefix={<Search className="h-4 w-4 text-text-muted" />}
          placeholder={t("sidepanel:rag.searchSettings", "Search settings...")}
          value={searchFilter}
          onChange={(e) => onSearchFilterChange(e.target.value)}
          allowClear
          aria-label={t("sidepanel:rag.searchSettings", "Search settings")}
        />
      </div>

      {/* Preset + Reset Row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {t("sidepanel:rag.preset", "Preset")}:
          </span>
          <Select
            value={preset}
            onChange={(val) => onPresetChange(val as RagPresetName)}
            options={PRESET_OPTIONS}
            size="small"
            className="w-28"
            aria-label={t("sidepanel:rag.preset", "Preset")}
          />
        </div>
        <button
          onClick={onResetToBalanced}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text transition-colors rounded hover:bg-surface2"
          aria-label={t("sidepanel:rag.resetToDefaults", "Reset to defaults")}
        >
          <RotateCcw className="h-3 w-3" />
          {t("sidepanel:rag.reset", "Reset")}
        </button>
      </div>

      {/* Scrollable Settings Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <QualitySection
          settings={settings}
          onUpdate={onUpdate}
          searchFilter={effectiveFilter}
        />

        <GenerationSection
          settings={settings}
          onUpdate={onUpdate}
          searchFilter={effectiveFilter}
        />

        <CitationsSection
          settings={settings}
          onUpdate={onUpdate}
          searchFilter={effectiveFilter}
        />

        <SafetySection
          settings={settings}
          onUpdate={onUpdate}
          searchFilter={effectiveFilter}
        />

        <AdvancedSection
          settings={settings}
          onUpdate={onUpdate}
          searchFilter={effectiveFilter}
        />

        {/* No results message */}
        {normalizedFilter && !hasMatchingSection && (
          <NoMatchMessage
            searchFilter={effectiveFilter}
            onClear={() => onSearchFilterChange("")}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Helper component for empty search results
 */
const NoMatchMessage: React.FC<{
  searchFilter: string
  onClear: () => void
}> = ({ searchFilter, onClear }) => {
  const { t } = useTranslation(["sidepanel"])

  // Check if any sections matched (they render null if no match)
  // This is a fallback message in case all sections are hidden
  return (
    <div className="text-center py-6 text-text-muted">
      <p className="text-sm">
        {t("sidepanel:rag.noSettingsMatch", "No settings match")} &quot;
        {searchFilter}&quot;
      </p>
      <button
        onClick={onClear}
        className="mt-2 text-xs text-accent hover:underline"
      >
        {t("sidepanel:rag.clearSearch", "Clear search")}
      </button>
    </div>
  )
}
