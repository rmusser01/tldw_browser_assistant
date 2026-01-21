/**
 * Evaluations Zustand store
 * Manages UI state for the Evaluations Playground page
 */

import { createWithEqualityFn } from "zustand/traditional"
import type {
  DatasetResponse,
  DatasetSample,
  EvaluationDetail,
  EvaluationHistoryItem,
  EvaluationRateLimitStatus,
  EvaluationRunDetail,
  EvaluationSummary,
  EvaluationWebhook
} from "@/services/evaluations"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationsTab =
  | "evaluations"
  | "runs"
  | "datasets"
  | "webhooks"
  | "history"

interface SelectionState {
  selectedEvalId: string | null
  selectedRunId: string | null
  editingEvalId: string | null
}

interface FormState {
  evalSpecText: string
  evalSpecError: string | null
  inlineDatasetEnabled: boolean
  inlineDatasetText: string
  runConfigText: string
  datasetOverrideText: string
  runIdempotencyKey: string
  evalIdempotencyKey: string
  adhocEndpoint: string
  adhocPayloadText: string
  adhocResult: any
}

interface DataState {
  historyResults: EvaluationHistoryItem[]
  viewingDataset: DatasetResponse | null
  datasetSamples: DatasetSample[]
  datasetSamplesPage: number
  datasetSamplesPageSize: number
  datasetSamplesTotal: number | null
  quotaSnapshot: {
    limitDay?: number
    remainingDay?: number
    limitMinute?: number
    remainingMinute?: number
    reset?: string | null
  } | null
  webhookSecretText: string | null
  defaultsApplied: boolean
}

interface UIState {
  activeTab: EvaluationsTab
  createEvalOpen: boolean
  createDatasetOpen: boolean
  isPolling: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

interface SelectionActions {
  setSelectedEvalId: (id: string | null) => void
  setSelectedRunId: (id: string | null) => void
  setEditingEvalId: (id: string | null) => void
  clearSelection: () => void
}

interface FormActions {
  setEvalSpecText: (text: string) => void
  setEvalSpecError: (error: string | null) => void
  setInlineDatasetEnabled: (enabled: boolean) => void
  setInlineDatasetText: (text: string) => void
  setRunConfigText: (text: string) => void
  setDatasetOverrideText: (text: string) => void
  setRunIdempotencyKey: (key: string) => void
  setEvalIdempotencyKey: (key: string) => void
  setAdhocEndpoint: (endpoint: string) => void
  setAdhocPayloadText: (text: string) => void
  setAdhocResult: (result: any) => void
  regenerateRunIdempotencyKey: () => void
  regenerateEvalIdempotencyKey: () => void
}

interface DataActions {
  setHistoryResults: (results: EvaluationHistoryItem[]) => void
  setViewingDataset: (dataset: DatasetResponse | null) => void
  setDatasetSamples: (samples: DatasetSample[]) => void
  setDatasetSamplesPage: (page: number) => void
  setDatasetSamplesTotal: (total: number | null) => void
  setQuotaSnapshot: (
    snapshot: {
      limitDay?: number
      remainingDay?: number
      limitMinute?: number
      remainingMinute?: number
      reset?: string | null
    } | null
  ) => void
  setWebhookSecretText: (text: string | null) => void
  setDefaultsApplied: (applied: boolean) => void
}

interface UIActions {
  setActiveTab: (tab: EvaluationsTab) => void
  openCreateEval: (editId?: string | null) => void
  closeCreateEval: () => void
  openCreateDataset: () => void
  closeCreateDataset: () => void
  setIsPolling: (polling: boolean) => void
  resetStore: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined State & Actions
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationsState = SelectionState &
  FormState &
  DataState &
  UIState &
  SelectionActions &
  FormActions &
  DataActions &
  UIActions

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const generateUUID = (): string =>
  (crypto as any)?.randomUUID?.() || Math.random().toString(36).slice(2)

const initialSelectionState: SelectionState = {
  selectedEvalId: null,
  selectedRunId: null,
  editingEvalId: null
}

const initialFormState: FormState = {
  evalSpecText: "",
  evalSpecError: null,
  inlineDatasetEnabled: false,
  inlineDatasetText: JSON.stringify(
    [
      {
        input: {
          question: "Q1",
          contexts: ["ctx"],
          response: "A"
        },
        expected: { answer: "A" }
      }
    ],
    null,
    2
  ),
  runConfigText: "",
  datasetOverrideText: "",
  runIdempotencyKey: generateUUID(),
  evalIdempotencyKey: generateUUID(),
  adhocEndpoint: "response-quality",
  adhocPayloadText: JSON.stringify(
    { input: "Sample text", reference: "Expected reply" },
    null,
    2
  ),
  adhocResult: null
}

const initialDataState: DataState = {
  historyResults: [],
  viewingDataset: null,
  datasetSamples: [],
  datasetSamplesPage: 1,
  datasetSamplesPageSize: 5,
  datasetSamplesTotal: null,
  quotaSnapshot: null,
  webhookSecretText: null,
  defaultsApplied: false
}

const initialUIState: UIState = {
  activeTab: "evaluations",
  createEvalOpen: false,
  createDatasetOpen: false,
  isPolling: false
}

const initialState = {
  ...initialSelectionState,
  ...initialFormState,
  ...initialDataState,
  ...initialUIState
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useEvaluationsStore = createWithEqualityFn<EvaluationsState>()((set) => ({
  ...initialState,

  // ─────────────────────────────────────────────────────────────────────────
  // Selection Actions
  // ─────────────────────────────────────────────────────────────────────────

  setSelectedEvalId: (selectedEvalId) =>
    set({ selectedEvalId, selectedRunId: null }),
  setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
  setEditingEvalId: (editingEvalId) => set({ editingEvalId }),
  clearSelection: () =>
    set({ selectedEvalId: null, selectedRunId: null, editingEvalId: null }),

  // ─────────────────────────────────────────────────────────────────────────
  // Form Actions
  // ─────────────────────────────────────────────────────────────────────────

  setEvalSpecText: (evalSpecText) => set({ evalSpecText }),
  setEvalSpecError: (evalSpecError) => set({ evalSpecError }),
  setInlineDatasetEnabled: (inlineDatasetEnabled) =>
    set({ inlineDatasetEnabled }),
  setInlineDatasetText: (inlineDatasetText) => set({ inlineDatasetText }),
  setRunConfigText: (runConfigText) => set({ runConfigText }),
  setDatasetOverrideText: (datasetOverrideText) => set({ datasetOverrideText }),
  setRunIdempotencyKey: (runIdempotencyKey) => set({ runIdempotencyKey }),
  setEvalIdempotencyKey: (evalIdempotencyKey) => set({ evalIdempotencyKey }),
  setAdhocEndpoint: (adhocEndpoint) => set({ adhocEndpoint }),
  setAdhocPayloadText: (adhocPayloadText) => set({ adhocPayloadText }),
  setAdhocResult: (adhocResult) => set({ adhocResult }),
  regenerateRunIdempotencyKey: () => set({ runIdempotencyKey: generateUUID() }),
  regenerateEvalIdempotencyKey: () =>
    set({ evalIdempotencyKey: generateUUID() }),

  // ─────────────────────────────────────────────────────────────────────────
  // Data Actions
  // ─────────────────────────────────────────────────────────────────────────

  setHistoryResults: (historyResults) => set({ historyResults }),
  setViewingDataset: (viewingDataset) => set({ viewingDataset }),
  setDatasetSamples: (datasetSamples) => set({ datasetSamples }),
  setDatasetSamplesPage: (datasetSamplesPage) => set({ datasetSamplesPage }),
  setDatasetSamplesTotal: (datasetSamplesTotal) => set({ datasetSamplesTotal }),
  setQuotaSnapshot: (quotaSnapshot) => set({ quotaSnapshot }),
  setWebhookSecretText: (webhookSecretText) => set({ webhookSecretText }),
  setDefaultsApplied: (defaultsApplied) => set({ defaultsApplied }),

  // ─────────────────────────────────────────────────────────────────────────
  // UI Actions
  // ─────────────────────────────────────────────────────────────────────────

  setActiveTab: (activeTab) => set({ activeTab }),
  openCreateEval: (editId = null) =>
    set({ createEvalOpen: true, editingEvalId: editId }),
  closeCreateEval: () =>
    set({ createEvalOpen: false, editingEvalId: null }),
  openCreateDataset: () => set({ createDatasetOpen: true }),
  closeCreateDataset: () => set({ createDatasetOpen: false }),
  setIsPolling: (isPolling) => set({ isPolling }),
  resetStore: () => set(initialState)
}))

// Expose for debugging
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__tldw_useEvaluationsStore = useEvaluationsStore
}
