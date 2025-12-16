import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems: number
  itemsPerPage: number
  currentItemsCount: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  currentItemsCount
}: PaginationProps) {
  const { t } = useTranslation(['review'])
  const [jumpToPage, setJumpToPage] = useState('')
  const [jumpError, setJumpError] = useState('')

  // Clear error when totalPages changes (pagination state updated)
  // IMPORTANT: All hooks must be called before any early returns
  useEffect(() => {
    if (jumpError) {
      setJumpError('')
    }
  }, [totalPages])

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = (currentPage - 1) * itemsPerPage + currentItemsCount

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }, [currentPage, onPageChange])

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }, [currentPage, totalPages, onPageChange])

  const handlePageClick = useCallback((page: number) => {
    onPageChange(page)
  }, [onPageChange])

  const handleJumpToPage = useCallback(() => {
    const pageNum = parseInt(jumpToPage, 10)
    if (isNaN(pageNum) || pageNum < 1) {
      setJumpError(t('mediaPage.pageRangeError', 'Page must be 1-{{max}}', { max: totalPages }))
      return
    }
    // Clamp to current totalPages and clear error + input on success
    const clampedPage = Math.min(pageNum, totalPages)
    setJumpError('')
    setJumpToPage('')
    onPageChange(clampedPage)
  }, [jumpToPage, totalPages, onPageChange, t])

  const handleJumpInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setJumpToPage(e.target.value)
    // Clear error when user starts typing again
    setJumpError('')
  }, [])

  const handleJumpKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJumpToPage()
    }
  }, [handleJumpToPage])

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('...')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('...')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }, [totalPages, currentPage])

  // Handle empty results case - after all hooks
  if (currentItemsCount === 0) {
    return (
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#171717]">
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
          0 of {totalItems} results
        </div>
      </div>
    )
  }

  if (totalPages <= 1) {
    return (
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#171717]">
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
          {currentItemsCount} of {totalItems} results
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#171717]">
      {/* Items count */}
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">
        Showing {startItem}-{endItem} of {totalItems}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-center gap-1 mb-2">
        {/* Previous button */}
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-1.5 py-0.5 text-gray-400 dark:text-gray-500 text-xs"
                aria-hidden="true"
                role="presentation"
              >
                ...
              </span>
            )
          }

          const pageNum = page as number
          const isActive = pageNum === currentPage

          return (
            <button
              key={pageNum}
              onClick={() => handlePageClick(pageNum)}
              aria-label={t('mediaPage.goToPage', 'Go to page {{num}}', { num: pageNum })}
              aria-current={isActive ? 'page' : undefined}
              className={`px-2 py-0.5 rounded text-xs transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                isActive
                  ? 'bg-blue-600 dark:bg-blue-600 text-white font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {pageNum}
            </button>
          )
        })}

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Jump to page - only show if there are many pages */}
      {totalPages > 5 && (
        <div className="flex items-center justify-center gap-1.5">
          <label htmlFor="jump-to-page" className="text-xs text-gray-600 dark:text-gray-400">
            {t('mediaPage.pageLabel', 'Page:')}
          </label>
          <Tooltip
            title={jumpError}
            open={!!jumpError}
            color="red"
          >
            <input
              id="jump-to-page"
              type="number"
              min="1"
              max={totalPages}
              value={jumpToPage}
              onChange={handleJumpInputChange}
              onKeyDown={handleJumpKeyPress}
              placeholder={`1-${totalPages}`}
              className={`w-16 px-1.5 py-0.5 text-xs border bg-white dark:bg-[#0c0c0c] text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
                jumpError
                  ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-600'
              }`}
              aria-invalid={!!jumpError}
              aria-describedby={jumpError ? 'jump-page-error' : undefined}
            />
          </Tooltip>
          <button
            onClick={handleJumpToPage}
            className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            {t('mediaPage.go', 'Go')}
          </button>
        </div>
      )}
    </div>
  )
}
