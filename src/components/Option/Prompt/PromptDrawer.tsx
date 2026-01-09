import React from "react"
import { Button, Drawer, Form, Input, Select } from "antd"
import { useTranslation } from "react-i18next"

interface PromptDrawerProps {
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  initialValues?: {
    name?: string
    author?: string
    details?: string
    system_prompt?: string
    user_prompt?: string
    keywords?: string[]
  }
  onSubmit: (values: any) => void
  isLoading: boolean
  allTags: string[]
}

export const PromptDrawer: React.FC<PromptDrawerProps> = ({
  open,
  onClose,
  mode,
  initialValues,
  onSubmit,
  isLoading,
  allTags
}) => {
  const { t } = useTranslation(["settings", "common"])
  const [form] = Form.useForm()

  React.useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue(initialValues)
    }
    if (open && mode === "create") {
      form.resetFields()
    }
  }, [open, initialValues, mode, form])

  const handleFinish = (values: any) => {
    onSubmit(values)
  }

  const title =
    mode === "create"
      ? t("managePrompts.modal.addTitle")
      : t("managePrompts.modal.editTitle")

  return (
    <Drawer
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>
            {t("common:cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="primary"
            loading={isLoading}
            onClick={() => form.submit()}
          >
            {isLoading
              ? t("managePrompts.form.btnSave.saving")
              : t("managePrompts.form.btnSave.save")}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ keywords: [] }}
      >
        {/* Section: Identity */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-muted mb-3">
            {t("managePrompts.drawer.sectionIdentity", { defaultValue: "Identity" })}
          </h3>
          <div className="space-y-4">
            <Form.Item
              name="name"
              label={t("managePrompts.form.title.label")}
              rules={[
                {
                  required: true,
                  message: t("managePrompts.form.title.required")
                }
              ]}
            >
              <Input
                placeholder={t("managePrompts.form.title.placeholder")}
                data-testid="prompt-drawer-name"
              />
            </Form.Item>

            <Form.Item
              name="author"
              label={t("managePrompts.form.author.label", { defaultValue: "Author" })}
            >
              <Input
                placeholder={t("managePrompts.form.author.placeholder", {
                  defaultValue: "Optional author"
                })}
                data-testid="prompt-drawer-author"
              />
            </Form.Item>
          </div>
        </div>

        {/* Section: Prompt Content */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-muted mb-3">
            {t("managePrompts.drawer.sectionContent", { defaultValue: "Prompt Content" })}
          </h3>
          <div className="space-y-4">
            <Form.Item
              name="system_prompt"
              label={t("managePrompts.form.systemPrompt.label", {
                defaultValue: "System prompt"
              })}
              help={t("managePrompts.form.systemPrompt.help", {
                defaultValue: "Sets the AI's behavior and persona. Sent as the system message."
              })}
            >
              <Input.TextArea
                placeholder={t("managePrompts.form.systemPrompt.placeholder", {
                  defaultValue: "Optional system prompt sent as the system message"
                })}
                autoSize={{ minRows: 3, maxRows: 10 }}
                data-testid="prompt-drawer-system"
              />
            </Form.Item>

            <Form.Item
              name="user_prompt"
              label={t("managePrompts.form.userPrompt.label", {
                defaultValue: "User prompt"
              })}
              help={t("managePrompts.form.userPrompt.help", {
                defaultValue: "Template inserted as the user message when using this prompt."
              })}
            >
              <Input.TextArea
                placeholder={t("managePrompts.form.userPrompt.placeholder", {
                  defaultValue: "Optional user prompt template"
                })}
                autoSize={{ minRows: 3, maxRows: 10 }}
                data-testid="prompt-drawer-user"
              />
            </Form.Item>
          </div>
        </div>

        {/* Section: Organization */}
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">
            {t("managePrompts.drawer.sectionOrganization", { defaultValue: "Organization" })}
          </h3>
          <div className="space-y-4">
            <Form.Item
              name="keywords"
              label={t("managePrompts.tags.label", { defaultValue: "Keywords" })}
            >
              <Select
                mode="tags"
                allowClear
                placeholder={t("managePrompts.tags.placeholder", {
                  defaultValue: "Add keywords"
                })}
                options={allTags.map((tag) => ({ label: tag, value: tag }))}
                data-testid="prompt-drawer-keywords"
              />
            </Form.Item>

            <Form.Item
              name="details"
              label={t("managePrompts.form.details.label", {
                defaultValue: "Notes"
              })}
            >
              <Input.TextArea
                placeholder={t("managePrompts.form.details.placeholder", {
                  defaultValue: "Add context or usage notes"
                })}
                autoSize={{ minRows: 2, maxRows: 6 }}
                data-testid="prompt-drawer-details"
              />
            </Form.Item>
          </div>
        </div>
      </Form>
    </Drawer>
  )
}
