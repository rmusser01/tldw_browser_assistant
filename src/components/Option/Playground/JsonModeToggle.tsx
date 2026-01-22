import React from "react"
import { Switch, Tooltip, Popover } from "antd"
import { useTranslation } from "react-i18next"
import { useStoreChatModelSettings } from "@/store/model"
import { Braces, Info, AlertCircle } from "lucide-react"

type Props = {
  compact?: boolean
  showLabel?: boolean
  className?: string
}

const JSON_MODE_INFO = {
  supported: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "claude-3",
    "gemini",
    "mistral"
  ],
  unsupported: ["ollama", "local"]
}

export const JsonModeToggle: React.FC<Props> = ({
  compact = false,
  showLabel = true,
  className
}) => {
  const { t } = useTranslation(["playground", "common"])
  const jsonMode = useStoreChatModelSettings((s) => s.jsonMode)
  const setJsonMode = useStoreChatModelSettings((s) => s.setJsonMode)

  const renderInfo = () => (
    <div className="max-w-xs space-y-2 text-xs">
      <div className="font-medium">
        {t("playground:jsonMode.title", "JSON Mode")}
      </div>
      <p className="text-text-muted">
        {t(
          "playground:jsonMode.description",
          "When enabled, the model will output valid JSON. This is useful for structured data extraction, API responses, and programmatic parsing."
        )}
      </p>
      <div className="space-y-1">
        <div className="font-medium">
          {t("playground:jsonMode.tips", "Tips:")}
        </div>
        <ul className="list-inside list-disc space-y-0.5 text-text-muted">
          <li>
            {t(
              "playground:jsonMode.tip1",
              "Include \"JSON\" in your prompt for best results"
            )}
          </li>
          <li>
            {t(
              "playground:jsonMode.tip2",
              "Describe the expected schema in your system prompt"
            )}
          </li>
          <li>
            {t(
              "playground:jsonMode.tip3",
              "Not all models support structured output"
            )}
          </li>
        </ul>
      </div>
      <div className="border-t border-border pt-2">
        <div className="flex items-center gap-1 text-[10px] text-text-subtle">
          <AlertCircle className="h-3 w-3" />
          {t(
            "playground:jsonMode.warning",
            "May increase response time slightly"
          )}
        </div>
      </div>
    </div>
  )

  const handleChange = (checked: boolean) => {
    setJsonMode(checked)
  }

  if (compact) {
    return (
      <Tooltip title={t("playground:jsonMode.title", "JSON Mode")} placement="top">
        <button
          type="button"
          onClick={() => handleChange(!jsonMode)}
          className={`flex items-center justify-center rounded-lg border p-2 transition-colors ${
            jsonMode
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-text-muted hover:border-primary/50 hover:bg-surface-hover"
          } ${className || ""}`}>
          <Braces className="h-4 w-4" />
        </button>
      </Tooltip>
    )
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 ${className || ""}`}>
      <div className="flex items-center gap-2">
        <Braces
          className={`h-4 w-4 ${jsonMode ? "text-primary" : "text-text-muted"}`}
        />
        {showLabel && (
          <span className="text-sm">
            {t("playground:jsonMode.label", "JSON Output")}
          </span>
        )}
        <Popover content={renderInfo()} trigger="click" placement="bottom">
          <button type="button" className="text-text-subtle hover:text-text">
            <Info className="h-3.5 w-3.5" />
          </button>
        </Popover>
      </div>
      <Switch
        size="small"
        checked={jsonMode ?? false}
        onChange={handleChange}
      />
    </div>
  )
}

type JsonModeIndicatorProps = {
  className?: string
}

export const JsonModeIndicator: React.FC<JsonModeIndicatorProps> = ({
  className
}) => {
  const { t } = useTranslation(["playground"])
  const jsonMode = useStoreChatModelSettings((s) => s.jsonMode)

  if (!jsonMode) {
    return null
  }

  return (
    <Tooltip
      title={t(
        "playground:jsonMode.activeHint",
        "Responses will be formatted as valid JSON"
      )}
      placement="top">
      <div
        className={`flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary ${className || ""}`}>
        <Braces className="h-3 w-3" />
        JSON
      </div>
    </Tooltip>
  )
}
