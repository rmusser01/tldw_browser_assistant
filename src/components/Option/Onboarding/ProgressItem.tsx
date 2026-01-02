import { Check, X, Loader2, AlertCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/libs/utils"

export type ProgressStatus = "idle" | "checking" | "success" | "error" | "empty"

interface ProgressItemProps {
  label: string
  status: ProgressStatus
}

export const ProgressItem = ({ label, status }: ProgressItemProps) => {
  const { t } = useTranslation(["settings", "common"])

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center",
          status === "idle" && "bg-border",
          status === "checking" && "bg-primary/10",
          status === "success" && "bg-success/10",
          status === "error" && "bg-danger/10",
          status === "empty" && "bg-warn/10"
        )}
      >
        {status === "idle" && (
          <div className="h-2 w-2 rounded-full bg-border-strong" />
        )}
        {status === "checking" && (
          <Loader2 className="size-3 animate-spin text-primary" />
        )}
        {status === "success" && <Check className="size-3 text-success" />}
        {status === "error" && <X className="size-3 text-danger" />}
        {status === "empty" && (
          <AlertCircle className="size-3 text-warn" />
        )}
      </div>
      <span
        className={cn(
          "text-text",
          status === "checking" && "font-medium text-primary",
          status === "success" && "text-success",
          status === "error" && "text-danger"
        )}
      >
        {label}
      </span>
      {status === "checking" && (
        <span className="text-xs text-text-subtle animate-pulse">
          {t("common:checking", "Checking...")}
        </span>
      )}
      {status === "empty" && (
        <span className="text-xs text-warn">
          {t(
            "settings:onboarding.progress.noIndex",
            "No documents indexed yet"
          )}
        </span>
      )}
    </div>
  )
}
