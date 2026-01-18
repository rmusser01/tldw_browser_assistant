/**
 * CreateEvaluationWizard component
 * Three-step wizard for creating/editing evaluations.
 */

import React, { useMemo, useState } from "react"
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Form,
  Input,
  Select,
  Space,
  Steps,
  Tooltip
} from "antd"
import type { FormInstance } from "antd"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { evalTypeOptions, getDefaultEvalSpecForType } from "../hooks/useEvaluations"
import { JsonEditor } from "./JsonEditor"
import { VisualSpecBuilder } from "./VisualSpecBuilder"

interface DatasetOption {
  id: string
  name?: string | null
}

interface CreateEvaluationWizardProps {
  form: FormInstance
  datasets: DatasetOption[]
  evalDefaults?: {
    defaultEvalType?: string
    defaultSpecByType?: Record<string, string>
  } | null
  editingEvalId?: string | null
  evalSpecText: string
  evalSpecError: string | null
  inlineDatasetEnabled: boolean
  inlineDatasetText: string
  evalIdempotencyKey: string
  onSpecChange: (text: string) => void
  onSpecError: (error: string | null) => void
  onInlineDatasetEnabled: (enabled: boolean) => void
  onInlineDatasetText: (text: string) => void
  onRegenerateIdempotencyKey: () => void
  onCancel: () => void
  onSubmit: () => void
  submitting?: boolean
}

export const CreateEvaluationWizard: React.FC<CreateEvaluationWizardProps> = ({
  form,
  datasets,
  evalDefaults,
  editingEvalId,
  evalSpecText,
  evalSpecError,
  inlineDatasetEnabled,
  inlineDatasetText,
  evalIdempotencyKey,
  onSpecChange,
  onSpecError,
  onInlineDatasetEnabled,
  onInlineDatasetText,
  onRegenerateIdempotencyKey,
  onCancel,
  onSubmit,
  submitting
}) => {
  const { t } = useTranslation(["evaluations", "common"])
  const [currentStep, setCurrentStep] = useState(0)

  const evalType = Form.useWatch("evalType", form) || "response_quality"
  const evalMetadataValue = Form.useWatch("evalMetadataJson", form) || ""

  const steps = useMemo(
    () => [
      {
        key: "basic",
        title: t("evaluations:wizardStepBasic", { defaultValue: "Type & name" })
      },
      {
        key: "config",
        title: t("evaluations:wizardStepConfig", { defaultValue: "Configuration" })
      },
      {
        key: "dataset",
        title: t("evaluations:wizardStepDataset", { defaultValue: "Dataset" })
      }
    ],
    [t]
  )

  const handleNext = async () => {
    if (currentStep === 0) {
      await form.validateFields(["name", "evalType"])
      setCurrentStep(1)
      return
    }
    if (currentStep === 1) {
      onSpecError(null)
      try {
        JSON.parse(evalSpecText || "{}")
        setCurrentStep(2)
      } catch (e: any) {
        onSpecError(e?.message || "Invalid JSON")
      }
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <Alert
              type="info"
              showIcon
              className="text-xs"
              message={t("evaluations:evalTypesHint", {
                defaultValue:
                  "Supported: model_graded, response_quality, rag, rag_pipeline, geval, exact_match, includes, fuzzy_match, proposition_extraction, qa3, label_choice, nli_factcheck, ocr."
              })}
            />
            <Form.Item
              label={t("evaluations:evalNameLabel", { defaultValue: "Name" })}
              name="name"
              rules={[
                { required: true },
                {
                  pattern: /^[a-zA-Z0-9_-]+$/,
                  message: t("evaluations:evalNameValidation", {
                    defaultValue:
                      "Use only letters, numbers, hyphens, and underscores."
                  }) as string
                }
              ]}
            >
              <Input
                placeholder={t("evaluations:evalNamePlaceholder", {
                  defaultValue: "my_eval_run"
                })}
              />
            </Form.Item>
            <Form.Item
              label={t("evaluations:descriptionLabel", {
                defaultValue: "Description"
              })}
              name="description"
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item
              label={t("evaluations:evalTypeLabel", {
                defaultValue: "Evaluation type"
              })}
              name="evalType"
              initialValue={evalDefaults?.defaultEvalType || "response_quality"}
              rules={[{ required: true }]}
            >
              <Select
                onChange={(value) => {
                  onSpecError(null)
                  onSpecChange(
                    JSON.stringify(
                      getDefaultEvalSpecForType(
                        value,
                        evalDefaults?.defaultSpecByType
                      ),
                      null,
                      2
                    )
                  )
                }}
                options={evalTypeOptions}
              />
            </Form.Item>
          </div>
        )
      case 1:
        return (
          <div className="space-y-4">
            <VisualSpecBuilder
              evalType={evalType}
              specText={evalSpecText}
              onSpecChange={onSpecChange}
              onValidationError={onSpecError}
            />
            {evalSpecError && (
              <div className="text-xs text-red-600">{evalSpecError}</div>
            )}
            <Collapse
              ghost
              items={[
                {
                  key: "advanced",
                  label: t("evaluations:advancedOptions", {
                    defaultValue: "Advanced options"
                  }),
                  children: (
                    <>
                      <Form.Item
                        label={t("evaluations:evalMetadataLabel", {
                          defaultValue: "Metadata (JSON, optional)"
                        })}
                        name="evalMetadataJson"
                      >
                        <JsonEditor
                          rows={3}
                          value={evalMetadataValue}
                          onChange={(value) =>
                            form.setFieldsValue({ evalMetadataJson: value })
                          }
                        />
                      </Form.Item>
                      {!editingEvalId && (
                        <Form.Item
                          label={
                            <Tooltip
                              title={t(
                                "evaluations:idempotencyKeyTooltip",
                                {
                                  defaultValue:
                                    "Prevents duplicate creation if the browser retries the request. Use a unique key per creation attempt."
                                }
                              )}
                            >
                              <span className="cursor-help underline decoration-dotted">
                                {t("evaluations:idempotencyKeyLabel", {
                                  defaultValue: "Idempotency key"
                                })}
                              </span>
                            </Tooltip>
                          }
                          name="idempotencyKey"
                          initialValue={evalIdempotencyKey}
                        >
                          <Space.Compact className="w-full">
                            <Input
                              placeholder={
                                t(
                                  "evaluations:idempotencyKeyPlaceholder",
                                  {
                                    defaultValue:
                                      "Prevents duplicate create on retry"
                                  }
                                ) as string
                              }
                            />
                            <Button
                              size="small"
                              onClick={() => {
                                onRegenerateIdempotencyKey()
                                form.setFieldsValue({
                                  idempotencyKey:
                                    (form.getFieldValue("idempotencyKey") as string) ||
                                    evalIdempotencyKey
                                })
                              }}
                            >
                              {t("common:regenerate", {
                                defaultValue: "Regenerate"
                              })}
                            </Button>
                          </Space.Compact>
                        </Form.Item>
                      )}
                    </>
                  )
                }
              ]}
            />
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <Form.Item
              label={t("evaluations:datasetLabel", {
                defaultValue: "Dataset (optional)"
              })}
              name="datasetId"
            >
              <Select
                allowClear
                placeholder={t("evaluations:datasetPlaceholder", {
                  defaultValue: "Select dataset"
                })}
                options={datasets.map((ds) => ({
                  value: ds.id,
                  label: ds.name || ds.id
                }))}
              />
            </Form.Item>
            <Checkbox
              checked={inlineDatasetEnabled}
              onChange={(e) => onInlineDatasetEnabled(e.target.checked)}
            >
              {t("evaluations:inlineDatasetCheckbox", {
                defaultValue:
                  "Attach inline dataset instead of referencing dataset_id"
              })}
            </Checkbox>
            {inlineDatasetEnabled && (
              <JsonEditor
                rows={4}
                value={inlineDatasetText}
                onChange={onInlineDatasetText}
                placeholder='[{"input": {"question": "Q1"}, "expected": {"answer": "A"}}]'
              />
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <Steps current={currentStep} items={steps} size="small" />
      <Form form={form} layout="vertical">
        {renderStepContent()}
      </Form>
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <Button
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={handleBack}
            >
              {t("common:back", { defaultValue: "Back" })}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onCancel}>
            {t("common:cancel", { defaultValue: "Cancel" })}
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext}>
              {t("common:next", { defaultValue: "Next" })}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="primary" loading={submitting} onClick={onSubmit}>
              {editingEvalId
                ? t("common:save", { defaultValue: "Save" })
                : t("common:create", { defaultValue: "Create" })}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateEvaluationWizard
