import React from "react"
import { Select, Space, Typography } from "antd"
import type { IngestPreset } from "./types"
import { PRESET_META, PRESET_ORDER, DEFAULT_PRESET } from "./presets"

type PresetSelectorProps = {
  /**
   * Translation function for quick-ingest namespace.
   */
  qi: (key: string, defaultValue: string, options?: Record<string, unknown>) => string
  /**
   * Currently selected preset.
   */
  value: IngestPreset
  /**
   * Callback when preset changes.
   */
  onChange: (preset: IngestPreset) => void
  /**
   * Callback to reset to default preset.
   */
  onReset?: () => void
  /**
   * Whether the selector is disabled.
   */
  disabled?: boolean
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  qi,
  value,
  onChange,
  onReset,
  disabled = false
}) => {
  const handleChange = React.useCallback(
    (newValue: IngestPreset) => {
      onChange(newValue)
    },
    [onChange]
  )

  const handleReset = React.useCallback(() => {
    onReset?.()
  }, [onReset])

  const options = PRESET_ORDER.map((presetKey) => {
    const meta = PRESET_META[presetKey]
    const label = qi(meta.labelKey, presetKey.charAt(0).toUpperCase() + presetKey.slice(1))
    const description = qi(meta.descriptionKey, "")
    const isRecommended = presetKey === DEFAULT_PRESET

    return {
      value: presetKey,
      label: (
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{meta.icon}</span>
          <span>
            {label}
            {isRecommended && (
              <span className="ml-1 text-xs text-text-muted">
                {qi("preset.recommended", "(Recommended)")}
              </span>
            )}
          </span>
        </div>
      ),
      // For search filtering
      searchLabel: label,
      description
    }
  })

  return (
    <div className="flex items-center gap-3">
      <Space align="center" size="small">
        <Typography.Text className="text-sm">
          {qi("preset.label", "Preset")}:
        </Typography.Text>
        <Select<IngestPreset>
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="min-w-48"
          popupMatchSelectWidth={false}
          aria-label={qi("preset.ariaLabel", "Select processing preset")}
          optionLabelProp="label"
          options={options.map((opt) => ({
            value: opt.value,
            label: opt.label,
            // Custom render for dropdown with description
            dropdownRender: undefined
          }))}
          optionRender={(option) => {
            const presetKey = option.value as IngestPreset
            const meta = PRESET_META[presetKey]
            const label = qi(meta.labelKey, presetKey.charAt(0).toUpperCase() + presetKey.slice(1))
            const description = qi(meta.descriptionKey, "")
            const isRecommended = presetKey === DEFAULT_PRESET

            return (
              <div className="py-1">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-base">
                    {meta.icon}
                  </span>
                  <span className="font-medium">
                    {label}
                    {isRecommended && (
                      <span className="ml-1 text-xs font-normal text-text-muted">
                        {qi("preset.recommended", "(Recommended)")}
                      </span>
                    )}
                  </span>
                </div>
                {description && (
                  <div className="ml-6 text-xs text-text-muted">{description}</div>
                )}
              </div>
            )
          }}
        />
      </Space>
      {value !== "custom" && onReset && (
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="text-xs text-primary hover:text-primaryStrong underline underline-offset-2 disabled:opacity-50"
        >
          {qi("preset.reset", "Reset to defaults")}
        </button>
      )}
    </div>
  )
}

export default PresetSelector
