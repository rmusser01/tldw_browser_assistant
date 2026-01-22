import React from "react"
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  Select,
  Segmented,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"

import { useServerOnline } from "@/hooks/useServerOnline"
import {
  appendManagedBlocklist,
  deleteManagedBlocklistItem,
  deleteUserOverride,
  getBlocklist,
  getEffectivePolicy,
  getManagedBlocklist,
  getModerationSettings,
  getUserOverride,
  lintBlocklist,
  listUserOverrides,
  reloadModeration,
  setUserOverride,
  testModeration,
  updateBlocklist,
  updateModerationSettings,
  type BlocklistLintItem,
  type BlocklistLintResponse,
  type BlocklistManagedItem,
  type ModerationSettingsResponse,
  type ModerationTestResponse,
  type ModerationUserOverride
} from "@/services/moderation"

const { Title, Text } = Typography
const { TextArea } = Input

const HERO_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, #fdf7ec 0%, #f6efdf 100%)",
  border: "1px solid #e8dcc8",
  boxShadow: "0 24px 70px rgba(110, 86, 48, 0.18)"
}

const HERO_GRID_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(73, 55, 36, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(73, 55, 36, 0.06) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
  opacity: 0.35
}

const normalizeCategories = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

const formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return "{}"
  }
}

const buildOverridePayload = (draft: ModerationUserOverride): ModerationUserOverride => {
  const payload: ModerationUserOverride = {}
  if (draft.enabled !== undefined) payload.enabled = draft.enabled
  if (draft.input_enabled !== undefined) payload.input_enabled = draft.input_enabled
  if (draft.output_enabled !== undefined) payload.output_enabled = draft.output_enabled
  if (draft.input_action) payload.input_action = draft.input_action
  if (draft.output_action) payload.output_action = draft.output_action
  if (draft.redact_replacement) payload.redact_replacement = draft.redact_replacement
  if (draft.categories_enabled !== undefined) {
    payload.categories_enabled = normalizeCategories(draft.categories_enabled)
  }
  return payload
}

const presetProfiles: Record<
  string,
  { label: string; description: string; payload: ModerationUserOverride }
> = {
  strict: {
    label: "Strict",
    description: "Block risky inputs and redact sensitive outputs.",
    payload: {
      enabled: true,
      input_enabled: true,
      output_enabled: true,
      input_action: "block",
      output_action: "redact"
    }
  },
  balanced: {
    label: "Balanced",
    description: "Warn on inputs, redact outputs.",
    payload: {
      enabled: true,
      input_enabled: true,
      output_enabled: true,
      input_action: "warn",
      output_action: "redact"
    }
  },
  monitor: {
    label: "Monitor",
    description: "Warn only, never block.",
    payload: {
      enabled: true,
      input_enabled: true,
      output_enabled: true,
      input_action: "warn",
      output_action: "warn"
    }
  }
}

export const ModerationPlayground: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const online = useServerOnline()
  const [messageApi, contextHolder] = message.useMessage()

  const [scope, setScope] = React.useState<"server" | "user">("server")
  const [userIdDraft, setUserIdDraft] = React.useState("")
  const [activeUserId, setActiveUserId] = React.useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  const [settingsDraft, setSettingsDraft] = React.useState({
    piiEnabled: false,
    categoriesEnabled: [] as string[],
    persist: false
  })

  const [overrideDraft, setOverrideDraft] = React.useState<ModerationUserOverride>({})
  const [overrideLoaded, setOverrideLoaded] = React.useState(false)
  const [overrideLoading, setOverrideLoading] = React.useState(false)

  const [blocklistText, setBlocklistText] = React.useState("")
  const [blocklistLint, setBlocklistLint] = React.useState<BlocklistLintResponse | null>(null)
  const [blocklistLoading, setBlocklistLoading] = React.useState(false)

  const [managedItems, setManagedItems] = React.useState<BlocklistManagedItem[]>([])
  const [managedVersion, setManagedVersion] = React.useState("")
  const [managedLine, setManagedLine] = React.useState("")
  const [managedLint, setManagedLint] = React.useState<BlocklistLintResponse | null>(null)
  const [managedLoading, setManagedLoading] = React.useState(false)

  const [testPhase, setTestPhase] = React.useState<"input" | "output">("input")
  const [testText, setTestText] = React.useState("")
  const [testUserId, setTestUserId] = React.useState("")
  const [testResult, setTestResult] = React.useState<ModerationTestResponse | null>(null)

  const settingsQuery = useQuery<ModerationSettingsResponse>({
    queryKey: ["moderation-settings"],
    queryFn: getModerationSettings,
    enabled: online
  })

  const policyQuery = useQuery<Record<string, any>>({
    queryKey: ["moderation-policy", activeUserId ?? "server"],
    queryFn: () => getEffectivePolicy(activeUserId || undefined),
    enabled: online
  })

  const overridesQuery = useQuery({
    queryKey: ["moderation-overrides"],
    queryFn: listUserOverrides,
    enabled: online && showAdvanced
  })

  React.useEffect(() => {
    if (!settingsQuery.data) return
    const data = settingsQuery.data
    const categories = data.categories_enabled ?? data.effective?.categories_enabled ?? []
    const piiEnabled =
      data.pii_enabled ??
      (typeof data.effective?.pii_enabled === "boolean"
        ? data.effective?.pii_enabled
        : false)
    setSettingsDraft((prev) => ({
      ...prev,
      piiEnabled,
      categoriesEnabled: categories || []
    }))
  }, [settingsQuery.data])

  React.useEffect(() => {
    if (scope === "server") {
      setActiveUserId(null)
      setOverrideDraft({})
      setOverrideLoaded(false)
      return
    }
    if (!userIdDraft.trim()) {
      setActiveUserId(null)
    }
  }, [scope, userIdDraft])

  React.useEffect(() => {
    if (!activeUserId) {
      setOverrideDraft({})
      setOverrideLoaded(false)
      return
    }
    let cancelled = false
    const loadOverride = async () => {
      setOverrideLoading(true)
      try {
        const data = await getUserOverride(activeUserId)
        if (cancelled) return
        const normalizedCategories =
          typeof data.categories_enabled === "undefined"
            ? undefined
            : normalizeCategories(data.categories_enabled)
        const normalized: ModerationUserOverride = {
          enabled: data.enabled,
          input_enabled: data.input_enabled,
          output_enabled: data.output_enabled,
          input_action: data.input_action,
          output_action: data.output_action,
          redact_replacement: data.redact_replacement,
          categories_enabled: normalizedCategories
        }
        setOverrideDraft(normalized)
        setOverrideLoaded(true)
      } catch (err: any) {
        if (cancelled) return
        if (err?.status === 404) {
          setOverrideDraft({})
          setOverrideLoaded(false)
        } else {
          messageApi.error("Failed to load user override")
        }
      } finally {
        if (!cancelled) setOverrideLoading(false)
      }
    }
    void loadOverride()
    return () => {
      cancelled = true
    }
  }, [activeUserId, messageApi])

  React.useEffect(() => {
    if (activeUserId && !testUserId) {
      setTestUserId(activeUserId)
    }
  }, [activeUserId, testUserId])

  const handleLoadUser = () => {
    if (!userIdDraft.trim()) {
      messageApi.warning("Enter a user id to load overrides")
      return
    }
    setActiveUserId(userIdDraft.trim())
  }

  const handleSaveSettings = async () => {
    try {
      const payload = {
        pii_enabled: settingsDraft.piiEnabled,
        categories_enabled: settingsDraft.categoriesEnabled,
        persist: settingsDraft.persist
      }
      await updateModerationSettings(payload)
      messageApi.success("Moderation settings updated")
      await settingsQuery.refetch()
      await policyQuery.refetch()
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to update settings")
    }
  }

  const handleApplyPreset = async (key: string) => {
    if (!activeUserId) {
      messageApi.warning("Select a user to apply presets")
      return
    }
    try {
      const preset = presetProfiles[key]
      const payload = buildOverridePayload(preset.payload)
      await setUserOverride(activeUserId, payload)
      messageApi.success(`Applied ${preset.label} profile`)
      setOverrideDraft((prev) => ({ ...prev, ...preset.payload }))
      await policyQuery.refetch()
      if (showAdvanced) {
        await overridesQuery.refetch()
      }
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to apply preset")
    }
  }

  const handleSaveOverride = async () => {
    if (!activeUserId) {
      messageApi.warning("Select a user to save overrides")
      return
    }
    try {
      const payload = buildOverridePayload(overrideDraft)
      await setUserOverride(activeUserId, payload)
      messageApi.success("User override saved")
      setOverrideLoaded(true)
      await policyQuery.refetch()
      if (showAdvanced) {
        await overridesQuery.refetch()
      }
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to save override")
    }
  }

  const handleDeleteOverride = async (userId?: string | null) => {
    const targetId = userId || activeUserId
    if (!targetId) return
    try {
      await deleteUserOverride(targetId)
      messageApi.success("Override removed")
      if (targetId === activeUserId) {
        setOverrideDraft({})
        setOverrideLoaded(false)
        await policyQuery.refetch()
      }
      if (showAdvanced) {
        await overridesQuery.refetch()
      }
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to delete override")
    }
  }

  const handleReload = async () => {
    try {
      await reloadModeration()
      messageApi.success("Reloaded moderation config")
      await settingsQuery.refetch()
      await policyQuery.refetch()
      if (showAdvanced) {
        await overridesQuery.refetch()
      }
    } catch (err: any) {
      messageApi.error(err?.message || "Reload failed")
    }
  }

  const handleLoadBlocklist = async () => {
    setBlocklistLoading(true)
    try {
      const lines = await getBlocklist()
      setBlocklistText((lines || []).join("\n"))
      setBlocklistLint(null)
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to load blocklist")
    } finally {
      setBlocklistLoading(false)
    }
  }

  const handleSaveBlocklist = async () => {
    setBlocklistLoading(true)
    try {
      const lines = blocklistText
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
      await updateBlocklist(lines)
      messageApi.success("Blocklist saved")
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to save blocklist")
    } finally {
      setBlocklistLoading(false)
    }
  }

  const handleLintBlocklist = async () => {
    setBlocklistLoading(true)
    try {
      const lines = blocklistText.split(/\r?\n/)
      const lint = await lintBlocklist({ lines })
      setBlocklistLint(lint)
    } catch (err: any) {
      messageApi.error(err?.message || "Lint failed")
    } finally {
      setBlocklistLoading(false)
    }
  }

  const handleLoadManaged = async () => {
    setManagedLoading(true)
    try {
      const { data, etag } = await getManagedBlocklist()
      setManagedItems(data.items || [])
      setManagedVersion(data.version || etag || "")
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to load managed blocklist")
    } finally {
      setManagedLoading(false)
    }
  }

  const handleAppendManaged = async () => {
    if (!managedVersion) {
      messageApi.warning("Load the managed blocklist first")
      return
    }
    const line = managedLine.trim()
    if (!line) {
      messageApi.warning("Enter a line to append")
      return
    }
    setManagedLoading(true)
    try {
      await appendManagedBlocklist(managedVersion, line)
      setManagedLine("")
      await handleLoadManaged()
      messageApi.success("Line appended")
    } catch (err: any) {
      messageApi.error(err?.message || "Append failed")
    } finally {
      setManagedLoading(false)
    }
  }

  const handleDeleteManaged = async (itemId: number) => {
    if (!managedVersion) return
    setManagedLoading(true)
    try {
      await deleteManagedBlocklistItem(managedVersion, itemId)
      await handleLoadManaged()
      messageApi.success("Line deleted")
    } catch (err: any) {
      messageApi.error(err?.message || "Delete failed")
    } finally {
      setManagedLoading(false)
    }
  }

  const handleLintManagedLine = async () => {
    if (!managedLine.trim()) {
      messageApi.warning("Enter a line to lint")
      return
    }
    setManagedLoading(true)
    try {
      const lint = await lintBlocklist({ line: managedLine.trim() })
      setManagedLint(lint)
    } catch (err: any) {
      messageApi.error(err?.message || "Lint failed")
    } finally {
      setManagedLoading(false)
    }
  }

  const handleRunTest = async () => {
    if (!testText.trim()) {
      messageApi.warning("Enter sample text to test")
      return
    }
    try {
      const payload = {
        user_id: testUserId ? testUserId.trim() : undefined,
        phase: testPhase,
        text: testText
      }
      const res = await testModeration(payload)
      setTestResult(res)
    } catch (err: any) {
      messageApi.error(err?.message || "Moderation test failed")
    }
  }

  const lintColumns: ColumnsType<BlocklistLintItem> = [
    { title: "Line", dataIndex: "line", key: "line", ellipsis: true },
    {
      title: "OK",
      dataIndex: "ok",
      key: "ok",
      width: 70,
      render: (ok: boolean) => (ok ? <Tag color="green">OK</Tag> : <Tag color="red">Fail</Tag>)
    },
    { title: "Action", dataIndex: "action", key: "action", width: 110 },
    { title: "Categories", dataIndex: "categories", key: "categories", width: 160,
      render: (cats: string[]) => (cats && cats.length ? cats.join(", ") : "-") },
    { title: "Error", dataIndex: "error", key: "error", ellipsis: true }
  ]

  const overrideColumns: ColumnsType<{ user_id: string; override: Record<string, any> }> = [
    { title: "User", dataIndex: "user_id", key: "user_id", width: 160 },
    {
      title: "Override",
      dataIndex: "override",
      key: "override",
      render: (override: Record<string, any>) => (
        <Text code className="whitespace-pre-wrap">
          {formatJson(override)}
        </Text>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_value, record) => (
        <Space>
          <Button size="small" onClick={() => {
            setScope("user")
            setUserIdDraft(record.user_id)
            setActiveUserId(record.user_id)
          }}>
            Load
          </Button>
          <Button size="small" danger onClick={() => handleDeleteOverride(record.user_id)}>
            Delete
          </Button>
        </Space>
      )
    }
  ]

  const policySnapshot = policyQuery.data || {}
  const policyCategories = normalizeCategories(policySnapshot.categories_enabled)
  const blocklistCount = policySnapshot.blocklist_count ?? 0

  return (
    <div className="space-y-6">
      {contextHolder}
      <div
        className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 text-text"
        style={HERO_STYLE}
      >
        <div className="absolute inset-0" style={HERO_GRID_STYLE} />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Title level={2} className="!mb-1 font-display">
                {t("option:moderationPlayground.title", "Moderation Playground")}
              </Title>
              <Text className="text-text-muted">
                {t(
                  "option:moderationPlayground.subtitle",
                  "Family safety controls and server guardrails in one place."
                )}
              </Text>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag color="gold">Admin only</Tag>
                <Tag color={online ? "green" : "red"}>
                  {online ? "Server online" : "Server offline"}
                </Tag>
                <Tag color="blue">Moderation API</Tag>
              </div>
            </div>
            <Space align="center" wrap>
              <Text className="text-text-muted">Advanced</Text>
              <Switch checked={showAdvanced} onChange={setShowAdvanced} />
              <Button onClick={handleReload}>Reload config</Button>
            </Space>
          </div>

          <Divider className="!my-4" />

          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={scope}
              onChange={(value) => setScope(value as "server" | "user")}
              options={[
                { label: "Server", value: "server" },
                { label: "User", value: "user" }
              ]}
            />
            <Input
              placeholder="User ID"
              value={userIdDraft}
              onChange={(event) => setUserIdDraft(event.target.value)}
              onPressEnter={handleLoadUser}
              disabled={scope !== "user"}
              style={{ width: 220 }}
            />
            <Button disabled={scope !== "user"} onClick={handleLoadUser}>
              Load user
            </Button>
            {activeUserId && (
              <Tag color="geekblue">Active user: {activeUserId}</Tag>
            )}
          </div>
        </div>
      </div>

      {!online && (
        <Alert
          type="warning"
          message="Connect to your tldw server to use moderation controls."
          showIcon
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Runtime Settings"
          className="shadow-sm"
          extra={<Text className="text-text-muted">Server-wide</Text>}
        >
          <Space direction="vertical" size="middle" className="w-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Text strong>PII Rule Pack</Text>
                <div className="text-text-muted text-xs">
                  Toggle built-in PII redaction rules.
                </div>
              </div>
              <Switch
                checked={settingsDraft.piiEnabled}
                onChange={(value) =>
                  setSettingsDraft((prev) => ({ ...prev, piiEnabled: value }))
                }
              />
            </div>

            <div>
              <Text strong>Categories Enabled</Text>
              <div className="text-text-muted text-xs">
                If set, only rules with matching categories will apply.
              </div>
              <Select
                mode="tags"
                style={{ width: "100%" }}
                placeholder="Add categories (e.g., pii, confidential)"
                value={settingsDraft.categoriesEnabled}
                onChange={(value) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    categoriesEnabled: value as string[]
                  }))
                }
              />
            </div>

            <Checkbox
              checked={settingsDraft.persist}
              onChange={(event) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  persist: event.target.checked
                }))
              }
            >
              Persist runtime overrides to file
            </Checkbox>

            <Button
              type="primary"
              onClick={handleSaveSettings}
              loading={settingsQuery.isFetching}
            >
              Save runtime settings
            </Button>

            {settingsQuery.data && (
              <Alert
                type="info"
                showIcon
                message={
                  <span>
                    Effective categories: {normalizeCategories(settingsQuery.data.effective?.categories_enabled).join(", ") || "all"}
                  </span>
                }
              />
            )}
          </Space>
        </Card>

        <Card
          title="Family Safety Profile"
          className="shadow-sm"
          extra={<Text className="text-text-muted">User overrides</Text>}
        >
          {scope !== "user" ? (
            <Alert
              type="info"
              showIcon
              message="Switch to User scope to configure family rules."
            />
          ) : (
            <Space direction="vertical" size="middle" className="w-full">
              <div>
                <Text strong>Quick presets</Text>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(presetProfiles).map(([key, preset]) => (
                    <Button
                      key={key}
                      onClick={() => handleApplyPreset(key)}
                      disabled={overrideLoading || !activeUserId}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Divider className="!my-2" />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between">
                  <Text>Enabled</Text>
                  <Switch
                    checked={Boolean(overrideDraft.enabled)}
                    onChange={(value) =>
                      setOverrideDraft((prev) => ({ ...prev, enabled: value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Text>Input filter</Text>
                  <Switch
                    checked={Boolean(overrideDraft.input_enabled)}
                    onChange={(value) =>
                      setOverrideDraft((prev) => ({ ...prev, input_enabled: value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Text>Output filter</Text>
                  <Switch
                    checked={Boolean(overrideDraft.output_enabled)}
                    onChange={(value) =>
                      setOverrideDraft((prev) => ({ ...prev, output_enabled: value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Text>Input action</Text>
                  <Select
                    value={overrideDraft.input_action}
                    onChange={(value) =>
                      setOverrideDraft((prev) => ({ ...prev, input_action: value }))
                    }
                    options={[
                      { value: "block", label: "Block" },
                      { value: "redact", label: "Redact" },
                      { value: "warn", label: "Warn" }
                    ]}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <Text>Output action</Text>
                  <Select
                    value={overrideDraft.output_action}
                    onChange={(value) =>
                      setOverrideDraft((prev) => ({ ...prev, output_action: value }))
                    }
                    options={[
                      { value: "block", label: "Block" },
                      { value: "redact", label: "Redact" },
                      { value: "warn", label: "Warn" }
                    ]}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div>
                <Text>Redaction replacement</Text>
                <Input
                  placeholder="[REDACTED]"
                  value={overrideDraft.redact_replacement}
                  onChange={(event) =>
                    setOverrideDraft((prev) => ({
                      ...prev,
                      redact_replacement: event.target.value
                    }))
                  }
                />
              </div>

              <div>
                <Text>Categories enabled</Text>
                <Select
                  mode="tags"
                  style={{ width: "100%" }}
                  placeholder="Leave empty to allow all"
                  value={overrideDraft.categories_enabled as string[] | undefined}
                  onChange={(value) =>
                    setOverrideDraft((prev) => ({
                      ...prev,
                      categories_enabled: value as string[]
                    }))
                  }
                />
              </div>

              <Space>
                <Button type="primary" onClick={handleSaveOverride} disabled={!activeUserId}>
                  Save override
                </Button>
                <Button danger onClick={handleDeleteOverride} disabled={!overrideLoaded}>
                  Delete override
                </Button>
              </Space>
            </Space>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Moderation Tester" className="shadow-sm">
          <Space direction="vertical" size="middle" className="w-full">
            <div className="flex flex-wrap gap-2">
              <Segmented
                value={testPhase}
                onChange={(value) => setTestPhase(value as "input" | "output")}
                options={[
                  { label: "Input", value: "input" },
                  { label: "Output", value: "output" }
                ]}
              />
              <Input
                placeholder="User ID (optional)"
                value={testUserId}
                onChange={(event) => setTestUserId(event.target.value)}
                style={{ width: 220 }}
              />
            </div>
            <TextArea
              rows={5}
              placeholder="Enter text to test against moderation policy"
              value={testText}
              onChange={(event) => setTestText(event.target.value)}
            />
            <Button onClick={handleRunTest}>Run test</Button>
            {testResult && (
              <Alert
                type={testResult.flagged ? "warning" : "success"}
                showIcon
                message={
                  <div>
                    <div>
                      Result: <strong>{testResult.action}</strong>
                      {testResult.category ? ` (category: ${testResult.category})` : ""}
                    </div>
                    {testResult.sample && (
                      <div className="text-xs text-text-muted">Sample: {testResult.sample}</div>
                    )}
                    {testResult.redacted_text && (
                      <div className="text-xs text-text-muted">Redacted: {testResult.redacted_text}</div>
                    )}
                  </div>
                }
              />
            )}
          </Space>
        </Card>

        <Card title="Effective Policy Snapshot" className="shadow-sm">
          <Space direction="vertical" size="middle" className="w-full">
            <div className="flex flex-wrap gap-2">
              <Tag color={policySnapshot.enabled ? "green" : "red"}>
                {policySnapshot.enabled ? "Enabled" : "Disabled"}
              </Tag>
              <Tag color={policySnapshot.input_enabled ? "blue" : "default"}>
                Input: {policySnapshot.input_action || "pass"}
              </Tag>
              <Tag color={policySnapshot.output_enabled ? "purple" : "default"}>
                Output: {policySnapshot.output_action || "pass"}
              </Tag>
              <Tag color="gold">Blocklist: {blocklistCount}</Tag>
            </div>
            <div>
              <Text className="text-text-muted">Categories</Text>
              <div className="mt-1 flex flex-wrap gap-2">
                {policyCategories.length ? (
                  policyCategories.map((cat: string) => (
                    <Tag key={cat}>{cat}</Tag>
                  ))
                ) : (
                  <Text className="text-text-muted">All categories</Text>
                )}
              </div>
            </div>
            {showAdvanced && (
              <TextArea rows={10} value={formatJson(policySnapshot)} readOnly />
            )}
          </Space>
        </Card>
      </div>

      {showAdvanced && (
        <>
          <Card title="Blocklist Studio" className="shadow-sm">
            <Tabs
              items={[
                {
                  key: "managed",
                  label: "Managed",
                  children: (
                    <Space direction="vertical" size="middle" className="w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={handleLoadManaged} loading={managedLoading}>
                          Load managed list
                        </Button>
                        <Tag color="default">ETag: {managedVersion || "-"}</Tag>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          placeholder="Add a blocklist line"
                          value={managedLine}
                          onChange={(event) => setManagedLine(event.target.value)}
                          style={{ minWidth: 280, flex: 1 }}
                        />
                        <Button onClick={handleLintManagedLine}>Lint line</Button>
                        <Button type="primary" onClick={handleAppendManaged}>
                          Append
                        </Button>
                      </div>
                      {managedLint && (
                        <Table
                          size="small"
                          rowKey={(record) => `${record.index}-${record.line}`}
                          columns={lintColumns}
                          dataSource={managedLint.items}
                          pagination={false}
                        />
                      )}
                      <Table
                        size="small"
                        rowKey={(record) => record.id}
                        columns={[
                          { title: "ID", dataIndex: "id", key: "id", width: 80 },
                          { title: "Line", dataIndex: "line", key: "line" },
                          {
                            title: "Actions",
                            key: "actions",
                            width: 120,
                            render: (_value, record) => (
                              <Button danger size="small" onClick={() => handleDeleteManaged(record.id)}>
                                Delete
                              </Button>
                            )
                          }
                        ]}
                        dataSource={managedItems}
                        pagination={{ pageSize: 8 }}
                      />
                    </Space>
                  )
                },
                {
                  key: "raw",
                  label: "Raw file",
                  children: (
                    <Space direction="vertical" size="middle" className="w-full">
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleLoadBlocklist} loading={blocklistLoading}>
                          Load blocklist
                        </Button>
                        <Button onClick={handleLintBlocklist} loading={blocklistLoading}>
                          Lint
                        </Button>
                        <Button type="primary" onClick={handleSaveBlocklist} loading={blocklistLoading}>
                          Save / Replace
                        </Button>
                      </div>
                      <TextArea
                        rows={10}
                        value={blocklistText}
                        onChange={(event) => setBlocklistText(event.target.value)}
                        placeholder="One rule per line"
                      />
                      {blocklistLint && (
                        <Table
                          size="small"
                          rowKey={(record) => `${record.index}-${record.line}`}
                          columns={lintColumns}
                          dataSource={blocklistLint.items}
                          pagination={{ pageSize: 6 }}
                        />
                      )}
                    </Space>
                  )
                }
              ]}
            />
          </Card>

          <Card title="Per-user Overrides" className="shadow-sm">
            {overridesQuery.isFetching && <Text className="text-text-muted">Loading overrides...</Text>}
            <Table
              size="small"
              rowKey={(record) => record.user_id}
              columns={overrideColumns}
              dataSource={Object.entries(overridesQuery.data?.overrides || {}).map(
                ([user_id, override]) => ({ user_id, override })
              )}
              pagination={{ pageSize: 6 }}
            />
          </Card>
        </>
      )}
    </div>
  )
}
