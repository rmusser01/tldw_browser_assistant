import React, { useCallback, useState } from "react"
import { Input, Tag } from "antd"
import { Plus, X } from "lucide-react"
import { useCollectionsStore } from "@/store/collections"

interface TagSelectorProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  suggestions?: string[]
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  tags,
  onChange,
  placeholder = "Add tag...",
  maxTags = 10,
  suggestions
}) => {
  const [inputValue, setInputValue] = useState("")
  const [inputVisible, setInputVisible] = useState(false)

  // Get available tags from store for suggestions
  const availableTags = useCollectionsStore((s) => s.availableTags)
  const suggestedTags = suggestions || availableTags

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value)
    },
    []
  )

  const handleInputConfirm = useCallback(() => {
    const trimmedValue = inputValue.trim().toLowerCase()
    if (trimmedValue && !tags.includes(trimmedValue) && tags.length < maxTags) {
      onChange([...tags, trimmedValue])
    }
    setInputVisible(false)
    setInputValue("")
  }, [inputValue, tags, onChange, maxTags])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleInputConfirm()
      } else if (e.key === "Escape") {
        setInputVisible(false)
        setInputValue("")
      }
    },
    [handleInputConfirm]
  )

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onChange(tags.filter((tag) => tag !== tagToRemove))
    },
    [tags, onChange]
  )

  const handleSuggestionClick = useCallback(
    (tag: string) => {
      if (!tags.includes(tag) && tags.length < maxTags) {
        onChange([...tags, tag])
      }
      setInputValue("")
    },
    [tags, onChange, maxTags]
  )

  // Filter suggestions based on input
  const filteredSuggestions = suggestedTags.filter(
    (tag) =>
      !tags.includes(tag) &&
      tag.toLowerCase().includes(inputValue.toLowerCase())
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Existing tags */}
      {tags.map((tag) => (
        <Tag
          key={tag}
          closable
          closeIcon={<X className="h-3 w-3" />}
          onClose={() => handleRemoveTag(tag)}
          className="flex items-center gap-1 border-0 bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
        >
          {tag}
        </Tag>
      ))}

      {/* Input for new tag */}
      {inputVisible ? (
        <div className="relative">
          <Input
            type="text"
            size="small"
            className="w-24"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputConfirm}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder={placeholder}
          />
          {/* Suggestions dropdown */}
          {inputValue && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 max-h-32 w-40 overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {filteredSuggestions.slice(0, 5).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSuggestionClick(suggestion)
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : tags.length < maxTags ? (
        <button
          type="button"
          onClick={() => setInputVisible(true)}
          className="flex items-center gap-1 rounded border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
        >
          <Plus className="h-3 w-3" />
          {placeholder}
        </button>
      ) : null}
    </div>
  )
}
