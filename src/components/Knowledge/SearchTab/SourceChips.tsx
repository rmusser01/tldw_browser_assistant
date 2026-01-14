import React from "react"
import { useTranslation } from "react-i18next"
import type { RagSource } from "@/services/rag/unified-rag"

type SourceChipsProps = {
  selectedSources: RagSource[]
  onSourcesChange: (sources: RagSource[]) => void
  disabled?: boolean
}

const ALL_SOURCES: RagSource[] = ["media_db", "notes", "characters", "chats"]

/**
 * Source filter chips - multi-select with "All" behavior
 *
 * - [All] is default and deselects when any specific source is selected
 * - Selecting multiple specific sources (e.g., [Notes] + [Media]) searches both
 * - Clicking a selected source deselects it; if none remain, reverts to All
 */
export const SourceChips: React.FC<SourceChipsProps> = ({
  selectedSources,
  onSourcesChange,
  disabled = false
}) => {
  const { t } = useTranslation(["sidepanel"])

  // Check if "All" is effectively selected (all sources or empty array)
  const isAllSelected =
    selectedSources.length === 0 ||
    selectedSources.length === ALL_SOURCES.length

  const sourceLabels: Record<RagSource, string> = {
    media_db: t("sidepanel:rag.sources.media", "Media"),
    notes: t("sidepanel:rag.sources.notes", "Notes"),
    characters: t("sidepanel:rag.sources.characters", "Characters"),
    chats: t("sidepanel:rag.sources.chats", "Chats")
  }

  const handleAllClick = () => {
    // Clicking "All" selects all sources (or clears to default)
    onSourcesChange([])
  }

  const handleSourceClick = (source: RagSource) => {
    if (isAllSelected) {
      // If "All" is selected, clicking a specific source selects only that source
      onSourcesChange([source])
    } else if (selectedSources.includes(source)) {
      // Deselect this source
      const newSources = selectedSources.filter((s) => s !== source)
      // If no sources remain, revert to "All"
      onSourcesChange(newSources.length === 0 ? [] : newSources)
    } else {
      // Add this source to selection
      const newSources = [...selectedSources, source]
      // If all sources are now selected, treat as "All"
      onSourcesChange(
        newSources.length === ALL_SOURCES.length ? [] : newSources
      )
    }
  }

  const chipClass = (isSelected: boolean) =>
    `px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer
     ${
       isSelected
         ? "bg-accent text-white"
         : "bg-surface2 text-text-muted hover:bg-surface3 hover:text-text"
     }
     ${disabled ? "opacity-50 cursor-not-allowed" : ""}
    `

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={t("sidepanel:rag.sourceFilter", "Filter by source")}
    >
      <button
        type="button"
        onClick={handleAllClick}
        disabled={disabled}
        className={chipClass(isAllSelected)}
        aria-pressed={isAllSelected}
      >
        {t("sidepanel:rag.sources.all", "All")}
      </button>

      {ALL_SOURCES.map((source) => {
        const isSelected = !isAllSelected && selectedSources.includes(source)
        return (
          <button
            key={source}
            type="button"
            onClick={() => handleSourceClick(source)}
            disabled={disabled}
            className={chipClass(isSelected)}
            aria-pressed={isSelected}
          >
            {sourceLabels[source]}
          </button>
        )
      })}
    </div>
  )
}
