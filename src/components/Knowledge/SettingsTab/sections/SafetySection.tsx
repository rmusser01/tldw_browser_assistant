import React from "react"
import { useTranslation } from "react-i18next"
import type { RagSettings } from "@/services/rag/unified-rag"
import { SettingField } from "../shared/SettingField"
import { CollapsibleSection } from "../shared/CollapsibleSection"

type SafetySectionProps = {
  settings: RagSettings
  onUpdate: <K extends keyof RagSettings>(key: K, value: RagSettings[K]) => void
  searchFilter?: string
}

const SENSITIVITY_LEVEL_OPTIONS = [
  { label: "Public", value: "public" },
  { label: "Internal", value: "internal" },
  { label: "Confidential", value: "confidential" },
  { label: "Restricted", value: "restricted" }
]

const CONTENT_POLICY_TYPE_OPTIONS = [
  { label: "PII", value: "pii" },
  { label: "PHI", value: "phi" }
]

const CONTENT_POLICY_MODE_OPTIONS = [
  { label: "Redact", value: "redact" },
  { label: "Drop", value: "drop" },
  { label: "Annotate", value: "annotate" }
]

const NUMERIC_FIDELITY_BEHAVIOR_OPTIONS = [
  { label: "Continue", value: "continue" },
  { label: "Ask user", value: "ask" },
  { label: "Decline", value: "decline" },
  { label: "Retry", value: "retry" }
]

/**
 * Safety section - security, PII, content filters, and integrity checks
 */
export const SafetySection: React.FC<SafetySectionProps> = ({
  settings,
  onUpdate,
  searchFilter = ""
}) => {
  const { t } = useTranslation(["sidepanel"])

  const matchesFilter = (label: string) =>
    !searchFilter || label.toLowerCase().includes(searchFilter.toLowerCase())

  const sectionVisible =
    !searchFilter ||
    matchesFilter("Safety") ||
    matchesFilter("Security") ||
    matchesFilter("PII") ||
    matchesFilter("filter") ||
    matchesFilter("injection") ||
    matchesFilter("sensitivity") ||
    matchesFilter("content policy")

  return (
    <CollapsibleSection
      title={t("sidepanel:rag.safety", "Safety & Integrity")}
      defaultExpanded={false}
      visible={sectionVisible}
    >
      {/* Security Filter */}
      {matchesFilter("Security filter") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.enableSecurityFilter", "Security filter")}
          value={settings.enable_security_filter}
          onChange={(val) => onUpdate("enable_security_filter", val)}
          helper={t(
            "sidepanel:rag.enableSecurityFilterHelper",
            "Filter potentially harmful content"
          )}
        />
      )}

      {/* Content Filter */}
      {matchesFilter("Content filter") && (
        <SettingField
          type="switch"
          label={t("sidepanel:rag.contentFilter", "Content filter")}
          value={settings.content_filter}
          onChange={(val) => onUpdate("content_filter", val)}
        />
      )}

      {/* Sensitivity Level */}
      {matchesFilter("Sensitivity level") && (
        <SettingField
          type="select"
          label={t("sidepanel:rag.sensitivityLevel", "Sensitivity level")}
          value={settings.sensitivity_level}
          onChange={(val) =>
            onUpdate("sensitivity_level", val as RagSettings["sensitivity_level"])
          }
          options={SENSITIVITY_LEVEL_OPTIONS}
        />
      )}

      {/* PII Section */}
      {matchesFilter("PII") && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.piiHandling", "PII Handling")}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.detectPii", "Detect PII")}
              value={settings.detect_pii}
              onChange={(val) => onUpdate("detect_pii", val)}
            />

            {settings.detect_pii && (
              <SettingField
                type="switch"
                label={t("sidepanel:rag.redactPii", "Redact PII")}
                value={settings.redact_pii}
                onChange={(val) => onUpdate("redact_pii", val)}
                helper={t(
                  "sidepanel:rag.redactPiiHelper",
                  "Replace detected PII with placeholders"
                )}
              />
            )}
          </div>
        </div>
      )}

      {/* Content Policy Section */}
      {matchesFilter("Content policy") && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.contentPolicy", "Content Policy")}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableContentPolicy", "Enable policy filter")}
              value={settings.enable_content_policy_filter}
              onChange={(val) => onUpdate("enable_content_policy_filter", val)}
            />

            {settings.enable_content_policy_filter && (
              <>
                <SettingField
                  type="multiselect"
                  label={t("sidepanel:rag.contentPolicyTypes", "Policy types")}
                  value={settings.content_policy_types}
                  onChange={(val) =>
                    onUpdate(
                      "content_policy_types",
                      val as RagSettings["content_policy_types"]
                    )
                  }
                  options={CONTENT_POLICY_TYPE_OPTIONS}
                />

                <SettingField
                  type="select"
                  label={t("sidepanel:rag.contentPolicyMode", "Policy mode")}
                  value={settings.content_policy_mode}
                  onChange={(val) =>
                    onUpdate(
                      "content_policy_mode",
                      val as RagSettings["content_policy_mode"]
                    )
                  }
                  options={CONTENT_POLICY_MODE_OPTIONS}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Injection Filter Section */}
      {matchesFilter("injection") && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.injectionProtection", "Injection Protection")}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableInjectionFilter", "Enable filter")}
              value={settings.enable_injection_filter}
              onChange={(val) => onUpdate("enable_injection_filter", val)}
              helper={t(
                "sidepanel:rag.enableInjectionFilterHelper",
                "Detect prompt injection attempts"
              )}
            />

            {settings.enable_injection_filter && (
              <SettingField
                type="number"
                label={t("sidepanel:rag.injectionFilterStrength", "Filter strength")}
                value={settings.injection_filter_strength}
                onChange={(val) => onUpdate("injection_filter_strength", val)}
                min={0}
                max={1}
                step={0.1}
              />
            )}
          </div>
        </div>
      )}

      {/* Numeric Fidelity Section */}
      {matchesFilter("numeric") && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {t("sidepanel:rag.numericFidelity", "Numeric Fidelity")}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={t("sidepanel:rag.enableNumericFidelity", "Enable checking")}
              value={settings.enable_numeric_fidelity}
              onChange={(val) => onUpdate("enable_numeric_fidelity", val)}
              helper={t(
                "sidepanel:rag.enableNumericFidelityHelper",
                "Verify numeric accuracy in answers"
              )}
            />

            {settings.enable_numeric_fidelity && (
              <SettingField
                type="select"
                label={t("sidepanel:rag.numericFidelityBehavior", "On error")}
                value={settings.numeric_fidelity_behavior}
                onChange={(val) =>
                  onUpdate(
                    "numeric_fidelity_behavior",
                    val as RagSettings["numeric_fidelity_behavior"]
                  )
                }
                options={NUMERIC_FIDELITY_BEHAVIOR_OPTIONS}
              />
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
