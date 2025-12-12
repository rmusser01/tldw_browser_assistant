/**
 * TimelineModal Component
 *
 * Main modal container for the conversation timeline/graph view.
 * Displays the graph canvas, toolbar, and info panel.
 */

import React, { useEffect, useCallback } from 'react'
import { Modal, Spin, Alert } from 'antd'
import { useTimelineStore } from '@/store/timeline'
import { GraphCanvas } from './GraphCanvas'
import { TimelineToolbar } from './TimelineToolbar'
import { NodeInfoPanel } from './NodeInfoPanel'

// ============================================================================
// Component
// ============================================================================

export const TimelineModal: React.FC = () => {
  const {
    isOpen,
    isLoading,
    error,
    graph,
    selectedNodeId,
    closeTimeline,
    selectNode,
    settings
  } = useTimelineStore()

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      // Escape to close
      if (e.key === 'Escape') {
        if (selectedNodeId) {
          // First escape clears selection
          selectNode(null)
        } else {
          // Second escape closes modal
          closeTimeline()
        }
        e.preventDefault()
      }

      // Ctrl+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const searchInput = document.querySelector<HTMLInputElement>(
          '.timeline-search-input'
        )
        searchInput?.focus()
        e.preventDefault()
      }
    },
    [isOpen, selectedNodeId, selectNode, closeTimeline]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Don't render if not open
  if (!isOpen) return null

  return (
    <Modal
      open={isOpen}
      onCancel={closeTimeline}
      title={null}
      footer={null}
      width="100vw"
      style={{
        top: 0,
        padding: 0,
        maxWidth: '100vw'
      }}
      styles={{
        body: {
          height: 'calc(100vh - 55px)',
          padding: 0,
          overflow: 'hidden'
        },
        content: {
          borderRadius: 0
        }
      }}
      closable={true}
      maskClosable={false}
      destroyOnClose
      className="timeline-modal"
    >
      <div className="timeline-container">
        {/* Toolbar */}
        <TimelineToolbar />

        {/* Main content area */}
        <div className="timeline-content">
          {/* Loading state */}
          {isLoading && (
            <div className="timeline-loading">
              <Spin size="large" tip="Building conversation tree..." />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="timeline-error">
              <Alert
                type="error"
                message="Failed to load timeline"
                description={error}
                showIcon
              />
            </div>
          )}

          {/* Graph canvas */}
          {graph && !isLoading && !error && (
            <GraphCanvas />
          )}

          {/* Empty state */}
          {!graph && !isLoading && !error && (
            <div className="timeline-empty">
              <Alert
                type="info"
                message="No conversation data"
                description="This conversation doesn't have any messages yet."
                showIcon
              />
            </div>
          )}
        </div>

        {/* Info panel (shown when node selected) */}
        {selectedNodeId && (
          <NodeInfoPanel />
        )}

        {/* Legend */}
        {settings.showLegend && graph && !isLoading && (
          <div className="timeline-legend">
            <div className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: settings.userNodeColor }}
              />
              <span>User</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-dot"
                style={{
                  backgroundColor: settings.assistantNodeColor,
                  border: '1px solid #ccc'
                }}
              />
              <span>Assistant</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: settings.systemNodeColor }}
              />
              <span>System</span>
            </div>
          </div>
        )}
      </div>

      {/* Styles */}
      <style>{`
        .timeline-modal .ant-modal-content {
          height: 100vh;
        }

        .timeline-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary, #1a1a1a);
          color: var(--text-primary, #fff);
        }

        .timeline-content {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .timeline-loading,
        .timeline-error,
        .timeline-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 24px;
        }

        .timeline-legend {
          position: absolute;
          bottom: 16px;
          left: 16px;
          display: flex;
          gap: 16px;
          background: rgba(0, 0, 0, 0.7);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          z-index: 10;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .timeline-search-highlight {
          background-color: #fbbf24;
          color: #000;
          padding: 0 2px;
          border-radius: 2px;
        }

        /* Dark mode adjustments */
        .dark .timeline-container {
          background: #1a1a1a;
          color: #fff;
        }

        .dark .timeline-legend {
          background: rgba(0, 0, 0, 0.8);
        }
      `}</style>
    </Modal>
  )
}

export default TimelineModal
