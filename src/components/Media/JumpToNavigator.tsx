import { useTranslation } from 'react-i18next'
import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { MoreHorizontal } from 'lucide-react'

interface JumpToNavigatorProps {
  results: Array<{ id: string | number; title?: string }>
  selectedId: string | number | null
  onSelect: (id: string | number) => void
  maxButtons?: number
}

export function JumpToNavigator({
  results,
  selectedId,
  onSelect,
  maxButtons = 12
}: JumpToNavigatorProps) {
  const { t } = useTranslation(['review'])

  if (results.length <= 5) {
    return null
  }

  const displayResults = results.slice(0, maxButtons)
  const overflowResults = results.slice(maxButtons)

  const overflowMenuItems: MenuProps['items'] = overflowResults.map((r) => ({
    key: String(r.id),
    label: String(r.title || r.id),
    onClick: () => onSelect(r.id)
  }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
        {t('mediaPage.jumpTo', 'Jump to')}
      </span>
      <div className="flex flex-wrap gap-1">
        {displayResults.map((r) => {
          const isSelected = selectedId === r.id
          const displayTitle = String(r.title || r.id).slice(0, 24)
          const needsTruncation = String(r.title || r.id).length > 24

          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={String(r.title || r.id)}
              aria-label={t('mediaPage.jumpToItem', 'Jump to: {{title}}', { title: String(r.title || r.id) })}
              aria-pressed={isSelected}
            >
              {displayTitle}
              {needsTruncation && '...'}
            </button>
          )
        })}
        {results.length > maxButtons && (
          <Dropdown
            menu={{ items: overflowMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <button
              className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              title={t('mediaPage.showMore', 'Show more items')}
            >
              <MoreHorizontal className="w-3 h-3" />
              <span>+{results.length - maxButtons}</span>
            </button>
          </Dropdown>
        )}
      </div>
    </div>
  )
}
