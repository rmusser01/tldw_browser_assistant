import { createSafeStorage } from "@/utils/safe-storage"

const storage = createSafeStorage({ area: "local" })
const METRICS_KEY = "compareMetrics"

export type CompareMetrics = {
  compareFeatureEnabled: number
  compareFeatureDisabled: number
  compareModeEnabled: number
  compareModeDisabled: number
  selectionEvents: number
  selectionSingle: number
  selectionMulti: number
  lastSelectionSize: number | null
  splitSingle: number
  splitBulk: number
  splitBulkChats: number
  exportCanonical: number
  lastEventAt: number | null
}

type CompareMetricEvent =
  | { type: "feature_enabled" }
  | { type: "feature_disabled" }
  | { type: "compare_mode_enabled" }
  | { type: "compare_mode_disabled" }
  | { type: "selection"; count: number }
  | { type: "split_single" }
  | { type: "split_bulk"; count: number }
  | { type: "export_canonical" }

const DEFAULT_METRICS: CompareMetrics = {
  compareFeatureEnabled: 0,
  compareFeatureDisabled: 0,
  compareModeEnabled: 0,
  compareModeDisabled: 0,
  selectionEvents: 0,
  selectionSingle: 0,
  selectionMulti: 0,
  lastSelectionSize: null,
  splitSingle: 0,
  splitBulk: 0,
  splitBulkChats: 0,
  exportCanonical: 0,
  lastEventAt: null
}

const readMetrics = async (): Promise<CompareMetrics> => {
  const stored = await storage.get<CompareMetrics | undefined>(METRICS_KEY)
  return {
    ...DEFAULT_METRICS,
    ...(stored || {})
  }
}

const writeMetrics = async (metrics: CompareMetrics) => {
  await storage.set(METRICS_KEY, metrics)
}

export const trackCompareMetric = async (event: CompareMetricEvent) => {
  try {
    const metrics = await readMetrics()
    metrics.lastEventAt = Date.now()

    switch (event.type) {
      case "feature_enabled":
        metrics.compareFeatureEnabled += 1
        break
      case "feature_disabled":
        metrics.compareFeatureDisabled += 1
        break
      case "compare_mode_enabled":
        metrics.compareModeEnabled += 1
        break
      case "compare_mode_disabled":
        metrics.compareModeDisabled += 1
        break
      case "selection":
        metrics.selectionEvents += 1
        metrics.lastSelectionSize = event.count
        if (event.count === 1) {
          metrics.selectionSingle += 1
        } else if (event.count > 1) {
          metrics.selectionMulti += 1
        }
        break
      case "split_single":
        metrics.splitSingle += 1
        break
      case "split_bulk":
        metrics.splitBulk += 1
        metrics.splitBulkChats += event.count
        break
      case "export_canonical":
        metrics.exportCanonical += 1
        break
      default:
        break
    }

    await writeMetrics(metrics)
  } catch (error) {
    console.warn("[compare-metrics] Failed to record metric", error)
  }
}
