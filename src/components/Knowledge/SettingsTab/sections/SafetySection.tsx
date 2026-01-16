import React from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import type { RagSettings } from "@/services/rag/unified-rag"
import { SettingField } from "../shared/SettingField"
import { CollapsibleSection } from "../shared/CollapsibleSection"

type SafetySectionProps = {
  settings: RagSettings
  onUpdate: <K extends keyof RagSettings>(key: K, value: RagSettings[K]) => void
  searchFilter?: string
}

export const getSafetySectionVisible = (
  searchFilter: string,
  t: TFunction
) => {
  const normalizedFilter = searchFilter.trim().toLowerCase()
  if (!normalizedFilter) return true
  const labels = [
    t("sidepanel:rag.safety", "Safety & Integrity"),
    t("sidepanel:rag.enableSecurityFilter", "Security filter"),
    t("sidepanel:rag.contentFilter", "Content filter"),
    t("sidepanel:rag.sensitivityLevel", "Sensitivity level"),
    t("sidepanel:rag.piiHandling", "PII Handling"),
    t("sidepanel:rag.contentPolicy", "Content Policy"),
    t("sidepanel:rag.injectionProtection", "Injection Protection"),
    t("sidepanel:rag.numericFidelity", "Numeric Fidelity")
  ]
  return labels.some((label) => label.toLowerCase().includes(normalizedFilter))
}

/**
 * Safety section - security, PII, content filters, and integrity checks
 */
export const SafetySection: React.FC<SafetySectionProps> = ({
  settings,
  onUpdate,
  searchFilter = ""
}) => {
  const { t } = useTranslation(["sidepanel"])
  const safetyTitle = t("sidepanel:rag.safety", "Safety & Integrity")
  const securityFilterLabel = t(
    "sidepanel:rag.enableSecurityFilter",
    "Security filter"
  )
  const contentFilterLabel = t("sidepanel:rag.contentFilter", "Content filter")
  const sensitivityLevelLabel = t(
    "sidepanel:rag.sensitivityLevel",
    "Sensitivity level"
  )
  const piiSectionLabel = t("sidepanel:rag.piiHandling", "PII Handling")
  const detectPiiLabel = t("sidepanel:rag.detectPii", "Detect PII")
  const redactPiiLabel = t("sidepanel:rag.redactPii", "Redact PII")
  const contentPolicyLabel = t(
    "sidepanel:rag.contentPolicy",
    "Content Policy"
  )
  const enableContentPolicyLabel = t(
    "sidepanel:rag.enableContentPolicy",
    "Enable policy filter"
  )
  const contentPolicyTypesLabel = t(
    "sidepanel:rag.contentPolicyTypes",
    "Policy types"
  )
  const contentPolicyModeLabel = t(
    "sidepanel:rag.contentPolicyMode",
    "Policy mode"
  )
  const injectionProtectionLabel = t(
    "sidepanel:rag.injectionProtection",
    "Injection Protection"
  )
  const enableInjectionFilterLabel = t(
    "sidepanel:rag.enableInjectionFilter",
    "Enable filter"
  )
  const injectionFilterStrengthLabel = t(
    "sidepanel:rag.injectionFilterStrength",
    "Filter strength"
  )
  const numericFidelityLabel = t(
    "sidepanel:rag.numericFidelity",
    "Numeric Fidelity"
  )
  const enableNumericFidelityLabel = t(
    "sidepanel:rag.enableNumericFidelity",
    "Enable checking"
  )
  const numericFidelityBehaviorLabel = t(
    "sidepanel:rag.numericFidelityBehavior",
    "On error"
  )

  const sensitivityLevelOptions = [
    { label: t("sidepanel:rag.sensitivity.public", "Public"), value: "public" },
    {
      label: t("sidepanel:rag.sensitivity.internal", "Internal"),
      value: "internal"
    },
    {
      label: t("sidepanel:rag.sensitivity.confidential", "Confidential"),
      value: "confidential"
    },
    {
      label: t("sidepanel:rag.sensitivity.restricted", "Restricted"),
      value: "restricted"
    }
  ]

  const contentPolicyTypeOptions = [
    { label: t("sidepanel:rag.contentPolicyTypeOptions.pii", "PII"), value: "pii" },
    { label: t("sidepanel:rag.contentPolicyTypeOptions.phi", "PHI"), value: "phi" }
  ]

  const contentPolicyModeOptions = [
    {
      label: t("sidepanel:rag.contentPolicyModeOptions.redact", "Redact"),
      value: "redact"
    },
    { label: t("sidepanel:rag.contentPolicyModeOptions.drop", "Drop"), value: "drop" },
    {
      label: t("sidepanel:rag.contentPolicyModeOptions.annotate", "Annotate"),
      value: "annotate"
    }
  ]

  const numericFidelityBehaviorOptions = [
    {
      label: t("sidepanel:rag.numericFidelityBehaviorOptions.continue", "Continue"),
      value: "continue"
    },
    { label: t("sidepanel:rag.numericFidelityBehaviorOptions.ask", "Ask user"), value: "ask" },
    {
      label: t("sidepanel:rag.numericFidelityBehaviorOptions.decline", "Decline"),
      value: "decline"
    },
    { label: t("sidepanel:rag.numericFidelityBehaviorOptions.retry", "Retry"), value: "retry" }
  ]

  const normalizedFilter = searchFilter.trim().toLowerCase()
  const matchesFilter = (label: string) =>
    !normalizedFilter || label.toLowerCase().includes(normalizedFilter)

  const sectionVisible = getSafetySectionVisible(searchFilter, t)

  return (
    <CollapsibleSection
      title={safetyTitle}
      defaultExpanded={false}
      visible={sectionVisible}
    >
      {/* Security Filter */}
      {matchesFilter(securityFilterLabel) && (
        <SettingField
          type="switch"
          label={securityFilterLabel}
          value={settings.enable_security_filter}
          onChange={(val) => onUpdate("enable_security_filter", val)}
          helper={t(
            "sidepanel:rag.enableSecurityFilterHelper",
            "Filter potentially harmful content"
          )}
        />
      )}

      {/* Content Filter */}
      {matchesFilter(contentFilterLabel) && (
        <SettingField
          type="switch"
          label={contentFilterLabel}
          value={settings.content_filter}
          onChange={(val) => onUpdate("content_filter", val)}
        />
      )}

      {/* Sensitivity Level */}
      {matchesFilter(sensitivityLevelLabel) && (
        <SettingField
          type="select"
          label={sensitivityLevelLabel}
          value={settings.sensitivity_level}
          onChange={(val) =>
            onUpdate("sensitivity_level", val as RagSettings["sensitivity_level"])
          }
          options={sensitivityLevelOptions}
        />
      )}

      {/* PII Section */}
      {matchesFilter(piiSectionLabel) && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {piiSectionLabel}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={detectPiiLabel}
              value={settings.detect_pii}
              onChange={(val) => onUpdate("detect_pii", val)}
            />

            {settings.detect_pii && (
              <SettingField
                type="switch"
                label={redactPiiLabel}
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
      {matchesFilter(contentPolicyLabel) && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {contentPolicyLabel}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={enableContentPolicyLabel}
              value={settings.enable_content_policy_filter}
              onChange={(val) => onUpdate("enable_content_policy_filter", val)}
            />

            {settings.enable_content_policy_filter && (
              <>
                <SettingField
                  type="multiselect"
                  label={contentPolicyTypesLabel}
                  value={settings.content_policy_types}
                  onChange={(val) =>
                    onUpdate(
                      "content_policy_types",
                      val as RagSettings["content_policy_types"]
                    )
                  }
                  options={contentPolicyTypeOptions}
                />

                <SettingField
                  type="select"
                  label={contentPolicyModeLabel}
                  value={settings.content_policy_mode}
                  onChange={(val) =>
                    onUpdate(
                      "content_policy_mode",
                      val as RagSettings["content_policy_mode"]
                    )
                  }
                  options={contentPolicyModeOptions}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Injection Filter Section */}
      {matchesFilter(injectionProtectionLabel) && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {injectionProtectionLabel}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={enableInjectionFilterLabel}
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
                label={injectionFilterStrengthLabel}
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
      {matchesFilter(numericFidelityLabel) && (
        <div className="col-span-2 border-t border-border pt-3 mt-2">
          <span className="text-xs font-medium text-text mb-2 block">
            {numericFidelityLabel}
          </span>

          <div className="grid gap-3 md:grid-cols-2">
            <SettingField
              type="switch"
              label={enableNumericFidelityLabel}
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
                label={numericFidelityBehaviorLabel}
                value={settings.numeric_fidelity_behavior}
                onChange={(val) =>
                  onUpdate(
                    "numeric_fidelity_behavior",
                    val as RagSettings["numeric_fidelity_behavior"]
                  )
                }
                options={numericFidelityBehaviorOptions}
              />
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
