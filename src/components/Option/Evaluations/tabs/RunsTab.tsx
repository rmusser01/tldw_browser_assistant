/**
 * RunsTab component
 * Tab for managing evaluation runs - create, list, view details
 */

import React, { useMemo } from "react"
import {
  Alert,
  Button,
  Card,
  Collapse,
  Divider,
  Empty,
  Form,
  Input,
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
  useRateLimits,
  useRunsList,
  useRunDetail,
  useCreateRun,
  useCancelRun,
  useAdhocEvaluation,
  extractMetricsSummary,
  adhocEndpointOptions
} from "../hooks/useRuns"
import { useEvaluationsList } from "../hooks/useEvaluations"
import { useEvaluationsStore } from "@/store/evaluations"
import {
  CopyButton,
  JsonEditor,
  MetricsChart,
  PollingIndicator,
  RateLimitsWidget,
  StatusBadge
} from "../components"

const { Text } = Typography

export const RunsTab: React.FC = () => {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const [runForm] = Form.useForm()

  // Store state
  const {
    selectedEvalId,
    setSelectedEvalId,
    selectedRunId,
    setSelectedRunId,
    runConfigText,
    setRunConfigText,
    datasetOverrideText,
    setDatasetOverrideText,
    runIdempotencyKey,
    regenerateRunIdempotencyKey,
    quotaSnapshot,
    setQuotaSnapshot,
    isPolling,
    adhocEndpoint,
    setAdhocEndpoint,
    adhocPayloadText,
    setAdhocPayloadText,
    adhocResult
  } = useEvaluationsStore((s) => ({
    selectedEvalId: s.selectedEvalId,
    setSelectedEvalId: s.setSelectedEvalId,
    selectedRunId: s.selectedRunId,
    setSelectedRunId: s.setSelectedRunId,
    runConfigText: s.runConfigText,
    setRunConfigText: s.setRunConfigText,
    datasetOverrideText: s.datasetOverrideText,
    setDatasetOverrideText: s.setDatasetOverrideText,
    runIdempotencyKey: s.runIdempotencyKey,
    regenerateRunIdempotencyKey: s.regenerateRunIdempotencyKey,
    quotaSnapshot: s.quotaSnapshot,
    setQuotaSnapshot: s.setQuotaSnapshot,
    isPolling: s.isPolling,
    adhocEndpoint: s.adhocEndpoint,
    setAdhocEndpoint: s.setAdhocEndpoint,
    adhocPayloadText: s.adhocPayloadText,
    setAdhocPayloadText: s.setAdhocPayloadText,
    adhocResult: s.adhocResult
  }))

  // Queries
  const { data: evalListResp } = useEvaluationsList({ limit: 20 })
  const { data: rateLimitsResp, isLoading: rateLimitsLoading, isError: rateLimitsError } =
    useRateLimits()
  const { data: runsListResp, isLoading: runsLoading, isError: runsError } =
    useRunsList(selectedEvalId)
  const { data: runDetailResp, isLoading: runDetailLoading, isError: runDetailError } =
    useRunDetail(selectedRunId)

  // Mutations
  const createRunMutation = useCreateRun()
  const cancelRunMutation = useCancelRun()
  const adhocMutation = useAdhocEvaluation()

  const evaluations = evalListResp?.data?.data || []
  const rateLimits = rateLimitsResp?.data
  const runs = runsListResp?.data?.data || []
  const runDetail = runDetailResp?.data

  const runMetrics = useMemo(
    () => extractMetricsSummary(runDetail?.results),
    [runDetail]
  )

  const isRunActive = ["running", "pending"].includes(
    String(runDetail?.status || "").toLowerCase()
  )

  const handleStartRun = async () => {
    if (!selectedEvalId) return
    const values = await runForm.validateFields().catch(() => null)
    if (!values) return

    let config: Record<string, any> | undefined
    if (values.configJson) {
      try {
        config = JSON.parse(values.configJson)
      } catch {
        return
      }
    }

    let datasetOverride: { samples: any[] } | undefined
    if (values.datasetOverrideJson) {
      try {
        const parsed = JSON.parse(values.datasetOverrideJson)
        if (Array.isArray(parsed)) {
          datasetOverride = { samples: parsed }
        } else if (parsed?.samples && Array.isArray(parsed.samples)) {
          datasetOverride = { samples: parsed.samples }
        }
      } catch {
        return
      }
    }

    await createRunMutation.mutateAsync({
      evalId: selectedEvalId,
      payload: {
        target_model: values.targetModel || "gpt-3.5-turbo",
        config,
        dataset_override: datasetOverride,
        webhook_url: values.webhookUrl || undefined
      },
      idempotencyKey: values.idempotencyKey || runIdempotencyKey
    })
    regenerateRunIdempotencyKey()
  }

  const handleAdhocRun = async () => {
    try {
      const parsed = adhocPayloadText ? JSON.parse(adhocPayloadText) : {}
      await adhocMutation.mutateAsync({ endpoint: adhocEndpoint, body: parsed })
    } catch {
      // Error handled in mutation
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Left Column - Run Form & List */}
      <div className="space-y-4">
        {/* Eval Selector */}
        <Card
          size="small"
          title={t("settings:evaluations.selectEvaluation", {
            defaultValue: "Select evaluation"
          })}
        >
          <Select
            className="w-full"
            placeholder={t("settings:evaluations.selectEvaluationPlaceholder", {
              defaultValue: "Choose an evaluation to run"
            })}
            value={selectedEvalId}
            onChange={(value) => {
              setSelectedEvalId(value)
              setSelectedRunId(null)
            }}
            options={evaluations.map((e) => ({
              value: e.id,
              label: e.name || e.id
            }))}
            allowClear
          />
        </Card>

        {/* Run Form */}
        <Card
          title={t("settings:evaluations.runsTitle", { defaultValue: "Runs" })}
          extra={<PollingIndicator isPolling={isPolling} />}
        >
          {!selectedEvalId ? (
            <Text type="secondary" className="text-xs">
              {t("settings:evaluations.noEvalSelectedRuns", {
                defaultValue: "Select an evaluation to see its recent runs."
              })}
            </Text>
          ) : (
            <>
              <Alert
                type="info"
                showIcon
                className="mb-2 text-xs"
                message={t("settings:evaluations.runPollingHint", {
                  defaultValue:
                    "Runs execute asynchronously. The UI polls every ~3s until status leaves running/pending."
                })}
              />
              <Form form={runForm} layout="vertical" size="small">
                <Form.Item
                  label={t("settings:evaluations.runModelLabelShort", {
                    defaultValue: "Target model"
                  })}
                  name="targetModel"
                  initialValue="gpt-3.5-turbo"
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label={t("settings:evaluations.runConfigLabel", {
                    defaultValue: "Config (JSON)"
                  })}
                  name="configJson"
                  initialValue={runConfigText}
                >
                  <JsonEditor
                    rows={3}
                    value={runConfigText}
                    onChange={(v) => {
                      setRunConfigText(v)
                      runForm.setFieldsValue({ configJson: v })
                    }}
                  />
                </Form.Item>

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
                            label={t("settings:evaluations.datasetOverrideLabel", {
                              defaultValue: "Dataset override (JSON array of samples)"
                            })}
                            name="datasetOverrideJson"
                            initialValue={datasetOverrideText}
                          >
                            <JsonEditor
                              rows={3}
                              value={datasetOverrideText}
                              onChange={(v) => {
                                setDatasetOverrideText(v)
                                runForm.setFieldsValue({ datasetOverrideJson: v })
                              }}
                              placeholder='[{"input": {...}, "expected": {...}}]'
                            />
                          </Form.Item>
                          <Form.Item
                            label={t("settings:evaluations.webhookUrlLabel", {
                              defaultValue: "Webhook URL (optional)"
                            })}
                            name="webhookUrl"
                          >
                            <Input placeholder="https://example.com/hook" />
                          </Form.Item>
                          <Form.Item
                            label={
                              <Tooltip
                                title={t(
                                  "settings:evaluations.idempotencyKeyTooltip",
                                  {
                                    defaultValue:
                                      "Prevents duplicate runs if the browser retries the request."
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
                            initialValue={runIdempotencyKey}
                          >
                            <Space.Compact className="w-full">
                              <Input />
                              <Button
                                size="small"
                                onClick={() => {
                                  regenerateRunIdempotencyKey()
                                  runForm.setFieldsValue({
                                    idempotencyKey:
                                      useEvaluationsStore.getState().runIdempotencyKey
                                  })
                                }}
                              >
                                {t("common:regenerate", {
                                  defaultValue: "Regenerate"
                                })}
                              </Button>
                            </Space.Compact>
                          </Form.Item>
                        </>
                      )
                    }
                  ]}
                />

                <Space className="mt-4">
                  <Button
                    type="primary"
                    loading={createRunMutation.isPending}
                    onClick={handleStartRun}
                  >
                    {t("settings:evaluations.startRunCta", {
                      defaultValue: "Start run"
                    })}
                  </Button>
                  {selectedRunId && isRunActive && (
                    <Button
                      danger
                      loading={cancelRunMutation.isPending}
                      onClick={() => cancelRunMutation.mutateAsync(selectedRunId)}
                    >
                      {t("settings:evaluations.cancelRunCta", {
                        defaultValue: "Cancel run"
                      })}
                    </Button>
                  )}
                </Space>
              </Form>

              <Divider className="my-3" />

              {/* Runs List */}
              {runsLoading ? (
                <div className="flex justify-center py-4">
                  <Spin />
                </div>
              ) : runsError || runsListResp?.ok === false ? (
                <Alert
                  type="warning"
                  showIcon
                  message={t("settings:evaluations.runsErrorTitle", {
                    defaultValue: "Unable to load runs"
                  })}
                />
              ) : runs.length === 0 ? (
                <Empty
                  description={t("settings:evaluations.runsEmpty", {
                    defaultValue: "No runs yet for this evaluation."
                  })}
                />
              ) : (
                <div className="flex flex-col gap-2 text-xs">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      className={`flex cursor-pointer items-center justify-between rounded border px-2 py-1 ${
                        selectedRunId === run.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-border"
                      }`}
                      onClick={() => {
                        setSelectedRunId(run.id)
                        setQuotaSnapshot(null)
                      }}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Run {run.id}</span>
                          <CopyButton text={run.id} />
                        </div>
                        {run.status && <StatusBadge status={run.status} />}
                      </div>
                      {selectedRunId === run.id && (
                        <Tag color="green" className="text-[11px]">
                          {t("settings:evaluations.selectedTag", {
                            defaultValue: "Selected"
                          })}
                        </Tag>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Ad-hoc Evaluator */}
        <Card
          title={t("settings:evaluations.adhocTitle", {
            defaultValue: "Ad-hoc evaluator"
          })}
          extra={
            <Select
              size="small"
              style={{ width: 180 }}
              value={adhocEndpoint}
              onChange={(val) => {
                setAdhocEndpoint(val)
                setAdhocPayloadText(
                  JSON.stringify(
                    val.includes("ocr")
                      ? { image_b64: "<base64-data>" }
                      : { input: "Sample text", reference: "Expected reply" },
                    null,
                    2
                  )
                )
              }}
              options={adhocEndpointOptions}
            />
          }
        >
          <Form layout="vertical" size="small">
            <Form.Item
              label={t("settings:evaluations.runConfigLabel", {
                defaultValue: "Config (JSON)"
              })}
            >
              <JsonEditor
                rows={4}
                value={adhocPayloadText}
                onChange={setAdhocPayloadText}
              />
            </Form.Item>
            <Button
              type="primary"
              loading={adhocMutation.isPending}
              onClick={handleAdhocRun}
            >
              {t("settings:evaluations.startRunCta", {
                defaultValue: "Start run"
              })}
            </Button>
          </Form>
          {adhocResult && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-surface2 p-2 text-[11px] text-text">
              {JSON.stringify(adhocResult, null, 2)}
            </pre>
          )}
        </Card>
      </div>

      {/* Right Column - Run Details & Rate Limits */}
      <div className="space-y-4">
        {/* Rate Limits */}
        <Card
          title={t("settings:evaluations.rateLimitsTitle", {
            defaultValue: "Evaluation limits"
          })}
        >
          <RateLimitsWidget
            rateLimits={rateLimits}
            isLoading={rateLimitsLoading}
            isError={rateLimitsError}
            quotaSnapshot={quotaSnapshot}
          />
        </Card>

        {/* Run Details */}
        <Card
          title={t("settings:evaluations.runDetailTitle", {
            defaultValue: "Run details"
          })}
          extra={
            selectedRunId && (
              <Space>
                <Button
                  size="small"
                  onClick={() =>
                    void queryClient.invalidateQueries({
                      queryKey: ["evaluations", "run", selectedRunId]
                    })
                  }
                >
                  {t("common:refresh", { defaultValue: "Refresh" })}
                </Button>
                {isRunActive && (
                  <Button
                    size="small"
                    danger
                    loading={cancelRunMutation.isPending}
                    onClick={() => cancelRunMutation.mutateAsync(selectedRunId)}
                  >
                    {t("settings:evaluations.cancelRunCta", {
                      defaultValue: "Cancel run"
                    })}
                  </Button>
                )}
              </Space>
            )
          }
        >
          {!selectedRunId ? (
            <Text type="secondary" className="text-xs">
              {t("settings:evaluations.noRunSelected", {
                defaultValue: "Select a run to see details."
              })}
            </Text>
          ) : runDetailLoading ? (
            <div className="flex justify-center py-4">
              <Spin />
            </div>
          ) : runDetailError || runDetailResp?.ok === false ? (
            <Alert
              type="warning"
              showIcon
              message={t("settings:evaluations.runDetailErrorTitle", {
                defaultValue: "Unable to load run details"
              })}
            />
          ) : runDetail ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Text type="secondary">
                  {t("settings:evaluations.runStatusLabel", {
                    defaultValue: "Status"
                  })}
                  {": "}
                </Text>
                <StatusBadge status={runDetail.status} />
              </div>
              <div>
                <Text type="secondary">
                  {t("settings:evaluations.runModelLabelShort", {
                    defaultValue: "Target model"
                  })}
                  {": "}
                </Text>
                <Text>{runDetail.target_model}</Text>
              </div>
              <div className="flex items-center gap-2">
                <Text type="secondary">
                  {t("settings:evaluations.runEvalIdLabel", {
                    defaultValue: "Evaluation"
                  })}
                  {": "}
                </Text>
                <Text>{runDetail.eval_id}</Text>
                <CopyButton text={runDetail.eval_id} />
              </div>

              {runMetrics.length > 0 && (
                <div className="mt-3">
                  <MetricsChart metrics={runMetrics} />
                </div>
              )}

              {runDetail.error_message && (
                <div>
                  <Text type="secondary">
                    {t("settings:evaluations.runErrorLabel", {
                      defaultValue: "Error"
                    })}
                    {": "}
                  </Text>
                  <Text type="danger">{runDetail.error_message}</Text>
                </div>
              )}

              {runDetail.results && (
                <div className="mt-2">
                  <Text type="secondary">
                    {t("settings:evaluations.runResultsLabel", {
                      defaultValue: "Results (snippet)"
                    })}
                  </Text>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface2 p-2 text-[11px] text-text">
                    {JSON.stringify(runDetail.results, null, 2)}
                  </pre>
                </div>
              )}

              {runDetail.progress && (
                <div className="mt-2">
                  <Text type="secondary">
                    {t("settings:evaluations.runProgressLabel", {
                      defaultValue: "Progress"
                    })}
                  </Text>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface2 p-2 text-[11px] text-text">
                    {JSON.stringify(runDetail.progress, null, 2)}
                  </pre>
                </div>
              )}

              {runDetail.usage && (
                <div className="mt-2">
                  <Text type="secondary">
                    {t("settings:evaluations.runUsageLabel", {
                      defaultValue: "Usage"
                    })}
                  </Text>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface2 p-2 text-[11px] text-text">
                    {JSON.stringify(runDetail.usage, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

export default RunsTab
