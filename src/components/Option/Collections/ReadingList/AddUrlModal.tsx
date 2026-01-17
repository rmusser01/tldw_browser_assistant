import React, { useCallback, useState } from "react"
import { Button, Form, Input, Modal, message } from "antd"
import { Link, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import { TagSelector } from "../common/TagSelector"

const { TextArea } = Input

interface AddUrlModalProps {
  onSuccess?: () => void
}

interface FormValues {
  url: string
  title?: string
  tags?: string[]
  notes?: string
}

export const AddUrlModal: React.FC<AddUrlModalProps> = ({ onSuccess }) => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()
  const [form] = Form.useForm<FormValues>()

  const addUrlModalOpen = useCollectionsStore((s) => s.addUrlModalOpen)
  const closeAddUrlModal = useCollectionsStore((s) => s.closeAddUrlModal)
  const addItem = useCollectionsStore((s) => s.addItem)

  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const newItem = await api.addReadingItem({
        url: values.url,
        title: values.title,
        tags,
        notes: values.notes
      })

      addItem({
        id: newItem.id,
        url: newItem.url,
        title: newItem.title,
        domain: newItem.domain,
        excerpt: newItem.excerpt,
        status: newItem.status,
        is_favorite: newItem.is_favorite,
        tags: newItem.tags,
        reading_time_minutes: newItem.reading_time_minutes,
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      })

      message.success(
        t("collections:reading.addSuccess", "Article added to reading list")
      )
      form.resetFields()
      setTags([])
      closeAddUrlModal()
      onSuccess?.()
    } catch (error: any) {
      if (error?.errorFields) {
        // Form validation error
        return
      }
      message.error(error?.message || "Failed to add article")
    } finally {
      setLoading(false)
    }
  }, [api, form, tags, addItem, closeAddUrlModal, onSuccess, t])

  const handleCancel = useCallback(() => {
    form.resetFields()
    setTags([])
    closeAddUrlModal()
  }, [form, closeAddUrlModal])

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          {t("collections:reading.addUrlTitle", "Add to Reading List")}
        </span>
      }
      open={addUrlModalOpen}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          {t("common:cancel", "Cancel")}
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={loading}
        >
          {t("collections:reading.saveToList", "Save to List")}
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="url"
          label={t("collections:reading.urlLabel", "URL")}
          rules={[
            {
              required: true,
              message: t("collections:reading.urlRequired", "Please enter a URL")
            },
            {
              validator: (_, value) => {
                if (!value || isValidUrl(value)) {
                  return Promise.resolve()
                }
                return Promise.reject(
                  t("collections:reading.urlInvalid", "Please enter a valid URL")
                )
              }
            }
          ]}
        >
          <Input
            prefix={<Link className="h-4 w-4 text-gray-400" />}
            placeholder="https://example.com/article"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          name="title"
          label={t("collections:reading.titleLabel", "Title (optional)")}
          extra={t(
            "collections:reading.titleHint",
            "Leave blank to auto-detect from the page"
          )}
        >
          <Input
            placeholder={t(
              "collections:reading.titlePlaceholder",
              "Article title"
            )}
          />
        </Form.Item>

        <Form.Item label={t("collections:reading.tagsLabel", "Tags")}>
          <TagSelector
            tags={tags}
            onChange={setTags}
            placeholder={t("collections:reading.tagsPlaceholder", "Add tags...")}
          />
        </Form.Item>

        <Form.Item
          name="notes"
          label={t("collections:reading.notesLabel", "Notes (optional)")}
        >
          <TextArea
            rows={3}
            placeholder={t(
              "collections:reading.notesPlaceholder",
              "Add any notes about this article..."
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
