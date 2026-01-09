/**
 * ErrorBoundaryTestTrigger - Test component for triggering errors
 *
 * Used by E2E tests to verify the AgentErrorBoundary catches errors correctly
 */

import { FC, useState } from "react"
import { Button } from "antd"
import { AlertTriangle } from "lucide-react"

interface ErrorBoundaryTestTriggerProps {
  className?: string
}

// Component that throws when triggered
const BuggyComponent: FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error("Test error: Intentionally thrown for E2E testing")
  }
  return null
}

export const ErrorBoundaryTestTrigger: FC<ErrorBoundaryTestTriggerProps> = ({
  className = ""
}) => {
  const [shouldThrow, setShouldThrow] = useState(false)

  return (
    <div className={`p-4 ${className}`}>
      <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-5 text-warn" />
          <h3 className="font-medium text-warn">
            Error Boundary Test Page
          </h3>
        </div>
        <p className="text-sm text-warn">
          This page is used to test the AgentErrorBoundary component.
          Click the button below to trigger an error and verify the error boundary catches it.
        </p>
      </div>

      <Button
        type="primary"
        danger
        data-testid="trigger-error-button"
        onClick={() => setShouldThrow(true)}
      >
        Trigger Error
      </Button>

      <BuggyComponent shouldThrow={shouldThrow} />
    </div>
  )
}

export default ErrorBoundaryTestTrigger
