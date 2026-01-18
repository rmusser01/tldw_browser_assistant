/**
 * useDatasets hook
 * Handles dataset CRUD operations and queries
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import {
  createDataset,
  deleteDataset,
  getDataset,
  listDatasets,
  type DatasetResponse,
  type DatasetSample
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

export function useDatasetsList(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["evaluations", "datasets", params || { limit: 50, offset: 0 }],
    queryFn: () => listDatasets(params || { limit: 50, offset: 0 })
  })
}

export function useDatasetDetail(
  datasetId: string | null,
  params?: { limit?: number; offset?: number; include_samples?: boolean }
) {
  return useQuery({
    queryKey: ["evaluations", "dataset", datasetId, params],
    queryFn: () =>
      getDataset(datasetId as string, params || { include_samples: true }),
    enabled: !!datasetId
  })
}

export function useCreateDataset() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()
  const { closeCreateDataset, setInlineDatasetEnabled } = useEvaluationsStore(
    (s) => ({
      closeCreateDataset: s.closeCreateDataset,
      setInlineDatasetEnabled: s.setInlineDatasetEnabled
    })
  )

  return useMutation({
    mutationFn: async (payload: {
      name: string
      description?: string
      samples: DatasetSample[]
      metadata?: Record<string, any>
    }) => ensureOk<{ data: DatasetResponse }>(await createDataset(payload)),
    onSuccess: (resp) => {
      void queryClient.invalidateQueries({
        queryKey: ["evaluations", "datasets"]
      })
      const createdId = resp?.data?.id
      // If created from the create eval modal, attach the dataset
      if (createdId) {
        setInlineDatasetEnabled(false)
      }
      notification.success({
        message: t("settings:evaluations.datasetCreateSuccessTitle", {
          defaultValue: "Dataset created"
        }),
        description: t("settings:evaluations.datasetCreateSuccessDescription", {
          defaultValue: "Your dataset is ready to use in evaluations."
        })
      })
    },
    onError: (error: any) => {
      const retryAfter = error?.resp?.retryAfterMs
      notification.error({
        message: t("settings:evaluations.datasetCreateErrorTitle", {
          defaultValue: "Failed to create dataset"
        }),
        description:
          error?.message ||
          t("settings:evaluations.datasetCreateErrorDescription", {
            defaultValue:
              "The server rejected this dataset. Check the fields and try again."
          }) +
            (retryAfter
              ? ` — retry after ${Math.ceil(Number(retryAfter) / 1000)}s`
              : "")
      })
    }
  })
}

export function useDeleteDataset() {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const notification = useAntdNotification()

  return useMutation({
    mutationFn: async (datasetId: string) =>
      ensureOk(await deleteDataset(datasetId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["evaluations", "datasets"]
      })
      notification.success({
        message: t("settings:evaluations.datasetDeleteSuccessTitle", {
          defaultValue: "Dataset deleted"
        })
      })
    },
    onError: () => {
      notification.error({
        message: t("settings:evaluations.datasetDeleteErrorTitle", {
          defaultValue: "Failed to delete dataset"
        })
      })
    }
  })
}

export function useLoadDatasetSamples() {
  const { t } = useTranslation(["settings", "common"])
  const notification = useAntdNotification()
  const {
    setViewingDataset,
    setDatasetSamples,
    setDatasetSamplesPage,
    setDatasetSamplesTotal,
    datasetSamplesPageSize
  } = useEvaluationsStore((s) => ({
    setViewingDataset: s.setViewingDataset,
    setDatasetSamples: s.setDatasetSamples,
    setDatasetSamplesPage: s.setDatasetSamplesPage,
    setDatasetSamplesTotal: s.setDatasetSamplesTotal,
    datasetSamplesPageSize: s.datasetSamplesPageSize
  }))

  return useMutation({
    mutationFn: async (args: { datasetId: string; page?: number }) => {
      const page = args.page || 1
      const offset = (page - 1) * datasetSamplesPageSize
      return ensureOk<{ data: DatasetResponse }>(
        await getDataset(args.datasetId, {
          limit: datasetSamplesPageSize,
          offset,
          include_samples: true
        })
      )
    },
    onSuccess: (resp, variables) => {
      const data = resp?.data || null
      setViewingDataset(data)
      setDatasetSamples(data?.samples || [])
      setDatasetSamplesPage(variables?.page || 1)
      setDatasetSamplesTotal(
        typeof data?.sample_count === "number" ? data.sample_count : null
      )
    },
    onError: (error: any) => {
      notification.error({
        message: t("settings:evaluations.datasetLoadErrorTitle", {
          defaultValue: "Failed to load dataset"
        }),
        description: error?.message
      })
    }
  })
}

export function useCloseDatasetViewer() {
  const { setViewingDataset, setDatasetSamples, setDatasetSamplesTotal } =
    useEvaluationsStore((s) => ({
      setViewingDataset: s.setViewingDataset,
      setDatasetSamples: s.setDatasetSamples,
      setDatasetSamplesTotal: s.setDatasetSamplesTotal
    }))

  return () => {
    setViewingDataset(null)
    setDatasetSamples([])
    setDatasetSamplesTotal(null)
  }
}

// Parse JSON samples from text input
export function parseSamplesJson(
  text: string
): { samples: DatasetSample[] | null; error: string | null } {
  if (!text.trim()) {
    return { samples: null, error: null }
  }
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return { samples: parsed, error: null }
    }
    return { samples: null, error: "Samples must be an array" }
  } catch (e: any) {
    return { samples: null, error: e?.message || "Invalid JSON" }
  }
}
