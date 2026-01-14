import React from "react"
import { useTranslation } from "react-i18next"
import type { RagSettings } from "@/services/rag/unified-rag"
import { SettingField } from "../shared/SettingField"
import { CollapsibleSection } from "../shared/CollapsibleSection"

type CitationsSectionProps = {
  settings: RagSettings
  onUpdate: <K extends keyof RagSettings>(key: K, value: RagSettings[K]) => void
  searchFilter?: string
}

const CITATION_STYLE_OPTIONS = [
  { label: "APA", value: "apa" },
  { label: "MLA", value: "mla" },
  { label: "Chicago", value: "chicago" },
  { label: "Harvard", value: "harvard" },
  { label: "IEEE", value: "ieee" }
]

/**
 * Citations section - citation style and formatting
 */
export const CitationsSection: React.FC<CitationsSectionProps> = ({
  settings,
  onUpdate,
  searchFilter = ""
}) => {
  const { t } = useTranslation(["sidepanel"])

  const matchesFilter = (label: string) =>
    !searchFilter || label.toLowerCase().includes(searchFilter.toLowerCase())

  const sectionVisible =
    !searchFilter ||
    matchesFilter("Citations") ||
    matchesFilter("citation") ||
    matchesFilter("page numbers") ||
    matchesFilter("chunk") ||
    matchesFilter("APA") ||
    matchesFilter("MLA")

  return (
    <CollapsibleSection
      title={t("sidepanel:rag.citations", "Citations")}
      defaultExpanded={false}
      visible={sectionVisible}
    >
      {/* Enable Citations */}
      {matchesFilter("Enable citations") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.enableCitations", "Enable citations")}
          value={settings.enable_citations}
          onChange={(val) => onUpdate("enable_citations", val)}
          helper={t(
            "sidepanel:rag.enableCitationsHelper",
            "Include source citations in answers"
          )}
        />
      )}

      {/* Citation Style */}
      {settings.enable_citations && matchesFilter("Citation style") && (
        <SettingField
          type="select"
          label={t("sidepanel:rag.citationStyle", "Citation style")}
          value={settings.citation_style}
          onChange={(val) =>
            onUpdate("citation_style", val as RagSettings["citation_style"])
          }
          options={CITATION_STYLE_OPTIONS}
        />
      )}

      {/* Include Page Numbers */}
      {settings.enable_citations && matchesFilter("page numbers") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.includePageNumbers", "Include page numbers")}
          value={settings.include_page_numbers}
          onChange={(val) => onUpdate("include_page_numbers", val)}
        />
      )}

      {/* Chunk Citations */}
      {settings.enable_citations && matchesFilter("chunk") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.enableChunkCitations", "Chunk-level citations")}
          value={settings.enable_chunk_citations}
          onChange={(val) => onUpdate("enable_chunk_citations", val)}
          helper={t(
            "sidepanel:rag.enableChunkCitationsHelper",
            "Cite specific text chunks rather than whole documents"
          )}
        />
      )}

      {/* Require Hard Citations */}
      {settings.enable_citations && matchesFilter("hard citations") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.requireHardCitations", "Require hard citations")}
          value={settings.require_hard_citations}
          onChange={(val) => onUpdate("require_hard_citations", val)}
          helper={t(
            "sidepanel:rag.requireHardCitationsHelper",
            "Reject answers without verifiable citations"
          )}
        />
      )}
    </CollapsibleSection>
  )
}
