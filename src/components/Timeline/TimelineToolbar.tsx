/**
 * TimelineToolbar Component
 *
 * Toolbar with search, layout controls, and other actions.
 */

import React from 'react'
import { Input, Button, Tooltip, Space, Select, Badge, Typography } from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  RotateRightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  CompressOutlined,
  UnorderedListOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { useTimelineStore } from '@/store/timeline'

const { Text } = Typography

// ============================================================================
// Component
// ============================================================================

export const TimelineToolbar: React.FC = () => {
  const {
    graph,
    searchQuery,
    searchResults,
    searchMode,
    settings,
    isLoading,
    error,
    setSearchQuery,
    setSearchMode,
    clearSearch,
    refreshGraph,
    toggleLayoutDirection,
    expandAllSwipes,
    collapseAllSwipes,
    updateSettings,
    closeTimeline
  } = useTimelineStore()

  const hasSearchResults = searchResults.length > 0
  const hasSearch = searchQuery.trim().length > 0
  const canZoom = Boolean(graph) && !isLoading && !error

  const zoomTo = React.useCallback((nextZoom: number) => {
    const clamped = Math.min(settings.maxZoom, Math.max(settings.minZoom, nextZoom))
    updateSettings({ zoomLevel: clamped })
  }, [settings.maxZoom, settings.minZoom, updateSettings])

  return (
    <div className="timeline-toolbar">
      {/* Left section - Title and close */}
      <div className="toolbar-left">
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={closeTimeline}
          style={{ marginRight: 8 }}
        />
        <Text strong style={{ fontSize: 16 }}>
          Conversation Timeline
        </Text>
      </div>

      {/* Center section - Search */}
      <div className="toolbar-center">
        <Space.Compact style={{ width: 400 }}>
          <Select
            value={searchMode}
            onChange={setSearchMode}
            style={{ width: 120 }}
            options={[
              { value: 'fragments', label: 'Fragments' },
              { value: 'substring', label: 'Substring' },
              { value: 'regex', label: 'Regex' }
            ]}
          />
          <Input
            id="timeline-search-input"
            className="timeline-search-input"
            placeholder="Search messages... (space = AND)"
            prefix={<SearchOutlined />}
            suffix={
              hasSearch ? (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={clearSearch}
                  style={{ marginRight: -8 }}
                />
              ) : null
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear={false}
            style={{ width: 280 }}
          />
        </Space.Compact>

        {hasSearch && (
          <Badge
            count={searchResults.length}
            style={{ marginLeft: 8 }}
            showZero
            color={hasSearchResults ? 'green' : 'red'}
          >
            <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
              {hasSearchResults ? 'matches' : 'no matches'}
            </Text>
          </Badge>
        )}
      </div>

      {/* Right section - Actions */}
      <div className="toolbar-right">
        <Space>
          {/* Refresh */}
          <Tooltip title="Refresh graph">
            <Button
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={refreshGraph}
              disabled={isLoading}
            />
          </Tooltip>

          {/* Toggle layout direction */}
          <Tooltip title={`Switch to ${settings.layoutDirection === 'TB' ? 'horizontal' : 'vertical'} layout`}>
            <Button
              icon={<RotateRightOutlined />}
              onClick={toggleLayoutDirection}
            />
          </Tooltip>

          {/* Expand/Collapse swipes */}
          <Tooltip title="Expand all alternatives">
            <Button
              icon={<ExpandOutlined />}
              onClick={expandAllSwipes}
            />
          </Tooltip>
          <Tooltip title="Collapse all alternatives">
            <Button
              icon={<CompressOutlined />}
              onClick={collapseAllSwipes}
            />
          </Tooltip>

          {/* Toggle legend */}
          <Tooltip title={settings.showLegend ? 'Hide legend' : 'Show legend'}>
            <Button
              icon={<UnorderedListOutlined />}
              type={settings.showLegend ? 'primary' : 'default'}
              onClick={() => updateSettings({ showLegend: !settings.showLegend })}
            />
          </Tooltip>

          {/* Zoom controls */}
          <Button.Group>
            <Tooltip title="Zoom in">
              <Button
                icon={<ZoomInOutlined />}
                disabled={!canZoom}
                onClick={() => zoomTo(settings.zoomLevel * 1.2)}
              />
            </Tooltip>
            <Tooltip title="Zoom out">
              <Button
                icon={<ZoomOutOutlined />}
                disabled={!canZoom}
                onClick={() => zoomTo(settings.zoomLevel / 1.2)}
              />
            </Tooltip>
          </Button.Group>
        </Space>
      </div>
    </div>
  )
}

export default TimelineToolbar
