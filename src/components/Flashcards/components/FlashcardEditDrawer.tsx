import React from "react"
import {
  Button,
  Collapse,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import { useDebouncedFormField } from "../hooks"
import { normalizeFlashcardTemplateFields } from "../utils/template-helpers"
import { MarkdownWithBoundary } from "./MarkdownWithBoundary"
import type { Flashcard, FlashcardUpdate, Deck } from "@/services/flashcards"

const { Text } = Typography

type FlashcardModelType = Flashcard["model_type"]

interface FlashcardEditDrawerProps {
  open: boolean
  onClose: () => void
  card: Flashcard | null
  onSave: (values: FlashcardUpdate) => void
  onDelete: () => void
  isLoading?: boolean
  decks: Deck[]
  decksLoading?: boolean
}

export const FlashcardEditDrawer: React.FC<FlashcardEditDrawerProps> = ({
  open,
  onClose,
  card,
  onSave,
  onDelete,
  isLoading = false,
  decks,
  decksLoading = false
}) => {
  const { t } = useTranslation(["option", "common"])
  const [form] = Form.useForm<FlashcardUpdate & { tags_text?: string[] }>()
  const [showPreview, setShowPreview] = React.useState(false)
  const [isDirty, setIsDirty] = React.useState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = React.useState(false)

  const frontPreview = useDebouncedFormField(form, "front")
  const backPreview = useDebouncedFormField(form, "back")
  const extraPreview = useDebouncedFormField(form, "extra")
  const notesPreview = useDebouncedFormField(form, "notes")

  const previewLabel = t("option:flashcards.preview", { defaultValue: "Preview" })
  const markdownSupportHint = t("option:flashcards.markdownSupportHint", {
    defaultValue: "Supports Markdown and LaTeX."
  })

  // Sync form with card data when card changes
  React.useEffect(() => {
    if (card && open) {
      form.setFieldsValue({
        deck_id: card.deck_id ?? undefined,
        front: card.front,
        back: card.back,
        notes: card.notes || undefined,
        extra: card.extra || undefined,
        tags: card.tags || undefined,
        model_type: card.model_type,
        expected_version: card.version
      })
      setIsDirty(false)
    }
  }, [card, open, form])

  // Track form changes
  const handleFormChange = React.useCallback(() => {
    setIsDirty(true)
  }, [])

  const syncTemplateFields = React.useCallback(
    (partial: Partial<Pick<FlashcardUpdate, "model_type" | "reverse" | "is_cloze">>) => {
      const normalized = normalizeFlashcardTemplateFields(partial)
      form.setFieldsValue({
        model_type: normalized.model_type,
        reverse: normalized.reverse,
        is_cloze: normalized.is_cloze
      })
    },
    [form]
  )

  const handleSave = async () => {
    try {
      const values = normalizeFlashcardTemplateFields(
        (await form.validateFields()) as FlashcardUpdate
      )
      onSave(values)
    } catch (e: any) {
      // Validation errors handled by form
      if (!e?.errorFields) {
        console.error("Save error:", e)
      }
    }
  }

  const handleAttemptClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true)
    } else {
      handleClose()
    }
  }

  const handleClose = () => {
    form.resetFields()
    setIsDirty(false)
    setConfirmCloseOpen(false)
    onClose()
  }

  return (
    <>
    <Drawer
      placement="right"
      width={520}
      open={open}
      onClose={handleAttemptClose}
      title={t("option:flashcards.editCard", { defaultValue: "Edit Flashcard" })}
      footer={
        <div className="flex justify-between">
          <Button danger onClick={onDelete}>
            {t("common:delete", { defaultValue: "Delete" })}
          </Button>
          <Space>
            <Button onClick={handleAttemptClose}>
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="primary" loading={isLoading} onClick={handleSave}>
              {t("common:save", { defaultValue: "Save" })}
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
        {/* Section: Organization */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-muted mb-3">
            {t("option:flashcards.organization", { defaultValue: "Organization" })}
          </h3>
          <Form.Item
            name="deck_id"
            label={t("option:flashcards.deck", { defaultValue: "Deck" })}
          >
            <Select
              allowClear
              loading={decksLoading}
              placeholder={t("option:flashcards.selectDeck", {
                defaultValue: "Select deck"
              })}
              options={decks.map((d) => ({
                label: d.name,
                value: d.id
              }))}
            />
          </Form.Item>
          <Form.Item
            name="model_type"
            label={t("option:flashcards.modelType", {
              defaultValue: "Card template"
            })}
          >
            <Select
              options={[
                {
                  label: t("option:flashcards.templateBasic", {
                    defaultValue: "Basic (Question - Answer)"
                  }),
                  value: "basic"
                },
                {
                  label: t("option:flashcards.templateReverse", {
                    defaultValue: "Basic + Reverse (Both directions)"
                  }),
                  value: "basic_reverse"
                },
                {
                  label: t("option:flashcards.templateCloze", {
                    defaultValue: "Cloze (Fill in the blank)"
                  }),
                  value: "cloze"
                }
              ]}
              onChange={(value: FlashcardModelType) => {
                syncTemplateFields({ model_type: value })
              }}
            />
          </Form.Item>
          <Form.Item
            name="tags"
            label={t("option:flashcards.tags", { defaultValue: "Tags" })}
          >
            <Select
              mode="tags"
              open={false}
              allowClear
              placeholder={t("option:flashcards.tagsPlaceholder", {
                defaultValue: "Add tags..."
              })}
            />
          </Form.Item>
        </div>

        {/* Section: Content */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-muted">
              {t("option:flashcards.content", { defaultValue: "Content" })}
            </h3>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview
                ? t("option:flashcards.hidePreview", { defaultValue: "Hide preview" })
                : t("option:flashcards.showPreview", { defaultValue: "Show preview" })}
            </button>
          </div>
          <Form.Item
            name="front"
            label={t("option:flashcards.front", { defaultValue: "Front" })}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Text type="secondary" className="block text-[11px] -mt-4 mb-3">
            {markdownSupportHint}
          </Text>
          {showPreview && frontPreview && (
            <div className="mb-4 border rounded p-2 text-xs bg-surface">
              <Text type="secondary" className="block text-[11px] mb-1">
                {previewLabel}
              </Text>
              <MarkdownWithBoundary content={frontPreview || ""} size="xs" />
            </div>
          )}

          <Form.Item
            name="back"
            label={t("option:flashcards.back", { defaultValue: "Back" })}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={5} />
          </Form.Item>
          <Text type="secondary" className="block text-[11px] -mt-4 mb-3">
            {markdownSupportHint}
          </Text>
          {showPreview && backPreview && (
            <div className="mb-4 border rounded p-2 text-xs bg-surface">
              <Text type="secondary" className="block text-[11px] mb-1">
                {previewLabel}
              </Text>
              <MarkdownWithBoundary content={backPreview || ""} size="xs" />
            </div>
          )}
        </div>

        {/* Section: Additional (collapsed) */}
        <Collapse ghost>
          <Collapse.Panel
            header={t("option:flashcards.additionalFields", {
              defaultValue: "Additional fields"
            })}
            key="additional"
          >
            <Form.Item
              name="extra"
              label={t("option:flashcards.extra", { defaultValue: "Extra" })}
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            {showPreview && extraPreview && (
              <div className="mb-4 border rounded p-2 text-xs bg-surface">
                <MarkdownWithBoundary content={extraPreview || ""} size="xs" />
              </div>
            )}
            <Form.Item
              name="notes"
              label={t("option:flashcards.notes", { defaultValue: "Notes" })}
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            {showPreview && notesPreview && (
              <div className="mb-4 border rounded p-2 text-xs bg-surface">
                <MarkdownWithBoundary content={notesPreview || ""} size="xs" />
              </div>
            )}
          </Collapse.Panel>
        </Collapse>

        {/* Hidden fields */}
        <Form.Item name="expected_version" hidden>
          <Input type="number" />
        </Form.Item>
        <Form.Item name="reverse" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="is_cloze" hidden>
          <Input />
        </Form.Item>
      </Form>
    </Drawer>

    {/* Confirmation modal for unsaved changes */}
    <Modal
      open={confirmCloseOpen}
      title={t("option:flashcards.unsavedChangesTitle", {
        defaultValue: "Unsaved changes"
      })}
      onCancel={() => setConfirmCloseOpen(false)}
      footer={[
        <Button key="cancel" onClick={() => setConfirmCloseOpen(false)}>
          {t("common:cancel", { defaultValue: "Cancel" })}
        </Button>,
        <Button key="discard" danger onClick={handleClose}>
          {t("common:discard", { defaultValue: "Discard" })}
        </Button>
      ]}
    >
      <p>
        {t("option:flashcards.unsavedChangesDescription", {
          defaultValue: "You have unsaved changes. Are you sure you want to close?"
        })}
      </p>
    </Modal>
    </>
  )
}

export default FlashcardEditDrawer
