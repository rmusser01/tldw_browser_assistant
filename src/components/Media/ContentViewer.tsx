import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  ChevronDown,
  ChevronUp,
  Send,
  Copy,
  Sparkles,
  MoreHorizontal,
  MessageSquare,
  Clock,
  FileText,
  StickyNote,
  Edit3,
  ExternalLink,
  Expand,
  Minimize2,
  Loader2,
  Trash2
} from 'lucide-react'
import React, { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react'
import { Select, Dropdown, Tooltip, message, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import type { MenuProps } from 'antd'
import { AnalysisModal } from './AnalysisModal'
import { AnalysisEditModal } from './AnalysisEditModal'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { DeveloperToolsSection } from './DeveloperToolsSection'
import { DiffViewModal } from './DiffViewModal'
import { MarkdownPreview } from '@/components/Common/MarkdownPreview'
import { useConfirmDanger } from '@/components/Common/confirm-danger'
import { bgRequest } from '@/services/background-proxy'
import type { MediaResultItem } from './types'
import { getTextStats } from '@/utils/text-stats'
import { useSetting } from '@/hooks/useSetting'
import { MEDIA_COLLAPSED_SECTIONS_SETTING } from '@/services/settings/ui-settings'

// Lazy load ContentEditModal for code splitting
const ContentEditModal = React.lazy(() =>
  import('./ContentEditModal').then((m) => ({ default: m.ContentEditModal }))
)

interface ContentViewerProps {
  selectedMedia: MediaResultItem | null
  content: string
  mediaDetail?: any
  isDetailLoading?: boolean
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
  currentIndex?: number
  totalResults?: number
  onChatWithMedia?: () => void
  onChatAboutMedia?: () => void
  onRefreshMedia?: () => void
  onKeywordsUpdated?: (mediaId: string | number, keywords: string[]) => void
  onCreateNoteWithContent?: (content: string, title: string) => void
  onOpenInMultiReview?: () => void
  onSendAnalysisToChat?: (text: string) => void
  contentRef?: (node: HTMLDivElement | null) => void
  onDeleteItem?: (item: MediaResultItem, detail: any | null) => Promise<void>
}


export function ContentViewer({
  selectedMedia,
  content,
  mediaDetail,
  isDetailLoading = false,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  currentIndex = 0,
  totalResults = 0,
  onChatWithMedia,
  onChatAboutMedia,
  onRefreshMedia,
  onKeywordsUpdated,
  onCreateNoteWithContent,
  onOpenInMultiReview,
  onSendAnalysisToChat,
  contentRef,
  onDeleteItem
}: ContentViewerProps) {
  const { t } = useTranslation(['review', 'common'])
  const confirmDanger = useConfirmDanger()
  const [collapsedSections, setCollapsedSections] = useSetting(
    MEDIA_COLLAPSED_SECTIONS_SETTING
  )
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)
  const [editingKeywords, setEditingKeywords] = useState<string[]>([])
  const [savingKeywords, setSavingKeywords] = useState(false)
  const saveKeywordsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New state for enhanced features
  const [contentExpanded, setContentExpanded] = useState(true)
  const [analysisEditModalOpen, setAnalysisEditModalOpen] = useState(false)
  const [editingAnalysisText, setEditingAnalysisText] = useState('')
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [diffLeftText, setDiffLeftText] = useState('')
  const [diffRightText, setDiffRightText] = useState('')
  const [diffLeftLabel, setDiffLeftLabel] = useState('')
  const [diffRightLabel, setDiffRightLabel] = useState('')
  const [contentEditModalOpen, setContentEditModalOpen] = useState(false)
  const [editingContentText, setEditingContentText] = useState('')
  const [deletingItem, setDeletingItem] = useState(false)

  // Content length threshold for collapse (2500 chars)
  const CONTENT_COLLAPSE_THRESHOLD = 2500
  const shouldShowExpandToggle = content && content.length > CONTENT_COLLAPSE_THRESHOLD
  const contentForPreview = useMemo(() => {
    if (!content) return ''
    if (selectedMedia?.kind === 'note') return content
    return content.replace(/\r\n/g, '\n').replace(/\n/g, '  \n')
  }, [content, selectedMedia?.kind])

  const resolveNoteVersion = (detail: any, raw: any): number | null => {
    const candidates = [
      detail?.version,
      detail?.metadata?.version,
      raw?.version,
      raw?.metadata?.version
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        const parsed = Number(candidate)
        if (Number.isFinite(parsed)) return parsed
      }
    }
    return null
  }

  // Sync editing keywords with selected media
  useEffect(() => {
    if (saveKeywordsTimeout.current) {
      clearTimeout(saveKeywordsTimeout.current)
      saveKeywordsTimeout.current = null
    }
    setEditingKeywords(selectedMedia?.keywords || [])
  }, [selectedMedia?.id, selectedMedia?.keywords])

  // Save keywords to API (debounced)
  const persistKeywords = useCallback(
    async (newKeywords: string[]) => {
      if (!selectedMedia) return
      setSavingKeywords(true)
      try {
        const endpoint =
          selectedMedia.kind === 'note'
            ? `/api/v1/notes/${selectedMedia.id}`
            : `/api/v1/media/${selectedMedia.id}`
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (selectedMedia.kind === 'note') {
          let expectedVersion = resolveNoteVersion(mediaDetail, selectedMedia.raw)
          if (expectedVersion == null) {
            try {
              const latest = await bgRequest<any>({
                path: `/api/v1/notes/${selectedMedia.id}` as any,
                method: 'GET' as any
              })
              expectedVersion = resolveNoteVersion(latest, null)
            } catch {
              expectedVersion = null
            }
          }
          if (expectedVersion == null) {
            throw new Error(
              t('review:mediaPage.noteUpdateNeedsReload', {
                defaultValue: 'Unable to update note. Reload and try again.'
              })
            )
          }
          headers['expected-version'] = String(expectedVersion)
        }

        await bgRequest({
          path: endpoint as any,
          method: 'PUT' as any,
          headers,
          body: { keywords: newKeywords }
        })
        setEditingKeywords(newKeywords)
        if (onKeywordsUpdated) {
          onKeywordsUpdated(selectedMedia.id, newKeywords)
        }
        message.success(
          t('review:mediaPage.keywordsSaved', {
            defaultValue: 'Keywords saved'
          })
        )
      } catch (err) {
        console.error('Failed to save keywords:', err)
        message.error(
          t('review:mediaPage.keywordsSaveFailed', {
            defaultValue: 'Failed to save keywords'
          })
        )
      } finally {
        setSavingKeywords(false)
      }
    },
    [selectedMedia, onKeywordsUpdated]
  )

  const handleDeleteItem = useCallback(async () => {
    if (!selectedMedia || !onDeleteItem || deletingItem) return
    const ok = await confirmDanger({
      title: t('common:confirmTitle', { defaultValue: 'Please confirm' }),
      content: t('review:mediaPage.deleteItemConfirm', {
        defaultValue: 'Delete this item? This cannot be undone.'
      }),
      okText: t('common:delete', { defaultValue: 'Delete' }),
      cancelText: t('common:cancel', { defaultValue: 'Cancel' })
    })
    if (!ok) return
    setDeletingItem(true)
    try {
      await onDeleteItem(selectedMedia, mediaDetail ?? null)
      message.success(t('common:deleted', { defaultValue: 'Deleted' }))
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : ''
      message.error(msg || t('common:deleteFailed', { defaultValue: 'Delete failed' }))
    } finally {
      setDeletingItem(false)
    }
  }, [confirmDanger, deletingItem, mediaDetail, onDeleteItem, selectedMedia, t])

  const handleSaveKeywords = (newKeywords: string[]) => {
    setEditingKeywords(newKeywords)
    if (saveKeywordsTimeout.current) {
      clearTimeout(saveKeywordsTimeout.current)
    }
    saveKeywordsTimeout.current = setTimeout(() => {
      persistKeywords(newKeywords)
    }, 500)
  }

  useEffect(() => {
    return () => {
      if (saveKeywordsTimeout.current) {
        clearTimeout(saveKeywordsTimeout.current)
      }
    }
  }, [])

  // Extract analyses from media detail
  const existingAnalyses = useMemo(() => {
    if (!mediaDetail) return []
    const analyses: Array<{ type: string; text: string }> = []

    // Check processing.analysis (tldw API structure)
    if (mediaDetail.processing?.analysis && typeof mediaDetail.processing.analysis === 'string' && mediaDetail.processing.analysis.trim()) {
      analyses.push({ type: 'Analysis', text: mediaDetail.processing.analysis })
    }

    // Check for summary field (root level)
    if (mediaDetail.summary && typeof mediaDetail.summary === 'string' && mediaDetail.summary.trim()) {
      analyses.push({ type: 'Summary', text: mediaDetail.summary })
    }

    // Check for analysis field (root level)
    if (mediaDetail.analysis && typeof mediaDetail.analysis === 'string' && mediaDetail.analysis.trim()) {
      analyses.push({ type: 'Analysis', text: mediaDetail.analysis })
    }

    // Check for analyses array
    if (Array.isArray(mediaDetail.analyses)) {
      mediaDetail.analyses.forEach((a: any, idx: number) => {
        const text = typeof a === 'string' ? a : (a?.content || a?.text || a?.summary || a?.analysis_content || '')
        const type = typeof a === 'object' && a?.type ? a.type : `Analysis ${idx + 1}`
        if (text && text.trim()) {
          analyses.push({ type, text })
        }
      })
    }

    // Check versions array for analysis_content
    if (Array.isArray(mediaDetail.versions)) {
      mediaDetail.versions.forEach((v: any, idx: number) => {
        if (v?.analysis_content && typeof v.analysis_content === 'string' && v.analysis_content.trim()) {
          const versionNum = v?.version_number || idx + 1
          analyses.push({ type: `Analysis (Version ${versionNum})`, text: v.analysis_content })
        }
      })
    }

    return analyses
  }, [mediaDetail])

  const toggleSection = (section: string) => {
    void setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const copyTextWithToasts = async (
    text: string,
    successKey: string,
    defaultSuccess: string
  ) => {
    if (!text) return
    if (!navigator.clipboard?.writeText) {
      message.error(
        t('mediaPage.copyNotSupported', 'Copy is not supported here')
      )
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      message.success(t(successKey, { defaultValue: defaultSuccess }))
    } catch (err) {
      console.error('Failed to copy text:', err)
      message.error(t('mediaPage.copyFailed', 'Failed to copy'))
    }
  }

  const handleCopyContent = () => {
    if (!content) return
    copyTextWithToasts(content, 'mediaPage.contentCopied', 'Content copied')
  }

  const handleCopyMetadata = () => {
    if (!selectedMedia) return
    const metadata = {
      id: selectedMedia.id,
      title: selectedMedia.title,
      type: selectedMedia.meta?.type,
      source: selectedMedia.meta?.source,
      duration: selectedMedia.meta?.duration
    }
    copyTextWithToasts(
      JSON.stringify(metadata, null, 2),
      'mediaPage.metadataCopied',
      'Metadata copied'
    )
  }

  // Get the first/selected analysis for creating note with analysis
  const selectedAnalysis = existingAnalyses.length > 0 ? existingAnalyses[0] : null

  // Check if viewing a note vs media
  const isNote = selectedMedia?.kind === 'note'

  // Actions dropdown menu items
  const actionMenuItems: MenuProps['items'] = [
    // Chat actions - only for media
    ...(!isNote && onChatWithMedia ? [{
      key: 'chat-with',
      label: t('review:reviewPage.chatWithMedia', {
        defaultValue: 'Chat with this media'
      }),
      icon: <Send className="w-4 h-4" />,
      onClick: onChatWithMedia
    }] : []),
    ...(!isNote && onChatAboutMedia ? [{
      key: 'chat-about',
      label: t('review:reviewPage.chatAboutMedia', {
        defaultValue: 'Chat about this media'
      }),
      icon: <MessageSquare className="w-4 h-4" />,
      onClick: onChatAboutMedia
    }] : []),
    ...(!isNote && (onChatWithMedia || onChatAboutMedia) ? [{ type: 'divider' as const }] : []),
    // Create note actions - only for media
    ...(!isNote && onCreateNoteWithContent ? [{
      key: 'create-note-content',
      label: t('review:mediaPage.createNoteWithContent', {
        defaultValue: 'Create note with content'
      }),
      icon: <StickyNote className="w-4 h-4" />,
      onClick: () => {
        const title = selectedMedia?.title || t('review:mediaPage.untitled', { defaultValue: 'Untitled' })
        onCreateNoteWithContent(content, title)
      }
    }] : []),
    ...(!isNote && onCreateNoteWithContent && selectedAnalysis ? [{
      key: 'create-note-content-analysis',
      label: t('review:mediaPage.createNoteWithContentAnalysis', {
        defaultValue: 'Create note with content + analysis'
      }),
      icon: <StickyNote className="w-4 h-4" />,
      onClick: () => {
        const title = selectedMedia?.title || t('review:mediaPage.untitled', { defaultValue: 'Untitled' })
        const noteContent = `${content}\n\n---\n\n## Analysis\n\n${selectedAnalysis.text}`
        onCreateNoteWithContent(noteContent, title)
      }
    }] : []),
    ...(!isNote && onCreateNoteWithContent ? [{ type: 'divider' as const }] : []),
    {
      key: 'copy-content',
      label: t('review:mediaPage.copyContent', { defaultValue: 'Copy content' }),
      icon: <Copy className="w-4 h-4" />,
      onClick: handleCopyContent
    },
    {
      key: 'copy-metadata',
      label: t('review:mediaPage.copyMetadata', { defaultValue: 'Copy metadata' }),
      icon: <Copy className="w-4 h-4" />,
      onClick: handleCopyMetadata
    },
    // Multi-item review - only for media
    ...(!isNote && onOpenInMultiReview ? [
      { type: 'divider' as const },
      {
        key: 'open-multi-review',
        label: t('review:reviewPage.openInMulti', 'Open in Multi-Item Review'),
        icon: <ExternalLink className="w-4 h-4" />,
        onClick: onOpenInMultiReview
      }
    ] : [])
  ]

  // Use API-provided word count if available, otherwise calculate
  const { wordCount, charCount, paragraphCount } = useMemo(() => {
    const text = content || ''
    const apiWordCount = mediaDetail?.content?.word_count
    const {
      wordCount: computedWordCount,
      charCount,
      paragraphCount
    } = getTextStats(text)
    const wordCountValue =
      typeof apiWordCount === 'number' ? apiWordCount : computedWordCount
    return {
      wordCount: wordCountValue,
      charCount,
      paragraphCount
    }
  }, [content, mediaDetail])

  if (!selectedMedia) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="text-center max-w-md px-6">
          <div className="mb-6 flex justify-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
              <FileSearch className="w-16 h-16 text-blue-400 dark:text-blue-500" />
            </div>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-text">
            {t('review:mediaPage.noSelectionTitle', {
              defaultValue: 'No media item selected'
            })}
          </h2>
          <p className="text-text-muted">
            {t('review:mediaPage.noSelectionDescription', {
              defaultValue:
                'Select a media item from the left sidebar to view its content and analyses here.'
            })}
          </p>
          <p className="mt-4 text-xs text-text-subtle">
            {t('review:mediaPage.keyboardHint', {
              defaultValue: 'Tip: Use j/k to navigate items, arrow keys to change pages'
            })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={contentRef} className="flex-1 flex flex-col bg-bg">
      {/* Compact Header */}
      <div className="px-4 py-2 border-b border-border bg-surface">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Left: Navigation */}
          <div className="flex items-center gap-1">
            <Tooltip
              title={t('review:reviewPage.prevItem', { defaultValue: 'Previous' })}
            >
              <button
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="p-1.5 text-text-muted hover:bg-surface2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('review:reviewPage.prevItem', { defaultValue: 'Previous' })}
                title={t('review:reviewPage.prevItem', { defaultValue: 'Previous' })}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </Tooltip>
            <span className="text-xs text-text-muted tabular-nums min-w-[40px] text-center">
              {totalResults > 0 ? `${currentIndex + 1}/${totalResults}` : '0/0'}
            </span>
            <Tooltip
              title={t('review:reviewPage.nextItem', { defaultValue: 'Next' })}
            >
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="p-1.5 text-text-muted hover:bg-surface2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('review:reviewPage.nextItem', { defaultValue: 'Next' })}
                title={t('review:reviewPage.nextItem', { defaultValue: 'Next' })}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {/* Center: Title */}
          <Tooltip title={selectedMedia.title || ''} placement="bottom">
            <h3 className="flex-1 text-sm font-medium text-text truncate text-center px-2 max-w-[300px] md:max-w-none">
              {selectedMedia.title || `${selectedMedia.kind} ${selectedMedia.id}`}
            </h3>
          </Tooltip>

          {/* Right: Chat Button + Actions Dropdown */}
          <div className="flex items-center gap-1">
            {!isNote && onChatWithMedia && (
              <Tooltip title={t('review:reviewPage.chatWithMedia', { defaultValue: 'Chat with this media' })}>
                <button
                  onClick={onChatWithMedia}
                  className="p-1.5 text-text-muted hover:bg-surface2 rounded"
                  aria-label={t('review:reviewPage.chatWithMedia', { defaultValue: 'Chat with this media' })}
                  title={t('review:reviewPage.chatWithMedia', { defaultValue: 'Chat with this media' })}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            <Dropdown
              menu={{ items: actionMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <button
                className="p-1.5 text-text-muted hover:bg-surface2 rounded"
                aria-label={t('review:mediaPage.actionsLabel', {
                  defaultValue: 'Actions'
                })}
                title={t('review:mediaPage.actionsLabel', {
                  defaultValue: 'Actions'
                })}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isDetailLoading ? (
          <div
            className="flex flex-col items-center justify-center h-64 text-text-muted"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <span className="text-sm">
              {t('review:mediaPage.loadingContent', { defaultValue: 'Loading content...' })}
            </span>
          </div>
        ) : (
        <div className="max-w-4xl mx-auto">
          {/* Meta Row */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted mb-3">
            {selectedMedia.meta?.type && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface2 text-text capitalize font-medium">
                {selectedMedia.meta.type}
              </span>
            )}
            {selectedMedia.meta?.source && (
              <span className="truncate max-w-[200px]" title={selectedMedia.meta.source}>
                {selectedMedia.meta.source}
              </span>
            )}
            {(() => {
              const rawDuration = selectedMedia.meta?.duration as
                | number
                | string
                | null
                | undefined
              const durationSeconds =
                typeof rawDuration === 'number'
                  ? rawDuration
                  : typeof rawDuration === 'string'
                    ? Number(rawDuration)
                    : null
              const durationLabel = formatDuration(durationSeconds)
              if (!durationLabel) return null
              return (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {durationLabel}
                </span>
              )
            })()}
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {wordCount.toLocaleString()} {t('review:mediaPage.words', { defaultValue: 'words' })}
            </span>
          </div>

          {/* Keywords - Compact */}
          <div className="mb-4">
            <Select
              mode="tags"
              allowClear
              placeholder={
                savingKeywords
                  ? t('review:mediaPage.savingKeywords', { defaultValue: 'Saving...' })
                  : t('review:mediaPage.keywordsPlaceholder', { defaultValue: 'Add keywords...' })
              }
              className="w-full"
              size="small"
              value={editingKeywords}
              onChange={(vals) => {
                handleSaveKeywords(vals as string[])
              }}
              loading={savingKeywords}
              disabled={savingKeywords}
              tokenSeparators={[',']}
              suffixIcon={savingKeywords ? <Spin size="small" /> : undefined}
            />
          </div>

          {/* Main Content */}
          <div className="bg-surface border border-border rounded-lg mb-2 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-surface2">
              <button
                onClick={() => toggleSection('content')}
                className="flex items-center gap-2 hover:bg-surface -ml-1 px-1 rounded transition-colors"
                title={t('review:mediaPage.content', { defaultValue: 'Content' })}
              >
                <span className="text-sm font-medium text-text">
                  {t('review:mediaPage.content', { defaultValue: 'Content' })}
                </span>
                {collapsedSections.content ? (
                  <ChevronDown className="w-4 h-4 text-text-subtle" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-text-subtle" />
                )}
              </button>
              <div className="flex items-center gap-1">
                {!isNote && content && (
                  <button
                    onClick={() => {
                      setEditingContentText(content)
                      setContentEditModalOpen(true)
                    }}
                    className="p-1 text-text-muted hover:text-text transition-colors"
                    title={t('review:mediaPage.editContent', {
                      defaultValue: 'Edit content'
                    })}
                    aria-label={t('review:mediaPage.editContent', {
                      defaultValue: 'Edit content'
                    })}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {/* Expand/collapse toggle for long content */}
                {!collapsedSections.content && shouldShowExpandToggle && (
                  <button
                    onClick={() => setContentExpanded((v) => !v)}
                    className="p-1 text-text-muted hover:text-text transition-colors"
                    title={
                      contentExpanded
                        ? t('review:mediaPage.collapse', {
                            defaultValue: 'Collapse'
                          })
                        : t('review:mediaPage.expand', {
                            defaultValue: 'Expand'
                          })
                    }
                  >
                    {contentExpanded ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Expand className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
            {!collapsedSections.content && (
              <div className="p-3 bg-surface animate-in fade-in slide-in-from-top-1 duration-150">
                <div
                  className={`text-sm text-text leading-relaxed ${
                    !contentExpanded && shouldShowExpandToggle ? 'max-h-64 overflow-hidden relative' : ''
                  }`}
                >
                  <MarkdownPreview
                    content={
                      contentForPreview ||
                      t('review:mediaPage.noContent', {
                        defaultValue: 'No content available'
                      })
                    }
                    size="sm"
                  />
                  {/* Fade overlay when collapsed */}
                  {!contentExpanded && shouldShowExpandToggle && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-surface to-transparent" />
                  )}
                </div>
                {/* Show more/less button */}
                {shouldShowExpandToggle && (
                  <button
                    onClick={() => setContentExpanded(v => !v)}
                    className="mt-2 text-xs text-primary hover:underline"
                    title={
                      contentExpanded
                        ? t('review:mediaPage.showLess', { defaultValue: 'Show less' })
                        : t('review:mediaPage.showMore', {
                            defaultValue: `Show more (${Math.round(content.length / 1000)}k chars)`
                          })
                    }
                  >
                    {contentExpanded
                      ? t('review:mediaPage.showLess', { defaultValue: 'Show less' })
                      : t('review:mediaPage.showMore', {
                          defaultValue: `Show more (${Math.round(content.length / 1000)}k chars)`
                        })}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Analysis - only for media, not notes */}
          {!isNote && (
            <div className="bg-surface border border-border rounded-lg mb-2 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-surface2">
              <button
                onClick={() => toggleSection('analysis')}
                className="flex items-center gap-2 hover:bg-surface -ml-1 px-1 rounded transition-colors"
                title={t('review:reviewPage.analysisTitle', { defaultValue: 'Analysis' })}
              >
                <span className="text-sm font-medium text-text">
                  {t('review:reviewPage.analysisTitle', { defaultValue: 'Analysis' })}
                </span>
                  {collapsedSections.analysis ? (
                    <ChevronDown className="w-4 h-4 text-text-subtle" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-text-subtle" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                <button
                  onClick={() => setAnalysisModalOpen(true)}
                  className="px-2 py-1 bg-primary hover:bg-primaryStrong text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
                  title={t('review:mediaPage.generateAnalysisHint', {
                    defaultValue: 'Generate new analysis'
                  })}
                >
                  <Sparkles className="w-3 h-3" />
                  {t('review:mediaPage.generateAnalysis', { defaultValue: 'Generate' })}
                </button>
                  {existingAnalyses.length > 0 && (
                    <>
                      {/* Edit analysis button */}
                      <button
                        onClick={() => {
                          setEditingAnalysisText(existingAnalyses[0].text)
                          setAnalysisEditModalOpen(true)
                        }}
                        className="p-1 text-text-muted hover:text-text transition-colors"
                        title={t('review:mediaPage.editAnalysis', { defaultValue: 'Edit analysis' })}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {/* Send to chat button */}
                      {onSendAnalysisToChat && (
                        <button
                          onClick={() => onSendAnalysisToChat(existingAnalyses[0].text)}
                          className="p-1 text-text-muted hover:text-text transition-colors"
                          title={t('review:reviewPage.sendAnalysisToChat', {
                            defaultValue: 'Send analysis to chat'
                          })}
                        >
                          <Send className="w-3.5 h-3.5" />
                          </button>
                      )}
                      {/* Copy analysis button */}
                      <button
                        onClick={() =>
                          copyTextWithToasts(
                            existingAnalyses[0].text,
                            'mediaPage.analysisCopied',
                            'Analysis copied'
                          )
                        }
                        className="p-1 text-text-muted hover:text-text transition-colors"
                        title={t('review:reviewPage.copyAnalysis', { defaultValue: 'Copy analysis' })}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {!collapsedSections.analysis && (
                <div className="p-3 bg-surface animate-in fade-in slide-in-from-top-1 duration-150">
                  {existingAnalyses.length > 0 ? (
                    <div className="space-y-3">
                    {existingAnalyses.map((analysis, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-muted uppercase">
                            {analysis.type}
                          </span>
                          <button
                            onClick={() =>
                              copyTextWithToasts(
                                analysis.text,
                                'mediaPage.analysisCopied',
                                'Analysis copied'
                              )
                            }
                          className="p-0.5 text-text-subtle hover:text-text"
                              aria-label={t('review:mediaPage.copyAnalysis', {
                                defaultValue: 'Copy analysis to clipboard'
                              })}
                              title={t('review:mediaPage.copyAnalysis', {
                                defaultValue: 'Copy analysis to clipboard'
                              })}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                            {analysis.text}
                          </div>
                          {idx < existingAnalyses.length - 1 && (
                            <div className="border-t border-border pt-3 mt-3" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-text-muted text-center py-4">
                      {t('review:reviewPage.noAnalysis', {
                        defaultValue: 'No analysis yet'
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Statistics */}
          <div className="bg-surface border border-border rounded-lg mb-2 overflow-hidden">
            <button
              onClick={() => toggleSection('statistics')}
              className="w-full flex items-center justify-between px-3 py-2 bg-surface2 hover:bg-surface transition-colors"
              title={t('review:mediaPage.statistics', { defaultValue: 'Statistics' })}
            >
              <span className="text-sm font-medium text-text">
                {t('review:mediaPage.statistics', { defaultValue: 'Statistics' })}
              </span>
              {collapsedSections.statistics ? (
                <ChevronDown className="w-4 h-4 text-text-subtle" />
              ) : (
                <ChevronUp className="w-4 h-4 text-text-subtle" />
              )}
            </button>
            {!collapsedSections.statistics && (
              <div className="p-3 bg-surface animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="flex flex-col">
                    <span className="text-text-muted text-xs">
                      {t('review:mediaPage.words', { defaultValue: 'Words' })}
                    </span>
                    <span className="text-text font-medium">
                      {wordCount}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-text-muted text-xs">
                      {t('review:mediaPage.characters', { defaultValue: 'Characters' })}
                    </span>
                    <span className="text-text font-medium">
                      {charCount}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-text-muted text-xs">
                      {t('review:mediaPage.paragraphs', { defaultValue: 'Paragraphs' })}
                    </span>
                    <span className="text-text font-medium">
                      {paragraphCount}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-surface border border-border rounded-lg mb-2 overflow-hidden">
            <button
              onClick={() => toggleSection('metadata')}
              className="w-full flex items-center justify-between px-3 py-2 bg-surface2 hover:bg-surface transition-colors"
              title={t('review:mediaPage.metadata', { defaultValue: 'Metadata' })}
            >
              <span className="text-sm font-medium text-text">
                {t('review:mediaPage.metadata', { defaultValue: 'Metadata' })}
              </span>
              {collapsedSections.metadata ? (
                <ChevronDown className="w-4 h-4 text-text-subtle" />
              ) : (
                <ChevronUp className="w-4 h-4 text-text-subtle" />
              )}
            </button>
            {!collapsedSections.metadata && (
              <div className="p-3 bg-surface animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted text-xs">
                      {t('review:mediaPage.idLabel', { defaultValue: 'ID' })}
                    </span>
                    <span className="text-text font-mono text-xs">
                      {selectedMedia.id}
                    </span>
                  </div>
                  {selectedMedia.meta?.type && (
                    <div className="flex justify-between py-1">
                      <span className="text-text-muted text-xs">
                        {t('review:mediaPage.typeLabel', { defaultValue: 'Type' })}
                      </span>
                      <span className="text-text text-xs capitalize">
                        {selectedMedia.meta.type}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted text-xs">
                      {t('review:mediaPage.titleLabel', { defaultValue: 'Title' })}
                    </span>
                    <span className="text-text text-xs truncate max-w-[200px]">
                      {selectedMedia.title || t('review:mediaPage.notAvailable', { defaultValue: 'N/A' })}
                    </span>
                  </div>
                  {selectedMedia.meta?.source && (
                    <div className="flex justify-between py-1">
                      <span className="text-text-muted text-xs">
                        {t('review:mediaPage.source', { defaultValue: 'Source' })}
                      </span>
                      <span className="text-text text-xs truncate max-w-[200px]">
                        {selectedMedia.meta.source}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Version History - only for media */}
          {!isNote && (
            <div className="mb-2">
              <VersionHistoryPanel
                mediaId={selectedMedia.id}
                onVersionLoad={(vContent, vAnalysis, vPrompt, vNum) => {
                  // Update the analysis edit text with the loaded version
                  if (vAnalysis) {
                    setEditingAnalysisText(vAnalysis)
                    setAnalysisEditModalOpen(true)
                  }
                }}
                onRefresh={onRefreshMedia}
                onShowDiff={(left, right, leftLabel, rightLabel) => {
                  setDiffLeftText(left)
                  setDiffRightText(right)
                  setDiffLeftLabel(leftLabel)
                  setDiffRightLabel(rightLabel)
                  setDiffModalOpen(true)
                }}
              />
            </div>
          )}

          {/* Developer Tools */}
          <DeveloperToolsSection
            data={mediaDetail}
            label={t('review:mediaPage.developerTools', { defaultValue: 'Developer Tools' })}
          />
          {selectedMedia && onDeleteItem && (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={deletingItem}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-danger/30 px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
                title={t('review:mediaPage.deleteItem', { defaultValue: 'Delete item' })}
              >
                {deletingItem ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deletingItem
                  ? t('review:mediaPage.deletingItem', { defaultValue: 'Deleting...' })
                  : t('review:mediaPage.deleteItem', { defaultValue: 'Delete item' })}
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Analysis Generation Modal - only for media */}
      {selectedMedia && !isNote && (
        <AnalysisModal
          open={analysisModalOpen}
          onClose={() => setAnalysisModalOpen(false)}
          mediaId={selectedMedia.id}
          mediaContent={content}
          onAnalysisGenerated={() => {
            if (onRefreshMedia) {
              onRefreshMedia()
            }
          }}
        />
      )}

      {/* Analysis Edit Modal */}
      <AnalysisEditModal
        open={analysisEditModalOpen}
        onClose={() => setAnalysisEditModalOpen(false)}
        initialText={editingAnalysisText}
        mediaId={selectedMedia?.id}
        onSendToChat={onSendAnalysisToChat}
        onSaveNewVersion={() => {
          if (onRefreshMedia) {
            onRefreshMedia()
          }
        }}
      />

      {/* Content Edit Modal */}
      {selectedMedia && !isNote && (
        <Suspense fallback={null}>
          <ContentEditModal
            open={contentEditModalOpen}
            onClose={() => setContentEditModalOpen(false)}
            initialText={editingContentText || content}
            mediaId={selectedMedia.id}
            onSaveNewVersion={() => {
              if (onRefreshMedia) {
                onRefreshMedia()
              }
            }}
          />
        </Suspense>
      )}

      {/* Diff View Modal */}
      <DiffViewModal
        open={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        leftText={diffLeftText}
        rightText={diffRightText}
        leftLabel={diffLeftLabel}
        rightLabel={diffRightLabel}
      />
    </div>
  )
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null
  const total = Math.max(0, Math.floor(Number(seconds)))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
