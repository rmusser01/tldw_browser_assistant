import React from "react"
import {
  Typography,
  Card,
  Button,
  List,
  Tag,
  Space,
  Alert,
  Select,
  InputNumber,
  Switch,
  Segmented
} from "antd"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { PageShell } from "@/components/Common/PageShell"
import { buildLlamacppServerArgs } from "@/utils/build-llamacpp-server-args"
import { parseGgufModelMetadata } from "@/utils/gguf-model-metadata"
import { StatusBanner } from "./StatusBanner"
import { CollapsibleSection } from "./CollapsibleSection"
import { ServerArgsEditor } from "./ServerArgsEditor"

const { Title, Text } = Typography

type LlamacppStatus = {
  backend?: string
  model?: string
  state?: string
  status?: string
  port?: number
  [key: string]: any
}

const CONTEXT_PRESETS = [
  { label: "2K", value: 2048 },
  { label: "4K", value: 4096 },
  { label: "8K", value: 8192 },
  { label: "16K", value: 16384 },
  { label: "32K", value: 32768 }
]

export const LlamacppAdminPage: React.FC = () => {
  const { t } = useTranslation(["option", "settings", "common"])

  // Status state
  const [status, setStatus] = React.useState<LlamacppStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = React.useState(false)
  const [statusError, setStatusError] = React.useState<string | null>(null)

  // Models state
  const [models, setModels] = React.useState<string[]>([])
  const [loadingModels, setLoadingModels] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<string | undefined>()

  // Server args state
  const [contextSize, setContextSize] = React.useState<number>(4096)
  const [gpuLayers, setGpuLayers] = React.useState<number>(0)
  const [threads, setThreads] = React.useState<number | undefined>()
  const [batchSize, setBatchSize] = React.useState<number | undefined>()
  const [mlock, setMlock] = React.useState<boolean>(false)
  const [customArgs, setCustomArgs] = React.useState<Record<string, any>>({})

  // Action state
  const [actionLoading, setActionLoading] = React.useState(false)

  // Admin guard
  const [adminGuard, setAdminGuard] = React.useState<"forbidden" | "notFound" | null>(null)

  const markAdminGuardFromError = (err: any) => {
    const msg = String(err?.message || "")
    if (msg.includes("Request failed: 403")) {
      setAdminGuard("forbidden")
    } else if (msg.includes("Request failed: 404")) {
      setAdminGuard("notFound")
    }
  }

  const loadStatus = React.useCallback(async () => {
    try {
      setLoadingStatus(true)
      setStatusError(null)
      const data = await tldwClient.getLlamacppStatus()
      setStatus(data as LlamacppStatus)
    } catch (e: any) {
      setStatusError(e?.message || "Failed to load Llama.cpp status.")
      markAdminGuardFromError(e)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  const loadModels = React.useCallback(async () => {
    try {
      setLoadingModels(true)
      const res = await tldwClient.listLlamacppModels()
      const list = Array.isArray(res?.available_models)
        ? (res.available_models as string[])
        : []
      setModels(list)
      if (list.length > 0) {
        setSelectedModel((current) => current ?? list[0])
      }
    } catch (e: any) {
      markAdminGuardFromError(e)
    } finally {
      setLoadingModels(false)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const init = async () => {
      await Promise.all([loadStatus(), loadModels()])
      if (cancelled) return
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [loadModels, loadStatus])

  const handleStart = async () => {
    if (!selectedModel) return
    try {
      setActionLoading(true)
      const serverArgs = buildLlamacppServerArgs({
        contextSize,
        gpuLayers,
        threads,
        batchSize,
        mlock,
        customArgs
      })
      await tldwClient.startLlamacppServer(selectedModel, serverArgs)
      await loadStatus()
    } catch (e: any) {
      setStatusError(e?.message || "Failed to start Llama.cpp server.")
      markAdminGuardFromError(e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStartWithDefaults = async () => {
    if (!selectedModel) return
    try {
      setActionLoading(true)
      await tldwClient.startLlamacppServer(selectedModel)
      await loadStatus()
    } catch (e: any) {
      setStatusError(e?.message || "Failed to start Llama.cpp server.")
      markAdminGuardFromError(e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStop = async () => {
    try {
      setActionLoading(true)
      await tldwClient.stopLlamacppServer()
      await loadStatus()
    } catch (e: any) {
      setStatusError(e?.message || "Failed to stop Llama.cpp server.")
      markAdminGuardFromError(e)
    } finally {
      setActionLoading(false)
    }
  }

  const effectiveState =
    status?.state || status?.status || status?.backend || "unknown"
  const isRunning = effectiveState === "running" || effectiveState === "online"
  const modelsWithMeta = React.useMemo(
    () => models.map((model) => ({ model, meta: parseGgufModelMetadata(model) })),
    [models]
  )

  return (
    <PageShell>
      <Space direction="vertical" size="large" className="w-full py-6">
        {/* Admin Guard Alert */}
        {adminGuard && (
          <Alert
            type="warning"
            showIcon
            message={
              adminGuard === "forbidden"
                ? t("settings:admin.adminGuardForbiddenTitle", "Admin access required")
                : t("settings:admin.adminGuardNotFoundTitle", "Admin APIs not available")
            }
            description={
              <span>
                {adminGuard === "forbidden"
                  ? t(
                      "settings:admin.adminGuardForbiddenBody",
                      "Sign in as an admin user on your tldw server to access these controls."
                    )
                  : t(
                      "settings:admin.adminGuardNotFoundBody",
                      "This tldw server does not expose the admin endpoints."
                    )}{" "}
                <a
                  href="https://github.com/rmusser01/tldw_server#documentation--resources"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("settings:admin.adminGuardLearnMore", "Learn more")}
                </a>
              </span>
            }
          />
        )}

        {/* Page Header */}
        <div>
          <Title level={2}>
            {t("option:header.adminLlamacpp", "Llama.cpp Admin")}
          </Title>
          <Text type="secondary">
            {t(
              "settings:admin.llamacppIntro",
              "Manage the Llama.cpp inference server: start/stop with custom configuration and inspect available models."
            )}
          </Text>
        </div>

        {!adminGuard && (
          <>
            {/* Status Banner */}
            <StatusBanner
              state={effectiveState}
              loading={loadingStatus}
              error={statusError}
              items={[
                { label: t("settings:admin.llamacppActiveModel", "Model"), value: status?.model, code: true },
                { label: t("settings:admin.llamacppPort", "Port"), value: status?.port }
              ]}
              onRefresh={loadStatus}
              quickAction={
                isRunning
                  ? {
                      label: t("settings:admin.llamacppStop", "Stop"),
                      onClick: handleStop,
                      loading: actionLoading,
                      danger: true
                    }
                  : undefined
              }
            />

            {/* Model Load Card */}
            <Card
              title={t("settings:admin.llamacppLoadTitle", "Load Model")}
              loading={loadingModels}
            >
              <Space direction="vertical" size="middle" className="w-full">
                {/* Model Selector */}
                <div>
                  <Text strong className="mb-2 block">
                    {t("settings:admin.llamacppSelectModel", "Select model")}
                  </Text>
                  <Select
                    value={selectedModel}
                    onChange={setSelectedModel}
                    options={models.map((m) => ({ label: m, value: m }))}
                    placeholder={t("settings:admin.llamacppSelectModelPlaceholder", "Choose a GGUF model...")}
                    className="w-full"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </div>

                {/* Basic Settings - Always Visible */}
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <Text strong className="mb-3 block">
                    {t("settings:admin.llamacppBasicSettings", "Basic Settings")}
                  </Text>
                  <Space direction="vertical" size="small" className="w-full">
                    {/* Context Size */}
                    <div className="flex flex-wrap items-center gap-3">
                      <Text className="w-32">
                        {t("settings:admin.llamacppContextSize", "Context size")}:
                      </Text>
                      <Segmented
                        size="small"
                        options={CONTEXT_PRESETS}
                        value={contextSize}
                        onChange={(val) => setContextSize(val as number)}
                      />
                      <InputNumber
                        size="small"
                        value={contextSize}
                        onChange={(val) => val && setContextSize(val)}
                        min={128}
                        max={131072}
                        step={256}
                        style={{ width: 100 }}
                      />
                    </div>

                    {/* GPU Layers */}
                    <div className="flex flex-wrap items-center gap-3">
                      <Text className="w-32">
                        {t("settings:admin.llamacppGpuLayers", "GPU layers")}:
                      </Text>
                      <InputNumber
                        size="small"
                        value={gpuLayers}
                        onChange={(val) => setGpuLayers(val ?? 0)}
                        min={-1}
                        max={200}
                        style={{ width: 100 }}
                      />
                      <Text type="secondary" className="text-xs">
                        {t("settings:admin.llamacppGpuLayersHint", "0 = CPU only, -1 = all layers")}
                      </Text>
                    </div>
                  </Space>
                </div>

                {/* Performance Settings - Collapsible */}
                <CollapsibleSection
                  title={t("settings:admin.llamacppPerformanceSettings", "Performance Settings")}
                  description={t("settings:admin.llamacppPerformanceSettingsDesc", "Thread count, batch size, memory options")}
                >
                  <Space direction="vertical" size="small" className="w-full">
                    {/* Threads */}
                    <div className="flex items-center gap-3">
                      <Text className="w-32">
                        {t("settings:admin.llamacppThreads", "Threads")}:
                      </Text>
                      <InputNumber
                        size="small"
                        value={threads}
                        onChange={(val) => setThreads(val ?? undefined)}
                        min={1}
                        max={128}
                        placeholder="auto"
                        style={{ width: 100 }}
                      />
                      <Text type="secondary" className="text-xs">
                        {t("settings:admin.llamacppThreadsHint", "Leave empty for auto-detect")}
                      </Text>
                    </div>

                    {/* Batch Size */}
                    <div className="flex items-center gap-3">
                      <Text className="w-32">
                        {t("settings:admin.llamacppBatchSize", "Batch size")}:
                      </Text>
                      <InputNumber
                        size="small"
                        value={batchSize}
                        onChange={(val) => setBatchSize(val ?? undefined)}
                        min={1}
                        max={8192}
                        placeholder="512"
                        style={{ width: 100 }}
                      />
                    </div>

                    {/* Memory Lock */}
                    <div className="flex items-center gap-3">
                      <Text className="w-32">
                        {t("settings:admin.llamacppMlock", "Memory lock")}:
                      </Text>
                      <Switch
                        size="small"
                        checked={mlock}
                        onChange={setMlock}
                      />
                      <Text type="secondary" className="text-xs">
                        {t("settings:admin.llamacppMlockHint", "Lock model in RAM (requires permissions)")}
                      </Text>
                    </div>
                  </Space>
                </CollapsibleSection>

                {/* Custom Arguments - Collapsible */}
                <CollapsibleSection
                  title={t("settings:admin.llamacppCustomArgs", "Custom Arguments")}
                  description={t("settings:admin.llamacppCustomArgsDesc", "Pass additional server arguments")}
                >
                  <ServerArgsEditor
                    value={customArgs}
                    onChange={setCustomArgs}
                    placeholder={t("settings:admin.llamacppCustomArgsPlaceholder", "No custom arguments. Click 'Add argument' to add one.")}
                  />
                </CollapsibleSection>

                {/* Action Buttons */}
                <Space className="mt-4">
                  <Button
                    type="primary"
                    onClick={handleStart}
                    loading={actionLoading}
                    disabled={!selectedModel || isRunning}
                  >
                    {t("settings:admin.llamacppStart", "Start Server")}
                  </Button>
                  <Button
                    onClick={handleStartWithDefaults}
                    loading={actionLoading}
                    disabled={!selectedModel || isRunning}
                  >
                    {t("settings:admin.llamacppStartDefaults", "Start with Defaults")}
                  </Button>
                </Space>

                {isRunning && (
                  <Alert
                    type="info"
                    message={t("settings:admin.llamacppAlreadyRunning", "Server is already running. Stop it first to start with new settings.")}
                    showIcon
                  />
                )}
              </Space>
            </Card>

            {/* Available Models - Collapsible */}
            <CollapsibleSection
              title={t("settings:admin.llamacppModelsTitle", "Available Models")}
              description={t("settings:admin.llamacppModelsDesc", `${models.length} GGUF model(s) detected`)}
            >
              {modelsWithMeta.length > 0 ? (
                <List
                  size="small"
                  bordered
                  dataSource={modelsWithMeta}
                  renderItem={({ model, meta }) => (
                    <List.Item
                      actions={[
                        <Button
                          key="select"
                          size="small"
                          type="link"
                          onClick={() => setSelectedModel(model)}
                          disabled={selectedModel === model}
                        >
                          {selectedModel === model
                            ? t("common:selected", "Selected")
                            : t("common:select", "Select")}
                        </Button>
                      ]}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Text code>{model}</Text>
                        {meta.parameterCount && (
                          <Tag color="geekblue">{meta.parameterCount}</Tag>
                        )}
                        {meta.quantization && (
                          <Tag color="purple">{meta.quantization}</Tag>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Text type="secondary">
                  {t(
                    "settings:admin.llamacppModelsEmpty",
                    "No local GGUF models detected. Configure your Llama.cpp models directory on the server."
                  )}
                </Text>
              )}
            </CollapsibleSection>
          </>
        )}
      </Space>
    </PageShell>
  )
}

export default LlamacppAdminPage
