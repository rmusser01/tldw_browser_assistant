/**
 * NodeInfoPanel Component
 *
 * Side panel showing detailed information about a selected node.
 * Includes message content, metadata, and action buttons.
 */

import React, { useMemo } from 'react'
import { Button, Typography, Tag, Tooltip, Space, Divider } from 'antd'
import {
  CloseOutlined,
  BranchesOutlined,
  EditOutlined,
  ReloadOutlined,
  SendOutlined,
  SwapOutlined,
  UserOutlined,
  RobotOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useTimelineStore } from '@/store/timeline'
import { timelineSearch } from '@/services/timeline'

const { Text, Paragraph } = Typography

// ============================================================================
// Component
// ============================================================================

export const NodeInfoPanel: React.FC = () => {
  const {
    selectedNodeId,
    graph,
    searchQuery,
    selectNode,
    getNodeById,
    toggleSwipeExpansion,
    expandedSwipeNodes
  } = useTimelineStore()

  // Get the selected node data
  const node = useMemo(() => {
    if (!selectedNodeId) return null
    return getNodeById(selectedNodeId)
  }, [selectedNodeId, getNodeById])

  // Get highlighted content if search is active
  const highlightedContent = useMemo(() => {
    if (!node || !searchQuery) return null

    const fragments = timelineSearch.parseQueryFragments(searchQuery)
    if (fragments.length === 0) return null

    return timelineSearch.highlightMatches(node.content, fragments)
  }, [node, searchQuery])

  if (!node) return null

  const isSwipeExpanded = expandedSwipeNodes.has(node.id)

  // Format timestamp
  const formattedTime = new Date(node.timestamp).toLocaleString()

  // Role icon
  const RoleIcon = node.role === 'user'
    ? UserOutlined
    : node.role === 'assistant'
      ? RobotOutlined
      : SettingOutlined

  // Role color
  const roleColor = node.role === 'user'
    ? 'blue'
    : node.role === 'assistant'
      ? 'green'
      : 'gray'

  return (
    <div className="node-info-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-title">
          <RoleIcon style={{ marginRight: 8 }} />
          <Text strong style={{ textTransform: 'capitalize' }}>
            {node.role}
          </Text>
          <Tag color={roleColor} style={{ marginLeft: 8 }}>
            {node.sender_name || node.role}
          </Tag>
        </div>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={() => selectNode(null)}
          size="small"
        />
      </div>

      {/* Metadata */}
      <div className="panel-meta">
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formattedTime}
        </Text>
        {node.is_swipe && (
          <Tag color="orange" style={{ marginLeft: 8 }}>
            Alternative Response
          </Tag>
        )}
        {node.has_swipes && (
          <Tag color="gold" style={{ marginLeft: 8 }}>
            {node.swipe_count} alternative{node.swipe_count !== 1 ? 's' : ''}
          </Tag>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Content */}
      <div className="panel-content">
        {highlightedContent ? (
          <div
            className="message-content highlighted-content"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        ) : (
          <Paragraph
            className="message-content"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0
            }}
          >
            {node.content}
          </Paragraph>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Actions */}
      <div className="panel-actions">
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* Navigate to message */}
          <Tooltip title="Go to this message in chat">
            <Button
              type="primary"
              icon={<SendOutlined />}
              block
              onClick={() => {
                // TODO: Implement navigation
                console.log('Navigate to message:', node.message_ids[0])
              }}
            >
              Go to Message
            </Button>
          </Tooltip>

          {/* Branch from here */}
          <Tooltip title="Create a new conversation branch from this point">
            <Button
              icon={<BranchesOutlined />}
              block
              onClick={() => {
                // TODO: Implement branching
                console.log('Branch from:', node.message_ids[0])
              }}
            >
              Branch from Here
            </Button>
          </Tooltip>

          {/* Edit message */}
          {node.role === 'user' && (
            <Tooltip title="Edit this message (creates a new branch if not the last message)">
              <Button
                icon={<EditOutlined />}
                block
                onClick={() => {
                  // TODO: Implement editing
                  console.log('Edit message:', node.message_ids[0])
                }}
              >
                Edit Message
              </Button>
            </Tooltip>
          )}

          {/* Regenerate response */}
          {node.role === 'assistant' && (
            <Tooltip title="Generate a new alternative response">
              <Button
                icon={<ReloadOutlined />}
                block
                onClick={() => {
                  // TODO: Implement regeneration
                  console.log('Regenerate:', node.message_ids[0])
                }}
              >
                Regenerate Response
              </Button>
            </Tooltip>
          )}

          {/* Toggle swipes */}
          {node.has_swipes && (
            <Tooltip title={isSwipeExpanded ? 'Hide alternatives' : 'Show alternatives'}>
              <Button
                icon={<SwapOutlined />}
                block
                onClick={() => toggleSwipeExpansion(node.id)}
              >
                {isSwipeExpanded ? 'Hide' : 'Show'} Alternatives ({node.swipe_count})
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Conversation info */}
      {node.history_ids.length > 1 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div className="panel-conversations">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Present in {node.history_ids.length} conversation{node.history_ids.length !== 1 ? 's' : ''}
            </Text>
          </div>
        </>
      )}

      {/* Styles */}
      <style>{`
        .node-info-panel {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 320px;
          background: var(--bg-secondary, #1f1f1f);
          border-left: 1px solid var(--border-color, #333);
          padding: 16px;
          overflow-y: auto;
          z-index: 20;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-title {
          display: flex;
          align-items: center;
        }

        .panel-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          max-height: 300px;
        }

        .message-content {
          font-size: 14px;
          line-height: 1.6;
        }

        .highlighted-content .timeline-search-highlight {
          background-color: #fbbf24;
          color: #000;
          padding: 0 2px;
          border-radius: 2px;
        }

        .panel-actions {
          margin-top: auto;
        }

        .panel-conversations {
          text-align: center;
        }

        /* Dark mode */
        .dark .node-info-panel {
          background: #1f1f1f;
          border-left-color: #333;
        }
      `}</style>
    </div>
  )
}

export default NodeInfoPanel
