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

export function SearchBar({ value, onChange, placeholder = "Search media (title/content)", onClearAll, hasActiveFilters = false }: SearchBarProps) {
  const { t } = useTranslation(['review'])

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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c0c0c] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
      />
      {/* Clear search only button */}
      {value && !hasActiveFilters && (
        <button
          onClick={handleClearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={t('mediaPage.clearSearch', 'Clear search')}
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      {/* Clear all (search + filters) button when filters active */}
      {(value || hasActiveFilters) && hasActiveFilters && onClearAll && (
        <Tooltip title={t('mediaPage.clearAllFilters', 'Clear search and filters')}>
          <button
            onClick={handleClearAll}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300"
            aria-label={t('mediaPage.clearAllFilters', 'Clear search and filters')}
            type="button"
          >
            <FilterX className="w-5 h-5" />
          </button>
        </Tooltip>
      )}
      {/* Clear search only when we have value but no filters */}
      {value && hasActiveFilters && !onClearAll && (
        <button
          onClick={handleClearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={t('mediaPage.clearSearch', 'Clear search')}
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
