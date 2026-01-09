import React from "react"
import { AlertTriangle } from "lucide-react"
import i18n from "i18next"
import { translateMessage } from "@/i18n/translateMessage"

interface MarkdownErrorBoundaryProps extends React.PropsWithChildren {
  fallbackText?: string
  /** Show detailed error UI instead of just fallback text */
  showErrorUI?: boolean
}

interface MarkdownErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class MarkdownErrorBoundary extends React.Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  state: MarkdownErrorBoundaryState = {
    hasError: false,
    error: undefined
  }

  static getDerivedStateFromError(error: Error): MarkdownErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("MarkdownErrorBoundary caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // If fallback text is provided and showErrorUI is false, show just the text
      if (this.props.fallbackText && !this.props.showErrorUI) {
        return (
          <div className="whitespace-pre-wrap">
            {this.props.fallbackText}
          </div>
        )
      }

      // Show visible error UI so users know something went wrong
      return (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-text"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {translateMessage(
                i18n.t,
                "common:markdown.unableToRender",
                "Unable to render content"
              )}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {translateMessage(
                i18n.t,
                "common:markdown.couldNotDisplay",
                "The message content could not be displayed. This may be due to invalid formatting."
              )}
            </p>
            {this.props.fallbackText && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-warn hover:text-warn">
                  {translateMessage(
                    i18n.t,
                    "common:markdown.showRawContent",
                    "Show raw content"
                  )}
                </summary>
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-warn/10 p-2 text-xs text-text">
                  {this.props.fallbackText}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default MarkdownErrorBoundary
