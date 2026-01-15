import React, { useEffect, useState } from "react"
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Tabs,
  message
} from "antd"
import { useTranslation } from "react-i18next"
import {
  createWatchlistTemplate,
  getWatchlistTemplate
} from "@/services/watchlists"
import type { WatchlistTemplate, WatchlistTemplateCreate } from "@/types/watchlists"

interface TemplateEditorProps {
  template: WatchlistTemplate | null
  open: boolean
  onClose: (saved?: boolean) => void
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  open,
  onClose
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"editor" | "docs">("editor")

  const isEditing = !!template

  // Load template content when editing
  useEffect(() => {
    if (open && template) {
      setLoading(true)
      getWatchlistTemplate(template.name)
        .then((result) => {
          form.setFieldsValue({
            name: result.name,
            description: result.description || "",
            content: result.content || "",
            output_format: result.output_format || "html"
          })
        })
        .catch((err) => {
          console.error("Failed to load template:", err)
          message.error(t("watchlists:templates.loadError", "Failed to load template"))
        })
        .finally(() => {
          setLoading(false)
        })
    } else if (open) {
      form.resetFields()
      form.setFieldsValue({
        output_format: "html",
        content: DEFAULT_TEMPLATE
      })
    }
  }, [open, template, form, t])

  // Handle save
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const payload: WatchlistTemplateCreate = {
        name: values.name,
        description: values.description || null,
        content: values.content,
        output_format: values.output_format
      }

      await createWatchlistTemplate(payload)
      message.success(
        isEditing
          ? t("watchlists:templates.updated", "Template updated")
          : t("watchlists:templates.created", "Template created")
      )
      onClose(true)
    } catch (err: any) {
      if (err.errorFields) return // Validation error
      console.error("Failed to save template:", err)
      message.error(t("watchlists:templates.saveError", "Failed to save template"))
    } finally {
      setSaving(false)
    }
  }

  const tabItems = [
    {
      key: "editor",
      label: t("watchlists:templates.editor.tab", "Editor"),
      children: (
        <Form.Item
          name="content"
          rules={[{ required: true, message: t("watchlists:templates.contentRequired", "Template content is required") }]}
          className="mb-0"
        >
          <Input.TextArea
            rows={18}
            placeholder={t("watchlists:templates.contentPlaceholder", "Enter Jinja2 template...")}
            className="font-mono text-sm"
            style={{ resize: "none" }}
          />
        </Form.Item>
      )
    },
    {
      key: "docs",
      label: t("watchlists:templates.docs.tab", "Variables"),
      children: (
        <div className="space-y-4 text-sm">
          <Alert
            message={t("watchlists:templates.docs.title", "Available Variables")}
            description={t("watchlists:templates.docs.description", "These variables are available in your Jinja2 template.")}
            type="info"
            showIcon
          />
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 font-mono text-xs space-y-2 max-h-80 overflow-auto">
            <div><span className="text-blue-600">{"{{ job }}"}</span> - Job object with name, description, filters</div>
            <div><span className="text-blue-600">{"{{ run }}"}</span> - Run object with status, stats, timestamps</div>
            <div><span className="text-blue-600">{"{{ items }}"}</span> - List of scraped items</div>
            <div className="ml-4"><span className="text-green-600">item.title</span> - Item title</div>
            <div className="ml-4"><span className="text-green-600">item.url</span> - Source URL</div>
            <div className="ml-4"><span className="text-green-600">item.content</span> - Full content text</div>
            <div className="ml-4"><span className="text-green-600">item.summary</span> - AI-generated summary</div>
            <div className="ml-4"><span className="text-green-600">item.author</span> - Author name</div>
            <div className="ml-4"><span className="text-green-600">item.published_at</span> - Publish date</div>
            <div className="ml-4"><span className="text-green-600">item.source</span> - Source object</div>
            <div className="ml-4"><span className="text-green-600">item.filter_matches</span> - Matched filter names</div>
            <div><span className="text-blue-600">{"{{ filter_tallies }}"}</span> - Dict of filter name → count</div>
            <div><span className="text-blue-600">{"{{ generated_at }}"}</span> - Generation timestamp</div>
          </div>

          <div className="text-zinc-500 text-xs">
            {t("watchlists:templates.docs.hint", "Use Jinja2 syntax: {% for item in items %}, {{ item.title }}, {% if condition %}, etc.")}
          </div>
        </div>
      )
    }
  ]

  return (
    <Modal
      title={
        isEditing
          ? t("watchlists:templates.editTitle", "Edit Template")
          : t("watchlists:templates.createTitle", "Create Template")
      }
      open={open}
      onCancel={() => onClose()}
      width={800}
      footer={
        <Space>
          <Button onClick={() => onClose()}>
            {t("common:cancel", "Cancel")}
          </Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t("common:save", "Save")}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" className="mt-4">
        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="name"
            label={t("watchlists:templates.fields.name", "Template Name")}
            rules={[{ required: true, message: t("watchlists:templates.nameRequired", "Name is required") }]}
          >
            <Input
              placeholder={t("watchlists:templates.namePlaceholder", "my-briefing-template")}
              disabled={isEditing}
            />
          </Form.Item>

          <Form.Item
            name="output_format"
            label={t("watchlists:templates.fields.format", "Output Format")}
          >
            <Radio.Group>
              <Radio value="html">HTML</Radio>
              <Radio value="markdown">Markdown</Radio>
            </Radio.Group>
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label={t("watchlists:templates.fields.description", "Description")}
        >
          <Input
            placeholder={t("watchlists:templates.descriptionPlaceholder", "Optional description...")}
          />
        </Form.Item>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "editor" | "docs")}
          items={tabItems}
        />
      </Form>
    </Modal>
  )
}

// Default template for new templates
const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <title>{{ job.name }} - {{ generated_at }}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    .item { margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 8px; }
    .item-title { font-size: 1.1em; font-weight: 600; margin-bottom: 8px; }
    .item-title a { color: #2563eb; text-decoration: none; }
    .item-meta { font-size: 0.85em; color: #666; margin-bottom: 8px; }
    .item-summary { line-height: 1.6; }
    .filters { display: flex; gap: 8px; margin-top: 8px; }
    .filter-tag { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{ job.name }}</h1>
    <p>Generated: {{ generated_at }} | Items: {{ items | length }}</p>
  </div>

  {% for item in items %}
  <div class="item">
    <div class="item-title">
      <a href="{{ item.url }}" target="_blank">{{ item.title }}</a>
    </div>
    <div class="item-meta">
      {% if item.author %}By {{ item.author }} | {% endif %}
      {{ item.published_at | default('Unknown date') }}
      {% if item.source %} | {{ item.source.name }}{% endif %}
    </div>
    {% if item.summary %}
    <div class="item-summary">{{ item.summary }}</div>
    {% endif %}
    {% if item.filter_matches %}
    <div class="filters">
      {% for filter in item.filter_matches %}
      <span class="filter-tag">{{ filter }}</span>
      {% endfor %}
    </div>
    {% endif %}
  </div>
  {% endfor %}
</body>
</html>`
