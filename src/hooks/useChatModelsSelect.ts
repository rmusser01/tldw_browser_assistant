import { useCallback, useMemo } from "react"
import type { TFunction } from "i18next"
import { getProviderDisplayName } from "@/utils/provider-registry"

export type ChatModelOption = {
  model: string
  nickname?: string
  provider?: string
  details?: {
    provider?: string
  }
}

type UseChatModelsSelectParams = {
  models: ChatModelOption[]
  currentModel?: string | null
  modelOverride?: string | null
  setModelOverride: (value: string | null) => void
  t: TFunction
}

export const useChatModelsSelect = ({
  models,
  currentModel,
  modelOverride,
  setModelOverride,
  t
}: UseChatModelsSelectParams) => {
  const formatModelLabel = useCallback((model: ChatModelOption) => {
    const provider = model.details?.provider ?? model.provider
    const providerLabel = getProviderDisplayName(provider)
    const modelLabel = model.nickname || model.model
    return providerLabel ? `${providerLabel} - ${modelLabel}` : modelLabel
  }, [])

  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        label: formatModelLabel(model),
        value: model.model
      })),
    [formatModelLabel, models]
  )

  const currentModelLabel = useMemo(() => {
    if (!currentModel) return null
    const match = models.find((model) => model.model === currentModel)
    return match ? formatModelLabel(match) : currentModel
  }, [currentModel, formatModelLabel, models])

  const modelPlaceholder = useMemo(
    () =>
      currentModelLabel
        ? t("option:quickChatHelper.modelPlaceholder", "Current: {{model}}", {
            model: currentModelLabel
          })
        : t("option:quickChatHelper.modelPlaceholderEmpty", "Select a model"),
    [currentModelLabel, t]
  )

  const handleModelChange = useCallback(
    (value?: string | null) => {
      if (!value || (currentModel && value === currentModel)) {
        setModelOverride(null)
        return
      }
      setModelOverride(value)
    },
    [currentModel, setModelOverride]
  )

  return {
    allowClear: Boolean(modelOverride),
    currentModelLabel,
    handleModelChange,
    modelOptions,
    modelPlaceholder
  }
}
