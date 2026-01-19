/**
 * Workflows Zustand Store
 *
 * Manages state for the guided workflow system including:
 * - Landing page visibility and configuration
 * - Active workflow instance and navigation
 * - Contextual suggestions
 * - Processing state and errors
 *
 * @example
 * ```tsx
 * import { useWorkflowsStore } from "@/store/workflows"
 *
 * // Start a workflow
 * const startWorkflow = useWorkflowsStore((s) => s.startWorkflow)
 * startWorkflow("summarize-page")
 *
 * // Get active workflow
 * const activeWorkflow = useWorkflowsStore((s) => s.activeWorkflow)
 *
 * // Update workflow data
 * const updateData = useWorkflowsStore((s) => s.updateWorkflowData)
 * updateData({ summary: "My summary" })
 * ```
 *
 * @see README.md for full documentation
 */

import { create } from "zustand"
import type {
  WorkflowId,
  WorkflowInstance,
  WorkflowStatus,
  ContextualSuggestion,
  WorkflowLandingConfig
} from "@/types/workflows"

// ─────────────────────────────────────────────────────────────────────────────
// Storage Keys
// ─────────────────────────────────────────────────────────────────────────────

const LANDING_CONFIG_KEY = "tldw:workflow:landing-config"
const DISMISSED_SUGGESTIONS_KEY = "tldw:workflow:dismissed-suggestions"

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

interface LandingState {
  showLanding: boolean
  landingConfig: WorkflowLandingConfig
}

interface InstanceState {
  activeWorkflow: WorkflowInstance | null
  workflowHistory: WorkflowInstance[]
}

interface SuggestionState {
  suggestions: ContextualSuggestion[]
  dismissedSuggestionIds: string[]
}

interface UIState {
  isWizardOpen: boolean
  isProcessing: boolean
  processingProgress: number
  processingMessage: string
  error: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions Types
// ─────────────────────────────────────────────────────────────────────────────

interface LandingActions {
  setShowLanding: (show: boolean) => void
  dismissLanding: () => void
  markWorkflowCompleted: (workflowId: WorkflowId) => void
  loadLandingConfig: () => Promise<void>
  saveLandingConfig: () => Promise<void>
}

interface InstanceActions {
  startWorkflow: (workflowId: WorkflowId) => void
  updateWorkflowData: (updates: Record<string, unknown>) => void
  setWorkflowStep: (stepIndex: number) => void
  setWorkflowStatus: (status: WorkflowStatus) => void
  completeWorkflow: () => void
  cancelWorkflow: () => void
  setWorkflowError: (error: string) => void
}

interface SuggestionActions {
  addSuggestion: (suggestion: Omit<ContextualSuggestion, "id">) => void
  dismissSuggestion: (suggestionId: string) => void
  clearSuggestions: () => void
  loadDismissedSuggestions: () => Promise<void>
}

interface UIActions {
  openWizard: () => void
  closeWizard: () => void
  setProcessing: (isProcessing: boolean, message?: string) => void
  setProcessingProgress: (progress: number) => void
  setError: (error: string | null) => void
  resetUI: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Store Type
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowsState = LandingState &
  InstanceState &
  SuggestionState &
  UIState &
  LandingActions &
  InstanceActions &
  SuggestionActions &
  UIActions

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialLandingState: LandingState = {
  showLanding: false,
  landingConfig: {
    showOnFirstRun: true,
    completedWorkflows: []
  }
}

const initialInstanceState: InstanceState = {
  activeWorkflow: null,
  workflowHistory: []
}

const initialSuggestionState: SuggestionState = {
  suggestions: [],
  dismissedSuggestionIds: []
}

const initialUIState: UIState = {
  isWizardOpen: false,
  isProcessing: false,
  processingProgress: 0,
  processingMessage: "",
  error: null
}

const initialState = {
  ...initialLandingState,
  ...initialInstanceState,
  ...initialSuggestionState,
  ...initialUIState
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Helpers
// ─────────────────────────────────────────────────────────────────────────────

const loadFromStorage = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key)
      return result[key] ?? defaultValue
    }
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

const saveToStorage = async <T>(key: string, value: T): Promise<void> => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: value })
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (e) {
    console.error(`Failed to save ${key}:`, e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useWorkflowsStore = create<WorkflowsState>()((set, get) => ({
  ...initialState,

  // ─────────────────────────────────────────────────────────────────────────
  // Landing Actions
  // ─────────────────────────────────────────────────────────────────────────

  setShowLanding: (show) => set({ showLanding: show }),

  dismissLanding: () => {
    const config = {
      ...get().landingConfig,
      dismissedAt: Date.now()
    }
    set({ showLanding: false, landingConfig: config })
    get().saveLandingConfig()
  },

  markWorkflowCompleted: (workflowId) => {
    const config = get().landingConfig
    if (!config.completedWorkflows.includes(workflowId)) {
      const newConfig = {
        ...config,
        completedWorkflows: [...config.completedWorkflows, workflowId]
      }
      set({ landingConfig: newConfig })
      get().saveLandingConfig()
    }
  },

  loadLandingConfig: async () => {
    const config = await loadFromStorage<WorkflowLandingConfig>(
      LANDING_CONFIG_KEY,
      initialLandingState.landingConfig
    )
    set({ landingConfig: config })

    // Show landing if first run and not dismissed
    if (config.showOnFirstRun && !config.dismissedAt) {
      set({ showLanding: true })
    }
  },

  saveLandingConfig: async () => {
    const config = get().landingConfig
    await saveToStorage(LANDING_CONFIG_KEY, config)
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Instance Actions
  // ─────────────────────────────────────────────────────────────────────────

  startWorkflow: (workflowId) => {
    const instance: WorkflowInstance = {
      id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      workflowId,
      status: "active",
      currentStepIndex: 0,
      startedAt: Date.now(),
      data: {}
    }
    set({
      activeWorkflow: instance,
      isWizardOpen: true,
      showLanding: false,
      error: null
    })
  },

  updateWorkflowData: (updates) => {
    const active = get().activeWorkflow
    if (!active) return
    set({
      activeWorkflow: {
        ...active,
        data: { ...active.data, ...updates }
      }
    })
  },

  setWorkflowStep: (stepIndex) => {
    const active = get().activeWorkflow
    if (!active) return
    set({
      activeWorkflow: {
        ...active,
        currentStepIndex: stepIndex
      }
    })
  },

  setWorkflowStatus: (status) => {
    const active = get().activeWorkflow
    if (!active) return
    set({
      activeWorkflow: {
        ...active,
        status
      }
    })
  },

  completeWorkflow: () => {
    const active = get().activeWorkflow
    if (!active) return

    const completed: WorkflowInstance = {
      ...active,
      status: "completed",
      completedAt: Date.now()
    }

    set((state) => ({
      activeWorkflow: null,
      workflowHistory: [...state.workflowHistory, completed],
      isWizardOpen: false,
      isProcessing: false
    }))

    // Mark as completed in landing config
    get().markWorkflowCompleted(active.workflowId)
  },

  cancelWorkflow: () => {
    const active = get().activeWorkflow
    if (!active) return

    const cancelled: WorkflowInstance = {
      ...active,
      status: "cancelled",
      completedAt: Date.now()
    }

    set((state) => ({
      activeWorkflow: null,
      workflowHistory: [...state.workflowHistory, cancelled],
      isWizardOpen: false,
      isProcessing: false,
      error: null
    }))
  },

  setWorkflowError: (error) => {
    const active = get().activeWorkflow
    if (!active) return
    set({
      activeWorkflow: {
        ...active,
        status: "error",
        error
      },
      error
    })
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Suggestion Actions
  // ─────────────────────────────────────────────────────────────────────────

  addSuggestion: (suggestion) => {
    const id = `sug-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const dismissedIds = get().dismissedSuggestionIds

    // Don't add if already dismissed (by workflow type)
    const existingSuggestion = get().suggestions.find(
      (s) => s.workflowId === suggestion.workflowId
    )
    if (existingSuggestion || dismissedIds.includes(suggestion.workflowId)) {
      return
    }

    const newSuggestion: ContextualSuggestion = { ...suggestion, id }
    set((state) => ({
      suggestions: [...state.suggestions, newSuggestion]
    }))
  },

  dismissSuggestion: (suggestionId) => {
    const suggestion = get().suggestions.find((s) => s.id === suggestionId)
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== suggestionId),
      dismissedSuggestionIds: suggestion
        ? [...state.dismissedSuggestionIds, suggestion.workflowId]
        : state.dismissedSuggestionIds
    }))
    // Persist dismissed suggestions
    saveToStorage(DISMISSED_SUGGESTIONS_KEY, get().dismissedSuggestionIds)
  },

  clearSuggestions: () => set({ suggestions: [] }),

  loadDismissedSuggestions: async () => {
    const dismissed = await loadFromStorage<string[]>(
      DISMISSED_SUGGESTIONS_KEY,
      []
    )
    set({ dismissedSuggestionIds: dismissed })
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UI Actions
  // ─────────────────────────────────────────────────────────────────────────

  openWizard: () => set({ isWizardOpen: true }),

  closeWizard: () => {
    // If there's an active workflow, cancel it
    const active = get().activeWorkflow
    if (active) {
      get().cancelWorkflow()
    } else {
      set({ isWizardOpen: false })
    }
  },

  setProcessing: (isProcessing, message = "") =>
    set({
      isProcessing,
      processingMessage: message,
      processingProgress: isProcessing ? 0 : 100
    }),

  setProcessingProgress: (progress) => set({ processingProgress: progress }),

  setError: (error) => set({ error }),

  resetUI: () =>
    set({
      ...initialUIState
    })
}))

// Expose for debugging
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__tldw_useWorkflowsStore = useWorkflowsStore
}
