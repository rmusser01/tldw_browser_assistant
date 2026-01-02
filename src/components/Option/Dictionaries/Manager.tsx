import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, Collapse, Divider, Form, Input, Modal, Skeleton, Switch, Table, Tooltip, Tag, InputNumber, Select, Descriptions } from "antd"
import { useTranslation } from "react-i18next"
import React from "react"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { Pen, Trash2, Book } from "lucide-react"
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useServerOnline } from "@/hooks/useServerOnline"
import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useAntdNotification } from "@/hooks/useAntdNotification"

export const DictionariesManager: React.FC = () => {
  const { t } = useTranslation(["common", "option"])
  const isOnline = useServerOnline()
  const qc = useQueryClient()
  const notification = useAntdNotification()
  const [open, setOpen] = React.useState(false)
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openEntries, setOpenEntries] = React.useState<null | number>(null)
  const [editId, setEditId] = React.useState<number | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [entryForm] = Form.useForm()
  const [openImport, setOpenImport] = React.useState(false)
  const [activateOnImport, setActivateOnImport] = React.useState(false)
  const [statsFor, setStatsFor] = React.useState<any | null>(null)
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const confirmDanger = useConfirmDanger()

  const { data, status } = useQuery({
    queryKey: ['tldw:listDictionaries'],
    queryFn: async () => {
      await tldwClient.initialize()
      const res = await tldwClient.listDictionaries(false)
      return res?.dictionaries || []
    },
    enabled: isOnline
  })

  const { mutate: createDict, isPending: creating } = useMutation({
    mutationFn: (v: any) => tldwClient.createDictionary(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tldw:listDictionaries'] }); setOpen(false); createForm.resetFields() },
    onError: (e: any) => notification.error({ message: 'Error', description: e?.message || 'Failed to create dictionary' })
  })
  const { mutate: updateDict, isPending: updating } = useMutation({
    mutationFn: (v: any) => editId != null ? tldwClient.updateDictionary(editId, v) : Promise.resolve(null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tldw:listDictionaries'] }); setOpenEdit(false); editForm.resetFields(); setEditId(null) },
    onError: (e: any) => notification.error({ message: 'Error', description: e?.message || 'Failed to update dictionary' })
  })
  const { mutate: deleteDict } = useMutation({
    mutationFn: (id: number) => tldwClient.deleteDictionary(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tldw:listDictionaries'] })
  })
  const { mutate: importDict, isPending: importing } = useMutation({
    mutationFn: ({ data, activate }: any) => tldwClient.importDictionaryJSON(data, activate),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tldw:listDictionaries'] }); setOpenImport(false) },
    onError: (e: any) => notification.error({ message: 'Import failed', description: e?.message })
  })

  const dictionariesUnsupported =
    !capsLoading && capabilities && !capabilities.hasChatDictionaries

  const columns = [
    { title: '', key: 'icon', width: 40, render: () => <Book className="w-4 h-4" /> },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string) => <span className="line-clamp-1">{v}</span> },
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag> },
    { title: 'Entries', dataIndex: 'entry_count', key: 'entry_count' },
    { title: 'Actions', key: 'actions', render: (_: any, record: any) => (
      <div className="flex gap-3">
        <Tooltip title="Edit"><button className="text-text-muted" onClick={() => { setEditId(record.id); editForm.setFieldsValue(record); setOpenEdit(true) }}><Pen className="w-4 h-4" /></button></Tooltip>
        <Tooltip title="Manage Entries"><button className="text-text-muted" onClick={() => setOpenEntries(record.id)}>Entries</button></Tooltip>
        <Tooltip title="Export JSON"><button className="text-text-muted" onClick={async () => { try { const exp = await tldwClient.exportDictionaryJSON(record.id); const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${record.name || 'dictionary'}.json`; a.click(); URL.revokeObjectURL(url) } catch (e: any) { notification.error({ message: 'Export failed', description: e?.message }) } }}>Export JSON</button></Tooltip>
        <Tooltip title="Export Markdown"><button className="text-text-muted" onClick={async () => { try { const exp = await tldwClient.exportDictionaryMarkdown(record.id); const blob = new Blob([exp?.content || '' ], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${record.name || 'dictionary'}.md`; a.click(); URL.revokeObjectURL(url) } catch (e: any) { notification.error({ message: 'Export failed', description: e?.message }) } }}>Export MD</button></Tooltip>
        <Tooltip title="Statistics"><button className="text-text-muted" onClick={async () => { try { const s = await tldwClient.dictionaryStatistics(record.id); setStatsFor(s) } catch (e: any) { notification.error({ message: 'Stats failed', description: e?.message }) } }}>Stats</button></Tooltip>
        <Tooltip title="Delete"><button className="text-danger" onClick={async () => { const ok = await confirmDanger({ title: t('common:confirmTitle', { defaultValue: 'Please confirm' }), content: 'Delete dictionary?', okText: t('common:delete', { defaultValue: 'Delete' }), cancelText: t('common:cancel', { defaultValue: 'Cancel' }) }); if (ok) deleteDict(record.id) }}><Trash2 className="w-4 h-4" /></button></Tooltip>
      </div>
    )}
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button onClick={() => setOpenImport(true)}>Import</Button>
        <Button type="primary" onClick={() => setOpen(true)}>New Dictionary</Button>
      </div>
      {status === 'pending' && <Skeleton active paragraph={{ rows: 6 }} />}
      {status === 'success' && dictionariesUnsupported && (
        <FeatureEmptyState
          title={t("option:dictionaries.offlineTitle", {
            defaultValue: "Chat dictionaries API not available on this server"
          })}
          description={t("option:dictionaries.offlineDescription", {
            defaultValue:
              "This tldw server does not advertise the /api/v1/chat/dictionaries endpoints. Upgrade your server to a version that includes chat dictionaries to use this workspace."
          })}
          primaryActionLabel={t("settings:healthSummary.diagnostics", {
            defaultValue: "Health & diagnostics"
          })}
          onPrimaryAction={() => {
            try {
              window.location.hash = "#/settings/health"
            } catch {}
          }}
        />
      )}
      {status === 'success' && !dictionariesUnsupported && (
        <Table rowKey={(r: any) => r.id} dataSource={data} columns={columns as any} />
      )}

      <Modal title="Create Dictionary" open={open} onCancel={() => setOpen(false)} footer={null}>
        <Form layout="vertical" form={createForm} onFinish={(v) => createDict(v)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Button type="primary" htmlType="submit" loading={creating} className="w-full">Create</Button>
        </Form>
      </Modal>

      <Modal title="Edit Dictionary" open={openEdit} onCancel={() => setOpenEdit(false)} footer={null}>
        <Form layout="vertical" form={editForm} onFinish={(v) => updateDict(v)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
          <Button type="primary" htmlType="submit" loading={updating} className="w-full">Save</Button>
        </Form>
      </Modal>

      <Modal title="Manage Entries" open={!!openEntries} onCancel={() => setOpenEntries(null)} footer={null}>
        {openEntries && <DictionaryEntryManager dictionaryId={openEntries} form={entryForm} />}
      </Modal>
      <Modal title="Import Dictionary (JSON)" open={openImport} onCancel={() => setOpenImport(false)} footer={null}>
        <div className="space-y-3">
          <input type="file" accept="application/json" onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const text = await file.text()
              const parsed = JSON.parse(text)
              await importDict({ data: parsed, activate: activateOnImport })
            } catch (err: any) {
              notification.error({ message: 'Import failed', description: err?.message })
            } finally {
              (e.target as any).value = ''
            }
          }} />
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={activateOnImport} onChange={(ev) => setActivateOnImport(ev.target.checked)} /> Activate after import</label>
        </div>
      </Modal>
      <Modal title="Dictionary Statistics" open={!!statsFor} onCancel={() => setStatsFor(null)} footer={null}>
        {statsFor && (
          <Descriptions size="small" bordered column={1}>
            <Descriptions.Item label="ID">{statsFor.dictionary_id}</Descriptions.Item>
            <Descriptions.Item label="Name">{statsFor.name}</Descriptions.Item>
            <Descriptions.Item label="Total Entries">{statsFor.total_entries}</Descriptions.Item>
            <Descriptions.Item label="Regex Entries">{statsFor.regex_entries}</Descriptions.Item>
            <Descriptions.Item label="Literal Entries">{statsFor.literal_entries}</Descriptions.Item>
            <Descriptions.Item label="Groups">{(statsFor.groups||[]).join(', ')}</Descriptions.Item>
            <Descriptions.Item label="Average Probability">{statsFor.average_probability}</Descriptions.Item>
            <Descriptions.Item label="Total Usage Count">{statsFor.total_usage_count}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

const DictionaryEntryManager: React.FC<{ dictionaryId: number; form: any }> = ({
  dictionaryId,
  form
}) => {
  const { t } = useTranslation(["common", "option"])
  const qc = useQueryClient()
  const confirmDanger = useConfirmDanger()
  const [validationStrict, setValidationStrict] = React.useState(false)
  const [validationReport, setValidationReport] = React.useState<any | null>(null)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [previewText, setPreviewText] = React.useState("")
  const [previewTokenBudget, setPreviewTokenBudget] = React.useState<number | null>(1000)
  const [previewMaxIterations, setPreviewMaxIterations] = React.useState<number | null>(5)
  const [previewResult, setPreviewResult] = React.useState<any | null>(null)
  const [previewError, setPreviewError] = React.useState<string | null>(null)

  const { data: dictionaryMeta } = useQuery({
    queryKey: ["tldw:getDictionary", dictionaryId],
    queryFn: async () => {
      await tldwClient.initialize()
      return await tldwClient.getDictionary(dictionaryId)
    }
  })

  const { data: entriesData, status: entriesStatus } = useQuery({
    queryKey: ["tldw:listDictionaryEntries", dictionaryId],
    queryFn: async () => {
      await tldwClient.initialize()
      const res = await tldwClient.listDictionaryEntries(dictionaryId)
      return res?.entries || []
    }
  })

  const entries = Array.isArray(entriesData) ? entriesData : []

  const { mutate: addEntry, isPending: adding } = useMutation({
    mutationFn: (v: any) => tldwClient.addDictionaryEntry(dictionaryId, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tldw:listDictionaryEntries", dictionaryId] })
      form.resetFields()
    }
  })
  const { mutate: deleteEntry } = useMutation({
    mutationFn: (id: number) => tldwClient.deleteDictionaryEntry(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["tldw:listDictionaryEntries", dictionaryId] })
  })

  const { mutate: runValidation, isPending: validating } = useMutation({
    mutationFn: async () => {
      await tldwClient.initialize()
      const payload = {
        data: {
          name: dictionaryMeta?.name || undefined,
          description: dictionaryMeta?.description || undefined,
          entries: entries.map((entry: any) => ({
            pattern: entry.pattern,
            replacement: entry.replacement,
            type: entry.type,
            probability: entry.probability,
            enabled: entry.enabled,
            case_sensitive: entry.case_sensitive,
            group: entry.group,
            max_replacements: entry.max_replacements
          }))
        },
        schema_version: 1,
        strict: validationStrict
      }
      return await tldwClient.validateDictionary(payload)
    },
    onSuccess: (res) => {
      setValidationReport(res)
      setValidationError(null)
    },
    onError: (e: any) => {
      setValidationReport(null)
      setValidationError(
        e?.message ||
          t("option:dictionariesTools.validateError", "Validation failed.")
      )
    }
  })

  const { mutate: runPreview, isPending: previewing } = useMutation({
    mutationFn: async () => {
      await tldwClient.initialize()
      const trimmed = previewText.trim()
      if (!trimmed) {
        throw new Error(
          t(
            "option:dictionariesTools.previewEmpty",
            "Enter sample text to preview."
          )
        )
      }
      const payload: {
        text: string
        token_budget?: number
        dictionary_id?: number | string
        max_iterations?: number
      } = {
        text: trimmed,
        dictionary_id: dictionaryId
      }
      if (typeof previewTokenBudget === "number" && previewTokenBudget > 0) {
        payload.token_budget = previewTokenBudget
      }
      if (
        typeof previewMaxIterations === "number" &&
        previewMaxIterations > 0
      ) {
        payload.max_iterations = previewMaxIterations
      }
      return await tldwClient.processDictionary(payload)
    },
    onSuccess: (res) => {
      setPreviewResult(res)
      setPreviewError(null)
    },
    onError: (e: any) => {
      setPreviewResult(null)
      setPreviewError(
        e?.message ||
          t("option:dictionariesTools.previewError", "Preview failed.")
      )
    }
  })

  const handlePreview = () => {
    if (!previewText.trim()) {
      setPreviewError(
        t(
          "option:dictionariesTools.previewEmpty",
          "Enter sample text to preview."
        )
      )
      return
    }
    runPreview()
  }

  const validationErrors = Array.isArray(validationReport?.errors)
    ? validationReport.errors
    : []
  const validationWarnings = Array.isArray(validationReport?.warnings)
    ? validationReport.warnings
    : []
  const entryStats = validationReport?.entry_stats || null

  const previewEntriesUsed = Array.isArray(previewResult?.entries_used)
    ? previewResult.entries_used
    : []

  return (
    <div className="space-y-4">
      <Collapse
        ghost
        className="rounded-lg border border-border bg-surface2/40"
        items={[
          {
            key: "validate",
            label: t(
              "option:dictionariesTools.validateTitle",
              "Validate dictionary"
            ),
            children: (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  {t(
                    "option:dictionariesTools.validateHelp",
                    "Check schema, regex safety, and template syntax for this dictionary."
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Switch
                    checked={validationStrict}
                    onChange={setValidationStrict}
                  />
                  <span className="text-sm text-text">
                    {t(
                      "option:dictionariesTools.strictLabel",
                      "Strict validation"
                    )}
                  </span>
                  <Button
                    size="small"
                    onClick={() => runValidation()}
                    loading={validating}
                    disabled={entries.length === 0}>
                    {t(
                      "option:dictionariesTools.validateButton",
                      "Run validation"
                    )}
                  </Button>
                </div>
                {entries.length === 0 && (
                  <div className="text-xs text-text-muted">
                    {t(
                      "option:dictionariesTools.validateEmpty",
                      "Add at least one entry to validate."
                    )}
                  </div>
                )}
                {validationError && (
                  <div className="text-xs text-danger">{validationError}</div>
                )}
                {validationReport && (
                  <div className="space-y-3 rounded-md border border-border bg-surface px-3 py-2">
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item
                        label={t(
                          "option:dictionariesTools.validationOk",
                          "Valid"
                        )}>
                        {validationReport.ok ? "Yes" : "No"}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={t(
                          "option:dictionariesTools.schemaVersion",
                          "Schema version"
                        )}>
                        {validationReport.schema_version ?? "—"}
                      </Descriptions.Item>
                      {entryStats && (
                        <Descriptions.Item
                          label={t(
                            "option:dictionariesTools.entryStats",
                            "Entry stats"
                          )}>
                          {`${entryStats.total ?? 0} total · ${entryStats.literal ?? 0} literal · ${entryStats.regex ?? 0} regex`}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                    <div>
                      <div className="text-xs font-medium text-text">
                        {t("option:dictionariesTools.errorsLabel", "Errors")}
                      </div>
                      {validationErrors.length > 0 ? (
                        <ul className="list-disc pl-4 text-xs text-text-muted">
                          {validationErrors.map((err: any, idx: number) => (
                            <li key={`err-${idx}`}>
                              <span className="font-medium text-text">
                                {err?.code || "error"}:
                              </span>{" "}
                              {err?.message || String(err)}
                              {err?.field ? ` (${err.field})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-text-muted">
                          {t(
                            "option:dictionariesTools.noErrors",
                            "No errors found."
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-text">
                        {t(
                          "option:dictionariesTools.warningsLabel",
                          "Warnings"
                        )}
                      </div>
                      {validationWarnings.length > 0 ? (
                        <ul className="list-disc pl-4 text-xs text-text-muted">
                          {validationWarnings.map((warn: any, idx: number) => (
                            <li key={`warn-${idx}`}>
                              <span className="font-medium text-text">
                                {warn?.code || "warning"}:
                              </span>{" "}
                              {warn?.message || String(warn)}
                              {warn?.field ? ` (${warn.field})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-text-muted">
                          {t(
                            "option:dictionariesTools.noWarnings",
                            "No warnings found."
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          },
          {
            key: "preview",
            label: t(
              "option:dictionariesTools.previewTitle",
              "Preview transforms"
            ),
            children: (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  {t(
                    "option:dictionariesTools.previewHelp",
                    "Test how this dictionary rewrites sample text."
                  )}
                </p>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-text">
                    {t(
                      "option:dictionariesTools.sampleTextLabel",
                      "Sample text"
                    )}
                  </div>
                  <Input.TextArea
                    rows={4}
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    placeholder={t(
                      "option:dictionariesTools.sampleTextPlaceholder",
                      "Paste text to preview dictionary substitutions."
                    )}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-text">
                      {t(
                        "option:dictionariesTools.tokenBudgetLabel",
                        "Token budget"
                      )}
                    </div>
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      value={previewTokenBudget ?? undefined}
                      onChange={(value) =>
                        setPreviewTokenBudget(
                          typeof value === "number" ? value : null
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-text">
                      {t(
                        "option:dictionariesTools.maxIterationsLabel",
                        "Max iterations"
                      )}
                    </div>
                    <InputNumber
                      min={1}
                      style={{ width: "100%" }}
                      value={previewMaxIterations ?? undefined}
                      onChange={(value) =>
                        setPreviewMaxIterations(
                          typeof value === "number" ? value : null
                        )
                      }
                    />
                  </div>
                </div>
                <Button
                  size="small"
                  type="primary"
                  onClick={handlePreview}
                  loading={previewing}
                  disabled={!previewText.trim()}>
                  {t("option:dictionariesTools.previewButton", "Run preview")}
                </Button>
                {previewError && (
                  <div className="text-xs text-danger">{previewError}</div>
                )}
                {previewResult && (
                  <div className="space-y-2 rounded-md border border-border bg-surface px-3 py-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-text">
                        {t(
                          "option:dictionariesTools.processedTextLabel",
                          "Processed text"
                        )}
                      </div>
                      <Input.TextArea
                        rows={4}
                        value={previewResult.processed_text || ""}
                        readOnly
                      />
                    </div>
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item
                        label={t(
                          "option:dictionariesTools.replacementsLabel",
                          "Replacements"
                        )}>
                        {previewResult.replacements ?? 0}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={t(
                          "option:dictionariesTools.iterationsLabel",
                          "Iterations"
                        )}>
                        {previewResult.iterations ?? 0}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={t(
                          "option:dictionariesTools.entriesUsedLabel",
                          "Entries used"
                        )}>
                        {previewEntriesUsed.length > 0
                          ? previewEntriesUsed.join(", ")
                          : "—"}
                      </Descriptions.Item>
                    </Descriptions>
                    {previewResult.token_budget_exceeded && (
                      <Tag color="red">
                        {t(
                          "option:dictionariesTools.tokenBudgetExceeded",
                          "Token budget exceeded"
                        )}
                      </Tag>
                    )}
                  </div>
                )}
              </div>
            )
          }
        ]}
      />

      <Divider className="!my-2" />

      {entriesStatus === "pending" && <Skeleton active paragraph={{ rows: 4 }} />}
      {entriesStatus === "success" && (
        <Table
          size="small"
          rowKey={(r: any) => r.id}
          dataSource={entries}
          columns={[
            { title: "Pattern", dataIndex: "pattern", key: "pattern" },
            {
              title: "Replacement",
              dataIndex: "replacement",
              key: "replacement"
            },
            { title: "Type", dataIndex: "type", key: "type" },
            { title: "Prob.", dataIndex: "probability", key: "probability" },
            { title: "Group", dataIndex: "group", key: "group" },
            {
              title: "Enabled",
              dataIndex: "enabled",
              key: "enabled",
              render: (v: boolean) => (v ? "Yes" : "No")
            },
            {
              title: "Actions",
              key: "actions",
              render: (_: any, r: any) => (
                <div className="flex gap-2">
                  <Tooltip title="Delete">
                    <button
                      className="text-danger"
                      onClick={async () => {
                        const ok = await confirmDanger({
                          title: t("common:confirmTitle", {
                            defaultValue: "Please confirm"
                          }),
                          content: "Delete entry?",
                          okText: t("common:delete", { defaultValue: "Delete" }),
                          cancelText: t("common:cancel", {
                            defaultValue: "Cancel"
                          })
                        })
                        if (ok) deleteEntry(r.id)
                      }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              )
            }
          ] as any}
        />
      )}
      <Form layout="vertical" form={form} onFinish={(v) => addEntry(v)}>
        <Form.Item name="pattern" label="Pattern" rules={[{ required: true }]}>
          <Input placeholder="hello or /hel+o/i" />
        </Form.Item>
        <Form.Item name="replacement" label="Replacement" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="type" label="Type" initialValue="literal">
          <Select
            options={[
              { label: "Literal", value: "literal" },
              { label: "Regex", value: "regex" }
            ]}
          />
        </Form.Item>
        <Form.Item name="probability" label="Probability" initialValue={1}>
          <InputNumber
            min={0}
            max={1}
            step={0.01}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Form.Item name="group" label="Group">
          <Input />
        </Form.Item>
        <Form.Item name="max_replacements" label="Max Replacements">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          name="enabled"
          label="Enabled"
          valuePropName="checked"
          initialValue={true}>
          <Switch />
        </Form.Item>
        <Form.Item name="case_sensitive" label="Case Sensitive" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={adding} className="w-full">
          Add Entry
        </Button>
      </Form>
    </div>
  )
}
