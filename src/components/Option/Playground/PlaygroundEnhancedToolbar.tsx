import React from "react"
import { Popover, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { useStoreChatModelSettings } from "@/store/model"
import { Settings2, Sparkles } from "lucide-react"
import { ParameterPresets, ParameterPresetsDropdown, type PresetKey } from "./ParameterPresets"
import { CostEstimation, SessionCostEstimation } from "./CostEstimation"
import { JsonModeToggle, JsonModeIndicator } from "./JsonModeToggle"
import { SystemPromptTemplatesButton, type PromptTemplate } from "./SystemPromptTemplates"
import { ConversationBranching } from "./ConversationBranching"

type Message = {
  id: string
  role: "user" | "assistant"
  message: string
  isBot: boolean
  generationInfo?: {
    prompt_eval_count?: number
    eval_count?: number
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
    }
  }
}

type Props = {
  // Model info
  selectedModel: string | null
  provider?: string | null

  // Token counts for cost estimation
  inputTokens?: number
  outputTokens?: number

  // Messages for session cost
  messages?: Message[]

  // Callbacks
  onSystemPromptSelect?: (template: PromptTemplate) => void
  onBranch?: (fromMessageIndex: number) => void
  onPresetChange?: (preset: PresetKey) => void

  // Layout
  compact?: boolean
  showPresets?: boolean
  showCostEstimation?: boolean
  showJsonToggle?: boolean
  showTemplates?: boolean
  showBranching?: boolean
  className?: string
}

export const PlaygroundEnhancedToolbar: React.FC<Props> = ({
  selectedModel,
  provider,
  inputTokens = 0,
  outputTokens = 0,
  messages = [],
  onSystemPromptSelect,
  onBranch,
  onPresetChange,
  compact = false,
  showPresets = true,
  showCostEstimation = true,
  showJsonToggle = true,
  showTemplates = true,
  showBranching = true,
  className
}) => {
  const { t } = useTranslation(["playground", "common"])

  const handleTemplateSelect = (template: PromptTemplate) => {
    onSystemPromptSelect?.(template)
  }

  const handleBranch = (fromIndex: number) => {
    onBranch?.(fromIndex)
  }

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className || ""}`}>
        {showPresets && (
          <ParameterPresets compact onChange={onPresetChange} />
        )}
        {showJsonToggle && <JsonModeToggle compact />}
        {showCostEstimation && selectedModel && (
          <CostEstimation
            modelId={selectedModel}
            provider={provider}
            inputTokens={inputTokens}
            outputTokens={outputTokens}
            compact
          />
        )}
        {showTemplates && onSystemPromptSelect && (
          <SystemPromptTemplatesButton onSelect={handleTemplateSelect} />
        )}
        {showBranching && messages.length > 0 && onBranch && (
          <ConversationBranching
            messages={messages}
            onBranch={handleBranch}
            compact
          />
        )}
        <JsonModeIndicator />
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className || ""}`}>
      {/* Parameter Presets Row */}
      {showPresets && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs font-medium text-text-muted">
            {t("playground:toolbar.presets", "Generation Style")}
          </div>
          <ParameterPresets onChange={onPresetChange} />
        </div>
      )}

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {showJsonToggle && <JsonModeToggle showLabel />}
          <JsonModeIndicator />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showTemplates && onSystemPromptSelect && (
            <SystemPromptTemplatesButton onSelect={handleTemplateSelect} />
          )}
          {showBranching && messages.length > 0 && onBranch && (
            <ConversationBranching
              messages={messages}
              onBranch={handleBranch}
            />
          )}
          {showCostEstimation && selectedModel && (
            <CostEstimation
              modelId={selectedModel}
              provider={provider}
              inputTokens={inputTokens}
              outputTokens={outputTokens}
            />
          )}
        </div>
      </div>

      {/* Session Stats */}
      {showCostEstimation && messages.length > 0 && (
        <div className="flex items-center justify-end">
          <SessionCostEstimation
            modelId={selectedModel}
            provider={provider}
            messages={messages}
          />
        </div>
      )}
    </div>
  )
}

type QuickSettingsProps = {
  selectedModel: string | null
  provider?: string | null
  messages?: Message[]
  onSystemPromptSelect?: (template: PromptTemplate) => void
  onBranch?: (fromMessageIndex: number) => void
}

export const PlaygroundQuickSettings: React.FC<QuickSettingsProps> = ({
  selectedModel,
  provider,
  messages = [],
  onSystemPromptSelect,
  onBranch
}) => {
  const { t } = useTranslation(["playground"])
  const [open, setOpen] = React.useState(false)

  const content = (
    <div className="w-80 space-y-4 p-2">
      <ParameterPresetsDropdown />

      <div className="space-y-2">
        <div className="text-xs font-medium text-text-muted">
          {t("playground:toolbar.outputSettings", "Output Settings")}
        </div>
        <JsonModeToggle showLabel />
      </div>

      {selectedModel && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-text-muted">
            {t("playground:toolbar.costInfo", "Cost Information")}
          </div>
          <SessionCostEstimation
            modelId={selectedModel}
            provider={provider}
            messages={messages}
          />
        </div>
      )}

      {onSystemPromptSelect && (
        <div className="border-t border-border pt-3">
          <SystemPromptTemplatesButton onSelect={onSystemPromptSelect} />
        </div>
      )}

      {onBranch && messages.length > 0 && (
        <div className="border-t border-border pt-3">
          <ConversationBranching
            messages={messages}
            onBranch={onBranch}
          />
        </div>
      )}
    </div>
  )

  return (
    <Popover
      content={content}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("playground:toolbar.quickSettings", "Quick Settings")}
        </div>
      }
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight">
      <Tooltip
        title={t("playground:toolbar.quickSettings", "Quick Settings")}
        placement="top">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:border-primary/50 hover:bg-surface-hover hover:text-text">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t("playground:toolbar.settings", "Settings")}
          </span>
        </button>
      </Tooltip>
    </Popover>
  )
}
