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
import { useAntdModal } from "@/hooks/useAntdModal"
import type { Character as StoredCharacter } from "@/types/character"

type Character = {
  id: string | number
  name: string
  description?: string
  avatar_url?: string
  tags?: string[]
  greeting?: string | null
  first_message?: string | null
  firstMessage?: string | null
  greet?: string | null
  alternate_greetings?: string[] | string | null
  alternateGreetings?: string[] | string | null
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
  const modal = useAntdModal()
  const [menuDensity] = useStorage("menuDensity", "comfortable")
  const [, setSelectedCharacter] = useStorage<StoredCharacter | null>(
    "selectedCharacter",
    null
  )
  const [searchText, setSearchText] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const searchInputRef = useRef<InputRef | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const imageOnlyModalRef = useRef<{ destroy: () => void } | null>(null)
  const imageOnlyModalResolveRef = useRef<((value: boolean) => void) | null>(
    null
  )
  const { capabilities } = useServerCapabilities()

  const hasCharacters = capabilities?.hasCharacters

  const destroyImageOnlyModal = React.useCallback(() => {
    if (!imageOnlyModalRef.current) return
    imageOnlyModalRef.current.destroy()
    imageOnlyModalRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      if (imageOnlyModalResolveRef.current) {
        imageOnlyModalResolveRef.current(false)
        imageOnlyModalResolveRef.current = null
      }
      destroyImageOnlyModal()
    }
  }, [destroyImageOnlyModal])

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

  const normalizeGreetingValue = React.useCallback((value: unknown) => {
    if (!value) return [] as string[]
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    }
    if (typeof value === "string") {
      const trimmed = value.trim()
      return trimmed.length > 0 ? [trimmed] : []
    }
    return []
  }, [])

  const collectGreetings = React.useCallback(
    (character: Character) => {
      const greetings = [
        ...normalizeGreetingValue(character.greeting),
        ...normalizeGreetingValue(character.first_message),
        ...normalizeGreetingValue(character.firstMessage),
        ...normalizeGreetingValue(character.greet),
        ...normalizeGreetingValue(character.alternate_greetings),
        ...normalizeGreetingValue(character.alternateGreetings)
      ]
      return Array.from(new Set(greetings))
    },
    [normalizeGreetingValue]
  )

  const pickGreeting = React.useCallback((greetings: string[]) => {
    if (greetings.length === 0) return ""
    if (greetings.length === 1) return greetings[0]
    const index = Math.floor(Math.random() * greetings.length)
    return greetings[index]
  }, [])

  const buildStoredCharacter = React.useCallback(
    (character: {
      id?: string | number
      name?: string
      avatar_url?: string
      image_base64?: string
      image_mime?: string
      tags?: string[]
    }): StoredCharacter | null => {
      const id = character?.id
      const name = character?.name
      if (!id || !name) return null
      const avatar =
        character.avatar_url ||
        (character.image_base64
          ? `data:${character.image_mime || "image/png"};base64,${
              character.image_base64
            }`
          : undefined)
      return {
        id: String(id),
        name,
        avatar_url: avatar ?? null,
        tags: character.tags,
        greeting: pickGreeting(
          collectGreetings(character as Character)
        ) || null
      }
    },
    [collectGreetings, pickGreeting]
  )

  const handleSelect = (id: string | null) => {
    setSelectedCharacterId(id)
    if (!id) {
      setSelectedCharacter(null)
      setDropdownOpen(false)
      return
    }

    const selected = characters?.find(
      (char) => String(char.id) === String(id)
    )
    const stored = selected ? buildStoredCharacter(selected) : null
    if (stored) {
      setSelectedCharacter(stored)
    }
    setDropdownOpen(false)

    if (stored?.greeting) return

    void tldwClient
      .initialize()
      .catch(() => null)
      .then(() => tldwClient.getCharacter(id))
      .then((full) => {
        const hydrated = buildStoredCharacter(full || {})
        if (hydrated?.id === String(id) && hydrated.greeting) {
          setSelectedCharacter(hydrated)
        }
      })
      .catch(() => {})
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

    const getImageOnlyDetail = (error: unknown) => {
      const details = (error as { details?: any })?.details
      const detail = details?.detail ?? details
      if (detail?.code === "missing_character_data") return detail
      return null
    }

    const confirmImageOnlyImport = (message?: string) =>
      new Promise<boolean>((resolve) => {
        let settled = false
        const finish = (value: boolean) => {
          if (settled) return
          settled = true
          resolve(value)
        }
        imageOnlyModalResolveRef.current = finish
        imageOnlyModalRef.current = modal.confirm({
          title: t("settings:manageCharacters.imageOnlyTitle", {
            defaultValue: "No character data detected"
          }),
          content:
            message ||
            t("settings:manageCharacters.imageOnlyBody", {
              defaultValue:
                "No character data was found in the image metadata. Import this image as a character anyway?"
            }),
          okText: t("settings:manageCharacters.imageOnlyConfirm", {
            defaultValue: "Import image-only"
          }),
          cancelText: t("common:cancel", { defaultValue: "Cancel" }),
          centered: true,
          okButtonProps: { danger: false },
          maskClosable: false,
          onOk: () => finish(true),
          onCancel: () => finish(false)
        })
      }).finally(() => {
        imageOnlyModalResolveRef.current = null
        destroyImageOnlyModal()
      })

    const importCharacter = async (allowImageOnly = false) =>
      await tldwClient.importCharacterFile(file, {
        allowImageOnly
      })
    const handleImportSuccess = (imported: Record<string, any>) => {
      const importedCharacter =
        imported?.character ??
        (imported?.id && imported?.name
          ? { id: imported.id, name: imported.name }
          : imported)
      const successDetail =
        typeof imported?.message === "string" && imported.message.trim()
          ? imported.message
          : undefined
      notification.success({
        message: t("settings:manageCharacters.notification.addSuccess", {
          defaultValue: "Character created"
        }),
        description: successDetail
      })
      refetch({ cancelRefetch: true })
      const createdId =
        importedCharacter?.id ??
        importedCharacter?.character_id ??
        importedCharacter?.characterId
      if (createdId != null) {
        setSelectedCharacterId(String(createdId))
        const stored = buildStoredCharacter(importedCharacter ?? {})
        if (stored) {
          setSelectedCharacter(stored)
        }
      }
    }

    try {
      setIsImporting(true)
      await tldwClient.initialize().catch(() => null)
      const imported = await importCharacter()
      handleImportSuccess(imported)
    } catch (error) {
      const imageOnlyDetail = getImageOnlyDetail(error)
      if (imageOnlyDetail) {
        const confirmed = await confirmImageOnlyImport(
          imageOnlyDetail?.message
        )
        if (confirmed) {
          try {
            const imported = await importCharacter(true)
            handleImportSuccess(imported)
          } catch (retryError) {
            const messageText =
              retryError instanceof Error ? retryError.message : String(retryError)
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
          }
        }
        return
      }
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

  const buildCharactersHash = React.useCallback((create?: boolean) => {
    const params = new URLSearchParams({ from: "sidepanel-character-select" })
    if (create) {
      params.set("create", "true")
    }
    return `#/characters?${params.toString()}`
  }, [])

  const openCharactersWorkspace = React.useCallback((options?: { create?: boolean }) => {
    const hash = buildCharactersHash(options?.create)
    try {
      if (typeof window === "undefined") return

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

    window.open(`/options.html${hash}`, "_blank")
  }, [buildCharactersHash])

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
        openCharactersWorkspace({ create: true })
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
              {t("common:loading.title", { defaultValue: "Loading..." })}
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
        accept=".json,.yaml,.yml,.txt,.md,.png,.webp,.jpg,.jpeg"
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
