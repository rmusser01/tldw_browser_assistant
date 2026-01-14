import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { shallow } from "zustand/shallow"
import {
  DEFAULT_RAG_SETTINGS,
  type RagPresetName,
  type RagSettings,
  applyRagPreset,
  toRagAdvancedOptions
} from "@/services/rag/unified-rag"
import { useStoreMessageOption } from "@/store/option"

/**
 * Keys that don't trigger preset change to "custom"
 */
const TRANSIENT_KEYS = new Set<keyof RagSettings>(["query", "batch_queries"])

/**
 * Normalize settings by merging with defaults
 */
const normalizeSettings = (value?: Partial<RagSettings>): RagSettings => ({
  ...DEFAULT_RAG_SETTINGS,
  ...(value || {})
})

/**
 * Return type for useKnowledgeSettings hook
 */
export type UseKnowledgeSettingsReturn = {
  // State
  preset: RagPresetName
  draftSettings: RagSettings
  storedSettings: RagSettings
  useCurrentMessage: boolean
  advancedOpen: boolean
  advancedSearch: string

  // Derived
  resolvedQuery: string
  isDirty: boolean

  // Actions
  updateSetting: <K extends keyof RagSettings>(
    key: K,
    value: RagSettings[K],
    options?: { transient?: boolean }
  ) => void
  applyPreset: (preset: RagPresetName) => void
  applySettings: () => void
  resetToBalanced: () => void
  setUseCurrentMessage: (value: boolean) => void
  setAdvancedOpen: (value: boolean) => void
  setAdvancedSearch: (value: string) => void
  discardChanges: () => void
}

/**
 * Hook for managing RAG settings state
 *
 * Implements the "staged settings" model:
 * - Settings are staged (draft) during a modal session
 * - Switching tabs preserves staged changes
 * - Apply commits staged settings to storage
 * - Closing without Apply discards uncommitted changes
 */
export function useKnowledgeSettings(
  currentMessage?: string
): UseKnowledgeSettingsReturn {
  // Persisted state
  const [storedPreset, setStoredPreset] = useStorage<RagPresetName>(
    "ragSearchPreset",
    "balanced"
  )
  const [storedSettings, setStoredSettings] = useStorage<RagSettings>(
    "ragSearchSettingsV2",
    DEFAULT_RAG_SETTINGS
  )
  const [useCurrentMessage, setUseCurrentMessage] = useStorage<boolean>(
    "ragSearchUseCurrentMessage",
    true
  )

  // Draft (staged) state - not persisted until Apply
  const [draftSettings, setDraftSettings] = React.useState<RagSettings>(
    normalizeSettings(storedSettings)
  )
  const [draftPreset, setDraftPreset] =
    React.useState<RagPresetName>(storedPreset)
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [advancedSearch, setAdvancedSearch] = React.useState("")

  // Store actions for syncing to global state
  const {
    setRagSearchMode,
    setRagTopK,
    setRagEnableGeneration,
    setRagEnableCitations,
    setRagSources,
    setRagAdvancedOptions
  } = useStoreMessageOption(
    (state) => ({
      setRagSearchMode: state.setRagSearchMode,
      setRagTopK: state.setRagTopK,
      setRagEnableGeneration: state.setRagEnableGeneration,
      setRagEnableCitations: state.setRagEnableCitations,
      setRagSources: state.setRagSources,
      setRagAdvancedOptions: state.setRagAdvancedOptions
    }),
    shallow
  )

  // Sync draft settings when stored settings change (e.g., from another tab)
  React.useEffect(() => {
    setDraftSettings(normalizeSettings(storedSettings))
  }, [storedSettings])

  // Sync draft preset when stored preset changes
  React.useEffect(() => {
    setDraftPreset(storedPreset)
  }, [storedPreset])

  // Update a single setting (staged, not persisted)
  const updateSetting = React.useCallback(
    <K extends keyof RagSettings>(
      key: K,
      value: RagSettings[K],
      options?: { transient?: boolean }
    ) => {
      setDraftSettings((prev) => ({
        ...prev,
        [key]: value
      }))
      // Switch to "custom" preset if modifying a non-transient setting
      if (!options?.transient && draftPreset !== "custom") {
        if (!TRANSIENT_KEYS.has(key)) {
          setDraftPreset("custom")
        }
      }
    },
    [draftPreset]
  )

  // Apply a preset (updates draft settings)
  const applyPreset = React.useCallback(
    (nextPreset: RagPresetName) => {
      setDraftPreset(nextPreset)
      if (nextPreset === "custom") return

      const nextSettings = applyRagPreset(nextPreset)
      // Preserve transient fields
      nextSettings.query = draftSettings.query
      nextSettings.batch_queries = draftSettings.batch_queries
      setDraftSettings(nextSettings)
    },
    [draftSettings.batch_queries, draftSettings.query]
  )

  // Commit staged settings to storage and global state
  const applySettings = React.useCallback(() => {
    const persistedSettings = {
      ...draftSettings,
      query: "", // Don't persist query
      batch_queries: [] // Don't persist batch queries
    }
    setStoredSettings(persistedSettings)
    setStoredPreset(draftPreset)

    // Sync to global store for other components
    setRagSearchMode(draftSettings.search_mode)
    setRagTopK(draftSettings.top_k)
    setRagEnableGeneration(draftSettings.enable_generation)
    setRagEnableCitations(draftSettings.enable_citations)
    setRagSources(draftSettings.sources)
    setRagAdvancedOptions(toRagAdvancedOptions(draftSettings))
  }, [
    draftPreset,
    draftSettings,
    setRagEnableCitations,
    setRagEnableGeneration,
    setRagSearchMode,
    setRagSources,
    setRagTopK,
    setRagAdvancedOptions,
    setStoredPreset,
    setStoredSettings
  ])

  // Reset to balanced preset
  const resetToBalanced = React.useCallback(() => {
    applyPreset("balanced")
  }, [applyPreset])

  // Discard staged changes and revert to stored settings
  const discardChanges = React.useCallback(() => {
    setDraftSettings(normalizeSettings(storedSettings))
    setDraftPreset(storedPreset)
  }, [storedPreset, storedSettings])

  // Resolve the query (use current message if enabled and query is empty)
  const resolvedQuery = React.useMemo(() => {
    if (useCurrentMessage && !draftSettings.query.trim()) {
      return (currentMessage || "").trim()
    }
    return draftSettings.query.trim()
  }, [currentMessage, draftSettings.query, useCurrentMessage])

  // Check if there are uncommitted changes
  const isDirty = React.useMemo(() => {
    // Compare draft to stored (excluding transient fields)
    const draftCopy = { ...draftSettings, query: "", batch_queries: [] }
    const storedCopy = { ...storedSettings, query: "", batch_queries: [] }
    return (
      JSON.stringify(draftCopy) !== JSON.stringify(storedCopy) ||
      draftPreset !== storedPreset
    )
  }, [draftPreset, draftSettings, storedPreset, storedSettings])

  return {
    // State
    preset: draftPreset,
    draftSettings,
    storedSettings,
    useCurrentMessage,
    advancedOpen,
    advancedSearch,

    // Derived
    resolvedQuery,
    isDirty,

    // Actions
    updateSetting,
    applyPreset,
    applySettings,
    resetToBalanced,
    setUseCurrentMessage,
    setAdvancedOpen,
    setAdvancedSearch,
    discardChanges
  }
}
