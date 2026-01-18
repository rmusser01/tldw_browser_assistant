/**
 * useRuns hook
 * Handles evaluation run operations and queries
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import {
  cancelRun,
  createRun,
  createSpecializedEvaluation,
  getRateLimits,
  getRun,
  listRuns,
  listRunsGlobal,
  type CreateRunPayload,
  type EvaluationRateLimitStatus,
  type EvaluationRunDetail
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

// Parse rate limit snapshot from response headers
export const parseQuotaSnapshot = (
  headers?: Record<string, string> | null
): {
  limitDay?: number
  remainingDay?: number
  limitMinute?: number
  remainingMinute?: number
  reset?: string | null
} | null => {
  if (!headers) return null
  const h: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    h[k.toLowerCase()] = v
  }
  const num = (s?: string | null) => {
    if (s == null) return undefined
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
  }
  const snapshot = {
    limitDay: num(h["x-ratelimit-limit-day"] || h["x-ratelimit-day-limit"]),
    remainingDay: num(
      h["x-ratelimit-remaining-day"] || h["x-ratelimit-day-remaining"]
    ),
    limitMinute: num(
      h["x-ratelimit-limit-minute"] || h["x-ratelimit-minute-limit"]
    ),
    remainingMinute: num(
      h["x-ratelimit-remaining-minute"] || h["x-ratelimit-minute-remaining"]
    ),
    reset: h["x-ratelimit-reset"] || h["x-ratelimit-reset-at"] || null
  }
  const hasData = Object.values(snapshot).some(
    (v) => v !== undefined && v !== null
  )
  return hasData ? snapshot : null
}

// Extract metrics summary from run results
export const extractMetricsSummary = (
  results: any
): { key: string; value: number }[] => {
  if (!results) return []
  const list: { key: string; value: number }[] = []
  const candidate =
    results?.metrics && typeof results.metrics === "object"
      ? results.metrics
      : results

  const walk = (obj: any, prefix = "") => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return
    for (const [k, v] of Object.entries(obj)) {
      const name = prefix ? `${prefix}.${k}` : k
      if (typeof v === "number" && Number.isFinite(v)) {
        list.push({ key: name, value: v })
      } else if (v && typeof v === "object" && list.length < 20) {
        walk(v, name)
      }
    }
  }

  walk(candidate)
  return list.slice(0, 20)
}

export function useRateLimits() {
  return useQuery({
    queryKey: ["evaluations", "rate-limits"],
    queryFn: () => getRateLimits()
  })
}

export function useRunsList(evalId: string | null, params?: { limit?: number }) {
  return useQuery({
    queryKey: ["evaluations", "runs", evalId, params || { limit: 20 }],
    queryFn: () => listRuns(evalId as string, params || { limit: 20 }),
    enabled: !!evalId
  })
}

export function useRunsListGlobal(params?: {
  limit?: number
  eval_id?: string
  status?: string
}) {
  return useQuery({
    queryKey: ["evaluations", "runs", "global", params],
    queryFn: () => listRunsGlobal(params)
  })
}

export function useRunDetail(runId: string | null) {
  const setQuotaSnapshot = useEvaluationsStore((s) => s.setQuotaSnapshot)
  const setIsPolling = useEvaluationsStore((s) => s.setIsPolling)

  return useQuery({
    queryKey: ["evaluations", "run", runId],
    queryFn: async () => {
      const resp = await getRun(runId as string)
      // Parse quota from headers
      const snapshot = parseQuotaSnapshot(resp?.headers as any)
      if (snapshot) setQuotaSnapshot(snapshot)
      return resp
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = (query?.state?.data as any)?.data?.status
      if (!status) {
        setIsPolling(false)
        return false
      }
      const isPolling = ["running", "pending"].includes(
        String(status).toLowerCase()
      )
      setIsPolling(isPolling)
      return isPolling ? 3000 : false
    }
  })
}

export function useCreateRun() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()
  const selectedEvalId = useEvaluationsStore((s) => s.selectedEvalId)
  const setSelectedRunId = useEvaluationsStore((s) => s.setSelectedRunId)
  const setQuotaSnapshot = useEvaluationsStore((s) => s.setQuotaSnapshot)

  return useMutation({
    mutationFn: async (params: {
      evalId: string
      payload: CreateRunPayload
      idempotencyKey?: string
    }) =>
      ensureOk(
        await createRun(params.evalId, params.payload, {
          idempotencyKey: params.idempotencyKey
        })
      ),
    onSuccess: (resp: any) => {
      const runId = resp?.data?.id || resp?.data?.run_id
      const snapshot = parseQuotaSnapshot(resp?.headers)
      if (snapshot) setQuotaSnapshot(snapshot)
      if (runId) {
        setSelectedRunId(String(runId))
        void queryClient.invalidateQueries({
          queryKey: ["evaluations", "runs", selectedEvalId]
        })
      }
      notification.success({
        message: t("settings:evaluations.runCreateSuccessTitle", {
          defaultValue: "Run started"
        }),
        description: t("settings:evaluations.runCreateSuccessDescription", {
          defaultValue:
            "Your evaluation run has started. You can monitor it from the server UI."
        })
      })
    },
    onError: (error: any) => {
      const retryAfter = error?.resp?.retryAfterMs
      notification.error({
        message: t("settings:evaluations.runCreateErrorTitle", {
          defaultValue: "Failed to start run"
        }),
        description:
          error?.message ||
          t("settings:evaluations.runCreateErrorDescription", {
            defaultValue:
              "The server rejected this run request. Check the model and try again."
          }) +
            (retryAfter
              ? ` — retry after ${Math.ceil(Number(retryAfter) / 1000)}s`
              : "")
      })
    }
  })
}

export function useCancelRun() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()
  const selectedEvalId = useEvaluationsStore((s) => s.selectedEvalId)
  const selectedRunId = useEvaluationsStore((s) => s.selectedRunId)

  return useMutation({
    mutationFn: async (runId: string) => ensureOk(await cancelRun(runId)),
    onSuccess: () => {
      notification.success({
        message: t("settings:evaluations.runCancelSuccessTitle", {
          defaultValue: "Run cancellation requested"
        })
      })
      if (selectedEvalId) {
        void queryClient.invalidateQueries({
          queryKey: ["evaluations", "runs", selectedEvalId]
        })
      }
      if (selectedRunId) {
        void queryClient.invalidateQueries({
          queryKey: ["evaluations", "run", selectedRunId]
        })
      }
    },
    onError: (error: any) => {
      notification.error({
        message: t("settings:evaluations.runCancelErrorTitle", {
          defaultValue: "Failed to cancel run"
        }),
        description: error?.message
      })
    }
  })
}

export function useAdhocEvaluation() {
  const { t } = useTranslation(["settings", "common"])
  const notification = useAntdNotification()
  const setAdhocResult = useEvaluationsStore((s) => s.setAdhocResult)

  return useMutation({
    mutationFn: async (payload: { endpoint: string; body: any }) =>
      ensureOk(
        await createSpecializedEvaluation(payload.endpoint, payload.body)
      ),
    onSuccess: (resp: any) => {
      setAdhocResult(resp?.data || resp)
      notification.success({
        message: t("settings:evaluations.runCreateSuccessTitle", {
          defaultValue: "Run started"
        }),
        description: t("settings:evaluations.runCreateSuccessDescription", {
          defaultValue:
            "Your evaluation run has started. You can monitor it from the server UI."
        })
      })
    },
    onError: (error: any) => {
      notification.error({
        message: t("settings:evaluations.createErrorTitle", {
          defaultValue: "Failed to create evaluation"
        }),
        description: error?.message
      })
    }
  })
}

// Adhoc endpoint options
export const adhocEndpointOptions = [
  { value: "response-quality", label: "response-quality" },
  { value: "rag", label: "rag" },
  { value: "geval", label: "geval" },
  { value: "propositions", label: "propositions" },
  { value: "ocr", label: "ocr" },
  { value: "ocr-pdf", label: "ocr-pdf" },
  { value: "batch", label: "batch" }
]
