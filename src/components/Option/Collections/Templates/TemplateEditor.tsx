import React, { useCallback, useState } from "react"
import { Button, Form, Input, Modal, Select, message } from "antd"
import { FileText } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { TemplateType, TemplateFormat } from "@/types/collections"

const { TextArea } = Input

const TEMPLATE_TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: "newsletter_markdown", label: "Newsletter (Markdown)" },
  { value: "briefing_markdown", label: "Briefing (Markdown)" },
  { value: "mece_markdown", label: "MECE Analysis (Markdown)" },
  { value: "newsletter_html", label: "Newsletter (HTML)" },
  { value: "tts_audio", label: "TTS Audio Script" }
]

const FORMAT_OPTIONS: { value: TemplateFormat; label: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "mp3", label: "MP3 (Audio)" }
]

interface FormValues {
  name: string
  description?: string
  template_type: TemplateType
  format: TemplateFormat
  body: string
}

interface TemplateEditorProps {
  onSuccess?: () => void
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ onSuccess }) => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()
  const [form] = Form.useForm<FormValues>()

  const templateEditorOpen = useCollectionsStore((s) => s.templateEditorOpen)
  const editingTemplate = useCollectionsStore((s) => s.editingTemplate)
  const closeTemplateEditor = useCollectionsStore((s) => s.closeTemplateEditor)
  const addTemplate = useCollectionsStore((s) => s.addTemplate)
  const updateTemplateInList = useCollectionsStore((s) => s.updateTemplateInList)

  const [loading, setLoading] = useState(false)

  const isEditing = !!editingTemplate?.id

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      if (isEditing && editingTemplate?.id) {
        // Update existing template
        const updated = await api.updateOutputTemplate(editingTemplate.id, {
          name: values.name,
          description: values.description,
          body: values.body
        })
        updateTemplateInList(editingTemplate.id, updated)
        message.success(t("collections:templates.updated", "Template updated"))
      } else {
        // Create new template
        const newTemplate = await api.createOutputTemplate({
          name: values.name,
          description: values.description,
          template_type: values.template_type,
          format: values.format,
          body: values.body
        })
        addTemplate(newTemplate)
        message.success(t("collections:templates.created", "Template created"))
      }

      closeTemplateEditor()
      onSuccess?.()
    } catch (error: any) {
      if (error?.errorFields) {
        return
      }
      message.error(error?.message || "Failed to save template")
    } finally {
      setLoading(false)
    }
  }, [
    api,
    form,
    isEditing,
    editingTemplate,
    addTemplate,
    updateTemplateInList,
    closeTemplateEditor,
    onSuccess,
    t
  ])

  const handleCancel = useCallback(() => {
    form.resetFields()
    closeTemplateEditor()
  }, [form, closeTemplateEditor])

  // Default template body examples
  const getDefaultBody = (type: TemplateType): string => {
    const templates: Record<TemplateType, string> = {
      newsletter_markdown: `# Weekly Reading Digest

{% for item in items %}
## {{ item.title }}
*{{ item.domain }} | {{ item.reading_time_minutes }} min read*

{{ item.summary or item.excerpt }}

[Read more]({{ item.url }})

---
{% endfor %}

*Generated on {{ now.strftime('%B %d, %Y') }}*`,

      briefing_markdown: `# Reading Briefing

## Summary
{{ items | length }} articles reviewed.

## Key Takeaways
{% for item in items %}
- **{{ item.title }}**: {{ item.summary or 'No summary available' }}
{% endfor %}

## Sources
{% for item in items %}
- [{{ item.title }}]({{ item.url }})
{% endfor %}`,

      mece_markdown: `# MECE Analysis

## Categories
{% for category, category_items in items | groupby('tags[0]') %}
### {{ category or 'Uncategorized' }}
{% for item in category_items %}
- {{ item.title }}
{% endfor %}
{% endfor %}`,

      newsletter_html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; }
    .item { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #eee; }
    .title { font-size: 18px; font-weight: 600; }
    .meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Weekly Reading Digest</h1>
  {% for item in items %}
  <div class="item">
    <div class="title">{{ item.title }}</div>
    <div class="meta">{{ item.domain }} | {{ item.reading_time_minutes }} min read</div>
    <p>{{ item.summary or item.excerpt }}</p>
    <a href="{{ item.url }}">Read more</a>
  </div>
  {% endfor %}
</body>
</html>`,

      tts_audio: `Reading Digest for {{ now.strftime('%B %d, %Y') }}.

{% for item in items %}
Article {{ loop.index }}: {{ item.title }}.
From {{ item.domain }}.

{{ item.summary or item.excerpt }}

{% endfor %}

This concludes today's reading digest.`
    }
    return templates[type]
  }

  const handleTypeChange = (type: TemplateType) => {
    // Auto-set format based on type
    let format: TemplateFormat = "markdown"
    if (type === "newsletter_html") format = "html"
    else if (type === "tts_audio") format = "mp3"

    form.setFieldsValue({
      template_type: type,
      format,
      body: getDefaultBody(type)
    })
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {isEditing
            ? t("collections:templates.editTitle", "Edit Template")
            : t("collections:templates.createTitle", "Create Template")}
        </span>
      }
      open={templateEditorOpen}
      onCancel={handleCancel}
      width={720}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          {t("common:cancel", "Cancel")}
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} loading={loading}>
          {isEditing ? t("common:save", "Save") : t("common:create", "Create")}
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={
          editingTemplate
            ? {
                name: editingTemplate.name,
                description: editingTemplate.description,
                template_type: editingTemplate.template_type,
                format: editingTemplate.format,
                body: editingTemplate.body
              }
            : {
                template_type: "newsletter_markdown",
                format: "markdown",
                body: getDefaultBody("newsletter_markdown")
              }
        }
      >
        <Form.Item
          name="name"
          label={t("collections:templates.nameLabel", "Template Name")}
          rules={[
            {
              required: true,
              message: t("collections:templates.nameRequired", "Please enter a name")
            }
          ]}
        >
          <Input placeholder={t("collections:templates.namePlaceholder", "My Newsletter Template")} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t("collections:templates.descriptionLabel", "Description (optional)")}
        >
          <Input
            placeholder={t(
              "collections:templates.descriptionPlaceholder",
              "Brief description of this template"
            )}
          />
        </Form.Item>

        <div className="flex gap-4">
          <Form.Item
            name="template_type"
            label={t("collections:templates.typeLabel", "Template Type")}
            className="flex-1"
            rules={[{ required: true }]}
          >
            <Select
              options={TEMPLATE_TYPE_OPTIONS.map((opt) => ({
                ...opt,
                label: t(`collections:templateTypes.${opt.value}`, opt.label)
              }))}
              onChange={handleTypeChange}
              disabled={isEditing}
            />
          </Form.Item>

          <Form.Item
            name="format"
            label={t("collections:templates.formatLabel", "Output Format")}
            className="w-36"
            rules={[{ required: true }]}
          >
            <Select options={FORMAT_OPTIONS} disabled={isEditing} />
          </Form.Item>
        </div>

        <Form.Item
          name="body"
          label={t("collections:templates.bodyLabel", "Template Body (Jinja2)")}
          rules={[
            {
              required: true,
              message: t("collections:templates.bodyRequired", "Please enter template content")
            }
          ]}
          extra={
            <span className="text-xs text-zinc-500">
              {t(
                "collections:templates.bodyHint",
                "Use Jinja2 syntax. Available variables: items (array of reading items), now (current datetime)"
              )}
            </span>
          }
        >
          <TextArea
            rows={12}
            className="font-mono text-sm"
            placeholder="{% for item in items %}..."
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
