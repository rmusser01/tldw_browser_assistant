import React, { useCallback, useEffect, useState } from "react"
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Spin,
  Tag,
  Tooltip,
  message
} from "antd"
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Edit,
  Trash2,
  Eye,
  Copy,
  Download
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { OutputTemplate, TemplateType, TemplateFormat } from "@/types/collections"
import { TemplateEditor } from "./TemplateEditor"
import { TemplatePreview } from "./TemplatePreview"

const TEMPLATE_TYPE_OPTIONS: { value: TemplateType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "newsletter_markdown", label: "Newsletter (MD)" },
  { value: "briefing_markdown", label: "Briefing (MD)" },
  { value: "mece_markdown", label: "MECE (MD)" },
  { value: "newsletter_html", label: "Newsletter (HTML)" },
  { value: "tts_audio", label: "TTS Audio" }
]

const FORMAT_COLORS: Record<TemplateFormat, string> = {
  markdown: "blue",
  html: "green",
  mp3: "purple"
}

export const TemplatesList: React.FC = () => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()

  // Store state
  const templates = useCollectionsStore((s) => s.templates)
  const templatesLoading = useCollectionsStore((s) => s.templatesLoading)
  const templatesError = useCollectionsStore((s) => s.templatesError)
  const templatesTotal = useCollectionsStore((s) => s.templatesTotal)
  const templateEditorOpen = useCollectionsStore((s) => s.templateEditorOpen)
  const editingTemplate = useCollectionsStore((s) => s.editingTemplate)

  // Store actions
  const setTemplates = useCollectionsStore((s) => s.setTemplates)
  const setTemplatesLoading = useCollectionsStore((s) => s.setTemplatesLoading)
  const setTemplatesError = useCollectionsStore((s) => s.setTemplatesError)
  const openTemplateEditor = useCollectionsStore((s) => s.openTemplateEditor)
  const removeTemplate = useCollectionsStore((s) => s.removeTemplate)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<TemplateType | "all">("all")
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    setTemplatesError(null)
    try {
      const response = await api.getOutputTemplates({
        search: searchQuery || undefined,
        template_type: filterType !== "all" ? filterType : undefined
      })
      setTemplates(response.templates, response.total)
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to fetch templates"
      setTemplatesError(errorMsg)
      message.error(errorMsg)
    } finally {
      setTemplatesLoading(false)
    }
  }, [api, searchQuery, filterType, setTemplates, setTemplatesLoading, setTemplatesError])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteTargetId(id)
    setDeleteModalOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return
    setDeleteLoading(true)
    try {
      await api.deleteOutputTemplate(deleteTargetId)
      removeTemplate(deleteTargetId)
      message.success(t("collections:templates.deleted", "Template deleted"))
      setDeleteModalOpen(false)
      setDeleteTargetId(null)
    } catch (error: any) {
      message.error(error?.message || "Failed to delete template")
    } finally {
      setDeleteLoading(false)
    }
  }, [api, deleteTargetId, removeTemplate, t])

  const handleDuplicate = useCallback(
    (template: OutputTemplate) => {
      openTemplateEditor({
        ...template,
        id: undefined,
        name: `${template.name} (copy)`,
        is_default: false
      } as any)
    },
    [openTemplateEditor]
  )

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    if (filterType !== "all" && t.template_type !== filterType) return false
    if (
      searchQuery &&
      !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => openTemplateEditor()}
          >
            {t("collections:templates.create", "Create Template")}
          </Button>
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchTemplates}
            loading={templatesLoading}
          >
            {t("common:refresh", "Refresh")}
          </Button>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:max-w-md">
          <Input
            placeholder={t("collections:templates.searchPlaceholder", "Search templates...")}
            prefix={<Search className="h-4 w-4 text-gray-400" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filterType}
          onChange={setFilterType}
          options={TEMPLATE_TYPE_OPTIONS.map((opt) => ({
            ...opt,
            label: t(`collections:templateTypes.${opt.value}`, opt.label)
          }))}
          className="w-48"
          size="small"
        />
      </div>

      {/* Templates Grid */}
      {templatesLoading && templates.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
        </div>
      ) : templatesError ? (
        <Empty description={templatesError} image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button onClick={fetchTemplates}>{t("common:retry", "Retry")}</Button>
        </Empty>
      ) : filteredTemplates.length === 0 ? (
        <Empty
          description={
            searchQuery || filterType !== "all"
              ? t("collections:templates.noResults", "No templates match your filters")
              : t("collections:templates.empty", "No templates yet")
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => openTemplateEditor()}>
            {t("collections:templates.createFirst", "Create your first template")}
          </Button>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => openTemplateEditor(template)}
              onDelete={() => handleDeleteClick(template.id)}
              onPreview={() => setPreviewTemplateId(template.id)}
              onDuplicate={() => handleDuplicate(template)}
            />
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {templateEditorOpen && (
        <TemplateEditor onSuccess={fetchTemplates} />
      )}

      {/* Preview Modal */}
      {previewTemplateId && (
        <TemplatePreview
          templateId={previewTemplateId}
          onClose={() => setPreviewTemplateId(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        title={t("collections:templates.deleteConfirm.title", "Delete Template")}
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDeleteConfirm}
        okText={t("common:delete", "Delete")}
        okButtonProps={{ danger: true, loading: deleteLoading }}
        cancelText={t("common:cancel", "Cancel")}
      >
        <p>
          {t(
            "collections:templates.deleteConfirm.message",
            "Are you sure you want to delete this template?"
          )}
        </p>
      </Modal>
    </div>
  )
}

// Individual Template Card
interface TemplateCardProps {
  template: OutputTemplate
  onEdit: () => void
  onDelete: () => void
  onPreview: () => void
  onDuplicate: () => void
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onEdit,
  onDelete,
  onPreview,
  onDuplicate
}) => {
  const { t } = useTranslation("collections")

  return (
    <Card
      size="small"
      className="group transition-shadow hover:shadow-md"
      actions={[
        <Tooltip key="preview" title={t("collections:templates.preview", "Preview")}>
          <Button type="text" size="small" icon={<Eye className="h-4 w-4" />} onClick={onPreview} />
        </Tooltip>,
        <Tooltip key="edit" title={t("common:edit", "Edit")}>
          <Button type="text" size="small" icon={<Edit className="h-4 w-4" />} onClick={onEdit} />
        </Tooltip>,
        <Tooltip key="duplicate" title={t("collections:templates.duplicate", "Duplicate")}>
          <Button type="text" size="small" icon={<Copy className="h-4 w-4" />} onClick={onDuplicate} />
        </Tooltip>,
        <Tooltip key="delete" title={t("common:delete", "Delete")}>
          <Button type="text" size="small" danger icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} />
        </Tooltip>
      ]}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <FileText className="h-5 w-5 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {template.name}
            </h4>
            {template.is_default && (
              <Tag color="gold" className="text-xs">
                {t("collections:templates.default", "Default")}
              </Tag>
            )}
          </div>
          {template.description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
              {template.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Tag color={FORMAT_COLORS[template.format]} className="text-xs">
              {template.format.toUpperCase()}
            </Tag>
            <span className="text-xs text-zinc-400">
              {t(`collections:templateTypes.${template.template_type}`, template.template_type)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
