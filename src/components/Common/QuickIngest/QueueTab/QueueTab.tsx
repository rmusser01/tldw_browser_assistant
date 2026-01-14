import React from "react"

type QueueTabProps = {
  /** Content to render in the queue tab panel */
  children: React.ReactNode
  /** Whether this tab is currently visible */
  isActive?: boolean
}

/**
 * Container component for the Queue tab panel.
 * Wraps queue-related content with proper ARIA attributes.
 */
export const QueueTab: React.FC<QueueTabProps> = ({ children, isActive = true }) => {
  return (
    <div
      role="tabpanel"
      id="quick-ingest-panel-queue"
      aria-labelledby="quick-ingest-tab-queue"
      className="py-3"
      hidden={!isActive}
    >
      {isActive && children}
    </div>
  )
}

export default QueueTab
