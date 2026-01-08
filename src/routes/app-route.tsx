import React from "react"
import type { ErrorInfo, ReactNode } from "react"
import { Route, Routes } from "react-router-dom"
import { useDarkMode } from "~/hooks/useDarkmode"
import { PageAssistLoader } from "@/components/Common/PageAssistLoader"
import { useAutoButtonTitles } from "@/hooks/useAutoButtonTitles"
import {
  platformConfig,
  type PlatformTarget
} from "@/config/platform"
import {
  optionRoutes,
  sidepanelRoutes,
  type RouteDefinition,
  type RouteKind
} from "@/routes/route-registry"

const getRoutesForTarget = (
  routes: RouteDefinition[],
  target: PlatformTarget
) => routes.filter((route) => !route.targets || route.targets.includes(target))

const ROUTE_FALLBACKS: Record<
  RouteKind,
  { label: string; description: string }
> = {
  options: {
    label: "Loading tldw Assistant...",
    description: "Setting up your workspace"
  },
  sidepanel: {
    label: "Loading chat...",
    description: "Preparing your assistant"
  }
}

type OptionsErrorBoundaryProps = {
  children: ReactNode
  onReset?: () => void
}

type OptionsErrorBoundaryState = {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class OptionsErrorBoundary extends React.Component<
  OptionsErrorBoundaryProps,
  OptionsErrorBoundaryState
> {
  state: OptionsErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  static getDerivedStateFromError(error: Error): Partial<OptionsErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error("[OptionsErrorBoundary] Caught error:", error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-8">
          <div className="max-w-lg text-center">
            <h2 className="text-lg font-semibold text-text">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              The Options page hit an unexpected error. You can try reloading the page.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-[color:var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-primary-strong)]"
            >
              Reload Options
            </button>
            {this.state.error && (
              <details className="mt-4 text-left text-xs text-text-subtle">
                <summary className="cursor-pointer">View error details</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-surface2 p-3 text-[11px] text-danger">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack
                    ? `\n${this.state.errorInfo.componentStack}`
                    : ""}
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

export const RouteShell = ({ kind }: { kind: RouteKind }) => {
  const { mode } = useDarkMode()
  useAutoButtonTitles()
  const { label, description } = ROUTE_FALLBACKS[kind]
  const routes = kind === "options" ? optionRoutes : sidepanelRoutes
  const visibleRoutes = getRoutesForTarget(routes, platformConfig.target)
  const handleOptionsReset = () => {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }
  const routesContent = (
    <Routes>
      {visibleRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  )

  return (
    <div className={`${mode === "dark" ? "dark" : "light"} arimo`}>
      <React.Suspense
        fallback={<PageAssistLoader label={label} description={description} />}
      >
        {kind === "options" ? (
          <OptionsErrorBoundary onReset={handleOptionsReset}>
            {routesContent}
          </OptionsErrorBoundary>
        ) : (
          routesContent
        )}
      </React.Suspense>
    </div>
  )
}
