import React, { useState, useEffect } from "react"
import { Modal, Form, Input, Typography, Space, Button, Upload } from "antd"
import type { UploadProps } from "antd"
import { useTranslation } from "react-i18next"
import { Save, BookOpen, User, Image as ImageIcon } from "lucide-react"
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
  const projectDescription = useAudiobookStudioStore((s) => s.projectDescription)
  const projectCoverImageUrl = useAudiobookStudioStore(
    (s) => s.projectCoverImageUrl
  )
  const setProjectTitle = useAudiobookStudioStore((s) => s.setProjectTitle)
  const setProjectAuthor = useAudiobookStudioStore((s) => s.setProjectAuthor)
  const setProjectDescription = useAudiobookStudioStore(
    (s) => s.setProjectDescription
  )
  const setProjectCoverImageUrl = useAudiobookStudioStore(
    (s) => s.setProjectCoverImageUrl
  )

  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        title: projectTitle,
        author: projectAuthor,
        description: projectDescription
      })
      setCoverPreview(projectCoverImageUrl || null)
    }
  }, [open, projectTitle, projectAuthor, projectDescription, projectCoverImageUrl, form])

  const handleCoverUpload: UploadProps["beforeUpload"] = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      setCoverPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    return false
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setProjectTitle(values.title.trim())
      setProjectAuthor(values.author?.trim() || "")
      setProjectDescription(values.description?.trim() || "")
      setProjectCoverImageUrl(coverPreview)
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
          author: projectAuthor,
          description: projectDescription
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

        <Form.Item
          name="description"
          label={t("audiobook:metadata.descriptionLabel", "Description")}
        >
          <TextArea
            rows={3}
            placeholder={t(
              "audiobook:metadata.descriptionPlaceholder",
              "Short description (optional)"
            )}
          />
        </Form.Item>

        <div className="space-y-2">
          <Text type="secondary" className="text-xs block">
            {t("audiobook:metadata.coverLabel", "Cover image")}
          </Text>
          <div className="flex items-center gap-3">
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={handleCoverUpload}
            >
              <Button icon={<ImageIcon className="h-4 w-4" />}>
                {t("audiobook:metadata.coverUpload", "Upload cover")}
              </Button>
            </Upload>
            {coverPreview && (
              <Button
                type="text"
                onClick={() => setCoverPreview(null)}
              >
                {t("audiobook:metadata.coverRemove", "Remove cover")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {coverPreview ? (
              <img
                src={coverPreview}
                alt={t("audiobook:metadata.coverLabel", "Cover image")}
                className="h-20 w-20 rounded-md object-cover border border-border"
              />
            ) : (
              <div className="h-20 w-20 rounded-md border border-dashed border-border flex items-center justify-center text-text-muted text-xs">
                {t("audiobook:metadata.coverHint", "No cover uploaded")}
              </div>
            )}
          </div>
        </div>

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
