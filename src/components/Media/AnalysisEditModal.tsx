import { useState, useEffect, useRef } from 'react'
import { Modal, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { Copy, Send, Save } from 'lucide-react'
import { bgRequest } from '@/services/background-proxy'

interface AnalysisEditModalProps {
  open: boolean
  onClose: () => void
  initialText: string
  mediaId?: string | number
  content?: string
  prompt?: string
  onSave?: (text: string) => void
  onSendToChat?: (text: string) => void
  onSaveNewVersion?: (text: string) => void
}

export function AnalysisEditModal({
  open,
  onClose,
  initialText,
  mediaId,
  content,
  prompt,
  onSave,
  onSendToChat,
  onSaveNewVersion
}: AnalysisEditModalProps) {
  const { t } = useTranslation(['review', 'common'])
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Reset text when modal opens with new initial text
  useEffect(() => {
    if (open) {
      setText(initialText)
    }
  }, [open, initialText])

  // Capture trigger element for focus restoration
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement
    }
  }, [open])

  const handleAfterOpenChange = (visible: boolean) => {
    if (visible) {
      // Focus textarea when modal opens
      setTimeout(() => textareaRef.current?.focus(), 0)
    } else {
      // Restore focus to trigger element when modal closes
      triggerRef.current?.focus()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      message.success(t('mediaPage.analysisCopied', 'Analysis copied'))
    } catch {
      message.error(t('mediaPage.copyFailed', 'Failed to copy'))
    }
  }

  const handleSendToChat = () => {
    if (!text.trim()) {
      message.warning(t('mediaPage.nothingToSend', 'Nothing to send'))
      return
    }
    if (onSendToChat) {
      onSendToChat(text)
      onClose()
    }
  }

  const handleSave = async () => {
    if (onSave) {
      if (!text.trim()) {
        message.warning(t('mediaPage.emptyAnalysis', 'Analysis cannot be empty'))
        return
      }
      onSave(text)
      onClose()
    }
  }

  const handleSaveAsNewVersion = async () => {
    if (!mediaId) {
      message.error(t('mediaPage.noMediaId', 'No media ID available'))
      return
    }
    if (!text.trim()) {
      message.warning(t('mediaPage.emptyAnalysis', 'Analysis cannot be empty'))
      return
    }

    setSaving(true)
    try {
      const getVersionNumber = (v: any): number | null => {
        const raw = v?.version_number ?? v?.version
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw
        if (typeof raw === 'string' && raw.trim().length > 0) {
          const parsed = Number(raw)
          if (Number.isFinite(parsed)) return parsed
        }
        return null
      }

      const pickLatestVersion = (versions: any[]): any | null => {
        if (!Array.isArray(versions) || versions.length === 0) return null
        let best: any | null = null
        let bestNum = -Infinity
        for (const v of versions) {
          const num = getVersionNumber(v)
          if (num != null && num > bestNum) {
            best = v
            bestNum = num
          }
        }
        return best || versions[0]
      }

      let resolvedPrompt = String(prompt || '')
      if (!resolvedPrompt) {
        try {
          const versions = await bgRequest<any>({
            path: `/api/v1/media/${mediaId}/versions?include_content=false&limit=50&page=1`,
            method: 'GET'
          })
          const arr = Array.isArray(versions) ? versions : (versions?.items || [])
          const latest = pickLatestVersion(arr)
          resolvedPrompt = String(latest?.prompt || '')
        } catch {}
      }

      await bgRequest({
        path: `/api/v1/media/${mediaId}/versions`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          content: String(content || ''),
          analysis_content: text,
          prompt: resolvedPrompt
        }
      })
      message.success(t('mediaPage.versionSaved', 'Saved as new version'))
      if (onSaveNewVersion) {
        onSaveNewVersion(text)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save version:', err)
      message.error(t('mediaPage.saveFailed', 'Failed to save version'))
    } finally {
      setSaving(false)
    }
  }

  const charCount = text.length
  const charLimit = 25000
  const warningThreshold = 20000
  const isApproachingLimit = charCount >= warningThreshold
  const isOverLimit = charCount >= charLimit

  return (
    <Modal
      title={t('mediaPage.editAnalysis', 'Edit Analysis')}
      open={open}
      onCancel={onClose}
      afterOpenChange={handleAfterOpenChange}
      width={700}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm text-text hover:bg-surface2 rounded flex items-center gap-1.5 transition-colors"
              title={t('common:copy', 'Copy')}
            >
              <Copy className="w-4 h-4" />
              {t('common:copy', 'Copy')}
            </button>
            {onSendToChat && (
              <button
                onClick={handleSendToChat}
                className="px-3 py-1.5 text-sm text-text hover:bg-surface2 rounded flex items-center gap-1.5 transition-colors"
                title={t('mediaPage.sendToChat', 'Send to Chat')}
              >
                <Send className="w-4 h-4" />
                {t('mediaPage.sendToChat', 'Send to Chat')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mediaId && (
              <button
                onClick={handleSaveAsNewVersion}
                disabled={saving || isOverLimit}
                className="px-3 py-1.5 text-sm bg-surface2 text-text hover:bg-surface rounded flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isOverLimit
                    ? t('mediaPage.charLimitExceeded', 'Character limit exceeded')
                    : t('mediaPage.saveAsVersion', 'Save as New Version')
                }
              >
                <Save className="w-4 h-4" />
                {t('mediaPage.saveAsVersion', 'Save as New Version')}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-text-muted hover:bg-surface2 rounded transition-colors"
              title={t('common:cancel', 'Cancel')}
            >
              {t('common:cancel', 'Cancel')}
            </button>
            {onSave && (
              <button
                onClick={handleSave}
                disabled={isOverLimit}
                className="px-3 py-1.5 text-sm bg-primary hover:bg-primaryStrong text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isOverLimit
                    ? t('mediaPage.charLimitExceeded', 'Character limit exceeded')
                    : t('common:save', 'Save')
                }
              >
                {t('common:save', 'Save')}
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
          onChange={e => setText(e.target.value)}
          maxLength={charLimit}
          className={`w-full min-h-[300px] p-3 text-sm font-mono rounded-lg border bg-surface text-text focus:outline-none focus:ring-2 resize-y leading-relaxed ${
            isOverLimit
              ? 'border-danger focus:ring-danger'
              : isApproachingLimit
                ? 'border-warn focus:ring-warn'
                : 'border-border focus:ring-focus'
          }`}
          placeholder={t('mediaPage.analysisPlaceholder', 'Enter analysis text...')}
        />
        <div className="flex items-center justify-between text-xs">
          <div className={`${isOverLimit ? 'text-danger font-medium' : isApproachingLimit ? 'text-warn font-medium' : 'text-text-muted'}`}>
            {t('mediaPage.wordCount', '{{count}} words', { count: text.trim() ? text.trim().split(/\s+/).length : 0 })}
            {' • '}
            {t('mediaPage.charCount', '{{count}} characters', { count: charCount })}
          </div>
          {isApproachingLimit && (
            <div className={`${isOverLimit ? 'text-danger' : 'text-warn'} text-xs font-medium`}>
              {isOverLimit
                ? t('mediaPage.charLimitExceeded', 'Character limit exceeded')
                : t('mediaPage.charLimitWarning', 'Approaching character limit (20k)')}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
