/**
 * Metrics formatting helpers for evaluations UI.
 */

export interface MetricPoint {
  key: string
  value: number
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}

export const formatMetricValue = (value: number, digits = 3): string => {
  if (!isFiniteNumber(value)) return "—"
  return value.toFixed(digits)
}

export const formatMetricDelta = (delta: number, digits = 3): string => {
  if (!isFiniteNumber(delta)) return "—"
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : ""
  return `${sign}${Math.abs(delta).toFixed(digits)}`
}

export const flattenMetrics = (
  results: any,
  maxItems = 30
): Record<string, number> => {
  const map: Record<string, number> = {}
  const candidate =
    results?.metrics && typeof results.metrics === "object"
      ? results.metrics
      : results

  const walk = (obj: any, prefix = "") => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return
    for (const [k, v] of Object.entries(obj)) {
      const name = prefix ? `${prefix}.${k}` : k
      if (isFiniteNumber(v)) {
        map[name] = v
      } else if (v && typeof v === "object" && Object.keys(map).length < maxItems) {
        walk(v, name)
      }
      if (Object.keys(map).length >= maxItems) return
    }
  }

  walk(candidate)
  return map
}

export const metricsFromResults = (
  results: any,
  maxItems = 20
): MetricPoint[] => {
  const map = flattenMetrics(results, maxItems)
  return Object.entries(map).map(([key, value]) => ({ key, value }))
}
