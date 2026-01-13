import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw, Trash2, Undo2 } from 'lucide-react'
import FeatureEmptyState from '@/components/Common/FeatureEmptyState'
import { useServerOnline } from '@/hooks/useServerOnline'
import { useServerCapabilities } from '@/hooks/useServerCapabilities'
import { useDemoMode } from '@/context/demo-mode'
import { useAntdMessage } from '@/hooks/useAntdMessage'
import { useConfirmDanger } from '@/components/Common/confirm-danger'
import { Pagination } from '@/components/Media/Pagination'
import { bgRequest } from '@/services/background-proxy'
import { toAllowedPath } from '@/services/tldw/path-utils'

const BULK_ACTION_BATCH_SIZE = 10
const BULK_ACTION_DELAY_MS = 100
const PAGE_SIZE = 20

type TrashItem = {
  id: number
  title?: string
  type?: string
  url?: string
}

type TrashResponse = {
  items: TrashItem[]
  pagination?: {
    page?: number
    results_per_page?: number
    total_pages?: number
    total_items?: number
  }
}

const executeBatchedRequests = async <T,>(
  ids: number[],
  makeRequest: (id: number) => Promise<T>
): Promise<{ successCount: number; failedCount: number }> => {
  const results: PromiseSettledResult<T>[] = []
  for (let i = 0; i < ids.length; i += BULK_ACTION_BATCH_SIZE) {
    const chunk = ids.slice(i, i + BULK_ACTION_BATCH_SIZE).map(makeRequest)
    results.push(...(await Promise.allSettled(chunk)))
    if (i + BULK_ACTION_BATCH_SIZE < ids.length) {
      await new Promise((resolve) => setTimeout(resolve, BULK_ACTION_DELAY_MS))
    }
  }
  const successCount = results.filter((result) => result.status === 'fulfilled').length
  return { successCount, failedCount: ids.length - successCount }
}

const TrashPageContent: React.FC = () => {
  const { t } = useTranslation(['review', 'common'])
  const message = useAntdMessage()
  const confirmDanger = useConfirmDanger()
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState<number | null>(null)
  const [actionType, setActionType] = useState<'restore' | 'delete' | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState<'restore' | 'delete' | 'empty' | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  const fetchTrash = useCallback(async (): Promise<TrashResponse> => {
    return await bgRequest<TrashResponse>({
      path: toAllowedPath(`/api/v1/media/trash?page=${page}&results_per_page=${PAGE_SIZE}`)
    })
  }, [page])

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch
  } = useQuery({
    queryKey: ['media-trash', page, PAGE_SIZE],
    queryFn: fetchTrash,
    placeholderData: keepPreviousData,
    staleTime: 20_000
  })

  const items = useMemo(() => data?.items ?? [], [data])
  const hasData = Boolean(data)
  const pagination = hasData ? data?.pagination : undefined
  const totalItems = hasData ? Number(pagination?.total_items ?? items.length ?? 0) : 0
  const totalPages = hasData
    ? Number(pagination?.total_pages ?? (items.length > 0 ? 1 : 0))
    : 0
  const visibleSelectedCount = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)).length,
    [items, selectedIds]
  )
  const selectedCount = visibleSelectedCount
  const allVisibleSelected = items.length > 0 && visibleSelectedCount === items.length
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected
  const isBulkBusy = bulkAction !== null
  const isAnyActionBusy = isBulkBusy || actionId !== null
  const showLoadingState = (isLoading || isFetching) && !hasData

  useEffect(() => {
    if (!totalPages || page <= totalPages) return
    setPage(Math.max(1, totalPages))
  }, [page, totalPages])

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected
    }
  }, [someVisibleSelected])

  // Keep bulk actions scoped to the current page results.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<number>()
      items.forEach((item) => {
        if (prev.has(item.id)) next.add(item.id)
      })
      return next
    })
  }, [items])

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (items.length === 0) return next
      if (items.every((item) => next.has(item.id))) {
        items.forEach((item) => next.delete(item.id))
      } else {
        items.forEach((item) => next.add(item.id))
      }
      return next
    })
  }, [items])

  const restoreItem = useCallback(async (item: TrashItem) => {
    if (item.id == null) return
    setActionId(item.id)
    setActionType('restore')
    try {
      await bgRequest({
        path: toAllowedPath(`/api/v1/media/${item.id}/restore`),
        method: 'POST'
      })
      message.success(
        t('review:trashPage.restoreSuccess', {
          defaultValue: 'Item restored'
        })
      )
      await refetch()
    } catch (err) {
      console.error('Failed to restore trashed item:', err)
      message.error(
        t('review:trashPage.restoreFailed', {
          defaultValue: 'Failed to restore item'
        })
      )
    } finally {
      setActionId(null)
      setActionType(null)
    }
  }, [message, refetch, t])

  const deleteItem = useCallback(async (item: TrashItem) => {
    if (item.id == null) return
    const ok = await confirmDanger({
      title: t('common:confirmTitle', { defaultValue: 'Please confirm' }),
      content: t('review:trashPage.deletePermanentConfirm', {
        defaultValue: 'Permanently delete this item? This cannot be undone.'
      }),
      okText: t('common:delete', { defaultValue: 'Delete' }),
      cancelText: t('common:cancel', { defaultValue: 'Cancel' })
    })
    if (!ok) return

    setActionId(item.id)
    setActionType('delete')
    try {
      await bgRequest({
        path: toAllowedPath(`/api/v1/media/${item.id}/permanent`),
        method: 'DELETE'
      })
      message.success(
        t('review:trashPage.deletePermanentSuccess', {
          defaultValue: 'Item permanently deleted'
        })
      )
      await refetch()
    } catch (err) {
      console.error('Failed to permanently delete trashed item:', err)
      message.error(
        t('review:trashPage.deletePermanentFailed', {
          defaultValue: 'Failed to delete item'
        })
      )
    } finally {
      setActionId(null)
      setActionType(null)
    }
  }, [confirmDanger, message, refetch, t])

  const handleBulkRestore = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkAction('restore')
    try {
      const { successCount, failedCount } = await executeBatchedRequests(ids, (id) =>
        bgRequest({
          path: toAllowedPath(`/api/v1/media/${id}/restore`),
          method: 'POST'
        })
      )
      if (successCount > 0) {
        message.success(
          t('review:trashPage.restoreSelectedSuccess', {
            defaultValue: 'Restored {{count}} items',
            count: successCount
          })
        )
      }
      if (failedCount > 0) {
        message.error(
          t('review:trashPage.restoreSelectedPartial', {
            defaultValue: 'Failed to restore {{count}} items',
            count: failedCount
          })
        )
      }
      await refetch()
    } catch (err) {
      console.error('Failed to restore selected items:', err)
      message.error(
        t('review:trashPage.restoreSelectedFailed', {
          defaultValue: 'Failed to restore selected items'
        })
      )
    } finally {
      setSelectedIds(new Set())
      setBulkAction(null)
    }
  }, [message, refetch, selectedIds, t])

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const ok = await confirmDanger({
      title: t('common:confirmTitle', { defaultValue: 'Please confirm' }),
      content: t('review:trashPage.deleteSelectedConfirm', {
        defaultValue: 'Permanently delete {{count}} items? This cannot be undone.',
        count: ids.length
      }),
      okText: t('common:delete', { defaultValue: 'Delete' }),
      cancelText: t('common:cancel', { defaultValue: 'Cancel' })
    })
    if (!ok) return
    setBulkAction('delete')
    try {
      const { successCount, failedCount } = await executeBatchedRequests(ids, (id) =>
        bgRequest({
          path: toAllowedPath(`/api/v1/media/${id}/permanent`),
          method: 'DELETE'
        })
      )
      if (successCount > 0) {
        message.success(
          t('review:trashPage.deleteSelectedSuccess', {
            defaultValue: 'Deleted {{count}} items',
            count: successCount
          })
        )
      }
      if (failedCount > 0) {
        message.error(
          t('review:trashPage.deleteSelectedPartial', {
            defaultValue: 'Failed to delete {{count}} items',
            count: failedCount
          })
        )
      }
      await refetch()
    } catch (err) {
      console.error('Failed to delete selected items:', err)
      message.error(
        t('review:trashPage.deleteSelectedFailed', {
          defaultValue: 'Failed to delete selected items'
        })
      )
    } finally {
      setSelectedIds(new Set())
      setBulkAction(null)
    }
  }, [confirmDanger, message, refetch, selectedIds, t])

  const handleEmptyTrash = useCallback(async () => {
    const ok = await confirmDanger({
      title: t('common:confirmTitle', { defaultValue: 'Please confirm' }),
      content: t('review:trashPage.emptyTrashConfirm', {
        defaultValue:
          'Permanently delete all items in trash? This cannot be undone.'
      }),
      okText: t('common:delete', { defaultValue: 'Delete' }),
      cancelText: t('common:cancel', { defaultValue: 'Cancel' })
    })
    if (!ok) return
    setBulkAction('empty')
    try {
      const response = await bgRequest<{
        deleted_count?: number
        failed_count?: number
      }>({
        path: toAllowedPath('/api/v1/media/trash/empty'),
        method: 'POST'
      })
      const deletedCount = Number(response?.deleted_count || 0)
      const failedCount = Number(response?.failed_count || 0)
      if (deletedCount > 0) {
        message.success(
          t('review:trashPage.emptyTrashSuccess', {
            defaultValue: 'Deleted {{count}} items',
            count: deletedCount
          })
        )
      }
      if (failedCount > 0) {
        message.error(
          t('review:trashPage.emptyTrashPartial', {
            defaultValue: '{{count}} items could not be deleted',
            count: failedCount
          })
        )
      }
      if (deletedCount === 0 && failedCount === 0) {
        message.info(
          t('review:trashPage.emptyTrashNone', {
            defaultValue: 'Trash already empty'
          })
        )
      }
      await refetch()
    } catch (err) {
      console.error('Failed to empty trash:', err)
      message.error(
        t('review:trashPage.emptyTrashFailed', {
          defaultValue: 'Failed to empty trash'
        })
      )
    } finally {
      setSelectedIds(new Set())
      setBulkAction(null)
    }
  }, [confirmDanger, message, refetch, t])

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text">
            {t('review:trashPage.title', { defaultValue: 'Trash' })}
          </h1>
          <p className="text-xs text-text-muted">
            {t('review:trashPage.subtitle', {
              defaultValue:
                'Items moved to trash stay here until you restore or permanently delete them.'
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface2 hover:text-text disabled:opacity-60"
            disabled={isFetching || isAnyActionBusy}
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t('review:trashPage.refresh', { defaultValue: 'Refresh' })}
          </button>
          <button
            type="button"
            onClick={handleEmptyTrash}
            className="inline-flex items-center gap-2 rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-60"
            disabled={totalItems === 0 || isAnyActionBusy}
          >
            {bulkAction === 'empty' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {t('review:trashPage.emptyTrash', { defaultValue: 'Empty trash' })}
          </button>
        </div>
      </div>

      {hasData && !isError && items.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
          <label className="inline-flex items-center gap-2">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              disabled={isAnyActionBusy}
              aria-label={t('review:trashPage.selectAllVisible', {
                defaultValue: 'Select all visible'
              })}
            />
            <span>{t('review:trashPage.selectAllVisible', { defaultValue: 'Select all visible' })}</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {t('review:trashPage.selectedCount', {
                defaultValue: '{{count}} selected',
                count: selectedCount
              })}
            </span>
            <button
              type="button"
              onClick={handleBulkRestore}
              disabled={selectedCount === 0 || isAnyActionBusy}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface2 disabled:opacity-60"
            >
              {bulkAction === 'restore' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              {t('review:trashPage.restoreSelected', { defaultValue: 'Restore selected' })}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedCount === 0 || isAnyActionBusy}
              className="inline-flex items-center gap-2 rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              {bulkAction === 'delete' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {t('review:trashPage.deleteSelected', { defaultValue: 'Delete selected' })}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex-1">
        {showLoadingState ? (
          <div className="flex h-full items-center justify-center text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <FeatureEmptyState
            title={t('review:trashPage.errorTitle', {
              defaultValue: 'Unable to load trash'
            })}
            description={t('review:trashPage.errorDescription', {
              defaultValue:
                'We could not load trash items. Check your connection and try again.'
            })}
            examples={[]}
            primaryActionLabel={t('common:retry', { defaultValue: 'Retry' })}
            onPrimaryAction={refetch}
            primaryDisabled={isFetching}
          />
        ) : items.length === 0 ? (
          <FeatureEmptyState
            title={t('review:trashPage.emptyTitle', {
              defaultValue: 'Trash is empty'
            })}
            description={t('review:trashPage.emptyDescription', {
              defaultValue:
                'Deleted media items show up here until you restore them or delete them permanently.'
            })}
            examples={[]}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isRestoring = actionId === item.id && actionType === 'restore'
              const isDeleting = actionId === item.id && actionType === 'delete'
              const isChecked = selectedIds.has(item.id)
              const isBusy = isAnyActionBusy
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      checked={isChecked}
                      onChange={() => toggleSelected(item.id)}
                      disabled={isBusy}
                      aria-label={t('review:trashPage.selectItem', {
                        defaultValue: 'Select item {{id}}',
                        id: item.id
                      })}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text">
                        {item.title || `Media ${item.id}`}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span className="rounded-full bg-surface2 px-2 py-0.5">
                          {item.type || t('review:mediaPage.notAvailable', { defaultValue: 'N/A' })}
                        </span>
                        <span>#{item.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => restoreItem(item)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface2 disabled:opacity-60"
                    >
                      {isRestoring ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5" />
                      )}
                      {isRestoring
                        ? t('review:trashPage.restoring', { defaultValue: 'Restoring...' })
                        : t('review:trashPage.restore', { defaultValue: 'Restore' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-2 rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-60"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {isDeleting
                        ? t('review:trashPage.deleting', { defaultValue: 'Deleting...' })
                        : t('review:trashPage.deletePermanent', { defaultValue: 'Delete permanently' })}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasData && !isError && (
        <div className="mt-6">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            itemsPerPage={PAGE_SIZE}
            currentItemsCount={items.length}
          />
        </div>
      )}
    </div>
  )
}

const MediaTrashPage: React.FC = () => {
  const { t } = useTranslation(['review', 'common', 'settings'])
  const navigate = useNavigate()
  const isOnline = useServerOnline()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const { demoEnabled } = useDemoMode()

  const mediaUnsupported = !capsLoading && capabilities && !capabilities.hasMedia

  if (!isOnline && demoEnabled) {
    return (
      <div className="flex h-full items-center justify-center">
        <FeatureEmptyState
          title={t('review:mediaEmpty.offlineTitle', {
            defaultValue: 'Media API not available offline'
          })}
          description={t('review:mediaEmpty.offlineDescription', {
            defaultValue:
              'This feature requires connection to the tldw server. Please check your server connection.'
          })}
          examples={[]}
        />
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex h-full items-center justify-center">
        <FeatureEmptyState
          title={t('review:mediaEmpty.offlineTitle', {
            defaultValue: 'Server offline'
          })}
          description={t('review:mediaEmpty.offlineDescription', {
            defaultValue: 'Please check your server connection.'
          })}
          examples={[]}
        />
      </div>
    )
  }

  if (capsLoading) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (isOnline && mediaUnsupported) {
    return (
      <FeatureEmptyState
        title={
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              {t('review:mediaEmpty.featureUnavailableBadge', {
                defaultValue: 'Feature unavailable'
              })}
            </span>
            <span>
              {t('review:mediaEmpty.offlineTitle', {
                defaultValue: 'Media API not available on this server'
              })}
            </span>
          </span>
        }
        description={t('review:mediaEmpty.offlineDescription', {
          defaultValue:
            'This workspace depends on Media Review support in your tldw server. You can continue using chat, notes, and other tools while you upgrade to a version that includes Media.'
        })}
        examples={[
          t('review:mediaEmpty.offlineExample1', {
            defaultValue:
              'Open Diagnostics to confirm your server version and available APIs.'
          }),
          t('review:mediaEmpty.offlineExample2', {
            defaultValue: 'After upgrading, reload the extension and return to Media.'
          }),
          t('review:mediaEmpty.offlineTechnicalDetails', {
            defaultValue:
              'Technical details: this tldw server does not advertise the Media endpoints (for example, /api/v1/media and /api/v1/media/search).'
          })
        ]}
        primaryActionLabel={t('settings:healthSummary.diagnostics', {
          defaultValue: 'Open Diagnostics'
        })}
        onPrimaryAction={() => navigate('/settings/health')}
      />
    )
  }

  return <TrashPageContent />
}

export default MediaTrashPage
