/**
 * DatasetsTab component
 * Tab for managing evaluation datasets - create, list, view, delete
 */

import React from "react"
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Space,
  Spin,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import {
  useDatasetsList,
  useCreateDataset,
  useDeleteDataset,
  useLoadDatasetSamples,
  useCloseDatasetViewer,
  parseSamplesJson
} from "../hooks/useDatasets"
import { useEvaluationsStore } from "@/store/evaluations"
import { CopyButton, JsonEditor } from "../components"
import type { DatasetResponse, DatasetSample } from "@/services/evaluations"

const { Text } = Typography

export const DatasetsTab: React.FC = () => {
  const { t } = useTranslation(["settings", "common"])
  const [form] = Form.useForm()

  // Store state
  const {
    createDatasetOpen,
    openCreateDataset,
    closeCreateDataset,
    viewingDataset,
    datasetSamples,
    datasetSamplesPage,
    datasetSamplesPageSize,
    datasetSamplesTotal
  } = useEvaluationsStore((s) => ({
    createDatasetOpen: s.createDatasetOpen,
    openCreateDataset: s.openCreateDataset,
    closeCreateDataset: s.closeCreateDataset,
    viewingDataset: s.viewingDataset,
    datasetSamples: s.datasetSamples,
    datasetSamplesPage: s.datasetSamplesPage,
    datasetSamplesPageSize: s.datasetSamplesPageSize,
    datasetSamplesTotal: s.datasetSamplesTotal
  }))

  // Queries & mutations
  const { data: datasetListResp, isLoading: datasetsLoading, isError: datasetsError } =
    useDatasetsList()
  const createDatasetMutation = useCreateDataset()
  const deleteDatasetMutation = useDeleteDataset()
  const loadDatasetMutation = useLoadDatasetSamples()
  const closeViewer = useCloseDatasetViewer()

  const datasets: DatasetResponse[] = datasetListResp?.data?.data || []

  const handleSubmitCreate = async () => {
    try {
      const values = await form.validateFields()
      let samples: DatasetSample[] = [
        {
          input: values.sampleInput,
          expected: values.sampleExpected || undefined
        }
      ]
      if (values.samplesJson) {
        const { samples: parsed, error } = parseSamplesJson(values.samplesJson)
        if (error) {
          return
        }
        if (parsed) {
          samples = parsed
        }
      }

      let metadata: Record<string, any> | undefined
      if (values.metadataJson) {
        try {
          metadata = JSON.parse(values.metadataJson)
        } catch {
          return
        }
      }

      await createDatasetMutation.mutateAsync({
        name: values.name,
        description: values.description,
        samples,
        metadata
      })
      form.resetFields()
      closeCreateDataset()
    } catch {
      // Form validation errors handled by antd
    }
  }

  const handleDeleteDataset = (datasetId: string) => {
    Modal.confirm({
      title: t("settings:evaluations.deleteDatasetConfirmTitle", {
        defaultValue: "Delete this dataset?"
      }),
      content: t("settings:evaluations.deleteDatasetConfirmDescription", {
        defaultValue:
          "This will permanently remove the dataset. Evaluations using it will need a new dataset."
      }),
      okButtonProps: { danger: true },
      onOk: () => deleteDatasetMutation.mutateAsync(datasetId)
    })
  }

  return (
    <div className="space-y-4">
      <Card
        title={t("settings:evaluations.datasetsTitle", {
          defaultValue: "Datasets"
        })}
        extra={
          <Button
            onClick={openCreateDataset}
            disabled={createDatasetMutation.isPending}
          >
            {t("settings:evaluations.newDatasetCta", {
              defaultValue: "New dataset"
            })}
          </Button>
        }
      >
        {datasetsLoading ? (
          <div className="flex justify-center py-4">
            <Spin />
          </div>
        ) : datasetsError || datasetListResp?.ok === false ? (
          <Alert
            type="warning"
            showIcon
            message={t("settings:evaluations.datasetsErrorTitle", {
              defaultValue: "Unable to load datasets"
            })}
          />
        ) : datasets.length === 0 ? (
          <Empty
            description={t("settings:evaluations.datasetsEmpty", {
              defaultValue:
                "No datasets yet. Create one to attach to evaluations."
            })}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {datasets.map((ds) => (
              <Card
                key={ds.id}
                size="small"
                className="hover:border-blue-500/70"
                bodyStyle={{ padding: "8px 12px" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ds.name}</span>
                      <CopyButton text={ds.id} />
                    </div>
                    {ds.description && (
                      <span className="text-xs text-text-subtle">
                        {ds.description}
                      </span>
                    )}
                    <span className="text-xs text-text-subtle">
                      {t("settings:evaluations.datasetSampleCount", {
                        defaultValue: "{{count}} samples",
                        count: ds.sample_count
                      })}
                    </span>
                  </div>
                  <Space>
                    <Button
                      size="small"
                      loading={loadDatasetMutation.isPending}
                      onClick={() =>
                        loadDatasetMutation.mutate({ datasetId: ds.id, page: 1 })
                      }
                    >
                      {t("common:view", { defaultValue: "View" })}
                    </Button>
                    <Button
                      size="small"
                      danger
                      loading={deleteDatasetMutation.isPending}
                      onClick={() => handleDeleteDataset(ds.id)}
                    >
                      {t("common:delete", { defaultValue: "Delete" })}
                    </Button>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Create Dataset Modal */}
      <Modal
        title={t("settings:evaluations.createDatasetModalTitle", {
          defaultValue: "New dataset"
        })}
        open={createDatasetOpen}
        onCancel={() => {
          closeCreateDataset()
          form.resetFields()
        }}
        onOk={handleSubmitCreate}
        confirmLoading={createDatasetMutation.isPending}
        okText={t("common:create", { defaultValue: "Create" }) as string}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t("settings:evaluations.datasetNameLabel", {
              defaultValue: "Name"
            })}
            name="name"
            rules={[{ required: true }]}
          >
            <Input
              placeholder={t("settings:evaluations.datasetNamePlaceholder", {
                defaultValue: "my_dataset"
              })}
            />
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.datasetDescriptionLabel", {
              defaultValue: "Description"
            })}
            name="description"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.sampleInputLabel", {
              defaultValue: "Sample input"
            })}
            name="sampleInput"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.sampleExpectedLabel", {
              defaultValue: "Expected output (optional)"
            })}
            name="sampleExpected"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.samplesJsonLabel", {
              defaultValue: "Samples JSON (optional, overrides fields)"
            })}
            name="samplesJson"
          >
            <JsonEditor
              rows={4}
              value=""
              onChange={() => {}}
              placeholder='[{"input": {...}, "expected": {...}}]'
            />
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.datasetMetadataLabel", {
              defaultValue: "Metadata (JSON, optional)"
            })}
            name="metadataJson"
          >
            <Input.TextArea rows={3} className="font-mono text-sm" />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Dataset Modal */}
      <Modal
        title={t("settings:evaluations.datasetDetailTitle", {
          defaultValue: "Dataset details"
        })}
        open={!!viewingDataset}
        onCancel={closeViewer}
        footer={
          <Button onClick={closeViewer}>
            {t("common:close", { defaultValue: "Close" })}
          </Button>
        }
        width={700}
      >
        {viewingDataset && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div>
                <Text type="secondary" className="text-xs">
                  {t("common:name", { defaultValue: "Name" })}:{" "}
                </Text>
                <Text className="text-sm font-medium">{viewingDataset.name}</Text>
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  {t("common:id", { defaultValue: "ID" })}:{" "}
                </Text>
                <code className="text-xs">{viewingDataset.id}</code>
                <CopyButton text={viewingDataset.id} />
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  {t("settings:evaluations.datasetSampleCountLabel", {
                    defaultValue: "Samples"
                  })}
                  :{" "}
                </Text>
                <Text className="text-sm">{viewingDataset.sample_count}</Text>
              </div>
            </div>

            {viewingDataset.description && (
              <div>
                <Text type="secondary" className="text-xs">
                  {t("settings:evaluations.descriptionLabel", {
                    defaultValue: "Description"
                  })}
                  :{" "}
                </Text>
                <Text className="text-sm">{viewingDataset.description}</Text>
              </div>
            )}

            <div>
              <Text type="secondary" className="text-xs block mb-1">
                {t("settings:evaluations.samplesPreviewLabel", {
                  defaultValue: "Samples preview"
                })}
              </Text>
              {datasetSamples.length === 0 ? (
                <Empty
                  description={t("settings:evaluations.noSamplesPreview", {
                    defaultValue: "No samples to preview"
                  })}
                />
              ) : (
                <div className="space-y-2">
                  {datasetSamples.map((sample, idx) => (
                    <pre
                      key={idx}
                      className="max-h-32 overflow-auto rounded bg-surface2 p-2 text-[11px] text-text"
                    >
                      {JSON.stringify(sample, null, 2)}
                    </pre>
                  ))}
                </div>
              )}
            </div>

            {datasetSamplesTotal !== null &&
              datasetSamplesTotal > datasetSamplesPageSize && (
                <Pagination
                  current={datasetSamplesPage}
                  pageSize={datasetSamplesPageSize}
                  total={datasetSamplesTotal}
                  size="small"
                  onChange={(page) =>
                    loadDatasetMutation.mutate({
                      datasetId: viewingDataset.id,
                      page
                    })
                  }
                />
              )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DatasetsTab
