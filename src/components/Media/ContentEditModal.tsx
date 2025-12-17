import { useState, useEffect, useRef } from 'react'
import { Modal, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { Copy, Save } from 'lucide-react'
import { bgRequest } from '@/services/background-proxy'

interface ContentEditModalProps {
  open: boolean
  onClose: () => void
  initialText: string
  mediaId?: string | number
  onSaveNewVersion?: (text: string) => void
}

export function ContentEditModal({
  open,
  onClose,
  initialText,
  mediaId,
  onSaveNewVersion
}: ContentEditModalProps) {
  const { t } = useTranslation(['review', 'common'])
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      setText(initialText)
    }
  }, [open, initialText])

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement
    }
  }, [open])

  const handleAfterOpenChange = (visible: boolean) => {
    if (visible) {
      setTimeout(() => textareaRef.current?.focus(), 0)
    } else {
      triggerRef.current?.focus()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      message.success(t('mediaPage.contentCopied', 'Content copied'))
    } catch {
      message.error(t('mediaPage.copyFailed', 'Failed to copy'))
    }
  }

  const handleSaveAsNewVersion = async () => {
    if (!mediaId) {
      message.error(t('mediaPage.noMediaId', 'No media ID available'))
      return
    }
    if (!text.trim()) {
      message.warning(
        t('mediaPage.emptyContent', 'Content cannot be empty')
      )
      return
    }

    setSaving(true)
    try {
      await bgRequest({
        path: `/api/v1/media/${mediaId}/versions`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          content: text
        }
      })
      message.success(t('mediaPage.versionSaved', 'Saved as new version'))
      if (onSaveNewVersion) {
        onSaveNewVersion(text)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save content version:', err)
      const errMsg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : String(err || 'Unknown error')
      message.error(
        errMsg.includes('401') || errMsg.includes('403')
          ? t('mediaPage.saveUnauthorized', 'Not authorized to save')
          : t('mediaPage.saveFailed', 'Failed to save version')
      )
    } finally {
      setSaving(false)
    }
  }

  const charCount = text.length
  const wordCount = text.trim()
    ? text.trim().split(/\s+/).filter((w) => w.length > 0).length
    : 0

  return (
    <Modal
      title={t('mediaPage.editContent', 'Edit Content')}
      open={open}
      onCancel={onClose}
      afterOpenChange={handleAfterOpenChange}
      width={800}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1.5 transition-colors"
            >
              <Copy className="w-4 h-4" />
              {t('common:copy', 'Copy')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {t('common:cancel', 'Cancel')}
            </button>
            {mediaId && (
              <button
                onClick={handleSaveAsNewVersion}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {t('mediaPage.saveAsVersion', 'Save as New Version')}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full min-h-[300px] p-3 text-sm font-mono rounded-lg border bg-white dark:bg-[#171717] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 border-gray-200 dark:border-gray-700 focus:ring-blue-500 resize-y leading-relaxed"
          placeholder={t(
            'mediaPage.contentPlaceholder',
            'Edit content text...'
          )}
        />
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>
            {t('mediaPage.wordCount', '{{count}} words', { count: wordCount })}
            {' • '}
            {t('mediaPage.charCount', '{{count}} characters', {
              count: charCount
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
