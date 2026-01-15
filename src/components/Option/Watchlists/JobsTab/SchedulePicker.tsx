import React, { useState } from "react"
import { Button, Input, Select, Space } from "antd"
import { Clock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CronDisplay } from "../shared"

interface SchedulePickerProps {
  value: string | null | undefined
  onChange: (schedule: string | null) => void
  timezone?: string
  onTimezoneChange?: (tz: string) => void
}

interface SchedulePreset {
  label: string
  cron: string
  description: string
}

const PRESETS: SchedulePreset[] = [
  { label: "Every hour", cron: "0 * * * *", description: "At minute 0 of every hour" },
  { label: "Every 6 hours", cron: "0 */6 * * *", description: "At minute 0 every 6 hours" },
  { label: "Daily at 9am", cron: "0 9 * * *", description: "Every day at 9:00 AM" },
  { label: "Daily at 6pm", cron: "0 18 * * *", description: "Every day at 6:00 PM" },
  { label: "Twice daily", cron: "0 9,18 * * *", description: "At 9:00 AM and 6:00 PM" },
  { label: "Weekly (Mon)", cron: "0 9 * * MON", description: "Every Monday at 9:00 AM" },
  { label: "Weekly (Fri)", cron: "0 9 * * FRI", description: "Every Friday at 9:00 AM" }
]

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Denver", label: "US Mountain" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" }
]

export const SchedulePicker: React.FC<SchedulePickerProps> = ({
  value,
  onChange,
  timezone = "UTC",
  onTimezoneChange
}) => {
  const { t } = useTranslation(["watchlists"])
  const [customMode, setCustomMode] = useState(false)
  const [customCron, setCustomCron] = useState(value || "")

  const isPreset = PRESETS.some((p) => p.cron === value)

  const handlePresetClick = (cron: string) => {
    setCustomMode(false)
    onChange(cron)
  }

  const handleCustomChange = (cron: string) => {
    setCustomCron(cron)
  }

  const handleCustomApply = () => {
    if (customCron.trim()) {
      onChange(customCron.trim())
    }
  }

  const handleClear = () => {
    setCustomCron("")
    setCustomMode(false)
    onChange(null)
  }

  return (
    <div className="space-y-4">
      {/* Current schedule display */}
      {value && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <CronDisplay expression={value} showIcon={false} />
          </div>
          <Button size="small" onClick={handleClear}>
            {t("watchlists:schedule.clear", "Clear")}
          </Button>
        </div>
      )}

      {/* Presets */}
      <div>
        <div className="text-sm font-medium mb-2">
          {t("watchlists:schedule.presets", "Quick Presets")}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.cron}
              size="small"
              type={value === preset.cron ? "primary" : "default"}
              onClick={() => handlePresetClick(preset.cron)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom cron */}
      <div>
        <div className="text-sm font-medium mb-2">
          {t("watchlists:schedule.custom", "Custom Schedule")}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t("watchlists:schedule.cronPlaceholder", "Cron expression (e.g., 0 9 * * MON)")}
            value={customCron}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="flex-1"
            onPressEnter={handleCustomApply}
          />
          <Button
            type="primary"
            onClick={handleCustomApply}
            disabled={!customCron.trim()}
          >
            {t("watchlists:schedule.apply", "Apply")}
          </Button>
        </div>
        {customCron && customCron !== value && (
          <div className="mt-2 text-sm text-zinc-500">
            <span className="font-medium">{t("watchlists:schedule.preview", "Preview")}:</span>{" "}
            <CronDisplay expression={customCron} showIcon={false} />
          </div>
        )}
      </div>

      {/* Timezone */}
      {onTimezoneChange && (
        <div>
          <div className="text-sm font-medium mb-2">
            {t("watchlists:schedule.timezone", "Timezone")}
          </div>
          <Select
            value={timezone}
            onChange={onTimezoneChange}
            className="w-48"
            options={TIMEZONES}
            showSearch
            optionFilterProp="label"
          />
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-zinc-500">
        {t(
          "watchlists:schedule.help",
          "Cron format: minute hour day-of-month month day-of-week. Use * for any, */N for every N intervals."
        )}
      </div>
    </div>
  )
}
