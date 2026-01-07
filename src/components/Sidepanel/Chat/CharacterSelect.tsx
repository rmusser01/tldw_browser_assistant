import React, { useState, useMemo, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Avatar, Dropdown, Empty, Input, Tooltip } from "antd"
import type { InputRef } from "antd"
import type { ItemType, MenuItemType } from "antd/es/menu/interface"
import { User2, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useStorage } from "@plasmohq/storage/hook"
import { IconButton } from "@/components/Common/IconButton"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { parseCharacterCardFile } from "@/utils/character-card-import"

type Character = {
  id: string | number
  name: string
  description?: string
  avatar_url?: string
  tags?: string[]
}

type Props = {
  selectedCharacterId: string | null
  setSelectedCharacterId: (id: string | null) => void
  className?: string
  iconClassName?: string
}

export const CharacterSelect: React.FC<Props> = ({
  selectedCharacterId,
  setSelectedCharacterId,
  className = "text-text-muted",
  iconClassName = "size-4"
}) => {
  const { t } = useTranslation(["sidepanel", "common", "settings"])
  const notification = useAntdNotification()
  const [menuDensity] = useStorage("menuDensity", "comfortable")
  const [searchText, setSearchText] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const searchInputRef = useRef<InputRef | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const { capabilities } = useServerCapabilities()

  const hasCharacters = capabilities?.hasCharacters

  const { data: characters = [], isLoading, refetch } = useQuery({
    queryKey: ["characters-list"],
    queryFn: async () => {
      await tldwClient.initialize().catch(() => null)
      const result = await tldwClient.listCharacters({ limit: 100 })
      return result as Character[]
    },
    enabled: !!hasCharacters,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  // Filter characters based on search
  const filteredCharacters = useMemo<Character[]>(() => {
    if (!characters) return []
    if (!searchText.trim()) return characters
    const q = searchText.toLowerCase()
    return characters.filter(
      (char) =>
        char.name?.toLowerCase().includes(q) ||
        char.description?.toLowerCase().includes(q) ||
        char.tags?.some((tag) => tag.toLowerCase().includes(q))
    )
  }, [characters, searchText])

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId || !characters) return null
    return characters.find(
      (char) => String(char.id) === String(selectedCharacterId)
    )
  }, [characters, selectedCharacterId])

  const handleSelect = (id: string | null) => {
    setSelectedCharacterId(id)
    setDropdownOpen(false)
  }

  const handleImportClick = () => {
    if (isImporting) return
    if (!importInputRef.current) return
    setDropdownOpen(false)
    importInputRef.current.value = ""
    importInputRef.current.click()
  }

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsImporting(true)
      const { payload, imageBase64 } = await parseCharacterCardFile(file)
      if (!payload.image_base64 && !payload.avatar_url && imageBase64) {
        payload.image_base64 = imageBase64
      }
      await tldwClient.initialize().catch(() => null)
      const created = await tldwClient.createCharacter(payload)
      notification.success({
        message: t("settings:manageCharacters.notification.addSuccess", {
          defaultValue: "Character created"
        })
      })
      refetch({ cancelRefetch: true })
      const createdId =
        created?.id ?? created?.character_id ?? created?.characterId
      if (createdId != null) {
        setSelectedCharacterId(String(createdId))
      }
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : String(error)
      notification.error({
        message: t("settings:manageCharacters.notification.error", {
          defaultValue: "Error"
        }),
        description:
          messageText ||
          t("settings:manageCharacters.notification.someError", {
            defaultValue: "Something went wrong. Please try again later"
          })
      })
    } finally {
      setIsImporting(false)
      event.target.value = ""
    }
  }

  const openCharactersWorkspace = React.useCallback(() => {
    try {
      if (typeof window === "undefined") return

      const hash = "#/characters?from=sidepanel-character-select"
      const url = browser.runtime.getURL(`/options.html${hash}`)

      if (browser.tabs?.create) {
        browser.tabs.create({ url })
      } else {
        window.open(url, "_blank")
      }
      return
    } catch {
      // fall back to window.open below
    }

    window.open(
      "/options.html#/characters?from=sidepanel-character-select",
      "_blank"
    )
  }, [])

  const createCharacterItem = (char: Character): MenuItemType => ({
    key: String(char.id),
    label: (
      <div className="w-56 py-0.5 flex items-center gap-2">
        {char.avatar_url ? (
          <Avatar src={char.avatar_url} size="small" />
        ) : (
          <Avatar size="small" icon={<User2 className="size-3" />} />
        )}
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{char.name}</div>
          {char.description && (
            <p className="text-xs text-text-subtle line-clamp-1">
              {char.description}
            </p>
          )}
        </div>
      </div>
    ),
    onClick: () => handleSelect(String(char.id))
  })

  const menuItems = useMemo<ItemType[]>(() => {
    const createLabel = t(
      "sidepanel:characterSelect.createNewCharacter",
      "Create a New Character+"
    )
    const importLabel = t(
      "sidepanel:characterSelect.importCharacter",
      "Import Character"
    )
    const createItem: ItemType = {
      key: "create",
      label: (
        <div className="w-56 py-0.5 flex items-center gap-2 text-primary font-medium">
          <span>{createLabel}</span>
        </div>
      ),
      onClick: () => {
        setDropdownOpen(false)
        openCharactersWorkspace()
      }
    }
    const importItem: ItemType = {
      key: "import",
      label: (
        <div className="w-56 py-0.5 flex items-center gap-2 text-primary font-medium">
          <span>{importLabel}</span>
        </div>
      ),
      onClick: handleImportClick
    }

    if (isLoading) {
      return [
        {
          key: "loading",
          label: (
            <div className="text-text-muted text-sm py-2">
              {t("common:loading", "Loading...")}
            </div>
          ),
          disabled: true
        },
        { type: "divider" },
        createItem,
        importItem
      ]
    }

    if (filteredCharacters.length === 0) {
      return [
        {
          key: "empty",
          label: (
            <Empty
              description={
                searchText
                  ? t("sidepanel:characterSelect.noMatches", "No matching characters")
                  : t("sidepanel:characterSelect.noCharacters", "No characters available")
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
          disabled: true
        },
        { type: "divider" },
        createItem,
        importItem
      ]
    }

    const items: ItemType[] = []

    // Add "None" option to clear selection
    items.push({
      key: "none",
      label: (
        <div className="w-56 py-0.5 flex items-center gap-2 text-text-muted">
          <X className="size-4" />
          <span>{t("sidepanel:characterSelect.none", "No character")}</span>
        </div>
      ),
      onClick: () => handleSelect(null)
    })

    items.push(createItem, importItem)
    items.push({ type: "divider" })

    // Add character items
    items.push(...filteredCharacters.map(createCharacterItem))

    return items
  }, [
    filteredCharacters,
    handleImportClick,
    isLoading,
    openCharactersWorkspace,
    searchText,
    t
  ])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (!dropdownOpen) {
      setSearchText("")
      return
    }

    let frameId: number | null = null
    let attempts = 0
    let canceled = false
    const focusWhenReady = () => {
      if (canceled) return
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        return
      }
      if (attempts < 10) {
        attempts += 1
        frameId = window.requestAnimationFrame(focusWhenReady)
      }
    }

    frameId = window.requestAnimationFrame(focusWhenReady)

    return () => {
      canceled = true
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [dropdownOpen])

  // Don't render if characters feature is not available
  if (!hasCharacters) {
    return null
  }

  return (
    <div>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.png"
        className="hidden"
        onChange={handleImportFile}
      />
      <Dropdown
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      menu={{
        items: menuItems,
        style: { maxHeight: 400, overflowY: "auto" },
        className: `no-scrollbar ${
          menuDensity === "compact"
            ? "menu-density-compact"
            : "menu-density-comfortable"
        }`,
        activeKey: selectedCharacterId ?? undefined
      }}
      dropdownRender={(menu) => (
        <div className="bg-surface rounded-lg shadow-lg border border-border">
          <div className="p-2 border-b border-border">
            <Input
              ref={searchInputRef}
              placeholder={t(
                "sidepanel:characterSelect.search",
                "Search characters..."
              )}
              prefix={<Search className="size-4 text-text-subtle" />}
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
      placement="topLeft"
      trigger={["click"]}
      >
        <Tooltip
          title={t("sidepanel:characterSelect.tooltip", "Select a character")}
        >
          <IconButton
            ariaLabel={
              t(
                "sidepanel:characterSelect.tooltip",
                "Select a character"
              ) as string
            }
            hasPopup="menu"
            dataTestId="chat-character-select"
            className={className}
          >
            {selectedCharacter?.avatar_url ? (
              <Avatar
                src={selectedCharacter.avatar_url}
                size="small"
                className="size-5"
              />
            ) : (
              <User2 className={iconClassName} />
            )}
            <span className="ml-1 hidden max-w-[100px] truncate text-xs font-medium text-text sm:inline">
              {selectedCharacter?.name ||
                t("sidepanel:characterSelect.label", "Character")}
            </span>
          </IconButton>
        </Tooltip>
      </Dropdown>
    </div>
  )
}

export default CharacterSelect
