/**
 * MetricsChart component
 * Simple native SVG bar chart for displaying evaluation metrics
 */

import React from "react"
import { Typography } from "antd"
import { useTranslation } from "react-i18next"
import { clamp01, formatMetricValue } from "../utils/metricsFormatter"

const { Text } = Typography

interface Metric {
  key: string
  value: number
}

interface MetricsChartProps {
  metrics: Metric[]
  className?: string
  showLabel?: boolean
}

// Color scale based on value (0-1)
const getBarColor = (value: number): string => {
  if (value >= 0.8) return "bg-green-500"
  if (value >= 0.6) return "bg-blue-500"
  if (value >= 0.4) return "bg-yellow-500"
  return "bg-red-500"
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  metrics,
  className = "",
  showLabel = true
}) => {
  const { t } = useTranslation(["evaluations", "common"])

  if (!metrics || metrics.length === 0) {
    return (
      <Text type="secondary" className="text-xs">
        {t("evaluations:noMetrics", {
          defaultValue: "No metrics available"
        })}
      </Text>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <Text type="secondary" className="text-xs">
          {t("evaluations:metricsLabel", { defaultValue: "Metrics" })}
        </Text>
      )}
      <div className="space-y-1.5">
        {metrics.map((m) => {
          // Normalize value to 0-1 range for display (assuming most metrics are 0-1)
          const displayValue = clamp01(m.value)
          const widthPercent = displayValue * 100

          return (
            <div key={m.key} className="flex items-center gap-2">
              <span
                className="w-32 truncate text-[11px] text-text-subtle"
                title={m.key}
              >
                {m.key}
              </span>
              <div className="flex-1 h-4 bg-surface2 rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getBarColor(m.value)}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <span className="w-14 font-mono text-[11px] text-right">
                {typeof m.value === "number" ? formatMetricValue(m.value) : "—"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MetricsChart
