/**
 * useHistory hook
 * Handles evaluation history queries
 */

import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import {
  getHistory,
  type EvaluationHistoryFilters,
  type EvaluationHistoryItem
} from "@/services/evaluations"
import { useEvaluationsStore } from "@/store/evaluations"

// Helper to ensure API responses are ok
const ensureOk = <T,>(resp: any): T => {
  if (!resp?.ok) {
    const err = new Error(resp?.error || `HTTP ${resp?.status}`)
    ;(err as any).resp = resp
    throw err
  }
  return resp as T
}

export function useFetchHistory() {
  const { t } = useTranslation(["evaluations", "common"])
  const notification = useAntdNotification()
  const setHistoryResults = useEvaluationsStore((s) => s.setHistoryResults)

  return useMutation({
    mutationFn: async (filters: EvaluationHistoryFilters) =>
      ensureOk<{ data: { data?: EvaluationHistoryItem[] } }>(
        await getHistory(filters)
      ),
    onSuccess: (resp) => {
      const list =
        resp?.data?.data ||
        (Array.isArray(resp?.data) ? resp?.data : (resp?.data as any)?.items) ||
        []
      setHistoryResults(list as EvaluationHistoryItem[])
    },
    onError: (error: any) => {
      notification.error({
        message: t("evaluations:historyErrorTitle", {
          defaultValue: "Failed to fetch history"
        }),
        description: error?.message
      })
    }
  })
}

// History filter presets
export const historyTypePresets = [
  { value: "evaluation.created", label: "evaluation.created" },
  { value: "evaluation.started", label: "evaluation.started" },
  { value: "evaluation.completed", label: "evaluation.completed" },
  { value: "evaluation.failed", label: "evaluation.failed" },
  { value: "evaluation.cancelled", label: "evaluation.cancelled" },
  { value: "run.created", label: "run.created" },
  { value: "run.started", label: "run.started" },
  { value: "run.completed", label: "run.completed" },
  { value: "run.failed", label: "run.failed" }
]
