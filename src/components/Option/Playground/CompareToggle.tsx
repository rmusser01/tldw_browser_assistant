import React from "react"
import { useTranslation } from "react-i18next"
import { GitCompare, X, Plus, Settings2 } from "lucide-react"
import { Tooltip, Popover, Select } from "antd"
import { ProviderIcons } from "@/components/Common/ProviderIcon"

interface Model {
  model: string
  nickname?: string
  provider?: string
}

interface CompareToggleProps {
  /** Whether compare feature is enabled in settings */
  featureEnabled: boolean
  /** Whether compare mode is currently active */
  active: boolean
  /** Toggle compare mode on/off */
  onToggle: () => void
  /** Currently selected models for comparison */
  selectedModels: string[]
  /** Available models to choose from */
  availableModels: Model[]
  /** Maximum number of models allowed */
  maxModels: number
  /** Add a model to comparison */
  onAddModel: (modelId: string) => void
  /** Remove a model from comparison */
  onRemoveModel: (modelId: string) => void
  /** Open full compare settings modal */
  onOpenSettings?: () => void
}

export const CompareToggle: React.FC<CompareToggleProps> = ({
  featureEnabled,
  active,
  onToggle,
  selectedModels,
  availableModels,
  maxModels,
  onAddModel,
  onRemoveModel,
  onOpenSettings
}) => {
  const { t } = useTranslation(["playground", "common"])
  const [popoverOpen, setPopoverOpen] = React.useState(false)

  if (!featureEnabled) {
    return null
  }

  const getModelLabel = (modelId: string) => {
    const model = availableModels.find((m) => m.model === modelId)
    return model?.nickname || model?.model || modelId
  }

  const getModelProvider = (modelId: string) => {
    const model = availableModels.find((m) => m.model === modelId)
    return String(model?.provider || "custom").toLowerCase()
  }

  const canAddMore = selectedModels.length < maxModels
  const unselectedModels = availableModels.filter(
    (m) => !selectedModels.includes(m.model)
  )

  const popoverContent = (
    <div className="w-64 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text">
          {t("playground:compare.selectedModels", "Selected models")}
        </span>
        <span className="text-[10px] text-text-muted">
          {selectedModels.length}/{maxModels}
        </span>
      </div>

      {/* Selected models */}
      <div className="space-y-1">
        {selectedModels.map((modelId) => (
          <div
            key={modelId}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <ProviderIcons
                provider={getModelProvider(modelId)}
                className="h-4 w-4 flex-shrink-0 text-text-subtle"
              />
              <span className="truncate text-xs text-text">
                {getModelLabel(modelId)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRemoveModel(modelId)}
              className="flex-shrink-0 rounded p-0.5 text-text-subtle hover:bg-surface2 hover:text-text"
              aria-label={t("common:remove", "Remove") as string}
              title={t("common:remove", "Remove") as string}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {selectedModels.length === 0 && (
          <div className="rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-text-muted">
            {t("playground:compare.noModelsSelected", "No models selected")}
          </div>
        )}
      </div>

      {/* Add model selector */}
      {canAddMore && unselectedModels.length > 0 && (
        <Select
          placeholder={t("playground:compare.addModel", "Add a model...")}
          size="small"
          className="w-full"
          showSearch
          optionFilterProp="label"
          value={null}
          onChange={(value) => {
            if (value) {
              onAddModel(value)
            }
          }}
          options={unselectedModels.map((m) => ({
            value: m.model,
            label: m.nickname || m.model
          }))}
        />
      )}

      {/* Settings link */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={() => {
            setPopoverOpen(false)
            onOpenSettings()
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface2 hover:text-text"
          title={t("playground:compare.moreSettings", "More settings") as string}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {t("playground:compare.moreSettings", "More settings")}
        </button>
      )}
    </div>
  )

  return (
    <div className="inline-flex items-center gap-1">
      {/* Main toggle button */}
      <Tooltip
        title={
          active
            ? t("playground:compare.disable", "Disable compare mode")
            : t("playground:compare.enable", "Compare models")
        }
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={active}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            active
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-text-muted hover:border-primary/50 hover:text-text"
          }`}
        >
          <GitCompare className="h-3.5 w-3.5" />
          <span>{t("playground:compare.label", "Compare")}</span>
          {active && selectedModels.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-white">
              {selectedModels.length}
            </span>
          )}
        </button>
      </Tooltip>

      {/* Model chips (shown when active) */}
      {active && selectedModels.length > 0 && (
        <Popover
          content={popoverContent}
          trigger="click"
          placement="bottomRight"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-[10px] text-text-muted hover:bg-surface2"
            title={t("playground:compare.selectedModels", "Selected models") as string}
          >
            {selectedModels.slice(0, 2).map((modelId) => (
              <span
                key={modelId}
                className="inline-flex items-center gap-1 rounded-full bg-surface2 px-1.5 py-0.5"
              >
                <ProviderIcons
                  provider={getModelProvider(modelId)}
                  className="h-3 w-3"
                />
                <span className="max-w-[60px] truncate text-[9px]">
                  {getModelLabel(modelId)}
                </span>
              </span>
            ))}
            {selectedModels.length > 2 && (
              <span className="text-[9px] text-text-subtle">
                +{selectedModels.length - 2}
              </span>
            )}
            <Plus className="h-3 w-3" />
          </button>
        </Popover>
      )}

      {/* Add button when active but no models */}
      {active && selectedModels.length === 0 && (
        <Popover
          content={popoverContent}
          trigger="click"
          placement="bottomRight"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-2 py-1 text-[10px] text-primary hover:bg-primary/5"
            title={t("playground:compare.addModels", "Add models") as string}
          >
            <Plus className="h-3 w-3" />
            {t("playground:compare.addModels", "Add models")}
          </button>
        </Popover>
      )}
    </div>
  )
}
