import React from "react"
import { useTranslation } from "react-i18next"
import { PageShell } from "@/components/Common/PageShell"
import { PromptBody } from "."

export const PromptsWorkspace: React.FC = () => {
  const { t } = useTranslation(["settings", "common"])

  return (
    <PageShell className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-text">
          {t("option:header.modePromptsPlayground", "Prompts")}
        </h1>
        <p className="text-xs text-text-muted">
          {t("settings:managePrompts.emptyDescription", {
            defaultValue:
              "Create reusable prompts for recurring tasks, workflows, and team conventions."
          })}
        </p>
      </div>
      <PromptBody />
    </PageShell>
  )
}
