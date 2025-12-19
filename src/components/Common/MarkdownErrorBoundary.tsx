import React from "react"
import { AlertTriangle } from "lucide-react"

type MarkdownErrorBoundaryProps = React.PropsWithChildren<{
  fallbackText?: string
  /** Show detailed error UI instead of just fallback text */
  showErrorUI?: boolean
}>

type MarkdownErrorBoundaryState = {
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
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Unable to render content</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              The message content could not be displayed. This may be due to invalid formatting.
            </p>
            {this.props.fallbackText && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200">
                  Show raw content
                </summary>
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-amber-100/50 p-2 text-xs dark:bg-amber-900/20">
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
