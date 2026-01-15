import React from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
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

export const getCitationsSectionVisible = (
  searchFilter: string,
  t: TFunction
) => {
  const normalizedFilter = searchFilter.trim().toLowerCase()
  if (!normalizedFilter) return true
  const labels = [
    t("sidepanel:rag.citations", "Citations"),
    t("sidepanel:rag.enableCitations", "Enable citations"),
    t("sidepanel:rag.citationStyle", "Citation style"),
    t("sidepanel:rag.includePageNumbers", "Include page numbers"),
    t("sidepanel:rag.enableChunkCitations", "Chunk-level citations"),
    t("sidepanel:rag.requireHardCitations", "Require hard citations")
  ]
  return labels.some((label) => label.toLowerCase().includes(normalizedFilter))
}

/**
 * Citations section - citation style and formatting
 */
export const CitationsSection: React.FC<CitationsSectionProps> = ({
  settings,
  onUpdate,
  searchFilter = ""
}) => {
  const { t } = useTranslation(["sidepanel"])
  const citationsTitle = t("sidepanel:rag.citations", "Citations")
  const enableCitationsLabel = t(
    "sidepanel:rag.enableCitations",
    "Enable citations"
  )
  const citationStyleLabel = t("sidepanel:rag.citationStyle", "Citation style")
  const includePageNumbersLabel = t(
    "sidepanel:rag.includePageNumbers",
    "Include page numbers"
  )
  const chunkCitationsLabel = t(
    "sidepanel:rag.enableChunkCitations",
    "Chunk-level citations"
  )
  const requireHardCitationsLabel = t(
    "sidepanel:rag.requireHardCitations",
    "Require hard citations"
  )

  const normalizedFilter = searchFilter.trim().toLowerCase()
  const matchesFilter = (label: string) =>
    !normalizedFilter || label.toLowerCase().includes(normalizedFilter)

  const sectionVisible = getCitationsSectionVisible(searchFilter, t)

  return (
    <CollapsibleSection
      title={citationsTitle}
      defaultExpanded={false}
      visible={sectionVisible}
    >
      {/* Enable Citations */}
      {matchesFilter(enableCitationsLabel) && (
        <SettingField
          type="switch"
          label={enableCitationsLabel}
          value={settings.enable_citations}
          onChange={(val) => onUpdate("enable_citations", val)}
          helper={t(
            "sidepanel:rag.enableCitationsHelper",
            "Include source citations in answers"
          )}
        />
      )}

      {/* Citation Style */}
      {settings.enable_citations && matchesFilter(citationStyleLabel) && (
        <SettingField
          type="select"
          label={citationStyleLabel}
          value={settings.citation_style}
          onChange={(val) =>
            onUpdate("citation_style", val as RagSettings["citation_style"])
          }
          options={CITATION_STYLE_OPTIONS}
        />
      )}

      {/* Include Page Numbers */}
      {settings.enable_citations && matchesFilter(includePageNumbersLabel) && (
        <SettingField
          type="switch"
          label={includePageNumbersLabel}
          value={settings.include_page_numbers}
          onChange={(val) => onUpdate("include_page_numbers", val)}
        />
      )}

      {/* Chunk Citations */}
      {settings.enable_citations && matchesFilter(chunkCitationsLabel) && (
        <SettingField
          type="switch"
          label={chunkCitationsLabel}
          value={settings.enable_chunk_citations}
          onChange={(val) => onUpdate("enable_chunk_citations", val)}
          helper={t(
            "sidepanel:rag.enableChunkCitationsHelper",
            "Cite specific text chunks rather than whole documents"
          )}
        />
      )}

      {/* Require Hard Citations */}
      {settings.enable_citations &&
        matchesFilter(requireHardCitationsLabel) && (
        <SettingField
          type="switch"
          label={requireHardCitationsLabel}
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
