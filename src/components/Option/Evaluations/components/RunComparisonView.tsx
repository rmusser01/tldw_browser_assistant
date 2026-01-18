/**
 * RunComparisonView component
 * Side-by-side metrics comparison with delta highlighting.
 */

import React, { useMemo } from "react"
import { Empty, Typography } from "antd"
import { useTranslation } from "react-i18next"
import type { EvaluationRunDetail } from "@/services/evaluations"
import {
  flattenMetrics,
  formatMetricDelta,
  formatMetricValue
} from "../utils/metricsFormatter"

const { Text } = Typography

interface RunComparisonViewProps {
  runA?: EvaluationRunDetail | null
  runB?: EvaluationRunDetail | null
  className?: string
}

export const RunComparisonView: React.FC<RunComparisonViewProps> = ({
  runA,
  runB,
  className = ""
}) => {
  const { t } = useTranslation(["evaluations", "common"])

  const { rows, hasMetrics } = useMemo(() => {
    const metricsA = flattenMetrics(runA?.results)
    const metricsB = flattenMetrics(runB?.results)
    const keys = Array.from(
      new Set([...Object.keys(metricsA), ...Object.keys(metricsB)])
    ).sort()

    const rows = keys.map((key) => {
      const a = metricsA[key]
      const b = metricsB[key]
      const delta =
        typeof a === "number" && typeof b === "number" ? b - a : NaN
      return { key, a, b, delta }
    })

    return { rows, hasMetrics: rows.length > 0 }
  }, [runA, runB])

  if (!runA || !runB || !hasMetrics) {
    return (
      <Empty
        description={t("evaluations:compareEmpty", {
          defaultValue: "Select two runs with metrics to compare."
        })}
        className={className}
      />
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs text-text-subtle">
        <Text type="secondary">
          {t("evaluations:compareRunLabel", {
            defaultValue: "Run A"
          })}
          {": "}
          <code>{runA.id}</code>
        </Text>
        <Text type="secondary">
          {t("evaluations:compareRunLabelB", {
            defaultValue: "Run B"
          })}
          {": "}
          <code>{runB.id}</code>
        </Text>
      </div>
      <div className="overflow-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface2 text-left">
            <tr>
              <th className="px-3 py-2">
                {t("evaluations:compareMetricHeader", {
                  defaultValue: "Metric"
                })}
              </th>
              <th className="px-3 py-2">
                {t("evaluations:compareRunAHeader", {
                  defaultValue: "Run A"
                })}
              </th>
              <th className="px-3 py-2">
                {t("evaluations:compareRunBHeader", {
                  defaultValue: "Run B"
                })}
              </th>
              <th className="px-3 py-2">
                {t("evaluations:compareDeltaHeader", {
                  defaultValue: "Delta"
                })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const deltaClass =
                typeof row.delta === "number" && Number.isFinite(row.delta)
                  ? row.delta > 0
                    ? "text-green-600"
                    : row.delta < 0
                      ? "text-red-600"
                      : "text-text-subtle"
                  : "text-text-subtle"
              return (
                <tr key={row.key} className="border-t border-border">
                  <td className="px-3 py-2 text-text-subtle">{row.key}</td>
                  <td className="px-3 py-2">
                    {typeof row.a === "number"
                      ? formatMetricValue(row.a)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {typeof row.b === "number"
                      ? formatMetricValue(row.b)
                      : "—"}
                  </td>
                  <td className={`px-3 py-2 font-mono ${deltaClass}`}>
                    {formatMetricDelta(row.delta)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RunComparisonView
