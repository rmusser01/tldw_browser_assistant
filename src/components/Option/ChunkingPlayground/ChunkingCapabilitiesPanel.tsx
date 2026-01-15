import React from "react"
import { useTranslation } from "react-i18next"
import { Alert, Button, Card, Space, Tag, Typography } from "antd"

import type { ChunkingCapabilities } from "@/services/chunking"

const { Text, Title } = Typography

interface ChunkingCapabilitiesPanelProps {
  capabilities?: ChunkingCapabilities
  loading?: boolean
  onRefresh?: () => void
}

export const ChunkingCapabilitiesPanel: React.FC<
  ChunkingCapabilitiesPanelProps
> = ({ capabilities, loading, onRefresh }) => {
  const { t } = useTranslation(["settings", "common"])

  if (!capabilities && !loading) {
    return (
      <Alert
        type="info"
        showIcon
        message={t("common:noData", "No data")}
      />
    )
  }

  const methods = capabilities?.methods ?? []
  const llmMethods = capabilities?.llm_required_methods ?? []
  const defaultOptions = capabilities?.default_options ?? {}
  const methodOptions = capabilities?.method_specific_options ?? {}

  return (
    <Card
      title={t(
        "settings:chunkingPlayground.capabilities.title",
        "Chunking Capabilities"
      )}
      extra={
        onRefresh ? (
          <Button size="small" onClick={onRefresh} loading={loading}>
            {t("common:refresh", "Refresh")}
          </Button>
        ) : null
      }>
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Title level={5} className="mb-2">
            {t(
              "settings:chunkingPlayground.capabilities.methodsLabel",
              "Methods"
            )}
          </Title>
          <div className="flex flex-wrap gap-2">
            {methods.map((method) => (
              <Tag key={method}>{method}</Tag>
            ))}
          </div>
        </div>

        <div>
          <Title level={5} className="mb-2">
            {t(
              "settings:chunkingPlayground.capabilities.llmLabel",
              "LLM-required methods"
            )}
          </Title>
          {llmMethods.length === 0 ? (
            <Text type="secondary">{t("common:noData", "No data")}</Text>
          ) : (
            <div className="flex flex-wrap gap-2">
              {llmMethods.map((method) => (
                <Tag key={method} color="gold">
                  {method}
                </Tag>
              ))}
            </div>
          )}
        </div>

        <div>
          <Title level={5} className="mb-2">
            {t(
              "settings:chunkingPlayground.capabilities.defaultsLabel",
              "Default options"
            )}
          </Title>
          <pre className="text-xs bg-surface2 rounded p-2 overflow-x-auto">
            {JSON.stringify(defaultOptions, null, 2)}
          </pre>
        </div>

        <div>
          <Title level={5} className="mb-2">
            {t(
              "settings:chunkingPlayground.capabilities.methodOptionsLabel",
              "Method-specific options"
            )}
          </Title>
          <pre className="text-xs bg-surface2 rounded p-2 overflow-x-auto">
            {JSON.stringify(methodOptions, null, 2)}
          </pre>
        </div>

        {capabilities?.notes && (
          <div>
            <Title level={5} className="mb-2">
              {t(
                "settings:chunkingPlayground.capabilities.notesLabel",
                "Notes"
              )}
            </Title>
            <Text type="secondary">{capabilities.notes}</Text>
          </div>
        )}
      </Space>
    </Card>
  )
}
