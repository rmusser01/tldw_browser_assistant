import React, { useCallback, useEffect, useState } from "react"
import {
  Button,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tooltip,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { Edit, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWatchlistsStore } from "@/store/watchlists"
import {
  fetchWatchlistTemplates,
  deleteWatchlistTemplate
} from "@/services/watchlists"
import type { WatchlistTemplate } from "@/types/watchlists"
import { formatRelativeTime } from "@/utils/dateFormatters"
import { TemplateEditor } from "./TemplateEditor"

export const TemplatesTab: React.FC = () => {
  const { t } = useTranslation(["watchlists", "common"])

  // Store state
  const templates = useWatchlistsStore((s) => s.templates)
  const templatesLoading = useWatchlistsStore((s) => s.templatesLoading)

  // Store actions
  const setTemplates = useWatchlistsStore((s) => s.setTemplates)
  const setTemplatesLoading = useWatchlistsStore((s) => s.setTemplatesLoading)

  // Local state for editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WatchlistTemplate | null>(null)

  // Fetch templates
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const result = await fetchWatchlistTemplates()
      setTemplates(Array.isArray(result) ? result : [])
    } catch (err) {
      console.error("Failed to fetch templates:", err)
      message.error(t("watchlists:templates.fetchError", "Failed to load templates"))
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [setTemplates, setTemplatesLoading, t])

  // Ensure templates is always an array for rendering
  const safeTemplates = Array.isArray(templates) ? templates : []

  // Initial load
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Handle create
  const handleCreate = () => {
    setEditingTemplate(null)
    setEditorOpen(true)
  }

  // Handle edit
  const handleEdit = (template: WatchlistTemplate) => {
    setEditingTemplate(template)
    setEditorOpen(true)
  }

  // Handle delete
  const handleDelete = async (template: WatchlistTemplate) => {
    try {
      await deleteWatchlistTemplate(template.name)
      message.success(t("watchlists:templates.deleted", "Template deleted"))
      loadTemplates()
    } catch (err) {
      console.error("Failed to delete template:", err)
      message.error(t("watchlists:templates.deleteError", "Failed to delete template"))
    }
  }

  // Handle editor close
  const handleEditorClose = (saved?: boolean) => {
    setEditorOpen(false)
    setEditingTemplate(null)
    if (saved) {
      loadTemplates()
    }
  }

  // Table columns
  const columns: ColumnsType<WatchlistTemplate> = [
    {
      title: t("watchlists:templates.columns.name", "Name"),
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string) => (
        <span className="font-medium">{name}</span>
      )
    },
    {
      title: t("watchlists:templates.columns.description", "Description"),
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (desc: string | null) => (
        <span className="text-sm text-zinc-500">
          {desc || "-"}
        </span>
      )
    },
    {
      title: t("watchlists:templates.columns.format", "Format"),
      dataIndex: "output_format",
      key: "output_format",
      width: 100,
      render: (format: string) => (
        <span className="text-sm uppercase">{format || "html"}</span>
      )
    },
    {
      title: t("watchlists:templates.columns.updated", "Updated"),
      dataIndex: "updated_at",
      key: "updated_at",
      width: 150,
      render: (date: string | null) =>
        date ? (
          <span className="text-sm text-zinc-500">
            {formatRelativeTime(date, t)}
          </span>
        ) : (
          <span className="text-sm text-zinc-400">-</span>
        )
    },
    {
      title: t("watchlists:templates.columns.actions", "Actions"),
      key: "actions",
      width: 100,
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t("watchlists:templates.edit", "Edit")}>
            <Button
              type="text"
              size="small"
              icon={<Edit className="h-4 w-4" />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t("watchlists:templates.deleteConfirm", "Delete this template?")}
            onConfirm={() => handleDelete(record)}
            okText={t("common:yes", "Yes")}
            cancelText={t("common:no", "No")}
          >
            <Tooltip title={t("watchlists:templates.delete", "Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 className="h-4 w-4" />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          type="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={handleCreate}
        >
          {t("watchlists:templates.create", "Create Template")}
        </Button>
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={loadTemplates}
          loading={templatesLoading}
        >
          {t("common:refresh", "Refresh")}
        </Button>
      </div>

      {/* Description */}
      <div className="text-sm text-zinc-500">
        {t("watchlists:templates.description", "Jinja2 templates for generating briefing outputs.")}
      </div>

      {/* Table */}
      {safeTemplates.length === 0 && !templatesLoading ? (
        <Empty
          description={t("watchlists:templates.empty", "No templates yet")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={handleCreate}>
            {t("watchlists:templates.createFirst", "Create your first template")}
          </Button>
        </Empty>
      ) : (
        <Table
          dataSource={safeTemplates}
          columns={columns}
          rowKey="name"
          loading={templatesLoading}
          pagination={false}
          size="middle"
        />
      )}

      {/* Template Editor Modal */}
      <TemplateEditor
        template={editingTemplate}
        open={editorOpen}
        onClose={handleEditorClose}
      />
    </div>
  )
}
