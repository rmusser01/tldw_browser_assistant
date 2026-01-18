/**
 * EvaluationsBreadcrumb component
 * Shows the current selection path for evaluations and runs.
 */

import React from "react"
import { Breadcrumb } from "antd"
import { useTranslation } from "react-i18next"

interface EvaluationsBreadcrumbProps {
  evalName?: string | null
  runId?: string | null
  className?: string
}

export const EvaluationsBreadcrumb: React.FC<EvaluationsBreadcrumbProps> = ({
  evalName,
  runId,
  className = ""
}) => {
  const { t } = useTranslation(["evaluations", "common"])

  const items = [
    {
      title: t("evaluations:breadcrumbRoot", { defaultValue: "Evaluations" }),
      href: "#/evaluations"
    }
  ]

  if (evalName) {
    items.push({ title: evalName })
  }
  if (runId) {
    items.push({
      title: t("evaluations:breadcrumbRun", {
        defaultValue: "Run {{id}}",
        id: runId
      })
    })
  }

  return <Breadcrumb className={className} items={items} />
}

export default EvaluationsBreadcrumb
