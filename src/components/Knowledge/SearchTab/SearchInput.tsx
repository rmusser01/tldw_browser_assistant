import React from "react"
import { Button, Checkbox, Input } from "antd"
import type { InputRef } from "antd"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"

type SearchInputProps = {
  query: string
  onQueryChange: (query: string) => void
  useCurrentMessage: boolean
  onUseCurrentMessageChange: (value: boolean) => void
  onSearch: () => void
  loading?: boolean
  error?: string | null
  autoFocus?: boolean
  disabled?: boolean
}

/**
 * Search input with query field, "Use current message" toggle, and search button
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  onQueryChange,
  useCurrentMessage,
  onUseCurrentMessageChange,
  onSearch,
  loading = false,
  error = null,
  autoFocus = true,
  disabled = false
}) => {
  const { t } = useTranslation(["sidepanel"])
  const inputRef = React.useRef<InputRef>(null)

  // Auto-focus on mount
  React.useEffect(() => {
    if (autoFocus) {
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [autoFocus])

  // Handle Enter key to search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSearch()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t(
            "sidepanel:rag.searchPlaceholder",
            "Search your knowledge..."
          )}
          disabled={disabled}
          status={error ? "error" : undefined}
          aria-label={t("sidepanel:rag.searchPlaceholder", "Search your knowledge...")}
          className="flex-1"
        />
        <Button
          type="primary"
          onClick={onSearch}
          loading={loading}
          disabled={disabled}
          icon={<Search className="h-4 w-4" />}
          aria-label={t("sidepanel:rag.search", "Search")}
        >
          {t("sidepanel:rag.search", "Search")}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Checkbox
          checked={useCurrentMessage}
          onChange={(e) => onUseCurrentMessageChange(e.target.checked)}
          disabled={disabled}
        >
          <span className="text-xs text-text-muted">
            {t("sidepanel:rag.useCurrentMessage", "Use current message")}
          </span>
        </Checkbox>

        {error && (
          <span className="text-xs text-error" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
