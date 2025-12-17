/**
 * AgentErrorBoundary - Error boundary for agent components
 *
 * Catches errors in agent UI components and provides graceful fallback
 */

import { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "antd"

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
        <div className="flex flex-col items-center justify-center h-full p-8 bg-white dark:bg-[#171717]">
          <div className="flex flex-col items-center max-w-md text-center">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertTriangle className="size-8 text-red-500" />
            </div>

            <h2 className="text-lg font-semibold mb-2">
              {this.props.fallbackMessage || "Something went wrong"}
            </h2>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              An error occurred in the agent interface. This may be due to an unexpected
              response or a temporary issue.
            </p>

            {this.state.error && (
              <details className="w-full mb-4 text-left">
                <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                  View error details
                </summary>
                <pre className="mt-2 p-3 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto">
                  <code className="text-red-600 dark:text-red-400">
                    {this.state.error.message}
                  </code>
                  {this.state.errorInfo?.componentStack && (
                    <code className="block mt-2 text-gray-500 dark:text-gray-400">
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
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AgentErrorBoundary
