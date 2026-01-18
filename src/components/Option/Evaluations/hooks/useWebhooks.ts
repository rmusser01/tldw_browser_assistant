/**
 * useWebhooks hook
 * Handles webhook CRUD operations and queries
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import {
  deleteWebhook,
  listWebhooks,
  registerWebhook,
  type EvaluationWebhook
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

export function useWebhooksList(enabled = true) {
  return useQuery({
    queryKey: ["evaluations", "webhooks"],
    queryFn: () => listWebhooks(),
    enabled
  })
}

export function useRegisterWebhook() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()
  const setWebhookSecretText = useEvaluationsStore((s) => s.setWebhookSecretText)

  return useMutation({
    mutationFn: async (payload: { url: string; events: string[] }) =>
      ensureOk<{ data: EvaluationWebhook }>(await registerWebhook(payload)),
    onSuccess: (resp) => {
      setWebhookSecretText(resp?.data?.secret || null)
      void queryClient.invalidateQueries({
        queryKey: ["evaluations", "webhooks"]
      })
      notification.success({
        message: t("settings:evaluations.webhookCreateSuccessTitle", {
          defaultValue: "Webhook registered"
        })
      })
    },
    onError: (error: any) => {
      notification.error({
        message: t("settings:evaluations.webhookCreateErrorTitle", {
          defaultValue: "Failed to register webhook"
        }),
        description: error?.message
      })
    }
  })
}

export function useDeleteWebhook() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()

  return useMutation({
    mutationFn: async (webhookId: string) =>
      ensureOk(await deleteWebhook(webhookId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["evaluations", "webhooks"]
      })
      notification.success({
        message: t("common:deleted", { defaultValue: "Deleted" })
      })
    },
    onError: (error: any) => {
      notification.error({
        message: t("settings:evaluations.webhookDeleteErrorTitle", {
          defaultValue: "Failed to delete webhook"
        }),
        description: error?.message
      })
    }
  })
}

// Webhook event options
export const webhookEventOptions = [
  { value: "evaluation.started", label: "evaluation.started" },
  { value: "evaluation.completed", label: "evaluation.completed" },
  { value: "evaluation.failed", label: "evaluation.failed" },
  { value: "evaluation.cancelled", label: "evaluation.cancelled" },
  { value: "evaluation.progress", label: "evaluation.progress" }
]

// Default events when registering a new webhook
export const defaultWebhookEvents = [
  "evaluation.started",
  "evaluation.completed",
  "evaluation.failed"
]
