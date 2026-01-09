/**
 * Error Boundary Test Page
 *
 * Test route for E2E testing of the AgentErrorBoundary component.
 * This route is wrapped with the error boundary and contains a trigger
 * component to intentionally cause an error.
 */

import { FC, useState } from "react"
import { useTranslation } from "react-i18next"
import { AgentErrorBoundary, ErrorBoundaryTestTrigger } from "@/components/Agent"

const SidepanelErrorBoundaryTest: FC = () => {
  const { t } = useTranslation("common")
  const [resetCount, setResetCount] = useState(0)

  return (
    <AgentErrorBoundary
      fallbackMessage={t("testErrorFallback", "Test error caught by boundary")}
      onReset={() => {
        setResetCount(prev => prev + 1)
      }}
    >
      <div className="flex flex-col h-dvh bg-white dark:bg-surface">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold" data-testid="error-boundary-test-title">
            Error Boundary Test
          </h1>
          <p className="text-sm text-gray-500">
            Reset count: <span data-testid="reset-count">{resetCount}</span>
          </p>
        </div>
        <div className="flex-1 overflow-auto">
          <ErrorBoundaryTestTrigger />
        </div>
      </div>
    </AgentErrorBoundary>
  )
}

export default SidepanelErrorBoundaryTest
