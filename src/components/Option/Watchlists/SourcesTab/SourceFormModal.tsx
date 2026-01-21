import React, { useEffect } from "react"
import { Form, Input, Modal, Select } from "antd"
import { useTranslation } from "react-i18next"
import type { WatchlistSource, SourceType } from "@/types/watchlists"

interface SourceFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: {
    name: string
    url: string
    source_type: SourceType
    tags: string[]
  }) => Promise<void>
  initialValues?: WatchlistSource
  existingTags: string[]
}

export const SourceFormModal: React.FC<SourceFormModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  existingTags
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)

  const isEditing = !!initialValues

  // Reset form when modal opens/closes or initialValues change
  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
          name: initialValues.name,
          url: initialValues.url,
          source_type: initialValues.source_type,
          tags: initialValues.tags
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          source_type: "rss",
          tags: []
        })
      }
    }
  }, [open, initialValues, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await onSubmit(values)
      form.resetFields()
    } catch (err) {
      // Validation error or submit error - handled by parent
      console.error("Form submit error:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={
        isEditing
          ? t("watchlists:sources.editSource", "Edit Source")
          : t("watchlists:sources.addSource", "Add Source")
      }
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={
        isEditing
          ? t("common:save", "Save")
          : t("common:create", "Create")
      }
      cancelText={t("common:cancel", "Cancel")}
      confirmLoading={submitting}
      destroyOnHidden
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{
          source_type: "rss",
          tags: []
        }}
      >
        <Form.Item
          name="name"
          label={t("watchlists:sources.form.name", "Name")}
          rules={[
            {
              required: true,
              message: t("watchlists:sources.form.nameRequired", "Please enter a name")
            },
            {
              max: 200,
              message: t(
                "watchlists:sources.form.nameTooLong",
                "Name must be less than 200 characters"
              )
            }
          ]}
        >
          <Input
            placeholder={t(
              "watchlists:sources.form.namePlaceholder",
              "e.g., Tech News Daily"
            )}
          />
        </Form.Item>

        <Form.Item
          name="url"
          label={t("watchlists:sources.form.url", "URL")}
          rules={[
            {
              required: true,
              message: t("watchlists:sources.form.urlRequired", "Please enter a URL")
            },
            {
              type: "url",
              message: t("watchlists:sources.form.urlInvalid", "Please enter a valid URL")
            }
          ]}
        >
          <Input
            placeholder={t(
              "watchlists:sources.form.urlPlaceholder",
              "e.g., https://example.com/feed.xml"
            )}
          />
        </Form.Item>

        <Form.Item
          name="source_type"
          label={t("watchlists:sources.form.type", "Type")}
          rules={[
            {
              required: true,
              message: t("watchlists:sources.form.typeRequired", "Please select a type")
            }
          ]}
        >
          <Select
            options={[
              {
                label: t("watchlists:sources.types.rss", "RSS Feed"),
                value: "rss"
              },
              {
                label: t("watchlists:sources.types.site", "Website"),
                value: "site"
              },
              {
                label: t("watchlists:sources.types.forum", "Forum"),
                value: "forum",
                disabled: true // Forum support coming later
              }
            ]}
          />
        </Form.Item>

        <Form.Item
          name="tags"
          label={t("watchlists:sources.form.tags", "Tags")}
          extra={t(
            "watchlists:sources.form.tagsHelp",
            "Add tags to organize and filter your sources"
          )}
        >
          <Select
            mode="tags"
            placeholder={t(
              "watchlists:sources.form.tagsPlaceholder",
              "Add or select tags"
            )}
            options={existingTags.map((tag) => ({
              label: tag,
              value: tag
            }))}
            tokenSeparators={[","]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
