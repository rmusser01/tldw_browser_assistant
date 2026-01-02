/**
 * AgentErrorBoundary - Error boundary for agent components
 *
 * Catches errors in agent UI components and provides graceful fallback
 */

import { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "antd"
import i18n from "i18next"
import { translateMessage } from "@/i18n/translateMessage"

interface Props {
  children: ReactNode
  fallbackMessage?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class AgentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    // Log error to console for debugging
    console.error("[AgentErrorBoundary] Caught error:", error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center bg-surface p-8">
          <div className="flex flex-col items-center max-w-md text-center">
            <div className="mb-4 rounded-full bg-danger/10 p-4">
              <AlertTriangle className="size-8 text-danger" />
            </div>

            <h2 className="text-lg font-semibold mb-2">
              {this.props.fallbackMessage ||
                translateMessage(
                  i18n.t,
                  "common:agent.errorBoundary.title",
                  "Something went wrong"
                )}
            </h2>

            <p className="mb-4 text-sm text-text-muted">
              {translateMessage(
                i18n.t,
                "common:agent.errorBoundary.description",
                "An error occurred in the agent interface. This may be due to an unexpected response or a temporary issue."
              )}
            </p>

            {this.state.error && (
              <details className="w-full mb-4 text-left">
                <summary className="cursor-pointer text-sm text-text-subtle hover:text-text">
                  {translateMessage(
                    i18n.t,
                    "common:agent.errorBoundary.viewDetails",
                    "View error details"
                  )}
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-surface2 p-3 text-xs text-text">
                  <code className="text-danger">
                    {this.state.error.message}
                  </code>
                  {this.state.errorInfo?.componentStack && (
                    <code className="mt-2 block text-text-subtle">
                      {this.state.errorInfo.componentStack}
                    </code>
                  )}
                </pre>
              </details>
            )}

            <Button
              type="primary"
              icon={<RefreshCw className="size-4" />}
              onClick={this.handleReset}
            >
              {translateMessage(
                i18n.t,
                "common:agent.errorBoundary.retry",
                "Try Again"
              )}
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AgentErrorBoundary
