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
          status === "idle" && "bg-gray-200 dark:bg-gray-700",
          status === "checking" && "bg-blue-100 dark:bg-blue-900/30",
          status === "success" && "bg-green-100 dark:bg-green-900/30",
          status === "error" && "bg-red-100 dark:bg-red-900/30",
          status === "empty" && "bg-amber-100 dark:bg-amber-900/30"
        )}
      >
        {status === "idle" && (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}
        {status === "checking" && (
          <Loader2 className="size-3 text-blue-600 animate-spin" />
        )}
        {status === "success" && <Check className="size-3 text-green-600" />}
        {status === "error" && <X className="size-3 text-red-600" />}
        {status === "empty" && (
          <AlertCircle className="size-3 text-amber-600" />
        )}
      </div>
      <span
        className={cn(
          "text-gray-700 dark:text-gray-300",
          status === "checking" &&
            "font-medium text-blue-600 dark:text-blue-400",
          status === "success" && "text-green-600 dark:text-green-400",
          status === "error" && "text-red-600 dark:text-red-400"
        )}
      >
        {label}
      </span>
      {status === "checking" && (
        <span className="text-xs text-gray-400 animate-pulse">
          {t("common:checking", "Checking...")}
        </span>
      )}
      {status === "empty" && (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {t(
            "settings:onboarding.progress.noIndex",
            "No documents indexed yet"
          )}
        </span>
      )}
    </div>
  )
}

