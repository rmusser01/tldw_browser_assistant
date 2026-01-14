import React from "react"
import { useTranslation } from "react-i18next"
import type { RagSettings } from "@/services/rag/unified-rag"
import { SettingField } from "../shared/SettingField"
import { CollapsibleSection } from "../shared/CollapsibleSection"

type GenerationSectionProps = {
  settings: RagSettings
  onUpdate: <K extends keyof RagSettings>(key: K, value: RagSettings[K]) => void
  searchFilter?: string
}

const ABSTENTION_BEHAVIOR_OPTIONS = [
  { label: "Continue", value: "continue" },
  { label: "Ask user", value: "ask" },
  { label: "Decline", value: "decline" }
]

/**
 * Generation section - answer generation, abstention, and synthesis
 */
export const GenerationSection: React.FC<GenerationSectionProps> = ({
  settings,
  onUpdate,
  searchFilter = ""
}) => {
  const { t } = useTranslation(["sidepanel"])

  const matchesFilter = (label: string) =>
    !searchFilter || label.toLowerCase().includes(searchFilter.toLowerCase())

  const sectionVisible =
    !searchFilter ||
    matchesFilter("Generation") ||
    matchesFilter("Answer") ||
    matchesFilter("Abstention") ||
    matchesFilter("Synthesis") ||
    matchesFilter("extractive") ||
    matchesFilter("tokens")

  return (
    <CollapsibleSection
      title={t("sidepanel:rag.generation", "Answer Generation")}
      defaultExpanded={false}
      visible={sectionVisible}
    >
      {/* Enable Generation */}
      {matchesFilter("Enable generation") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.enableGeneration", "Enable generation")}
          value={settings.enable_generation}
          onChange={(val) => onUpdate("enable_generation", val)}
          helper={t(
            "sidepanel:rag.enableGenerationHelper",
            "Generate answers from retrieved context"
          )}
        />
      )}

      {/* Strict Extractive */}
      {settings.enable_generation && matchesFilter("Strict extractive") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.strictExtractive", "Strict extractive")}
          value={settings.strict_extractive}
          onChange={(val) => onUpdate("strict_extractive", val)}
          helper={t(
            "sidepanel:rag.strictExtractiveHelper",
            "Only use verbatim quotes from sources"
          )}
        />
      )}

      {/* Generation Model */}
      {settings.enable_generation && matchesFilter("Generation model") && (
        <SettingField
          type="text"
          label={t("sidepanel:rag.generationModel", "Generation model")}
          value={settings.generation_model || ""}
          onChange={(val) => onUpdate("generation_model", val || null)}
          placeholder={t("sidepanel:rag.generationModelPlaceholder", "Default")}
        />
      )}

      {/* Generation Prompt */}
      {settings.enable_generation && matchesFilter("Generation prompt") && (
        <div className="col-span-2">
          <SettingField
            type="textarea"
            label={t("sidepanel:rag.generationPrompt", "Generation prompt")}
            value={settings.generation_prompt || ""}
            onChange={(val) => onUpdate("generation_prompt", val || null)}
            placeholder={t(
              "sidepanel:rag.generationPromptPlaceholder",
              "Custom prompt template..."
            )}
            rows={3}
          />
        </div>
      )}

      {/* Max Generation Tokens */}
      {settings.enable_generation && matchesFilter("tokens") && (
        <SettingField
          type="number"
          label={t("sidepanel:rag.maxGenerationTokens", "Max tokens")}
          value={settings.max_generation_tokens}
          onChange={(val) => onUpdate("max_generation_tokens", val)}
          min={100}
          max={4000}
          step={100}
        />
      )}

      {/* Abstention Section */}
      {settings.enable_generation && matchesFilter("Abstention") && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.abstention", "Abstention")}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableAbstention", "Enable abstention")}
              value={settings.enable_abstention}
              onChange={(val) => onUpdate("enable_abstention", val)}
              helper={t(
                "sidepanel:rag.enableAbstentionHelper",
                "Allow declining when uncertain"
              )}
            />

            {settings.enable_abstention && (
              <SettingField
                type="select"
                label={t("sidepanel:rag.abstentionBehavior", "Behavior")}
                value={settings.abstention_behavior}
                onChange={(val) =>
                  onUpdate(
                    "abstention_behavior",
                    val as RagSettings["abstention_behavior"]
                  )
                }
                options={ABSTENTION_BEHAVIOR_OPTIONS}
              />
            )}
          </div>
        </div>
      )}

      {/* Multi-turn Synthesis Section */}
      {settings.enable_generation && matchesFilter("Synthesis") && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.synthesis", "Multi-turn Synthesis")}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableSynthesis", "Enable synthesis")}
              value={settings.enable_multi_turn_synthesis}
              onChange={(val) => onUpdate("enable_multi_turn_synthesis", val)}
              helper={t(
                "sidepanel:rag.enableSynthesisHelper",
                "Draft and refine answers in multiple passes"
              )}
            />

            {settings.enable_multi_turn_synthesis && (
              <>
                <SettingField
                  type="number"
                  label={t("sidepanel:rag.synthesisTimeBudget", "Time budget (s)")}
                  value={settings.synthesis_time_budget_sec}
                  onChange={(val) => onUpdate("synthesis_time_budget_sec", val)}
                  min={10}
                  max={180}
                />

                <SettingField
                  type="number"
                  label={t("sidepanel:rag.synthesisDraftTokens", "Draft tokens")}
                  value={settings.synthesis_draft_tokens}
                  onChange={(val) => onUpdate("synthesis_draft_tokens", val)}
                  min={100}
                  max={2000}
                  step={100}
                />

                <SettingField
                  type="number"
                  label={t("sidepanel:rag.synthesisRefineTokens", "Refine tokens")}
                  value={settings.synthesis_refine_tokens}
                  onChange={(val) => onUpdate("synthesis_refine_tokens", val)}
                  min={100}
                  max={2000}
                  step={100}
                />
              </>
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
