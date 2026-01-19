import React, { useState, useEffect } from "react"
import { Modal, Form, Input, Typography, Space, Button } from "antd"
import { useTranslation } from "react-i18next"
import { Save, BookOpen, User } from "lucide-react"
import { useAudiobookStudioStore } from "@/store/audiobook-studio"

const { Text } = Typography
const { TextArea } = Input

type ProjectMetadataFormProps = {
  open: boolean
  onClose: () => void
  onSave?: () => void
}

export const ProjectMetadataForm: React.FC<ProjectMetadataFormProps> = ({
  open,
  onClose,
  onSave
}) => {
  const { t } = useTranslation(["audiobook", "common"])
  const [form] = Form.useForm()

  const projectTitle = useAudiobookStudioStore((s) => s.projectTitle)
  const projectAuthor = useAudiobookStudioStore((s) => s.projectAuthor)
  const setProjectTitle = useAudiobookStudioStore((s) => s.setProjectTitle)
  const setProjectAuthor = useAudiobookStudioStore((s) => s.setProjectAuthor)

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        title: projectTitle,
        author: projectAuthor
      })
    }
  }, [open, projectTitle, projectAuthor, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setProjectTitle(values.title.trim())
      setProjectAuthor(values.author?.trim() || "")
      onSave?.()
      onClose()
    } catch (err) {
      // Validation failed
    }
  }

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {t("audiobook:metadata.title", "Project Details")}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>
            {t("common:cancel", "Cancel")}
          </Button>
          <Button
            type="primary"
            icon={<Save className="h-4 w-4" />}
            onClick={handleSubmit}
          >
            {t("common:save", "Save")}
          </Button>
        </Space>
      }
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        className="py-4"
        initialValues={{
          title: projectTitle,
          author: projectAuthor
        }}
      >
        <Form.Item
          name="title"
          label={t("audiobook:metadata.titleLabel", "Audiobook Title")}
          rules={[
            {
              required: true,
              message: t(
                "audiobook:metadata.titleRequired",
                "Please enter a title"
              )
            }
          ]}
        >
          <Input
            placeholder={t(
              "audiobook:metadata.titlePlaceholder",
              "My Audiobook"
            )}
            prefix={<BookOpen className="h-4 w-4 text-text-muted" />}
          />
        </Form.Item>

        <Form.Item
          name="author"
          label={t("audiobook:metadata.authorLabel", "Author")}
        >
          <Input
            placeholder={t(
              "audiobook:metadata.authorPlaceholder",
              "Author name (optional)"
            )}
            prefix={<User className="h-4 w-4 text-text-muted" />}
          />
        </Form.Item>

        <Text type="secondary" className="text-xs">
          {t(
            "audiobook:metadata.hint",
            "These details will be used when exporting your audiobook."
          )}
        </Text>
      </Form>
    </Modal>
  )
}

export default ProjectMetadataForm
