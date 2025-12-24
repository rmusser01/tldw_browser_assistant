import { useQuery } from "@tanstack/react-query"
import { Dropdown, Empty, Tooltip, Input } from "antd"
import { BookIcon, ComputerIcon, ZapIcon, Search } from "lucide-react"
import React, { useState, useMemo, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { getAllPrompts } from "@/db/dexie/helpers"
import { useStorage } from "@plasmohq/storage/hook"
import { IconButton } from "./IconButton"

type Props = {
  setSelectedSystemPrompt: (promptId: string | undefined) => void
  setSelectedQuickPrompt: (prompt: string | undefined) => void
  selectedSystemPrompt: string | undefined
  className?: string
  iconClassName?: string
}

export const PromptSelect: React.FC<Props> = ({
  setSelectedQuickPrompt,
  setSelectedSystemPrompt,
  selectedSystemPrompt,
  className = "dark:text-gray-300",
  iconClassName = "size-5"
}) => {
  const { t } = useTranslation("option")
  const [menuDensity] = useStorage("menuDensity", "comfortable")
  const [searchText, setSearchText] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchInputRef = useRef<any>(null)

  const { data } = useQuery({
    queryKey: ["getAllPromptsForSelect"],
    queryFn: getAllPrompts
  })

  // Filter prompts based on search text
  const filteredData = useMemo(() => {
    if (!data) return []
    if (!searchText.trim()) return data
    const q = searchText.toLowerCase()
    return data.filter((p: any) =>
      p.title?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q)
    )
  }, [data, searchText])

  const handlePromptChange = React.useCallback((value?: string) => {
    if (!value) {
      setSelectedSystemPrompt(undefined)
      setSelectedQuickPrompt(undefined)
      return
    }
    const prompt = data?.find((prompt) => prompt.id === value)
    if (prompt?.is_system) {
      setSelectedSystemPrompt(prompt.id)
    } else {
      setSelectedSystemPrompt(undefined)
      setSelectedQuickPrompt(prompt!.content)
    }
  }, [data, setSelectedSystemPrompt, setSelectedQuickPrompt])

  // Group prompts by category: Favorites, System, Quick
  const groupedMenuItems = useMemo(() => {
    if (filteredData.length === 0) {
      return [{
        key: "empty",
        label: <Empty description={searchText ? t("noMatchingPrompts", "No matching prompts") : undefined} />
      }]
    }

    const favorites = filteredData.filter((p: any) => p.favorite)
    const systemPrompts = filteredData.filter((p: any) => !p.favorite && p.is_system)
    const quickPrompts = filteredData.filter((p: any) => !p.favorite && !p.is_system)

    const createPromptItem = (prompt: any) => ({
      key: prompt.id,
      label: (
        <div className="w-56 py-0.5">
          <div className="flex items-center gap-2">
            {prompt.is_system ? (
              <ComputerIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ZapIcon className="w-4 h-4 flex-shrink-0" />
            )}
            {prompt?.favorite && (
              <span className="text-yellow-500 flex-shrink-0" title="Favorite">★</span>
            )}
            <span className="truncate font-medium">{prompt.title}</span>
          </div>
          {prompt.content && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5 ml-6">
              {prompt.content}
            </p>
          )}
        </div>
      ),
      onClick: () => {
        if (selectedSystemPrompt === prompt.id) {
          setSelectedSystemPrompt(undefined)
        } else {
          handlePromptChange(prompt.id)
        }
        setDropdownOpen(false)
      }
    })

    const items: any[] = []

    if (favorites.length > 0) {
      items.push({
        type: 'group',
        label: t("promptSelect.favorites", "Favorites"),
        children: favorites.map(createPromptItem)
      })
    }

    if (systemPrompts.length > 0) {
      items.push({
        type: 'group',
        label: t("promptSelect.system", "System prompts"),
        children: systemPrompts.map(createPromptItem)
      })
    }

    if (quickPrompts.length > 0) {
      items.push({
        type: 'group',
        label: t("promptSelect.quick", "Quick prompts"),
        children: quickPrompts.map(createPromptItem)
      })
    }

    // If no groups (shouldn't happen, but fallback)
    if (items.length === 0) {
      return filteredData.map(createPromptItem)
    }

    return items
  }, [filteredData, searchText, selectedSystemPrompt, t, handlePromptChange, setDropdownOpen, setSelectedSystemPrompt])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } else {
      setSearchText("") // Clear search when closed
    }
  }, [dropdownOpen])

  return (
    <>
      {data && (
        <Dropdown
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          menu={{
            items: groupedMenuItems,
            style: {
              maxHeight: 400,
              overflowY: "auto"
            },
            className: `no-scrollbar ${menuDensity === 'compact' ? 'menu-density-compact' : 'menu-density-comfortable'}`,
            activeKey: selectedSystemPrompt
          }}
          dropdownRender={(menu) => (
            <div className="bg-white dark:bg-[#1f1f1f] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <Input
                  ref={searchInputRef}
                  placeholder={t("searchPrompts", "Search prompts...")}
                  prefix={<Search className="size-4 text-gray-400" />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  size="small"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              {menu}
            </div>
          )}
          placement={"topLeft"}
          trigger={["click"]}>
          <Tooltip title={t("selectAPrompt")}>
            <IconButton
              ariaLabel={t("selectAPrompt") as string}
              hasPopup="menu"
              dataTestId="chat-prompt-select"
              className={className}>
              <BookIcon className={iconClassName} />
            </IconButton>
          </Tooltip>
        </Dropdown>
      )}
    </>
  )
}
