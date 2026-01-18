import React, { useCallback, useEffect, useState } from "react"
import { Button, Form, Input, Modal, Select, message } from "antd"
import { Highlighter } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { HighlightColor } from "@/types/collections"

const { TextArea } = Input

const COLOR_OPTIONS: { value: HighlightColor; labelKey: string }[] = [
  { value: "yellow", labelKey: "yellow" },
  { value: "green", labelKey: "green" },
  { value: "blue", labelKey: "blue" },
  { value: "pink", labelKey: "pink" },
  { value: "purple", labelKey: "purple" }
]

interface HighlightFormValues {
  quote: string
  note?: string
  color: HighlightColor
}

interface HighlightEditorProps {
  onSuccess?: () => void
}

export const HighlightEditor: React.FC<HighlightEditorProps> = ({ onSuccess }) => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()
  const [form] = Form.useForm<HighlightFormValues>()

  const highlightEditorOpen = useCollectionsStore((s) => s.highlightEditorOpen)
  const editingHighlight = useCollectionsStore((s) => s.editingHighlight)
  const closeHighlightEditor = useCollectionsStore((s) => s.closeHighlightEditor)
  const addHighlight = useCollectionsStore((s) => s.addHighlight)
  const updateHighlightInList = useCollectionsStore((s) => s.updateHighlightInList)

  const [loading, setLoading] = useState(false)

  const isEditing = Boolean(editingHighlight?.id)
  const readingItemId = editingHighlight?.item_id

  useEffect(() => {
    if (!highlightEditorOpen) return
    form.setFieldsValue({
      quote: editingHighlight?.quote || "",
      note: editingHighlight?.note || "",
      color: (editingHighlight?.color as HighlightColor) || "yellow"
    })
  }, [highlightEditorOpen, editingHighlight, form])

  const handleCancel = useCallback(() => {
    form.resetFields()
    closeHighlightEditor()
  }, [form, closeHighlightEditor])

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      if (isEditing && editingHighlight?.id) {
        const updated = await api.updateHighlight(editingHighlight.id, {
          note: values.note,
          color: values.color
        })
        updateHighlightInList(editingHighlight.id, updated)
        message.success(t("collections:highlights.updated", "Highlight updated"))
      } else {
        if (!readingItemId) {
          message.error(t("collections:highlights.missingItem", "Select an article first"))
          return
        }
        const created = await api.createHighlight({
          item_id: readingItemId,
          quote: values.quote,
          note: values.note,
          color: values.color
        })
        addHighlight(created)
        message.success(t("collections:highlights.created", "Highlight created"))
      }

      handleCancel()
      onSuccess?.()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.message || "Failed to save highlight")
    } finally {
      setLoading(false)
    }
  }, [
    api,
    form,
    isEditing,
    editingHighlight,
    readingItemId,
    addHighlight,
    updateHighlightInList,
    handleCancel,
    onSuccess,
    t
  ])

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Highlighter className="h-5 w-5" />
          {isEditing
            ? t("collections:highlights.edit", "Edit Highlight")
            : t("collections:highlights.add", "Add Highlight")}
        </span>
      }
      open={highlightEditorOpen}
      onCancel={handleCancel}
      width={560}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          {t("common:cancel", "Cancel")}
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} loading={loading}>
          {isEditing ? t("common:save", "Save") : t("common:create", "Create")}
        </Button>
      ]}
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="quote"
          label={t("collections:highlights.quoteLabel", "Quote")}
          rules={[
            {
              required: true,
              message: t("collections:highlights.quoteRequired", "Please enter the highlight text")
            }
          ]}
        >
          <TextArea
            rows={3}
            placeholder={t(
              "collections:highlights.quotePlaceholder",
              "Paste the highlighted text..."
            )}
            disabled={isEditing}
          />
        </Form.Item>

        <Form.Item
          name="note"
          label={t("collections:highlights.noteLabel", "Note (optional)")}
        >
          <TextArea
            rows={3}
            placeholder={t(
              "collections:highlights.notePlaceholder",
              "Add context or why this matters..."
            )}
          />
        </Form.Item>

        <Form.Item
          name="color"
          label={t("collections:highlights.colorLabel", "Highlight color")}
          rules={[{ required: true }]}
        >
          <Select
            options={COLOR_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(`collections:colors.${opt.labelKey}`, opt.labelKey)
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
