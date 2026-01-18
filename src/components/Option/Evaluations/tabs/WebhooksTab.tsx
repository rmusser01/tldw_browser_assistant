/**
 * WebhooksTab component
 * Tab for managing evaluation webhooks - register, list, delete
 */

import React from "react"
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import {
  useWebhooksList,
  useRegisterWebhook,
  useDeleteWebhook,
  webhookEventOptions,
  defaultWebhookEvents
} from "../hooks/useWebhooks"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useEvaluationsStore } from "@/store/evaluations"
import { CopyButton } from "../components"

const { Text } = Typography

export const WebhooksTab: React.FC = () => {
  const { t } = useTranslation(["settings", "common"])
  const [form] = Form.useForm()
  const isOnline = useServerOnline()

  // Store state
  const webhookSecretText = useEvaluationsStore((s) => s.webhookSecretText)

  // Queries & mutations
  const { data: webhooksResp, isLoading: webhooksLoading, isError: webhooksError } =
    useWebhooksList(isOnline)
  const registerMutation = useRegisterWebhook()
  const deleteMutation = useDeleteWebhook()

  const webhooks = webhooksResp?.data?.data || []

  const handleRegister = async () => {
    try {
      const values = await form.validateFields()
      await registerMutation.mutateAsync({
        url: values.url,
        events: values.events
      })
      form.resetFields()
    } catch {
      // Form validation errors handled by antd
    }
  }

  const handleDelete = (webhookId: string) => {
    Modal.confirm({
      title: t("settings:evaluations.deleteWebhookConfirmTitle", {
        defaultValue: "Delete this webhook?"
      }),
      content: t("settings:evaluations.deleteWebhookConfirmDescription", {
        defaultValue:
          "This will stop sending events to this URL. You can re-register it later."
      }),
      okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutateAsync(webhookId)
    })
  }

  return (
    <div className="space-y-4">
      <Card
        title={t("settings:evaluations.webhooksTitle", {
          defaultValue: "Webhooks"
        })}
        extra={
          webhooksLoading ? (
            <Spin size="small" />
          ) : webhooksError || webhooksResp?.ok === false ? (
            <Tag color="red">Error</Tag>
          ) : (
            <Tag>{webhooks.length}</Tag>
          )
        }
      >
        {/* Register Form */}
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            label={t("settings:evaluations.webhookUrlLabel", {
              defaultValue: "URL"
            })}
            name="url"
            rules={[
              { required: true },
              { type: "url", message: "Please enter a valid URL" }
            ]}
          >
            <Input placeholder="https://example.com/hook" />
          </Form.Item>
          <Form.Item
            label={t("settings:evaluations.webhookEventsLabel", {
              defaultValue: "Events"
            })}
            name="events"
            initialValue={defaultWebhookEvents}
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              options={webhookEventOptions}
              placeholder={t("settings:evaluations.webhookEventsPlaceholder", {
                defaultValue: "Select events to receive"
              })}
            />
          </Form.Item>
          <Button
            type="primary"
            loading={registerMutation.isPending}
            onClick={handleRegister}
          >
            {t("settings:evaluations.webhookCreateCta", {
              defaultValue: "Register webhook"
            })}
          </Button>

          {webhookSecretText && (
            <Alert
              className="mt-3"
              type="success"
              message={t("settings:evaluations.webhookSecretTitle", {
                defaultValue: "Webhook Secret"
              })}
              description={
                <div className="flex items-center gap-2">
                  <code className="text-xs">{webhookSecretText}</code>
                  <CopyButton text={webhookSecretText} />
                </div>
              }
            />
          )}
        </Form>

        <Divider />

        {/* Webhooks List */}
        {webhooksLoading ? (
          <div className="flex justify-center py-3">
            <Spin size="small" />
          </div>
        ) : webhooksError || webhooksResp?.ok === false ? (
          <Alert
            type="warning"
            message={t("settings:evaluations.webhookListErrorTitle", {
              defaultValue: "Unable to load webhooks"
            })}
          />
        ) : webhooks.length === 0 ? (
          <Empty
            description={t("settings:evaluations.webhooksEmpty", {
              defaultValue: "No webhooks registered yet."
            })}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {webhooks.map((hook: any) => (
              <Card
                key={hook.id}
                size="small"
                className="hover:border-blue-500/70"
                bodyStyle={{ padding: "8px 12px" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{hook.url}</span>
                      <CopyButton text={hook.url} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(hook.events || []).map((event: string) => (
                        <Tag key={event} className="text-[10px]">
                          {event}
                        </Tag>
                      ))}
                    </div>
                    <Text type="secondary" className="text-[11px] mt-1">
                      {t("common:id", { defaultValue: "ID" })}: {hook.id}
                    </Text>
                    {hook.is_active !== undefined && (
                      <Tag
                        color={hook.is_active ? "green" : "default"}
                        className="text-[10px] mt-1 w-fit"
                      >
                        {hook.is_active
                          ? t("common:active", { defaultValue: "Active" })
                          : t("common:inactive", { defaultValue: "Inactive" })}
                      </Tag>
                    )}
                  </div>
                  <Button
                    size="small"
                    danger
                    loading={deleteMutation.isPending}
                    onClick={() => handleDelete(hook.id)}
                  >
                    {t("common:delete", { defaultValue: "Delete" })}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Webhook Info */}
      <Card size="small">
        <Alert
          type="info"
          showIcon
          message={t("settings:evaluations.webhookInfoTitle", {
            defaultValue: "About webhooks"
          })}
          description={
            <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
              <li>
                {t("settings:evaluations.webhookInfoItem1", {
                  defaultValue:
                    "Webhooks receive POST requests when evaluation events occur."
                })}
              </li>
              <li>
                {t("settings:evaluations.webhookInfoItem2", {
                  defaultValue:
                    "Use the secret to verify webhook signatures and prevent spoofing."
                })}
              </li>
              <li>
                {t("settings:evaluations.webhookInfoItem3", {
                  defaultValue:
                    "Events include: started, completed, failed, cancelled, and progress updates."
                })}
              </li>
            </ul>
          }
        />
      </Card>
    </div>
  )
}

export default WebhooksTab
