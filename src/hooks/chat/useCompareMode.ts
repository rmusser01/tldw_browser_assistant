import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { useFeatureFlag, FEATURE_FLAGS } from "@/hooks/useFeatureFlags"
import { getCompareState, saveCompareState } from "@/db/dexie/helpers"
import { trackCompareMetric } from "@/utils/compare-metrics"
import { useStoreMessageOption } from "@/store/option"
import { MAX_COMPARE_MODELS } from "@/hooks/chat/compare-constants"

type UseCompareModeOptions = {
  historyId: string | null
  forceEnabled?: boolean
}

export const useCompareMode = ({ historyId, forceEnabled }: UseCompareModeOptions) => {
  const {
    compareMode,
    setCompareMode,
    compareSelectedModels,
    setCompareSelectedModels,
    compareSelectionByCluster,
    setCompareSelectionForCluster,
    compareActiveModelsByCluster,
    setCompareActiveModelsForCluster,
    compareParentByHistory,
    setCompareParentForHistory,
    compareCanonicalByCluster,
    setCompareCanonicalForCluster,
    compareSplitChats,
    setCompareSplitChat
  } = useStoreMessageOption()

  // Per-user configurable max compare models (2–4, default 3)
  const [compareMaxModels, setCompareMaxModels] = useStorage(
    "compareMaxModels",
    MAX_COMPARE_MODELS
  )
  const [compareFeatureEnabled, setCompareFeatureEnabled] = useFeatureFlag(
    FEATURE_FLAGS.COMPARE_MODE
  )

  const effectiveCompareEnabled = forceEnabled ? true : compareFeatureEnabled
  const compareModeActive = effectiveCompareEnabled && compareMode
  const compareModeActiveRef = React.useRef(compareModeActive)
  const compareFeatureEnabledRef = React.useRef(compareFeatureEnabled)
  const compareHydratingRef = React.useRef(false)
  const compareSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const compareNewHistoryIdsRef = React.useRef<Set<string>>(new Set())

  const compareParentForHistory = historyId
    ? compareParentByHistory?.[historyId]
    : undefined

  const resetCompareState = React.useCallback(() => {
    setCompareMode(false)
    setCompareSelectedModels([])
    useStoreMessageOption.setState({
      compareSelectionByCluster: {},
      compareCanonicalByCluster: {},
      compareSplitChats: {},
      compareActiveModelsByCluster: {}
    })
  }, [setCompareMode, setCompareSelectedModels])

  React.useEffect(() => {
    if (!effectiveCompareEnabled && compareMode) {
      setCompareMode(false)
      setCompareSelectedModels([])
    }
  }, [effectiveCompareEnabled, compareMode, setCompareMode, setCompareSelectedModels])

  React.useEffect(() => {
    if (compareModeActiveRef.current === compareModeActive) {
      return
    }
    compareModeActiveRef.current = compareModeActive
    void trackCompareMetric({
      type: compareModeActive ? "compare_mode_enabled" : "compare_mode_disabled"
    })
  }, [compareModeActive])

  React.useEffect(() => {
    if (compareFeatureEnabledRef.current === compareFeatureEnabled) {
      return
    }
    compareFeatureEnabledRef.current = compareFeatureEnabled
    void trackCompareMetric({
      type: compareFeatureEnabled ? "feature_enabled" : "feature_disabled"
    })
  }, [compareFeatureEnabled])

  React.useEffect(() => {
    if (!historyId || historyId === "temp") {
      return
    }

    let cancelled = false
    compareHydratingRef.current = true

    const loadCompareState = async () => {
      try {
        const saved = await getCompareState(historyId)
        if (cancelled) return
        if (saved) {
          setCompareMode(saved.compareMode ?? false)
          setCompareSelectedModels(saved.compareSelectedModels ?? [])
          useStoreMessageOption.setState({
            compareSelectionByCluster: saved.compareSelectionByCluster || {},
            compareCanonicalByCluster: saved.compareCanonicalByCluster || {},
            compareSplitChats: saved.compareSplitChats || {},
            compareActiveModelsByCluster:
              saved.compareActiveModelsByCluster || {}
          })
          if (saved.compareParent) {
            setCompareParentForHistory(historyId, saved.compareParent)
          }
        } else if (!compareNewHistoryIdsRef.current.has(historyId)) {
          resetCompareState()
        }
      } finally {
        compareHydratingRef.current = false
      }
    }

    void loadCompareState()
    return () => {
      cancelled = true
      compareHydratingRef.current = false
    }
  }, [
    historyId,
    resetCompareState,
    setCompareMode,
    setCompareSelectedModels,
    setCompareParentForHistory
  ])

  React.useEffect(() => {
    if (!historyId || historyId === "temp") {
      return
    }
    if (compareHydratingRef.current) {
      return
    }

    if (compareSaveTimerRef.current) {
      clearTimeout(compareSaveTimerRef.current)
    }

    compareSaveTimerRef.current = setTimeout(() => {
      void saveCompareState({
        history_id: historyId,
        compareMode,
        compareSelectedModels,
        compareSelectionByCluster,
        compareCanonicalByCluster,
        compareSplitChats,
        compareActiveModelsByCluster,
        compareParent: compareParentForHistory ?? null,
        updatedAt: Date.now()
      })
    }, 200)

    return () => {
      if (compareSaveTimerRef.current) {
        clearTimeout(compareSaveTimerRef.current)
      }
    }
  }, [
    historyId,
    compareMode,
    compareSelectedModels,
    compareSelectionByCluster,
    compareCanonicalByCluster,
    compareSplitChats,
    compareActiveModelsByCluster,
    compareParentForHistory
  ])

  const markCompareHistoryCreated = React.useCallback((id: string) => {
    if (id) {
      compareNewHistoryIdsRef.current.add(id)
    }
  }, [])

  return {
    compareMode,
    setCompareMode,
    compareFeatureEnabled: effectiveCompareEnabled,
    setCompareFeatureEnabled,
    compareSelectedModels,
    setCompareSelectedModels,
    compareSelectionByCluster,
    setCompareSelectionForCluster,
    compareActiveModelsByCluster,
    setCompareActiveModelsForCluster,
    compareParentByHistory,
    setCompareParentForHistory,
    compareCanonicalByCluster,
    setCompareCanonicalForCluster,
    compareSplitChats,
    setCompareSplitChat,
    compareMaxModels,
    setCompareMaxModels,
    compareModeActive,
    compareParentForHistory,
    markCompareHistoryCreated
  }
}
