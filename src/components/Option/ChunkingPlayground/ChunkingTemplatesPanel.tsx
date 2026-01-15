import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography
} from "antd"
import { useQuery } from "@tanstack/react-query"

import { useAntdMessage } from "@/hooks/useAntdMessage"
import {
  applyChunkingTemplate,
  createChunkingTemplate,
  deleteChunkingTemplate,
  getChunkingTemplateDiagnostics,
  learnChunkingTemplate,
  listChunkingTemplates,
  matchChunkingTemplates,
  updateChunkingTemplate,
  validateChunkingTemplate,
  type ApplyTemplateResponse,
  type ChunkingTemplateResponse,
  type TemplateDiagnosticsResponse,
  type TemplateLearnResponse,
  type TemplateMatchResponse,
  type TemplateValidationResponse
} from "@/services/chunking"

const { TextArea } = Input
const { Text, Title } = Typography

const parseJson = (raw: string) => {
  if (!raw.trim()) return { value: undefined, error: null }
  try {
    return { value: JSON.parse(raw), error: null }
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : String(err) }
  }
}

const formatJson = (value: unknown) => JSON.stringify(value, null, 2)

export const ChunkingTemplatesPanel: React.FC = () => {
  const { t } = useTranslation(["settings", "common"])
  const message = useAntdMessage()

  const [activeTab, setActiveTab] = useState("browse")

  const [includeBuiltin, setIncludeBuiltin] = useState(true)
  const [includeCustom, setIncludeCustom] = useState(true)
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [userIdFilter, setUserIdFilter] = useState("")
  const [hardDelete, setHardDelete] = useState(false)

  const [selectedTemplateName, setSelectedTemplateName] = useState("")

  const [editorName, setEditorName] = useState("")
  const [editorDescription, setEditorDescription] = useState("")
  const [editorTags, setEditorTags] = useState<string[]>([])
  const [editorUserId, setEditorUserId] = useState("")
  const [editorTemplateJson, setEditorTemplateJson] = useState("")
  const [editorResponse, setEditorResponse] =
    useState<ChunkingTemplateResponse | null>(null)

  const [applyTemplateName, setApplyTemplateName] = useState("")
  const [applyText, setApplyText] = useState("")
  const [applyOverrideOptions, setApplyOverrideOptions] = useState("")
  const [applyIncludeMetadata, setApplyIncludeMetadata] = useState(false)
  const [applyResponse, setApplyResponse] =
    useState<ApplyTemplateResponse | null>(null)

  const [validateJson, setValidateJson] = useState("")
  const [validateResponse, setValidateResponse] =
    useState<TemplateValidationResponse | null>(null)

  const [matchMediaType, setMatchMediaType] = useState("")
  const [matchTitle, setMatchTitle] = useState("")
  const [matchUrl, setMatchUrl] = useState("")
  const [matchFilename, setMatchFilename] = useState("")
  const [matchResponse, setMatchResponse] =
    useState<TemplateMatchResponse | null>(null)

  const [learnName, setLearnName] = useState("")
  const [learnExampleText, setLearnExampleText] = useState("")
  const [learnDescription, setLearnDescription] = useState("")
  const [learnSave, setLearnSave] = useState(false)
  const [learnClassifierJson, setLearnClassifierJson] = useState("")
  const [learnResponse, setLearnResponse] =
    useState<TemplateLearnResponse | null>(null)

  const [diagnosticsResponse, setDiagnosticsResponse] =
    useState<TemplateDiagnosticsResponse | null>(null)

  const {
    data: templateList,
    isLoading: templateLoading,
    error: templateError,
    refetch: refetchTemplates
  } = useQuery({
    queryKey: [
      "chunking-templates",
      includeBuiltin,
      includeCustom,
      tagFilters,
      userIdFilter
    ],
    queryFn: () =>
      listChunkingTemplates({
        includeBuiltin,
        includeCustom,
        tags: tagFilters.length ? tagFilters : undefined,
        userId: userIdFilter || undefined
      }),
    staleTime: 60 * 1000
  })

  const templates = templateList?.templates ?? []
  const selectedTemplate = templates.find(
    (template) => template.name === selectedTemplateName
  )

  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        value: template.name,
        label: template.name
      })),
    [templates]
  )

  const loadTemplateIntoEditor = (template: ChunkingTemplateResponse) => {
    setEditorName(template.name)
    setEditorDescription(template.description ?? "")
    setEditorTags(template.tags ?? [])
    setEditorUserId(template.user_id ? String(template.user_id) : "")
    try {
      setEditorTemplateJson(formatJson(JSON.parse(template.template_json)))
    } catch {
      setEditorTemplateJson(template.template_json)
    }
    setEditorResponse(null)
    setActiveTab("editor")
  }

  const handleCreate = async () => {
    if (!editorName.trim()) {
      message.error(
        t(
          "settings:chunkingPlayground.templates.nameRequired",
          "Template name is required."
        )
      )
      return
    }
    const parsed = parseJson(editorTemplateJson)
    if (parsed.error || !parsed.value) {
      message.error(
        t("settings:chunkingPlayground.templates.jsonError", "Invalid JSON. Please fix and try again.")
      )
      return
    }

    try {
      const response = await createChunkingTemplate({
        name: editorName.trim(),
        description: editorDescription.trim() || undefined,
        tags: editorTags.length ? editorTags : undefined,
        user_id: editorUserId.trim() || undefined,
        template: parsed.value
      })
      setEditorResponse(response)
      await refetchTemplates()
      message.success(t("common:create", "Create"))
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Create failed")
    }
  }

  const handleUpdate = async () => {
    if (!editorName.trim()) {
      message.error(
        t(
          "settings:chunkingPlayground.templates.nameRequired",
          "Template name is required."
        )
      )
      return
    }
    const parsed = parseJson(editorTemplateJson)
    if (parsed.error) {
      message.error(
        t("settings:chunkingPlayground.templates.jsonError", "Invalid JSON. Please fix and try again.")
      )
      return
    }

    try {
      const response = await updateChunkingTemplate(editorName.trim(), {
        description: editorDescription.trim() || undefined,
        tags: editorTags.length ? editorTags : undefined,
        template: parsed.value
      })
      setEditorResponse(response)
      await refetchTemplates()
      message.success(
        t("settings:chunkingPlayground.templates.updateAction", "Update")
      )
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Update failed")
    }
  }

  const handleDelete = async () => {
    if (!selectedTemplateName.trim()) return
    try {
      await deleteChunkingTemplate(selectedTemplateName.trim(), hardDelete)
      await refetchTemplates()
      setSelectedTemplateName("")
      message.success(t("common:delete", "Delete"))
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  const handleApply = async () => {
    if (!applyTemplateName.trim() || !applyText.trim()) {
      message.error(t("settings:chunkingPlayground.noInput", "Please provide text to chunk"))
      return
    }
    const parsed = parseJson(applyOverrideOptions)
    if (parsed.error) {
      message.error(
        t("settings:chunkingPlayground.templates.jsonError", "Invalid JSON. Please fix and try again.")
      )
      return
    }

    try {
      const payload: {
        template_name: string
        text: string
        override_options?: Record<string, any>
      } = {
        template_name: applyTemplateName.trim(),
        text: applyText
      }
      if (parsed.value !== undefined) {
        payload.override_options = parsed.value
      }
      const response = await applyChunkingTemplate(payload, applyIncludeMetadata)
      setApplyResponse(response)
      message.success(
        t("settings:chunkingPlayground.templates.applyAction", "Apply")
      )
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Apply failed")
    }
  }

  const handleValidate = async () => {
    const parsed = parseJson(validateJson)
    if (parsed.error || !parsed.value) {
      message.error(
        t("settings:chunkingPlayground.templates.jsonError", "Invalid JSON. Please fix and try again.")
      )
      return
    }

    try {
      const response = await validateChunkingTemplate(parsed.value)
      setValidateResponse(response)
      message.success(
        t("settings:chunkingPlayground.templates.validateAction", "Validate")
      )
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Validate failed")
    }
  }

  const handleMatch = async () => {
    try {
      const response = await matchChunkingTemplates({
        mediaType: matchMediaType.trim() || undefined,
        title: matchTitle.trim() || undefined,
        url: matchUrl.trim() || undefined,
        filename: matchFilename.trim() || undefined
      })
      setMatchResponse(response)
      message.success(
        t("settings:chunkingPlayground.templates.matchAction", "Match")
      )
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Match failed")
    }
  }

  const handleLearn = async () => {
    if (!learnName.trim()) {
      message.error(
        t(
          "settings:chunkingPlayground.templates.nameRequired",
          "Template name is required."
        )
      )
      return
    }
    const parsed = parseJson(learnClassifierJson)
    if (parsed.error) {
      message.error(
        t("settings:chunkingPlayground.templates.jsonError", "Invalid JSON. Please fix and try again.")
      )
      return
    }

    try {
      const response = await learnChunkingTemplate({
        name: learnName.trim(),
        example_text: learnExampleText.trim() || undefined,
        description: learnDescription.trim() || undefined,
        save: learnSave,
        classifier: parsed.value
      })
      setLearnResponse(response)
      if (learnSave) await refetchTemplates()
      message.success(
        t("settings:chunkingPlayground.templates.learnAction", "Learn")
      )
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Learn failed")
    }
  }

  const handleDiagnostics = async () => {
    try {
      const response = await getChunkingTemplateDiagnostics()
      setDiagnosticsResponse(response)
      message.success(
        t(
          "settings:chunkingPlayground.templates.diagnosticsAction",
          "Run diagnostics"
        )
      )
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Diagnostics failed")
    }
  }

  const renderResponse = (value: unknown) => {
    if (!value) {
      return <Text type="secondary">{t("common:noData", "No data")}</Text>
    }
    return (
      <pre className="text-xs bg-surface2 rounded p-2 overflow-x-auto">
        {formatJson(value)}
      </pre>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Title level={4} className="mb-1">
          {t(
            "settings:chunkingPlayground.templates.title",
            "Chunking Templates"
          )}
        </Title>
        <Text type="secondary">
          {t(
            "settings:chunkingPlayground.templates.description",
            "Manage, validate, and apply chunking templates."
          )}
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "browse",
            label: t(
              "settings:chunkingPlayground.templates.tabBrowse",
              "Browse"
            ),
            children: (
              <Card size="small">
                <Form layout="vertical" size="small">
                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.filtersTitle",
                      "Filters"
                    )}>
                    <Space direction="vertical" size={8} className="w-full">
                      <div className="flex items-center justify-between">
                        <Text>
                          {t(
                            "settings:chunkingPlayground.templates.includeBuiltin",
                            "Include built-in"
                          )}
                        </Text>
                        <Switch
                          checked={includeBuiltin}
                          onChange={setIncludeBuiltin}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Text>
                          {t(
                            "settings:chunkingPlayground.templates.includeCustom",
                            "Include custom"
                          )}
                        </Text>
                        <Switch
                          checked={includeCustom}
                          onChange={setIncludeCustom}
                        />
                      </div>
                      <Select
                        mode="tags"
                        value={tagFilters}
                        onChange={setTagFilters}
                        placeholder={t(
                          "settings:chunkingPlayground.templates.tagsPlaceholder",
                          "Add tags"
                        )}
                      />
                      <Input
                        value={userIdFilter}
                        onChange={(e) => setUserIdFilter(e.target.value)}
                        placeholder={t(
                          "settings:chunkingPlayground.templates.userIdLabel",
                          "User ID"
                        )}
                      />
                      <Button
                        size="small"
                        onClick={() => refetchTemplates()}
                        loading={templateLoading}>
                        {t("common:refresh", "Refresh")}
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>

                {templateError && (
                  <Alert
                    type="warning"
                    showIcon
                    message={(templateError as Error)?.message}
                  />
                )}

                <Divider className="my-3" />

                <Form layout="vertical" size="small">
                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.selectLabel",
                      "Template"
                    )}>
                    <Select
                      showSearch
                      value={selectedTemplateName || undefined}
                      onChange={setSelectedTemplateName}
                      options={templateOptions}
                      loading={templateLoading}
                      placeholder={t(
                        "settings:chunkingPlayground.templates.selectPlaceholder",
                        "Select a template"
                      )}
                      filterOption={(inputValue, option) =>
                        (option?.value ?? "")
                          .toString()
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                    />
                  </Form.Item>
                </Form>

                {selectedTemplate ? (
                  <Card
                    size="small"
                    title={t(
                      "settings:chunkingPlayground.templates.detailsTitle",
                      "Template details"
                    )}
                    className="mt-3">
                    <Space direction="vertical" size="small" className="w-full">
                      <div>
                        <Text strong>{selectedTemplate.name}</Text>
                      </div>
                      {selectedTemplate.description && (
                        <Text type="secondary">
                          {selectedTemplate.description}
                        </Text>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.is_builtin && (
                          <Tag color="blue">
                            {t(
                              "settings:chunkingPlayground.templates.isBuiltin",
                              "Built-in"
                            )}
                          </Tag>
                        )}
                        <Tag>
                          {t(
                            "settings:chunkingPlayground.templates.version",
                            "Version"
                          )}
                          : {selectedTemplate.version}
                        </Tag>
                        {selectedTemplate.tags?.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                      <Text type="secondary" className="text-xs">
                        {t(
                          "settings:chunkingPlayground.templates.updatedAt",
                          "Updated"
                        )}
                        : {selectedTemplate.updated_at}
                      </Text>
                      <pre className="text-xs bg-surface2 rounded p-2 overflow-x-auto">
                        {selectedTemplate.template_json}
                      </pre>
                      <Space>
                        <Button
                          size="small"
                          onClick={() => loadTemplateIntoEditor(selectedTemplate)}>
                          {t(
                            "settings:chunkingPlayground.templates.loadIntoEditor",
                            "Load into editor"
                          )}
                        </Button>
                        <Popconfirm
                          title={t(
                            "settings:chunkingPlayground.templates.deleteConfirm",
                            "Delete this template?"
                          )}
                          onConfirm={handleDelete}>
                          <Button danger size="small">
                            {t("common:delete", "Delete")}
                          </Button>
                        </Popconfirm>
                        <Space size="small">
                          <Text type="secondary" className="text-xs">
                            {t(
                              "settings:chunkingPlayground.templates.hardDeleteLabel",
                              "Hard delete"
                            )}
                          </Text>
                          <Switch
                            checked={hardDelete}
                            onChange={setHardDelete}
                          />
                        </Space>
                      </Space>
                    </Space>
                  </Card>
                ) : (
                  <Text type="secondary">
                    {t(
                      "settings:chunkingPlayground.templates.noSelection",
                      "Select a template to view details."
                    )}
                  </Text>
                )}
              </Card>
            )
          },
          {
            key: "editor",
            label: t(
              "settings:chunkingPlayground.templates.tabEditor",
              "Editor"
            ),
            children: (
              <Card size="small">
                <Form layout="vertical" size="small">
                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.learnNameLabel",
                      "Template name"
                    )}>
                    <Input
                      value={editorName}
                      onChange={(e) => setEditorName(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.learnDescriptionLabel",
                      "Description"
                    )}>
                    <Input
                      value={editorDescription}
                      onChange={(e) => setEditorDescription(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.tagsLabel",
                      "Tags"
                    )}>
                    <Select
                      mode="tags"
                      value={editorTags}
                      onChange={setEditorTags}
                      placeholder={t(
                        "settings:chunkingPlayground.templates.tagsPlaceholder",
                        "Add tags"
                      )}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.userIdLabel",
                      "User ID"
                    )}>
                    <Input
                      value={editorUserId}
                      onChange={(e) => setEditorUserId(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.templateJsonLabel",
                      "Template JSON"
                    )}>
                    <TextArea
                      value={editorTemplateJson}
                      onChange={(e) => setEditorTemplateJson(e.target.value)}
                      rows={10}
                    />
                  </Form.Item>
                </Form>

                <Space>
                  <Button onClick={handleCreate}>
                    {t("common:create", "Create")}
                  </Button>
                  <Button onClick={handleUpdate}>
                    {t(
                      "settings:chunkingPlayground.templates.updateAction",
                      "Update"
                    )}
                  </Button>
                </Space>

                <Divider className="my-3" />
                {renderResponse(editorResponse)}
              </Card>
            )
          },
          {
            key: "apply",
            label: t(
              "settings:chunkingPlayground.templates.tabApply",
              "Apply"
            ),
            children: (
              <Card size="small">
                <Form layout="vertical" size="small">
                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.selectLabel",
                      "Template"
                    )}>
                    <Select
                      showSearch
                      value={applyTemplateName || undefined}
                      onChange={setApplyTemplateName}
                      options={templateOptions}
                      placeholder={t(
                        "settings:chunkingPlayground.templates.selectPlaceholder",
                        "Select a template"
                      )}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.applyTextLabel",
                      "Text to apply template"
                    )}>
                    <TextArea
                      value={applyText}
                      onChange={(e) => setApplyText(e.target.value)}
                      rows={6}
                      placeholder={t(
                        "settings:chunkingPlayground.templates.applyTextPlaceholder",
                        "Paste text to chunk with this template"
                      )}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.overrideOptionsLabel",
                      "Override options (JSON)"
                    )}>
                    <TextArea
                      value={applyOverrideOptions}
                      onChange={(e) => setApplyOverrideOptions(e.target.value)}
                      rows={4}
                    />
                  </Form.Item>

                  <div className="flex items-center justify-between">
                    <Text>
                      {t(
                        "settings:chunkingPlayground.templates.includeMetadataLabel",
                        "Include metadata"
                      )}
                    </Text>
                    <Switch
                      checked={applyIncludeMetadata}
                      onChange={setApplyIncludeMetadata}
                    />
                  </div>
                </Form>

                <Space className="mt-3">
                  <Button onClick={handleApply}>
                    {t(
                      "settings:chunkingPlayground.templates.applyAction",
                      "Apply"
                    )}
                  </Button>
                </Space>

                <Divider className="my-3" />
                {renderResponse(applyResponse)}
              </Card>
            )
          },
          {
            key: "validate",
            label: t(
              "settings:chunkingPlayground.templates.tabValidate",
              "Validate"
            ),
            children: (
              <Card size="small">
                <Form layout="vertical" size="small">
                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.validateLabel",
                      "Template JSON to validate"
                    )}>
                    <TextArea
                      value={validateJson}
                      onChange={(e) => setValidateJson(e.target.value)}
                      rows={8}
                    />
                  </Form.Item>
                </Form>

                <Button onClick={handleValidate}>
                  {t(
                    "settings:chunkingPlayground.templates.validateAction",
                    "Validate"
                  )}
                </Button>

                <Divider className="my-3" />
                {renderResponse(validateResponse)}
              </Card>
            )
          },
          {
            key: "match",
            label: t(
              "settings:chunkingPlayground.templates.tabMatch",
              "Match"
            ),
            children: (
              <Card size="small">
                <Form layout="vertical" size="small">
                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.matchMediaTypeLabel",
                      "Media type"
                    )}>
                    <Input
                      value={matchMediaType}
                      onChange={(e) => setMatchMediaType(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.matchTitleLabel",
                      "Title"
                    )}>
                    <Input
                      value={matchTitle}
                      onChange={(e) => setMatchTitle(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.matchUrlLabel",
                      "URL"
                    )}>
                    <Input
                      value={matchUrl}
                      onChange={(e) => setMatchUrl(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.matchFilenameLabel",
                      "Filename"
                    )}>
                    <Input
                      value={matchFilename}
                      onChange={(e) => setMatchFilename(e.target.value)}
                    />
                  </Form.Item>
                </Form>

                <Button onClick={handleMatch}>
                  {t(
                    "settings:chunkingPlayground.templates.matchAction",
                    "Match"
                  )}
                </Button>

                <Divider className="my-3" />
                {renderResponse(matchResponse)}
              </Card>
            )
          },
          {
            key: "learn",
            label: t(
              "settings:chunkingPlayground.templates.tabLearn",
              "Learn"
            ),
            children: (
              <Card size="small">
                <Form layout="vertical" size="small">
                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.learnNameLabel",
                      "Template name"
                    )}>
                    <Input
                      value={learnName}
                      onChange={(e) => setLearnName(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.learnExampleLabel",
                      "Example text"
                    )}>
                    <TextArea
                      value={learnExampleText}
                      onChange={(e) => setLearnExampleText(e.target.value)}
                      rows={6}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.learnDescriptionLabel",
                      "Description"
                    )}>
                    <Input
                      value={learnDescription}
                      onChange={(e) => setLearnDescription(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(
                      "settings:chunkingPlayground.templates.learnClassifierLabel",
                      "Classifier (JSON)"
                    )}>
                    <TextArea
                      value={learnClassifierJson}
                      onChange={(e) => setLearnClassifierJson(e.target.value)}
                      rows={4}
                    />
                  </Form.Item>

                  <div className="flex items-center justify-between">
                    <Text>
                      {t(
                        "settings:chunkingPlayground.templates.learnSaveLabel",
                        "Save template"
                      )}
                    </Text>
                    <Switch checked={learnSave} onChange={setLearnSave} />
                  </div>
                </Form>

                <Button onClick={handleLearn}>
                  {t(
                    "settings:chunkingPlayground.templates.learnAction",
                    "Learn"
                  )}
                </Button>

                <Divider className="my-3" />
                {renderResponse(learnResponse)}
              </Card>
            )
          },
          {
            key: "diagnostics",
            label: t(
              "settings:chunkingPlayground.templates.tabDiagnostics",
              "Diagnostics"
            ),
            children: (
              <Card size="small">
                <Button onClick={handleDiagnostics}>
                  {t(
                    "settings:chunkingPlayground.templates.diagnosticsAction",
                    "Run diagnostics"
                  )}
                </Button>

                <Divider className="my-3" />
                {renderResponse(diagnosticsResponse)}
              </Card>
            )
          }
        ]}
      />
    </div>
  )
}
