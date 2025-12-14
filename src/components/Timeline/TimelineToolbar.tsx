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
import { translateMessage } from '@/i18n/translateMessage'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

const { Text } = Typography

// ============================================================================
// Component
// ============================================================================

export const TimelineToolbar: React.FC = () => {
  const { t } = useTranslation(['common'])
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
  } = useTimelineStore(
    useShallow((state) => ({
      graph: state.graph,
      searchQuery: state.searchQuery,
      searchResults: state.searchResults,
      searchMode: state.searchMode,
      settings: state.settings,
      isLoading: state.isLoading,
      error: state.error,
      setSearchQuery: state.setSearchQuery,
      setSearchMode: state.setSearchMode,
      clearSearch: state.clearSearch,
      refreshGraph: state.refreshGraph,
      toggleLayoutDirection: state.toggleLayoutDirection,
      expandAllSwipes: state.expandAllSwipes,
      collapseAllSwipes: state.collapseAllSwipes,
      updateSettings: state.updateSettings,
      closeTimeline: state.closeTimeline
    }))
  )

  const hasSearchResults = searchResults.length > 0
  const hasSearch = searchQuery.trim().length > 0
  const canZoom = Boolean(graph) && !isLoading && !error
  const nextLayoutDirectionLabel =
    settings.layoutDirection === 'TB'
      ? translateMessage(t, 'common:timeline.layout.horizontal', 'horizontal')
      : translateMessage(t, 'common:timeline.layout.vertical', 'vertical')

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
          {translateMessage(
            t,
            'common:timeline.title',
            'Conversation Timeline'
          )}
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
              {
                value: 'fragments',
                label: translateMessage(
                  t,
                  'common:timeline.searchMode.fragments',
                  'Fragments'
                )
              },
              {
                value: 'substring',
                label: translateMessage(
                  t,
                  'common:timeline.searchMode.substring',
                  'Substring'
                )
              },
              {
                value: 'regex',
                label: translateMessage(
                  t,
                  'common:timeline.searchMode.regex',
                  'Regex'
                )
              }
            ]}
          />
          <Input
            id="timeline-search-input"
            className="timeline-search-input"
            placeholder={translateMessage(
              t,
              'common:timeline.searchPlaceholder',
              'Search messages... (space = AND)'
            )}
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
              {hasSearchResults
                ? translateMessage(
                    t,
                    'common:timeline.searchMatches',
                    'matches'
                  )
                : translateMessage(
                    t,
                    'common:timeline.searchNoMatches',
                    'no matches'
                  )}
            </Text>
          </Badge>
        )}
      </div>

      {/* Right section - Actions */}
      <div className="toolbar-right">
        <Space>
          {/* Refresh */}
          <Tooltip
            title={translateMessage(t, 'common:timeline.refreshGraph', 'Refresh graph')}
          >
            <Button
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={() => void refreshGraph()}
              disabled={isLoading}
            />
          </Tooltip>

          {/* Toggle layout direction */}
          <Tooltip
            title={translateMessage(
              t,
              'common:timeline.switchLayout',
              'Switch to {{layout}} layout',
              { layout: nextLayoutDirectionLabel }
            )}
          >
            <Button
              icon={<RotateRightOutlined />}
              onClick={toggleLayoutDirection}
            />
          </Tooltip>

          {/* Expand/Collapse swipes */}
          <Tooltip
            title={translateMessage(
              t,
              'common:timeline.expandAllAlternatives',
              'Expand all alternatives'
            )}
          >
            <Button
              icon={<ExpandOutlined />}
              onClick={expandAllSwipes}
            />
          </Tooltip>
          <Tooltip
            title={translateMessage(
              t,
              'common:timeline.collapseAllAlternatives',
              'Collapse all alternatives'
            )}
          >
            <Button
              icon={<CompressOutlined />}
              onClick={collapseAllSwipes}
            />
          </Tooltip>

          {/* Toggle legend */}
          <Tooltip
            title={
              settings.showLegend
                ? translateMessage(
                    t,
                    'common:timeline.hideLegend',
                    'Hide legend'
                  )
                : translateMessage(
                    t,
                    'common:timeline.showLegend',
                    'Show legend'
                  )
            }
          >
            <Button
              icon={<UnorderedListOutlined />}
              type={settings.showLegend ? 'primary' : 'default'}
              onClick={() => updateSettings({ showLegend: !settings.showLegend })}
            />
          </Tooltip>

          {/* Zoom controls */}
          <Button.Group>
            <Tooltip title={translateMessage(t, 'common:timeline.zoomIn', 'Zoom in')}>
              <Button
                icon={<ZoomInOutlined />}
                disabled={!canZoom}
                onClick={() => zoomTo(settings.zoomLevel * 1.2)}
              />
            </Tooltip>
            <Tooltip
              title={translateMessage(t, 'common:timeline.zoomOut', 'Zoom out')}
            >
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
