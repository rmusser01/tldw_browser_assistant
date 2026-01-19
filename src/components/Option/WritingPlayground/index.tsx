import React from "react"
import { Alert, Card, Empty, Typography } from "antd"
import { useTranslation } from "react-i18next"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"

const { Title, Paragraph } = Typography

export const WritingPlayground = () => {
  const { t } = useTranslation(["option"])
  const isOnline = useServerOnline()
  const { capabilities, loading } = useServerCapabilities()
  const hasWriting = Boolean(capabilities?.hasWriting)

  const showOffline = !isOnline
  const showUnsupported = !showOffline && !loading && !hasWriting

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Title level={2}>
          {t("option:writingPlayground.title", "Writing Playground")}
        </Title>
        <Paragraph type="secondary">
          {t(
            "option:writingPlayground.subtitle",
            "Draft long-form prompts, manage sessions, and generate with your tldw server."
          )}
        </Paragraph>
      </div>

      {showOffline && (
        <Alert
          type="warning"
          showIcon
          message={t("option:writingPlayground.offlineTitle", "Server required")}
          description={t(
            "option:writingPlayground.offlineBody",
            "Connect to your tldw server to load writing sessions and generate."
          )}
        />
      )}

      {showUnsupported && (
        <Alert
          type="info"
          showIcon
          message={t(
            "option:writingPlayground.unavailableTitle",
            "Playground unavailable"
          )}
          description={t(
            "option:writingPlayground.unavailableBody",
            "This server does not advertise writing playground support yet."
          )}
        />
      )}

      <Card>
        <Empty
          description={t(
            "option:writingPlayground.emptyState",
            "Scaffolding is ready. Editor, sessions, and tools land in the next stage."
          )}
        />
      </Card>
    </div>
  )
}
