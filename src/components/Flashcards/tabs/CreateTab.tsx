import React from "react"
import { Button, Collapse, Form, Input, Modal, Select, Space, Typography } from "antd"
import { useTranslation } from "react-i18next"
import { useAntdMessage } from "@/hooks/useAntdMessage"
import {
  useDecksQuery,
  useCreateFlashcardMutation,
  useCreateDeckMutation,
  useDebouncedFormField
} from "../hooks"
import { MarkdownWithBoundary } from "../components"
import { normalizeFlashcardTemplateFields } from "../utils/template-helpers"
import type { FlashcardCreate } from "@/services/flashcards"

const { Text, Title } = Typography

interface PreviewProps {
  content?: string
  showPreview: boolean
}

const Preview: React.FC<PreviewProps> = ({ content, showPreview }) => {
  const { t } = useTranslation(["option"])
  if (!showPreview || !content) return null
  return (
    <div className="mt-2 rounded border border-border bg-surface p-2 text-xs">
      <Text type="secondary" className="block text-[11px] mb-1">
        {t("flashcards.preview", { defaultValue: "Preview" })}
      </Text>
      <MarkdownWithBoundary content={content} size="xs" />
    </div>
  )
}

/**
 * Simplified Create tab for adding new flashcards.
 * - Core fields (deck, template, front, back) always visible
 * - Advanced options (tags, extra, notes) collapsed by default
 * - Single preview toggle for all fields
 */
export const CreateTab: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const message = useAntdMessage()

  // Form and state
  const [createForm] = Form.useForm<FlashcardCreate>()
  const [showPreview, setShowPreview] = React.useState(false)
  const createFrontPreview = useDebouncedFormField(createForm, "front")
  const createBackPreview = useDebouncedFormField(createForm, "back")
  const createExtraPreview = useDebouncedFormField(createForm, "extra")
  const createNotesPreview = useDebouncedFormField(createForm, "notes")

  // New deck modal state
  const [newDeckModalOpen, setNewDeckModalOpen] = React.useState(false)
  const [newDeckName, setNewDeckName] = React.useState("")
  const [newDeckDesc, setNewDeckDesc] = React.useState("")

  // Queries and mutations
  const decksQuery = useDecksQuery()
  const createMutation = useCreateFlashcardMutation()
  const createDeckMutation = useCreateDeckMutation()

  // Create new deck
  const handleCreateDeck = async () => {
    try {
      if (!newDeckName.trim()) {
        message.error(
          t("option:flashcards.newDeckNameRequired", {
            defaultValue: "Enter a deck name."
          })
        )
        return
      }
      const deck = await createDeckMutation.mutateAsync({
        name: newDeckName.trim(),
        description: newDeckDesc.trim() || undefined
      })
      message.success(t("common:created", { defaultValue: "Created" }))
      setNewDeckModalOpen(false)
      setNewDeckName("")
      setNewDeckDesc("")
      createForm.setFieldsValue({ deck_id: deck.id })
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to create deck"
      message.error(errorMessage)
    }
  }

  // Create flashcard
  const handleCreateFlashcard = async () => {
    try {
      const values = await createForm.validateFields()
      await createMutation.mutateAsync(normalizeFlashcardTemplateFields(values))
      message.success(t("common:created", { defaultValue: "Created" }))
      createForm.resetFields()
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) return // form validation
      const errorMessage = e instanceof Error ? e.message : "Create failed"
      message.error(errorMessage)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-3">
        <Title level={5}>
          {t("option:flashcards.createTitle", {
            defaultValue: "Create flashcards from your notes"
          })}
        </Title>
        <Text type="secondary">
          {t("option:flashcards.createDescriptionSimple", {
            defaultValue:
              "Fill in the front (question) and back (answer). Markdown and LaTeX are supported."
          })}
        </Text>
      </div>

      <Form
        form={createForm}
        layout="vertical"
        initialValues={{
          is_cloze: false,
          model_type: "basic",
          reverse: false
        }}
      >
        {/* Deck selector */}
        <Space align="end" className="mb-2">
          <Form.Item
            name="deck_id"
            label={t("option:flashcards.deck", { defaultValue: "Deck" })}
            className="!mb-0"
          >
            <Select
              placeholder={t("option:flashcards.selectDeck", {
                defaultValue: "Select deck"
              })}
              allowClear
              loading={decksQuery.isLoading}
              className="min-w-64"
              data-testid="flashcards-create-deck-select"
              options={(decksQuery.data || []).map((d) => ({
                label: d.name,
                value: d.id
              }))}
            />
          </Form.Item>
          <Button
            onClick={() => setNewDeckModalOpen(true)}
            data-testid="flashcards-create-new-deck"
          >
            {t("option:flashcards.newDeck", { defaultValue: "New Deck" })}
          </Button>
        </Space>

        {/* Card template - model_type handles reverse and cloze */}
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
          />
        </Form.Item>

        {/* Hidden fields for API compatibility */}
        <Form.Item name="reverse" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="is_cloze" hidden>
          <Input />
        </Form.Item>

        {/* Front - required */}
        <Form.Item
          name="front"
          label={t("option:flashcards.front", { defaultValue: "Front" })}
          rules={[{ required: true }]}
        >
          <Input.TextArea
            rows={3}
            placeholder={t("option:flashcards.frontPlaceholder", {
              defaultValue: "Question or prompt..."
            })}
            data-testid="flashcards-create-front"
          />
          <Preview content={createFrontPreview} showPreview={showPreview} />
        </Form.Item>

        {/* Back - required */}
        <Form.Item
          name="back"
          label={t("option:flashcards.back", { defaultValue: "Back" })}
          rules={[{ required: true }]}
        >
          <Input.TextArea
            rows={5}
            placeholder={t("option:flashcards.backPlaceholder", {
              defaultValue: "Answer..."
            })}
            data-testid="flashcards-create-back"
          />
          <Preview content={createBackPreview} showPreview={showPreview} />
        </Form.Item>

        {/* Preview toggle and help text */}
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
            className="text-xs text-primary hover:text-primaryStrong"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview
              ? t("option:flashcards.hidePreview", {
                  defaultValue: "Hide preview"
                })
              : t("option:flashcards.showPreview", {
                  defaultValue: "Show preview"
                })}
          </button>
          <Text type="secondary" className="text-xs">
            {t("option:flashcards.markdownHint", {
              defaultValue: "Supports Markdown and LaTeX ($x^2$, $$\\sum_{i=1}^n$$)"
            })}
          </Text>
        </div>

        {/* Advanced options - collapsed by default */}
        <Collapse
          ghost
          className="mb-4 -mx-4"
          items={[
            {
              key: "advanced",
              label: (
                <Text type="secondary">
                  {t("option:flashcards.advancedOptions", {
                    defaultValue: "Advanced options (tags, extra, notes)"
                  })}
                </Text>
              ),
              children: (
                <div className="space-y-4">
                  {/* Tags */}
                  <Form.Item
                    name="tags"
                    label={t("option:flashcards.tags", { defaultValue: "Tags" })}
                    className="!mb-0"
                  >
                    <Select
                      mode="tags"
                      placeholder={t("option:flashcards.tagsPlaceholder", {
                        defaultValue: "tag1, tag2"
                      })}
                      open={false}
                      allowClear
                    />
                  </Form.Item>

                  {/* Extra */}
                  <Form.Item
                    name="extra"
                    label={t("option:flashcards.extra", { defaultValue: "Extra" })}
                    className="!mb-0"
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder={t("option:flashcards.extraPlaceholder", {
                        defaultValue: "Optional hints or explanations..."
                      })}
                    />
                    <Preview content={createExtraPreview} showPreview={showPreview} />
                  </Form.Item>

                  {/* Notes */}
                  <Form.Item
                    name="notes"
                    label={t("option:flashcards.notes", { defaultValue: "Notes" })}
                    className="!mb-0"
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder={t("option:flashcards.notesPlaceholder", {
                        defaultValue: "Internal notes (not shown during review)..."
                      })}
                    />
                    <Preview content={createNotesPreview} showPreview={showPreview} />
                  </Form.Item>
                </div>
              )
            }
          ]}
        />

        {/* Action buttons */}
        <Space>
          <Button
            type="primary"
            onClick={handleCreateFlashcard}
            loading={createMutation.isPending}
            data-testid="flashcards-create-submit"
          >
            {t("common:create", { defaultValue: "Create" })}
          </Button>
          <Button onClick={() => createForm.resetFields()}>
            {t("common:reset", { defaultValue: "Reset" })}
          </Button>
        </Space>
      </Form>

      {/* New deck modal */}
      <Modal
        title={t("option:flashcards.newDeck", { defaultValue: "New Deck" })}
        open={newDeckModalOpen}
        onCancel={() => setNewDeckModalOpen(false)}
        onOk={handleCreateDeck}
        okText={t("common:create", { defaultValue: "Create" })}
        confirmLoading={createDeckMutation.isPending}
        okButtonProps={{
          disabled: !newDeckName.trim(),
          "data-testid": "flashcards-new-deck-submit"
        }}
      >
        <Space direction="vertical" className="w-full">
          <Input
            placeholder={t("option:flashcards.deckNamePlaceholder", {
              defaultValue: "Name"
            })}
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            data-testid="flashcards-new-deck-name"
          />
          <Input.TextArea
            placeholder={t("option:flashcards.deckDescriptionPlaceholder", {
              defaultValue: "Description (optional)"
            })}
            value={newDeckDesc}
            onChange={(e) => setNewDeckDesc(e.target.value)}
            data-testid="flashcards-new-deck-description"
          />
        </Space>
      </Modal>
    </div>
  )
}

export default CreateTab
