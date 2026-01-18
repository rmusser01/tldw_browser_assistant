/**
 * CopyButton component
 * Small button to copy text to clipboard with feedback
 */

import React, { useState, useCallback } from "react"
import { Button, Tooltip } from "antd"
import { Check, Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { copyToClipboard } from "@/utils/clipboard"

interface CopyButtonProps {
  text: string
  className?: string
  size?: "small" | "middle" | "large"
  showTooltip?: boolean
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  className = "",
  size = "small",
  showTooltip = true
}) => {
  const { t } = useTranslation(["common"])
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await copyToClipboard({ text })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  const button = (
    <Button
      type="text"
      size={size}
      className={className}
      onClick={handleCopy}
      icon={
        copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )
      }
    />
  )

  if (!showTooltip) {
    return button
  }

  return (
    <Tooltip
      title={
        copied
          ? t("common:copied", { defaultValue: "Copied!" })
          : t("common:copyToClipboard", { defaultValue: "Copy to clipboard" })
      }
    >
      {button}
    </Tooltip>
  )
}

export default CopyButton
