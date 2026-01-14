import React from "react"
import { Button } from "antd"
import { AlertCircle, Search, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"

type EmptyStateVariant = "initial" | "no-results" | "timeout" | "disconnected"

type SearchEmptyStateProps = {
  variant: EmptyStateVariant
  onRetry?: () => void
  onDismissHint?: () => void
  showHint?: boolean
}

/**
 * Empty state display for various search states
 */
export const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({
  variant,
  onRetry,
  onDismissHint,
  showHint = false
}) => {
  const { t } = useTranslation(["sidepanel"])

  if (variant === "initial") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Search className="h-10 w-10 text-text-muted mb-3" />
        <p className="text-sm text-text-muted mb-1">
          {t("sidepanel:rag.noResults", "No results yet")}
        </p>
        <p className="text-xs text-text-muted">
          {t(
            "sidepanel:rag.hint.message",
            "Search your knowledge base and insert results into your message."
          )}
        </p>
        {showHint && onDismissHint && (
          <Button
            type="link"
            size="small"
            onClick={onDismissHint}
            className="mt-2 text-xs"
          >
            {t("sidepanel:rag.hint.dismiss", "Dismiss")}
          </Button>
        )}
      </div>
    )
  }

  if (variant === "no-results") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Search className="h-10 w-10 text-text-muted mb-3" />
        <p className="text-sm text-text-muted">
          {t("sidepanel:rag.noResults", "No results found")}
        </p>
        <p className="text-xs text-text-muted mt-1">
          {t(
            "sidepanel:rag.tryDifferentQuery",
            "Try a different search query or adjust your filters."
          )}
        </p>
      </div>
    )
  }

  if (variant === "timeout") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-10 w-10 text-warn mb-3" />
        <p className="text-sm text-text mb-2">
          {t("sidepanel:rag.timeout.message", "Request timed out.")}
        </p>
        <div className="flex gap-2">
          {onRetry && (
            <Button
              type="primary"
              size="small"
              onClick={onRetry}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              {t("sidepanel:rag.timeout.retry", "Retry")}
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (variant === "disconnected") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-10 w-10 text-error mb-3" />
        <p className="text-sm text-text">
          {t(
            "sidepanel:rag.disconnected",
            "Connect to server to search knowledge base"
          )}
        </p>
      </div>
    )
  }

  return null
}
