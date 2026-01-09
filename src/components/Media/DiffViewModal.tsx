import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal, Radio } from 'antd'
import { useTranslation } from 'react-i18next'

interface DiffViewModalProps {
  open: boolean
  onClose: () => void
  leftText: string
  rightText: string
  leftLabel?: string
  rightLabel?: string
}

type DiffLine = { type: 'same' | 'add' | 'del'; text: string }

// Compute line-by-line diff using LCS algorithm
function computeDiff(oldStr: string, newStr: string): DiffLine[] {
  const a = String(oldStr || '').split('\n')
  const b = String(newStr || '').split('\n')
  const n = a.length
  const m = b.length

  // Build LCS length table
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  // Trace back to build diff
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] })
      i++
    } else {
      out.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) {
    out.push({ type: 'del', text: a[i++] })
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j++] })
  }
  return out
}

export function DiffViewModal({
  open,
  onClose,
  leftText,
  rightText,
  leftLabel = 'Left',
  rightLabel = 'Right'
}: DiffViewModalProps) {
  const { t } = useTranslation(['review'])
  const [viewMode, setViewMode] = useState<'unified' | 'sideBySide'>('unified')
  const triggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Capture trigger element for focus restoration
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement
    }
  }, [open])

  const handleAfterOpenChange = (visible: boolean) => {
    if (visible) {
      // Focus the diff content for keyboard scrolling
      setTimeout(() => contentRef.current?.focus(), 0)
    } else {
      // Restore focus to trigger element when modal closes
      triggerRef.current?.focus()
    }
  }

  const diffLines = useMemo(() => computeDiff(leftText, rightText), [leftText, rightText])

  // Build side-by-side view data
  const sideBySideData = useMemo(() => {
    const left: Array<{ num: number; text: string; type: 'same' | 'del' | 'empty' }> = []
    const right: Array<{ num: number; text: string; type: 'same' | 'add' | 'empty' }> = []

    let leftNum = 1
    let rightNum = 1

    for (const line of diffLines) {
      if (line.type === 'same') {
        left.push({ num: leftNum++, text: line.text, type: 'same' })
        right.push({ num: rightNum++, text: line.text, type: 'same' })
      } else if (line.type === 'del') {
        left.push({ num: leftNum++, text: line.text, type: 'del' })
        right.push({ num: 0, text: '', type: 'empty' })
      } else {
        left.push({ num: 0, text: '', type: 'empty' })
        right.push({ num: rightNum++, text: line.text, type: 'add' })
      }
    }

    return { left, right }
  }, [diffLines])

  const getLineClass = (type: string) => {
    switch (type) {
      case 'add':
        return 'bg-success/10 text-success'
      case 'del':
        return 'bg-danger/10 text-danger'
      case 'empty':
        return 'bg-surface2'
      default:
        return 'text-text'
    }
  }

  const getLinePrefix = (type: string) => {
    switch (type) {
      case 'add':
        return '+'
      case 'del':
        return '-'
      default:
        return ' '
    }
  }

  return (
    <Modal
      title={t('mediaPage.diffView', 'Diff View')}
      open={open}
      onCancel={onClose}
      afterOpenChange={handleAfterOpenChange}
      footer={null}
      width={900}
      className="diff-modal"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-muted">
            <span className="font-medium text-danger">{leftLabel}</span>
            {' → '}
            <span className="font-medium text-success">{rightLabel}</span>
          </span>
        </div>
        <Radio.Group
          value={viewMode}
          onChange={e => setViewMode(e.target.value)}
          size="small"
        >
          <Radio.Button value="unified">{t('mediaPage.unified', 'Unified')}</Radio.Button>
          <Radio.Button value="sideBySide">{t('mediaPage.sideBySide', 'Side by Side')}</Radio.Button>
        </Radio.Group>
      </div>

      <div
        ref={contentRef}
        tabIndex={0}
        className="border border-border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-focus"
        onKeyDown={(e) => {
          // Keyboard navigation for diff scrolling
          const scrollAmount = 100
          const pageScrollAmount = 400
          if (e.key === 'ArrowDown' || e.key === 'j') {
            e.preventDefault()
            contentRef.current?.scrollBy({ top: scrollAmount, behavior: 'smooth' })
          } else if (e.key === 'ArrowUp' || e.key === 'k') {
            e.preventDefault()
            contentRef.current?.scrollBy({ top: -scrollAmount, behavior: 'smooth' })
          } else if (e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault()
            contentRef.current?.scrollBy({ top: pageScrollAmount, behavior: 'smooth' })
          } else if (e.key === 'PageUp') {
            e.preventDefault()
            contentRef.current?.scrollBy({ top: -pageScrollAmount, behavior: 'smooth' })
          } else if (e.key === 'Home') {
            e.preventDefault()
            contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          } else if (e.key === 'End') {
            e.preventDefault()
            contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' })
          }
        }}
        role="region"
        aria-label={t('mediaPage.diffContentRegion', 'Diff content - use arrow keys to scroll')}
      >
        {viewMode === 'unified' ? (
          <div className="font-mono text-xs">
            {diffLines.length === 0 ? (
              <div className="p-4 text-center text-text-muted">
                {t('mediaPage.noDifferences', 'No differences found')}
              </div>
            ) : (
              diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-0.5 ${getLineClass(line.type)}`}
                >
                  <span className="select-none text-text-subtle mr-2">
                    {getLinePrefix(line.type)}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex font-mono text-xs">
            {/* Left side */}
            <div className="flex-1 border-r border-border">
              <div className="px-3 py-1 bg-surface2 text-text-muted font-medium border-b border-border">
                {leftLabel}
              </div>
              {sideBySideData.left.map((line, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-0.5 flex ${getLineClass(line.type)}`}
                >
                  <span className="w-8 text-right text-text-subtle mr-2 select-none flex-shrink-0">
                    {line.num > 0 ? line.num : ''}
                  </span>
                  <span className="whitespace-pre-wrap break-all flex-1">{line.text || ' '}</span>
                </div>
              ))}
            </div>
            {/* Right side */}
            <div className="flex-1">
              <div className="px-3 py-1 bg-surface2 text-text-muted font-medium border-b border-border">
                {rightLabel}
              </div>
              {sideBySideData.right.map((line, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-0.5 flex ${getLineClass(line.type)}`}
                >
                  <span className="w-8 text-right text-text-subtle mr-2 select-none flex-shrink-0">
                    {line.num > 0 ? line.num : ''}
                  </span>
                  <span className="whitespace-pre-wrap break-all flex-1">{line.text || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend & keyboard hints */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-danger/20"></span>
            {t('mediaPage.removed', 'Removed')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-success/20"></span>
            {t('mediaPage.added', 'Added')}
          </span>
        </div>
        <span className="hidden sm:block">
          {t('mediaPage.keyboardNavHint', '↑↓ or j/k to scroll, PgUp/PgDn for pages')}
        </span>
      </div>
    </Modal>
  )
}
