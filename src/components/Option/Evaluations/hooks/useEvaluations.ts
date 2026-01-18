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
  switch (evalType) {
    case "model_graded":
      return {
        sub_type: "response_quality",
        metrics: ["coherence", "relevance", "groundedness"],
        threshold: 0.7,
        evaluator_model: "openai"
      }
    case "response_quality":
      return {
        metrics: ["coherence", "conciseness", "relevance"],
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        thresholds: { min_score: 0.7 }
      }
    case "rag":
      return {
        metrics: ["relevance", "faithfulness", "answer_similarity"],
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        thresholds: {
          min_relevance: 0.7,
          min_faithfulness: 0.7,
          min_answer_similarity: 0.7
        }
      }
    case "geval":
      return {
        metrics: ["g_eval_score"],
        model: "gpt-3.5-turbo",
        temperature: 0
      }
    case "exact_match":
      return {
        metrics: ["exact_match"],
        model: "gpt-3.5-turbo",
        temperature: 0
      }
    case "includes":
      return {
        metrics: ["includes"],
        case_sensitive: false
      }
    case "fuzzy_match":
      return {
        metrics: ["fuzzy_match"],
        threshold: 0.85
      }
    case "rag_pipeline":
      return {
        sub_type: "rag_pipeline",
        metrics: ["retrieval_precision", "faithfulness", "answer_relevancy"],
        evaluator_model: "openai"
      }
    case "proposition_extraction":
      return {
        metrics: ["proposition_extraction"],
        evaluator_model: "openai",
        proposition_schema: ["claim", "evidence"]
      }
    case "qa3":
      return {
        metrics: ["qa3"],
        evaluator_model: "openai",
        labels: ["good", "borderline", "bad"]
      }
    case "label_choice":
      return {
        metrics: ["label_choice"],
        allowed_labels: ["A", "B", "C"]
      }
    case "nli_factcheck":
      return {
        metrics: ["nli_factcheck"],
        allowed_labels: ["entailed", "contradicted", "neutral"]
      }
    case "ocr":
      return {
        metrics: ["cer", "wer", "coverage"],
        language: "eng"
      }
    default:
      return {
        metrics: ["accuracy"],
        model: "gpt-3.5-turbo",
        temperature: 0.3
      }
  }
}

// Eval type options for select dropdowns
export const evalTypeOptions = [
  { value: "model_graded", label: "model_graded" },
  { value: "response_quality", label: "response_quality" },
  { value: "rag", label: "rag" },
  { value: "rag_pipeline", label: "rag_pipeline" },
  { value: "geval", label: "geval" },
  { value: "exact_match", label: "exact_match" },
  { value: "includes", label: "includes" },
  { value: "fuzzy_match", label: "fuzzy_match" },
  { value: "proposition_extraction", label: "proposition_extraction" },
  { value: "qa3", label: "qa3" },
  { value: "label_choice", label: "label_choice" },
  { value: "nli_factcheck", label: "nli_factcheck" },
  { value: "ocr", label: "ocr" }
]

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
