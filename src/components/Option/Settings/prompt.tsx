import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Skeleton, Radio, Form, Input, Alert, Modal } from "antd"
import React from "react"
import { useTranslation } from "react-i18next"
import { SaveButton } from "~/components/Common/SaveButton"
import {
  getWebSearchPrompt,
  geWebSearchFollowUpPrompt,
  setWebPrompts,
  promptForRag,
  setPromptForRag
} from "~/services/tldw-server"

export const SettingPrompt = () => {
  const { t } = useTranslation("settings")

  const [selectedValue, setSelectedValue] = React.useState<"web" | "rag">("rag")
  const [isDirty, setIsDirty] = React.useState(false)
  const [ragForm] = Form.useForm()
  const [webForm] = Form.useForm()

  const handleTabChange = (newTab: "web" | "rag") => {
    if (isDirty) {
      Modal.confirm({
        title: t("managePrompts.unsavedChangesTitle", "Unsaved Changes"),
        content: t("managePrompts.unsavedChangesContent", "You have unsaved changes. Are you sure you want to switch tabs? Your changes will be lost."),
        okText: t("common:discard", "Discard"),
        cancelText: t("common:cancel", "Cancel"),
        okButtonProps: { danger: true },
        onOk: () => {
          setIsDirty(false)
          // Reset BOTH forms to ensure clean state
          ragForm.resetFields()
          webForm.resetFields()
          // Refetch to ensure forms use latest server data
          queryClient.invalidateQueries({
            queryKey: ["fetchRagPrompt"]
          })
          setSelectedValue(newTab)
        }
      })
    } else {
      setSelectedValue(newTab)
    }
  }

  const queryClient = useQueryClient()

  const { status, data } = useQuery({
    queryKey: ["fetchRagPrompt"],
    queryFn: async () => {
      const [prompt, webSearchPrompt, webSearchFollowUpPrompt] =
        await Promise.all([
          promptForRag(),
          getWebSearchPrompt(),
          geWebSearchFollowUpPrompt()
        ])

      return {
        prompt,
        webSearchPrompt,
        webSearchFollowUpPrompt
      }
    }
  })

  return (
    <div className="flex flex-col gap-3">
      {status === "pending" && <Skeleton paragraph={{ rows: 4 }} active />}

      {status === "error" && (
        <Alert
          type="error"
          showIcon
          message={t("managePrompts.loadError", "Unable to load prompt settings")}
          description={t(
            "managePrompts.loadErrorHelp",
            "Connect to your tldw server, then refresh the page."
          )}
        />
      )}

      {status === "success" && (
        <div>
          <div className="my-3 flex justify-end">
            <Radio.Group
              value={selectedValue}
              onChange={(e) => handleTabChange(e.target.value)}>
              <Radio.Button value="rag">RAG</Radio.Button>
              <Radio.Button value="web">{t("rag.prompt.option2")}</Radio.Button>
            </Radio.Group>
          </div>

          {selectedValue === "rag" && (
            <Form
              form={ragForm}
              layout="vertical"
              onValuesChange={() => setIsDirty(true)}
              onFinish={(values) => {
                setPromptForRag(
                  values?.systemPrompt || "",
                  values?.questionPrompt || ""
                )
                setIsDirty(false)
                queryClient.invalidateQueries({
                  queryKey: ["fetchRagPrompt"]
                })
              }}
              initialValues={{
                systemPrompt: data.prompt.ragPrompt,
                questionPrompt: data.prompt.ragQuestionPrompt
              }}>
              <Form.Item
                label={t("managePrompts.systemPrompt")}
                name="systemPrompt"
                rules={[
                  {
                    required: true,
                    message: t("settings:prompts.enterPrompt", "Enter a prompt.")
                  }
                ]}>
                <Input.TextArea
                  rows={5}
                  placeholder={t(
                    "settings:prompts.enterPromptPlaceholder",
                    "Enter a prompt."
                  )}
                />
              </Form.Item>
              <Form.Item
                label={t("managePrompts.questionPrompt")}
                name="questionPrompt"
                rules={[
                  {
                    required: true,
                    message: t(
                      "settings:prompts.enterFollowUpPrompt",
                      "Enter a follow up prompt."
                    )
                  }
                ]}>
                <Input.TextArea
                  rows={5}
                  placeholder={t(
                    "settings:prompts.enterFollowUpPromptPlaceholder",
                    "Enter a follow up prompt."
                  )}
                />
              </Form.Item>
              <Form.Item>
                <div className="flex justify-end">
                  <SaveButton btnType="submit" />
                </div>{" "}
              </Form.Item>
            </Form>
          )}

          {selectedValue === "web" && (
            <Form
              form={webForm}
              layout="vertical"
              onValuesChange={() => setIsDirty(true)}
              onFinish={(values) => {
                setWebPrompts(
                  values?.webSearchPrompt || "",
                  values?.webSearchFollowUpPrompt || ""
                )
                setIsDirty(false)
                queryClient.invalidateQueries({
                  queryKey: ["fetchRagPrompt"]
                })
              }}
              initialValues={{
                webSearchPrompt: data.webSearchPrompt,
                webSearchFollowUpPrompt: data.webSearchFollowUpPrompt
              }}>
              <Form.Item
                label={t("rag.prompt.webSearchPrompt")}
                name="webSearchPrompt"
                help={t("rag.prompt.webSearchPromptHelp")}
                rules={[
                  {
                    required: true,
                    message: t("rag.prompt.webSearchPromptError")
                  }
                ]}>
                <Input.TextArea
                  rows={5}
                  placeholder={t("rag.prompt.webSearchPromptPlaceholder")}
                />
              </Form.Item>
              <Form.Item
                label={t("rag.prompt.webSearchFollowUpPrompt")}
                name="webSearchFollowUpPrompt"
                help={t("rag.prompt.webSearchFollowUpPromptHelp")}
                rules={[
                  {
                    required: true,
                    message: t("rag.prompt.webSearchFollowUpPromptError")
                  }
                ]}>
                <Input.TextArea
                  rows={5}
                  placeholder={t(
                    "rag.prompt.webSearchFollowUpPromptPlaceholder"
                  )}
                />
              </Form.Item>
              <Form.Item>
                <div className="flex justify-end">
                  <SaveButton btnType="submit" />
                </div>{" "}
              </Form.Item>
            </Form>
          )}
        </div>
      )}
    </div>
  )
}
