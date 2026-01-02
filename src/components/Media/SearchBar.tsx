import { Search, X, FilterX } from 'lucide-react'
import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onClearAll?: () => void // Optional callback to reset filters too
  hasActiveFilters?: boolean // Whether there are active filters to clear
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search media (title/content)',
  onClearAll,
  hasActiveFilters = false
}: SearchBarProps) {
  const { t } = useTranslation(['review'])

  const showClearSearch = value.length > 0
  const showClearAll = Boolean(hasActiveFilters && onClearAll)
  const inputPaddingClass = showClearSearch && showClearAll ? 'pr-16' : 'pr-10'

  const handleClearSearch = () => {
    onChange('')
  }

  const handleClearAll = () => {
    onChange('')
    if (onClearAll) {
      onClearAll()
    }
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-subtle" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pl-10 ${inputPaddingClass} py-2.5 border border-border bg-surface text-text placeholder:text-text-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent`}
      />
      {/* Clear search button */}
      {showClearSearch && (
        <button
          onClick={handleClearSearch}
          className={`absolute top-1/2 -translate-y-1/2 text-text-subtle hover:text-text ${
            showClearAll ? 'right-10' : 'right-3'
          }`}
          aria-label={t('mediaPage.clearSearch', 'Clear search')}
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      {/* Clear all (search + filters) button when filters active */}
      {showClearAll && (
        <Tooltip title={t('mediaPage.clearAllFilters', 'Clear search and filters')}>
          <button
            onClick={handleClearAll}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-warn hover:text-warn"
            aria-label={t('mediaPage.clearAllFilters', 'Clear search and filters')}
            type="button"
          >
            <FilterX className="w-5 h-5" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
