/**
 * HistoryTab component
 * Tab for viewing evaluation history
 */

import React from "react"
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  Select,
  Spin,
  Tag,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import { useFetchHistory, historyTypePresets } from "../hooks/useHistory"
import { useEvaluationsStore } from "@/store/evaluations"
import { CopyButton } from "../components"

const { Text } = Typography

export const HistoryTab: React.FC = () => {
  const { t } = useTranslation(["settings", "common"])
  const [form] = Form.useForm()

  // Store state
  const historyResults = useEvaluationsStore((s) => s.historyResults)

  // Mutations
  const fetchHistoryMutation = useFetchHistory()

  const handleFetch = () => {
    const values = form.getFieldsValue()
    fetchHistoryMutation.mutate(values)
  }

  return (
    <div className="space-y-4">
      <Card
        title={t("settings:evaluations.historyTitle", {
          defaultValue: "History"
        })}
      >
        <Form form={form} layout="vertical" size="small">
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label={t("settings:evaluations.historyTypeLabel", {
                defaultValue: "Type"
              })}
              name="type"
            >
              <Select
                allowClear
                placeholder={t("settings:evaluations.historyTypePlaceholder", {
                  defaultValue: "Filter by event type"
                })}
                options={historyTypePresets}
              />
            </Form.Item>
            <Form.Item
              label={t("settings:evaluations.historyUserLabel", {
                defaultValue: "User ID"
              })}
              name="user_id"
            >
              <Input placeholder="user_123" />
            </Form.Item>
            <Form.Item
              label={t("settings:evaluations.historyStartLabel", {
                defaultValue: "Start date (ISO)"
              })}
              name="start_date"
            >
              <Input placeholder="2024-01-01T00:00:00Z" type="datetime-local" />
            </Form.Item>
            <Form.Item
              label={t("settings:evaluations.historyEndLabel", {
                defaultValue: "End date (ISO)"
              })}
              name="end_date"
            >
              <Input placeholder="2024-12-31T23:59:59Z" type="datetime-local" />
            </Form.Item>
          </div>
          <Button
            type="primary"
            loading={fetchHistoryMutation.isPending}
            onClick={handleFetch}
          >
            {t("settings:evaluations.historyFetchCta", {
              defaultValue: "Fetch history"
            })}
          </Button>
        </Form>

        <Divider />

        {fetchHistoryMutation.isPending ? (
          <div className="flex justify-center py-4">
            <Spin size="small" />
          </div>
        ) : historyResults.length === 0 ? (
          <Text type="secondary" className="text-xs">
            {t("settings:evaluations.historyEmpty", {
              defaultValue: "Run a query to see recent activity."
            })}
          </Text>
        ) : (
          <div className="space-y-2">
            <Text type="secondary" className="text-xs">
              {t("settings:evaluations.historyResultsCount", {
                defaultValue: "{{count}} results",
                count: historyResults.length
              })}
            </Text>
            <div className="flex flex-col gap-2">
              {historyResults.map((item) => (
                <Card
                  key={item.id}
                  size="small"
                  className="hover:border-blue-500/70"
                  bodyStyle={{ padding: "8px 12px" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Tag color="blue" className="text-xs">
                          {item.type}
                        </Tag>
                        <Text type="secondary" className="text-[11px]">
                          {item.created_at || ""}
                        </Text>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {item.eval_id && (
                          <div className="flex items-center gap-1">
                            <Text type="secondary" className="text-[11px]">
                              Eval:
                            </Text>
                            <code className="text-[11px]">{item.eval_id}</code>
                            <CopyButton text={item.eval_id} />
                          </div>
                        )}
                        {item.run_id && (
                          <div className="flex items-center gap-1">
                            <Text type="secondary" className="text-[11px]">
                              Run:
                            </Text>
                            <code className="text-[11px]">{item.run_id}</code>
                            <CopyButton text={item.run_id} />
                          </div>
                        )}
                        {item.user_id && (
                          <div className="flex items-center gap-1">
                            <Text type="secondary" className="text-[11px]">
                              User:
                            </Text>
                            <code className="text-[11px]">{item.user_id}</code>
                          </div>
                        )}
                      </div>
                      {item.detail && Object.keys(item.detail).length > 0 && (
                        <pre className="mt-2 max-h-24 overflow-auto rounded bg-surface2 p-2 text-[10px] text-text">
                          {JSON.stringify(item.detail, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default HistoryTab
