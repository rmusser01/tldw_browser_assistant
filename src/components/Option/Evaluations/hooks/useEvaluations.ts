/**
 * useEvaluations hook
 * Handles evaluation CRUD operations and queries
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import {
  createEvaluation,
  deleteEvaluation,
  getEvaluation,
  listEvaluations,
  updateEvaluation,
  type CreateEvaluationPayload,
  type EvaluationDetail
} from "@/services/evaluations"
import {
  getEvaluationDefaults,
  setDefaultSpecForType
} from "@/services/evaluations-settings"
import { useEvaluationsStore } from "@/store/evaluations"
import { EVAL_SPEC_SCHEMAS, EVAL_SPEC_TYPES } from "../utils/evalSpecSchemas"

// Helper to ensure API responses are ok
const ensureOk = <T,>(resp: any): T => {
  if (!resp?.ok) {
    const err = new Error(resp?.error || `HTTP ${resp?.status}`)
    ;(err as any).resp = resp
    throw err
  }
  return resp as T
}

// Default eval specs for different eval types
export const getDefaultEvalSpecForType = (
  evalType: string,
  overrides?: Record<string, string>
): Record<string, any> => {
  if (overrides && overrides[evalType]) {
    try {
      return JSON.parse(overrides[evalType])
    } catch {
      // fall through to defaults
    }
  }
  return EVAL_SPEC_SCHEMAS[evalType]?.defaultSpec || {
    metrics: ["accuracy"],
    model: "gpt-3.5-turbo",
    temperature: 0.3
  }
}

// Eval type options for select dropdowns
export const evalTypeOptions = EVAL_SPEC_TYPES.map((type) => ({
  value: type,
  label: EVAL_SPEC_SCHEMAS[type]?.label || type
}))

export function useEvaluationDefaults() {
  return useQuery({
    queryKey: ["evaluations", "defaults", "ui"],
    queryFn: () => getEvaluationDefaults()
  })
}

export function useEvaluationsList(params?: {
  limit?: number
  after?: string
  eval_type?: string
}) {
  return useQuery({
    queryKey: ["evaluations", "list", params || { limit: 20 }],
    queryFn: () => listEvaluations(params || { limit: 20 })
  })
}

export function useEvaluationDetail(evalId: string | null) {
  return useQuery({
    queryKey: ["evaluations", "detail", evalId],
    queryFn: () => getEvaluation(evalId as string),
    enabled: !!evalId
  })
}

export function useCreateEvaluation() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()
  const setSelectedEvalId = useEvaluationsStore((s) => s.setSelectedEvalId)

  return useMutation({
    mutationFn: async (params: {
      payload: CreateEvaluationPayload
      idempotencyKey?: string
    }) =>
      ensureOk(
        await createEvaluation(params.payload, {
          idempotencyKey: params.idempotencyKey
        })
      ),
    onSuccess: (resp: any) => {
      void queryClient.invalidateQueries({
        queryKey: ["evaluations", "list"]
      })
      const evalId = resp?.data?.id
      if (evalId) {
        setSelectedEvalId(evalId)
      }
      notification.success({
        message: t("settings:evaluations.createSuccessTitle", {
          defaultValue: "Evaluation created"
        })
      })
    },
    onError: (error: any) => {
      const retryAfter = error?.resp?.retryAfterMs
      notification.error({
        message: t("settings:evaluations.createErrorTitle", {
          defaultValue: "Failed to create evaluation"
        }),
        description:
          error?.message ||
          t("settings:evaluations.createErrorDescription", {
            defaultValue:
              "The server rejected this evaluation. Ensure name, type, and spec are valid."
          }) +
            (retryAfter
              ? ` — retry after ${Math.ceil(Number(retryAfter) / 1000)}s`
              : "")
      })
    }
  })
}

export function useUpdateEvaluation() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()
  const selectedEvalId = useEvaluationsStore((s) => s.selectedEvalId)

  return useMutation({
    mutationFn: async (params: {
      evalId: string
      payload: Partial<CreateEvaluationPayload>
    }) => ensureOk(await updateEvaluation(params.evalId, params.payload)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["evaluations", "list"]
      })
      if (selectedEvalId) {
        void queryClient.invalidateQueries({
          queryKey: ["evaluations", "detail", selectedEvalId]
        })
      }
      notification.success({
        message: t("settings:evaluations.updateSuccessTitle", {
          defaultValue: "Evaluation updated"
        })
      })
    },
    onError: (error: any) => {
      notification.error({
        message: t("settings:evaluations.updateErrorTitle", {
          defaultValue: "Failed to update evaluation"
        }),
        description: error?.message
      })
    }
  })
}

export function useDeleteEvaluation() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()
  const { selectedEvalId, setSelectedEvalId, setSelectedRunId, setEditingEvalId } =
    useEvaluationsStore((s) => ({
      selectedEvalId: s.selectedEvalId,
      setSelectedEvalId: s.setSelectedEvalId,
      setSelectedRunId: s.setSelectedRunId,
      setEditingEvalId: s.setEditingEvalId
    }))

  return useMutation({
    mutationFn: async (evalId: string) =>
      ensureOk(await deleteEvaluation(evalId)),
    onSuccess: (_resp, evalId) => {
      void queryClient.invalidateQueries({
        queryKey: ["evaluations", "list"]
      })
      if (selectedEvalId === evalId) {
        setSelectedEvalId(null)
        setSelectedRunId(null)
      }
      setEditingEvalId(null)
      notification.success({
        message: t("common:deleted", { defaultValue: "Deleted" })
      })
    },
    onError: (error: any) => {
      notification.error({
        message: t("settings:evaluations.deleteErrorTitle", {
          defaultValue: "Failed to delete evaluation"
        }),
        description: error?.message
      })
    }
  })
}

// Helper to persist spec as default for a type
export function usePersistDefaultSpec() {
  return async (evalType: string, specText: string) => {
    if (specText) {
      await setDefaultSpecForType(evalType, specText)
    }
  }
}
