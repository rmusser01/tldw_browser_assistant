/**
 * EvaluationsTab component
 * Main tab for managing evaluations - list, create, edit, delete
 */

import React, { useEffect } from "react"
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import {
  useEvaluationsList,
  useEvaluationDetail,
  useCreateEvaluation,
  useUpdateEvaluation,
  useDeleteEvaluation,
  useEvaluationDefaults,
  getDefaultEvalSpecForType,
  evalTypeOptions
} from "../hooks/useEvaluations"
import { useDatasetsList } from "../hooks/useDatasets"
import { useEvaluationsStore } from "@/store/evaluations"
import { CopyButton, JsonEditor } from "../components"
import type { EvaluationSummary } from "@/services/evaluations"

const { Text } = Typography

export const EvaluationsTab: React.FC = () => {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  // Store state
  const {
    selectedEvalId,
    setSelectedEvalId,
    setSelectedRunId,
    editingEvalId,
    setEditingEvalId,
    createEvalOpen,
    openCreateEval,
    closeCreateEval,
    evalSpecText,
    setEvalSpecText,
    evalSpecError,
    setEvalSpecError,
    inlineDatasetEnabled,
    setInlineDatasetEnabled,
    inlineDatasetText,
    setInlineDatasetText,
    evalIdempotencyKey,
    regenerateEvalIdempotencyKey
  } = useEvaluationsStore((s) => ({
    selectedEvalId: s.selectedEvalId,
    setSelectedEvalId: s.setSelectedEvalId,
    setSelectedRunId: s.setSelectedRunId,
    editingEvalId: s.editingEvalId,
    setEditingEvalId: s.setEditingEvalId,
    createEvalOpen: s.createEvalOpen,
    openCreateEval: s.openCreateEval,
    closeCreateEval: s.closeCreateEval,
    evalSpecText: s.evalSpecText,
    setEvalSpecText: s.setEvalSpecText,
    evalSpecError: s.evalSpecError,
    setEvalSpecError: s.setEvalSpecError,
    inlineDatasetEnabled: s.inlineDatasetEnabled,
    setInlineDatasetEnabled: s.setInlineDatasetEnabled,
    inlineDatasetText: s.inlineDatasetText,
    setInlineDatasetText: s.setInlineDatasetText,
    evalIdempotencyKey: s.evalIdempotencyKey,
    regenerateEvalIdempotencyKey: s.regenerateEvalIdempotencyKey
  }))

  // Queries
  const { data: evalListResp, isLoading: evalsLoading, isError: evalsError } =
    useEvaluationsList({ limit: 20 })
  const { data: evalDetailResp, isLoading: evalDetailLoading, isError: evalDetailError } =
    useEvaluationDetail(selectedEvalId)
  const { data: evalDefaults } = useEvaluationDefaults()
  const { data: datasetListResp, isLoading: datasetsLoading } = useDatasetsList()

  // Mutations
  const createEvalMutation = useCreateEvaluation()
  const updateEvalMutation = useUpdateEvaluation()
  const deleteEvalMutation = useDeleteEvaluation()

  const evaluations = evalListResp?.data?.data || []
  const evalDetail = evalDetailResp?.data
  const datasets = datasetListResp?.data?.data || []

  // Initialize defaults
  useEffect(() => {
    if (evalDefaults && !evalSpecText) {
      const defaultType = evalDefaults.defaultEvalType || "response_quality"
      const spec = getDefaultEvalSpecForType(
        defaultType,
        evalDefaults.defaultSpecByType
      )
      setEvalSpecText(JSON.stringify(spec, null, 2))
    }
  }, [evalDefaults, evalSpecText, setEvalSpecText])

  const handleOpenCreate = () => {
    const defaultType = evalDefaults?.defaultEvalType || "response_quality"
    const defaultModel = evalDefaults?.defaultTargetModel || "gpt-3.5-turbo"
    const spec = getDefaultEvalSpecForType(
      defaultType,
      evalDefaults?.defaultSpecByType
    )
    setEvalSpecError(null)
    setEvalSpecText(JSON.stringify(spec, null, 2))
    setInlineDatasetEnabled(false)
    form.setFieldsValue({
      evalType: defaultType,
      runModel: defaultModel,
      name: "",
      description: "",
      datasetId: evalDefaults?.defaultDatasetId || undefined,
      idempotencyKey: evalIdempotencyKey,
      evalMetadataJson: undefined
    })
    openCreateEval()
  }

  const handleOpenEdit = () => {
    if (!selectedEvalId) return
    const selectedSummary = evaluations.find((e) => e.id === selectedEvalId)
    const detail = evalDetail as any
    const type =
      detail?.eval_type || selectedSummary?.eval_type || "response_quality"
    setEvalSpecError(null)
    setEvalSpecText(
      JSON.stringify(
        detail?.eval_spec || getDefaultEvalSpecForType(type),
        null,
        2
      )
    )
    form.setFieldsValue({
      evalType: type,
      name: detail?.name || selectedSummary?.name || selectedEvalId,
      description: detail?.description || selectedSummary?.description,
      datasetId: detail?.dataset_id || selectedSummary?.dataset_id,
      evalMetadataJson: detail?.metadata
        ? JSON.stringify(detail.metadata, null, 2)
        : undefined
    })
    setInlineDatasetEnabled(false)
    openCreateEval(selectedEvalId)
  }

  const handleDelete = () => {
    if (!selectedEvalId) return
    Modal.confirm({
      title: t("settings:evaluations.deleteConfirmTitle", {
        defaultValue: "Delete this evaluation?"
      }),
      content: t("settings:evaluations.deleteConfirmDescription", {
        defaultValue:
          "This will remove the evaluation definition. Runs already created remain in history."
      }),
      okButtonProps: { danger: true, loading: deleteEvalMutation.isPending },
      onOk: () => deleteEvalMutation.mutateAsync(selectedEvalId)
    })
  }

  const handleSubmit = async () => {
    setEvalSpecError(null)
    try {
      const values = await form.validateFields()
      let spec: any
      try {
        spec = JSON.parse(evalSpecText || "{}")
      } catch (e: any) {
        setEvalSpecError(e?.message || "Invalid JSON")
        return
      }

      const sanitizedName = String(values.name || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-")

      let inlineDataset: any[] | undefined
      if (inlineDatasetEnabled && inlineDatasetText.trim().length > 0) {
        try {
          const parsed = JSON.parse(inlineDatasetText)
          if (Array.isArray(parsed)) {
            inlineDataset = parsed
          } else {
            throw new Error("Inline dataset must be an array.")
          }
        } catch (e: any) {
          setEvalSpecError(e?.message || "Invalid inline dataset JSON")
          return
        }
      }

      let metadata: Record<string, any> | undefined
      if (values.evalMetadataJson) {
        try {
          metadata = JSON.parse(values.evalMetadataJson)
        } catch (e: any) {
          setEvalSpecError(e?.message || "Invalid metadata JSON")
          return
        }
      }

      const payload = {
        name: sanitizedName,
        description: values.description,
        eval_type: values.evalType,
        eval_spec: spec,
        dataset_id: inlineDataset ? undefined : values.datasetId || undefined,
        dataset: inlineDataset,
        metadata
      }

      if (editingEvalId) {
        await updateEvalMutation.mutateAsync({
          evalId: editingEvalId,
          payload
        })
      } else {
        await createEvalMutation.mutateAsync({
          payload,
          idempotencyKey: values.idempotencyKey || evalIdempotencyKey
        })
        regenerateEvalIdempotencyKey()
      }

      closeCreateEval()
      form.resetFields()
    } catch {
      // Form validation errors handled by antd
    }
  }

  return (
    <div className="space-y-4">
      {/* Evaluations List */}
      <Card
        title={t("settings:evaluations.listTitle", {
          defaultValue: "Recent evaluations"
        })}
        extra={
          <Space>
            <Button onClick={handleOpenCreate} type="primary">
              {t("settings:evaluations.newEvaluationCta", {
                defaultValue: "New evaluation"
              })}
            </Button>
            <Button disabled={!selectedEvalId} onClick={handleOpenEdit}>
              {t("common:edit", { defaultValue: "Edit" })}
            </Button>
            <Button
              danger
              disabled={!selectedEvalId}
              loading={deleteEvalMutation.isPending}
              onClick={handleDelete}
            >
              {t("common:delete", { defaultValue: "Delete" })}
            </Button>
          </Space>
        }
      >
        {evalsLoading ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : evalsError || evalListResp?.ok === false ? (
          <Alert
            type="error"
            message={t("settings:evaluations.loadErrorTitle", {
              defaultValue: "Unable to load evaluations"
            })}
            description={t("settings:evaluations.loadErrorDescription", {
              defaultValue:
                "Check your tldw server connection and API credentials, then try again."
            })}
          />
        ) : evaluations.length === 0 ? (
          <Empty
            description={t("settings:evaluations.emptyList", {
              defaultValue:
                "No evaluations yet. Once you create one, it will appear here."
            })}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {evaluations.map((ev: EvaluationSummary) => (
              <Card
                key={ev.id}
                size="small"
                className={`cursor-pointer hover:border-blue-500/70 ${
                  selectedEvalId === ev.id ? "border-blue-500" : ""
                }`}
                bodyStyle={{ padding: "8px 12px" }}
                onClick={() => {
                  setSelectedEvalId(ev.id)
                  setSelectedRunId(null)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {ev.name || ev.id}
                      </span>
                      <CopyButton text={ev.id} />
                    </div>
                    {ev.description && (
                      <span className="text-xs text-text-subtle">
                        {ev.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedEvalId === ev.id && (
                      <Tag color="green" className="text-xs">
                        {t("settings:evaluations.selectedTag", {
                          defaultValue: "Selected"
                        })}
                      </Tag>
                    )}
                    {ev.eval_type && (
                      <Tag color="blue" className="text-xs">
                        {ev.eval_type}
                      </Tag>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Evaluation Details */}
      <Card
        title={t("settings:evaluations.detailTitle", {
          defaultValue: "Evaluation details"
        })}
        extra={
          selectedEvalId && (
            <Space>
              <Button size="small" onClick={handleOpenEdit}>
                {t("common:edit", { defaultValue: "Edit" })}
              </Button>
              <Button
                size="small"
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: ["evaluations", "detail", selectedEvalId]
                  })
                }
              >
                {t("common:refresh", { defaultValue: "Refresh" })}
              </Button>
            </Space>
          )
        }
      >
        {!selectedEvalId ? (
          <Text type="secondary" className="text-xs">
            {t("settings:evaluations.noEvalSelectedDetails", {
              defaultValue: "Select an evaluation to inspect its spec."
            })}
          </Text>
        ) : evalDetailLoading ? (
          <div className="flex justify-center py-4">
            <Spin />
          </div>
        ) : evalDetailError || evalDetailResp?.ok === false ? (
          <Alert
            type="warning"
            message={t("settings:evaluations.detailErrorTitle", {
              defaultValue: "Unable to load evaluation details"
            })}
          />
        ) : evalDetail ? (
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-3">
              <Tag>
                {t("common:id", { defaultValue: "ID" })}:{" "}
                <code>{evalDetail.id}</code>
                <CopyButton text={evalDetail.id} />
              </Tag>
              {evalDetail.eval_type && (
                <Tag color="blue">{evalDetail.eval_type}</Tag>
              )}
              {evalDetail.dataset_id && (
                <Tag color="purple">
                  {t("settings:evaluations.datasetLabel", {
                    defaultValue: "Dataset"
                  })}
                  : {evalDetail.dataset_id}
                </Tag>
              )}
            </div>
            {evalDetail.description && (
              <div>
                <Text type="secondary">
                  {t("settings:evaluations.descriptionLabel", {
                    defaultValue: "Description"
                  })}
                  {": "}
                </Text>
                <Text>{evalDetail.description}</Text>
              </div>
            )}
            {evalDetail.metadata && (
              <div>
                <Text type="secondary">
                  {t("common:metadata", { defaultValue: "Metadata" })}
                </Text>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface2 p-2 text-[11px] text-text">
                  {JSON.stringify(evalDetail.metadata, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <Text type="secondary">
                {t("settings:evaluations.evalSpecLabel", {
                  defaultValue: "Evaluation spec (snippet)"
                })}
              </Text>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface2 p-2 text-[11px] text-text">
                {JSON.stringify(evalDetail.eval_spec || {}, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={
          editingEvalId
            ? t("settings:evaluations.editEvalModalTitle", {
                defaultValue: "Edit evaluation"
              })
            : t("settings:evaluations.createEvalModalTitle", {
                defaultValue: "New evaluation"
              })
        }
        open={createEvalOpen}
        onCancel={() => {
          closeCreateEval()
          form.resetFields()
        }}
        onOk={handleSubmit}
        confirmLoading={createEvalMutation.isPending || updateEvalMutation.isPending}
        okText={
          editingEvalId
            ? (t("common:save", { defaultValue: "Save" }) as string)
            : (t("common:create", { defaultValue: "Create" }) as string)
        }
        width={640}
      >
        <Form form={form} layout="vertical">
          <Alert
            type="info"
            showIcon
            className="mb-3 text-xs"
            message={t("settings:evaluations.evalTypesHint", {
              defaultValue:
                "Supported: model_graded, response_quality, rag, rag_pipeline, geval, exact_match, includes, fuzzy_match, proposition_extraction, qa3, label_choice, nli_factcheck, ocr."
            })}
          />
          <Form.Item
            label={t("settings:evaluations.evalNameLabel", {
              defaultValue: "Name"
            })}
            name="name"
            rules={[
              { required: true },
              {
                pattern: /^[a-zA-Z0-9_-]+$/,
                message: t("settings:evaluations.evalNameValidation", {
                  defaultValue:
                    "Use only letters, numbers, hyphens, and underscores."
                }) as string
              }
            ]}
          >
            <Input
              placeholder={t("settings:evaluations.evalNamePlaceholder", {
                defaultValue: "my_eval_run"
              })}
            />
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.evalTypeLabel", {
              defaultValue: "Evaluation type"
            })}
            name="evalType"
            initialValue="response_quality"
            rules={[{ required: true }]}
          >
            <Select
              onChange={(value) => {
                setEvalSpecError(null)
                setEvalSpecText(
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
          <Form.Item
            label={t("settings:evaluations.datasetLabel", {
              defaultValue: "Dataset (optional)"
            })}
            name="datasetId"
          >
            <Select
              allowClear
              placeholder={t("settings:evaluations.datasetPlaceholder", {
                defaultValue: "Select dataset"
              })}
              loading={datasetsLoading}
              options={datasets.map((ds) => ({
                value: ds.id,
                label: ds.name
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={inlineDatasetEnabled}
              onChange={(e) => setInlineDatasetEnabled(e.target.checked)}
            >
              {t("settings:evaluations.inlineDatasetCheckbox", {
                defaultValue:
                  "Attach inline dataset instead of referencing dataset_id"
              })}
            </Checkbox>
            {inlineDatasetEnabled && (
              <JsonEditor
                rows={3}
                className="mt-2"
                value={inlineDatasetText}
                onChange={setInlineDatasetText}
                placeholder='[{"input": {"question": "Q1", "contexts": ["ctx"], "response": "A"}, "expected": {"answer": "A"}}]'
              />
            )}
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.evalSpecLabel", {
              defaultValue: "Evaluation spec (JSON)"
            })}
          >
            <JsonEditor
              rows={6}
              value={evalSpecText}
              onChange={setEvalSpecText}
              onValidationError={setEvalSpecError}
            />
            {evalSpecError && (
              <div className="mt-1 text-xs text-red-600">{evalSpecError}</div>
            )}
          </Form.Item>

          {/* Advanced options in collapsible section */}
          <Collapse
            ghost
            items={[
              {
                key: "advanced",
                label: t("settings:evaluations.advancedOptions", {
                  defaultValue: "Advanced options"
                }),
                children: (
                  <>
                    <Form.Item
                      label={t("settings:evaluations.evalMetadataLabel", {
                        defaultValue: "Metadata (JSON, optional)"
                      })}
                      name="evalMetadataJson"
                    >
                      <Input.TextArea rows={3} className="font-mono text-sm" />
                    </Form.Item>
                    {!editingEvalId && (
                      <Form.Item
                        label={
                          <Tooltip
                            title={t(
                              "settings:evaluations.idempotencyKeyTooltip",
                              {
                                defaultValue:
                                  "Prevents duplicate creation if the browser retries the request. Use a unique key per creation attempt."
                              }
                            )}
                          >
                            <span className="cursor-help underline decoration-dotted">
                              {t("settings:evaluations.idempotencyKeyLabel", {
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
                                "settings:evaluations.idempotencyKeyPlaceholder",
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
                              regenerateEvalIdempotencyKey()
                              form.setFieldsValue({
                                idempotencyKey:
                                  useEvaluationsStore.getState().evalIdempotencyKey
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
        </Form>
      </Modal>
    </div>
  )
}

export default EvaluationsTab
