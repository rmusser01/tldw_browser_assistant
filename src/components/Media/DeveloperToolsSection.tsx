import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Code, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { message } from 'antd'

interface DeveloperToolsSectionProps {
  data: unknown
  label?: string
  defaultExpanded?: boolean
}

export function DeveloperToolsSection({
  data,
  label,
  defaultExpanded = false
}: DeveloperToolsSectionProps) {
  const { t } = useTranslation(['review'])
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
    }
  }, [])

  let jsonString: string | null = null
  let stringifyError: string | null = null
  if (data != null) {
    try {
      jsonString = JSON.stringify(data, null, 2)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to stringify data in DeveloperToolsSection', err)
      stringifyError = err instanceof Error ? err.message : String(err)
      jsonString = null
    }
  }

  const handleCopy = async () => {
    if (!jsonString) return
    if (!navigator.clipboard?.writeText) {
      message.error(
        t(
          'mediaPage.copyNotSupported',
          'Copy is not supported here'
        )
      )
      return
    }
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      message.success(
        t('mediaPage.jsonCopied', 'JSON copied to clipboard')
      )

      // Clear any existing timeout
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }

      // Reset copied state after 2 seconds
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      message.error(t('mediaPage.copyFailed', 'Failed to copy'))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="developer-tools-panel"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface2 hover:bg-surface transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-text-subtle" />
          <span className="text-sm font-medium text-text">
            {label || t('mediaPage.developerTools', 'Developer Tools')}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-text-subtle" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-subtle" />
        )}
      </button>

      {expanded && (
        <div
          id="developer-tools-panel"
          className="p-3 bg-surface animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted">
              {t('mediaPage.rawJsonData', 'Raw JSON Data')}
            </span>
            {jsonString && (
              <button
                type="button"
                onClick={handleCopy}
                className={`p-1 transition-all ${
                  copied
                    ? 'text-success bg-success/10'
                    : 'text-text-muted hover:text-text'
                }`}
                title={t('mediaPage.copyJson', 'Copy JSON')}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {jsonString ? (
            <div className="rounded border border-border bg-surface2 overflow-auto max-h-96">
              <pre className="text-xs p-3 whitespace-pre-wrap break-all text-text font-mono">
                {jsonString}
              </pre>
            </div>
          ) : stringifyError ? (
            <div className="text-sm text-danger text-center py-4">
              {t('mediaPage.jsonStringifyError', 'Cannot display data: {{error}}', { error: stringifyError })}
            </div>
          ) : (
            <div className="text-sm text-text-muted text-center py-4">
              {t('mediaPage.noDataLoaded', 'No data loaded')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
