import React from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Tabs, Card, Alert } from "antd"
import {
  FlaskConical,
  Sparkles,
  DollarSign,
  Braces,
  BookText,
  GitBranch,
  ArrowRight,
  Settings2
} from "lucide-react"
import { useStoreChatModelSettings } from "@/store/model"
import {
  ParameterPresets,
  ParameterPresetsDropdown,
  JsonModeToggle,
  SystemPromptTemplatesModal,
  CostEstimation,
  PROMPT_TEMPLATES,
  type PromptTemplate
} from "../Playground/playground-features"

export const ModelPlayground: React.FC = () => {
  const { t } = useTranslation(["playground", "option", "common"])
  const navigate = useNavigate()
  const [templatesOpen, setTemplatesOpen] = React.useState(false)
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<PromptTemplate | null>(null)

  const setSystemPrompt = useStoreChatModelSettings((s) => s.setSystemPrompt)
  const systemPrompt = useStoreChatModelSettings((s) => s.systemPrompt)
  const temperature = useStoreChatModelSettings((s) => s.temperature)
  const jsonMode = useStoreChatModelSettings((s) => s.jsonMode)

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template)
    setSystemPrompt(template.content)
  }

  const handleGoToChat = () => {
    navigate("/")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-text">
            <FlaskConical className="h-7 w-7 text-primary" />
            {t("option:header.modelPlayground", "Model Playground")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            {t(
              "playground:modelPlayground.description",
              "Experiment with model parameters, presets, and system prompts. Configure your settings here, then head to Chat to test them out."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleGoToChat}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-surface transition hover:bg-primaryStrong">
          {t("playground:modelPlayground.goToChat", "Go to Chat")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Current Settings Summary */}
      <Card size="small" className="bg-surface2/50">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-text-muted" />
            <span className="font-medium text-text">
              {t("playground:modelPlayground.currentSettings", "Current Settings")}:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-text-muted">
            <span>
              Temperature: <strong className="text-text">{temperature ?? 0.7}</strong>
            </span>
            <span>•</span>
            <span>
              JSON Mode:{" "}
              <strong className={jsonMode ? "text-primary" : "text-text"}>
                {jsonMode ? "On" : "Off"}
              </strong>
            </span>
            {systemPrompt && (
              <>
                <span>•</span>
                <span>
                  System Prompt:{" "}
                  <strong className="text-text">
                    {systemPrompt.slice(0, 30)}...
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Feature Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Parameter Presets */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("playground:presets.title", "Parameter Presets")}
            </div>
          }
          className="h-full">
          <p className="mb-4 text-sm text-text-muted">
            {t(
              "playground:modelPlayground.presetsDescription",
              "Quickly switch between Creative, Balanced, and Precise modes to adjust model behavior."
            )}
          </p>
          <ParameterPresetsDropdown />
        </Card>

        {/* JSON Mode */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Braces className="h-5 w-5 text-primary" />
              {t("playground:jsonMode.title", "JSON Mode")}
            </div>
          }
          className="h-full">
          <p className="mb-4 text-sm text-text-muted">
            {t(
              "playground:jsonMode.description",
              "When enabled, the model will output valid JSON. This is useful for structured data extraction, API responses, and programmatic parsing."
            )}
          </p>
          <JsonModeToggle showLabel />
        </Card>

        {/* System Prompt Templates */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <BookText className="h-5 w-5 text-primary" />
              {t("playground:templates.title", "System Prompt Templates")}
            </div>
          }
          className="h-full">
          <p className="mb-4 text-sm text-text-muted">
            {t(
              "playground:modelPlayground.templatesDescription",
              "Choose from a library of pre-built system prompts for different use cases like coding, writing, analysis, and more."
            )}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2 text-sm font-medium text-text transition hover:border-primary/50 hover:bg-surface-hover">
              <BookText className="h-4 w-4" />
              {t("playground:modelPlayground.browseTemplates", "Browse Templates")}
            </button>
            {selectedTemplate && (
              <Alert
                type="success"
                showIcon
                message={
                  <span className="text-sm">
                    Using template:{" "}
                    <strong>{selectedTemplate.title}</strong>
                  </span>
                }
              />
            )}
          </div>
        </Card>

        {/* Cost Estimation */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {t("playground:cost.title", "Cost Estimation")}
            </div>
          }
          className="h-full">
          <p className="mb-4 text-sm text-text-muted">
            {t(
              "playground:modelPlayground.costDescription",
              "See estimated costs for your API calls based on token usage and model pricing. Costs are displayed in real-time during chat."
            )}
          </p>
          <div className="rounded-lg border border-border bg-surface2/50 p-4">
            <div className="text-center text-sm text-text-muted">
              {t(
                "playground:modelPlayground.costHint",
                "Cost estimation appears automatically during chat based on your selected model and token usage."
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Tips */}
      <Card
        title={t("playground:modelPlayground.tips", "Quick Tips")}
        size="small"
        className="bg-primary/5 border-primary/20">
        <ul className="space-y-2 text-sm text-text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
            <span>
              <strong className="text-text">Creative mode</strong> is great for brainstorming,
              storytelling, and generating varied responses.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
            <span>
              <strong className="text-text">Precise mode</strong> works best for factual questions,
              code generation, and tasks requiring consistency.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
            <span>
              Enable <strong className="text-text">JSON mode</strong> and include "JSON" in your
              prompt for best structured output results.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
            <span>
              Use <strong className="text-text">System Prompt Templates</strong> as starting points
              and customize them for your specific needs.
            </span>
          </li>
        </ul>
      </Card>

      {/* Templates Modal */}
      <SystemPromptTemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  )
}

export default ModelPlayground
