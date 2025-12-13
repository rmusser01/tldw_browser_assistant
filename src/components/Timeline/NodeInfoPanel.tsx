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
  const node = useTimelineStore((s) => {
    if (!s.selectedNodeId) return null
    return s.getNodeById(s.selectedNodeId) || null
  })
  const searchQuery = useTimelineStore((s) => s.searchQuery)
  const selectNode = useTimelineStore((s) => s.selectNode)
  const toggleSwipeExpansion = useTimelineStore((s) => s.toggleSwipeExpansion)
  const expandedSwipeNodes = useTimelineStore((s) => s.expandedSwipeNodes)

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
  const historyCount = node.history_ids?.length ?? 0

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
    <div className="node-info-panel absolute right-0 top-0 bottom-0 w-80 bg-[var(--bg-secondary,#1f1f1f)] border-l border-[var(--border-color,#333)] p-4 overflow-y-auto z-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <RoleIcon className="mr-2" />
          <Text strong className="capitalize">
            {node.role}
          </Text>
          <Tag color={roleColor} className="ml-2">
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
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Text type="secondary" className="text-xs">
          {formattedTime}
        </Text>
        {node.is_swipe && (
          <Tag color="orange">
            Alternative Response
          </Tag>
        )}
        {node.has_swipes && (
          <Tag color="gold">
            {node.swipe_count} alternative{node.swipe_count !== 1 ? 's' : ''}
          </Tag>
        )}
      </div>

      <Divider className="my-3" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-[300px]">
        {highlightedContent ? (
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        ) : (
          <Paragraph
            className="whitespace-pre-wrap break-words !mb-0 text-sm leading-relaxed"
          >
            {node.content}
          </Paragraph>
        )}
      </div>

      <Divider className="my-3" />

      {/* Actions */}
      <div className="mt-auto">
        <Space direction="vertical" className="w-full">
          {/* Navigate to message */}
          <Tooltip title="Not yet available">
            <span className="inline-block w-full">
              <Button type="primary" icon={<SendOutlined />} block disabled>
                Go to Message
              </Button>
            </span>
          </Tooltip>

          {/* Branch from here */}
          <Tooltip title="Not yet available">
            <span className="inline-block w-full">
              <Button icon={<BranchesOutlined />} block disabled>
                Branch from Here
              </Button>
            </span>
          </Tooltip>

          {/* Edit message */}
          {node.role === 'user' && (
            <Tooltip title="Not yet available">
              <span className="inline-block w-full">
                <Button icon={<EditOutlined />} block disabled>
                  Edit Message
                </Button>
              </span>
            </Tooltip>
          )}

          {/* Regenerate response */}
          {node.role === 'assistant' && (
            <Tooltip title="Not yet available">
              <span className="inline-block w-full">
                <Button icon={<ReloadOutlined />} block disabled>
                  Regenerate Response
                </Button>
              </span>
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
        {/* Conversation info */}
        {historyCount > 1 && (
          <>
            <Divider className="my-3" />
            <div className="text-center">
              <Text type="secondary" className="text-xs">
                Present in {historyCount} conversation{historyCount !== 1 ? 's' : ''}
              </Text>
            </div>
          </>
        )}
      </div>

    </div>
  )
}

export default NodeInfoPanel
