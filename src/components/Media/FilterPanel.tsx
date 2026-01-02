import { ChevronDown, Filter, Star } from 'lucide-react'
import { useState } from 'react'
import { Select } from 'antd'
import { useTranslation } from 'react-i18next'

interface FilterPanelProps {
  mediaTypes: string[]
  selectedMediaTypes: string[]
  onMediaTypesChange: (types: string[]) => void
  selectedKeywords: string[]
  onKeywordsChange: (keywords: string[]) => void
  keywordOptions?: string[]
  onKeywordSearch?: (text: string) => void
  showFavoritesOnly?: boolean
  onShowFavoritesOnlyChange?: (show: boolean) => void
  favoritesCount?: number
}

// Normalize media type to Title Case for consistent display
const toTitleCase = (str: string): string => {
  if (!str) return str
  return str
    .toLowerCase()
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Get user-friendly label for media type
const getMediaTypeLabel = (type: string): string => {
  const normalized = toTitleCase(type)
  // Map common types to better labels if needed
  const labelMap: Record<string, string> = {
    'Youtube': 'YouTube',
    'Pdf': 'PDF',
    'Mp3': 'MP3',
    'Mp4': 'MP4',
    'Wav': 'WAV',
    'Html': 'HTML',
    'Url': 'URL'
  }
  return labelMap[normalized] || normalized
}

export function FilterPanel({
  mediaTypes,
  selectedMediaTypes,
  onMediaTypesChange,
  selectedKeywords,
  onKeywordsChange,
  keywordOptions = [],
  onKeywordSearch,
  showFavoritesOnly = false,
  onShowFavoritesOnlyChange,
  favoritesCount = 0
}: FilterPanelProps) {
  const { t } = useTranslation(['review'])
  const [expandedSections, setExpandedSections] = useState({
    mediaTypes: false,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleMediaTypeToggle = (type: string) => {
    if (selectedMediaTypes.includes(type)) {
      onMediaTypesChange(selectedMediaTypes.filter(t => t !== type))
    } else {
      onMediaTypesChange([...selectedMediaTypes, type])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text">
          <Filter className="w-4 h-4" />
          <span>
            {t('review:reviewPage.filters', { defaultValue: 'Filters' })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onMediaTypesChange([])
            onKeywordsChange([])
            onShowFavoritesOnlyChange?.(false)
          }}
          className="text-sm text-primary hover:text-primaryStrong"
        >
          {t('review:mediaPage.clearAll', { defaultValue: 'Clear all' })}
        </button>
      </div>

      {/* Favorites Toggle */}
      {onShowFavoritesOnlyChange && (
        <label className="flex items-center gap-2 cursor-pointer py-1 px-1 rounded hover:bg-surface2 transition-colors">
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={(e) => onShowFavoritesOnlyChange(e.target.checked)}
            className="w-4 h-4 rounded border-border text-warn focus:ring-2 focus:ring-warn"
          />
          <Star className={`w-4 h-4 text-warn ${showFavoritesOnly ? 'fill-warn' : ''}`} />
          <span className="text-sm text-text">
            {t('review:mediaPage.favoritesOnly', { defaultValue: 'Favorites only' })}
          </span>
          {favoritesCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-warn/10 text-warn font-medium">
              {favoritesCount}
            </span>
          )}
        </label>
      )}

      {/* Media Types */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => toggleSection('mediaTypes')}
          className="flex items-center justify-between w-full text-sm text-text hover:text-text"
        >
          <span>
            {t('review:reviewPage.mediaTypes', {
              defaultValue: 'Media types'
            })}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expandedSections.mediaTypes ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.mediaTypes && (
          <div className="pl-1">
            {mediaTypes.length > 0 ? (
              <div className="space-y-2">
                {mediaTypes.map(type => {
                  const displayLabel = getMediaTypeLabel(type)
                  return (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMediaTypes.includes(type)}
                        onChange={() => handleMediaTypeToggle(type)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-focus"
                        aria-label={t('review:mediaPage.filterMediaType', 'Filter by {{type}}', { type: displayLabel })}
                      />
                      <span className="text-sm text-text">{displayLabel}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-text-muted">
                {t('review:mediaPage.noMediaTypes', {
                  defaultValue: 'No media types available'
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Keywords */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-text">
            {t('review:reviewPage.keywords', { defaultValue: 'Keywords' })}
          </div>
          {selectedKeywords.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primaryStrong font-medium">
              {t('review:mediaPage.keywordsSelected', '{{count}} selected', { count: selectedKeywords.length })}
            </span>
          )}
        </div>
        <Select
          mode="tags"
          allowClear
          placeholder={t('review:mediaPage.filterByKeyword', {
            defaultValue: 'Filter by keyword'
          })}
          className="w-full"
          value={selectedKeywords}
          onSearch={(txt) => {
            if (onKeywordSearch) onKeywordSearch(txt)
          }}
          onChange={(vals) => {
            onKeywordsChange(vals as string[])
          }}
          options={keywordOptions.map((k) => ({ label: k, value: k }))}
        />
        <div className="text-xs text-text-muted">
          {t('review:mediaPage.keywordHelper', {
            defaultValue:
              'Add keywords to narrow down results. Keywords are assigned when reviewing media.'
          })}
        </div>
      </div>
    </div>
  )
}
