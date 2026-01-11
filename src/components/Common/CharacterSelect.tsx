import { useQuery } from "@tanstack/react-query"
import { Dropdown, Tooltip, Input, type MenuProps } from "antd"
import { UserCircle2 } from "lucide-react"
import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { useTranslation } from "react-i18next"
import { browser } from "wxt/browser"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { IconButton } from "./IconButton"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { useAntdModal } from "@/hooks/useAntdModal"
import { useSelectedCharacter } from "@/hooks/useSelectedCharacter"
import { collectGreetings } from "@/utils/character-greetings"
import { useClearChat } from "@/hooks/chat/useClearChat"
import { useStoreMessageOption } from "@/store/option"

type Props = {
  className?: string
  iconClassName?: string
  showLabel?: boolean
}

type CharacterSummary = {
  id?: string | number
  slug?: string
  name?: string
  title?: string
  avatar_url?: string
  image_base64?: string
  image_mime?: string
  system_prompt?: string
  systemPrompt?: string
  instructions?: string
  greeting?: string
  first_message?: string
  firstMessage?: string
  greet?: string
  alternate_greetings?: string[] | string | null
  alternateGreetings?: string[] | string | null
}

type CharacterSelection = {
  id: string
  name: string
  system_prompt: string
  greeting: string
  alternate_greetings?: string[]
  avatar_url: string
}

const normalizeCharacter = (character: CharacterSummary): CharacterSelection => {
  const idSource =
    character.id ?? character.slug ?? character.name ?? character.title ?? ""
  const nameSource = character.name ?? character.title ?? character.slug ?? ""

  if (!idSource || !nameSource) {
    throw new Error("Character must have a valid id and name")
  }

  const avatar =
    character.avatar_url ||
    (character.image_base64
      ? `data:${character.image_mime || "image/png"};base64,${
          character.image_base64
        }`
      : "")

  const greetings = collectGreetings(character)
  const [primaryGreeting, ...alternateGreetings] = greetings

  return {
    id: String(idSource),
    name: String(nameSource),
    system_prompt:
      character.system_prompt ||
      character.systemPrompt ||
      character.instructions ||
      "",
    // Keep greeting deterministic; choose a randomized greeting at injection time.
    greeting: primaryGreeting ?? "",
    alternate_greetings:
      alternateGreetings.length > 0 ? alternateGreetings : undefined,
    avatar_url: avatar
  }
}

export const CharacterSelect: React.FC<Props> = ({
  className = "text-text-muted",
  iconClassName = "size-5",
  showLabel = true
}) => {
  const { t } = useTranslation(["option", "common", "settings", "playground"])
  const notification = useAntdNotification()
  const modal = useAntdModal()
  const [selectedCharacter, setSelectedCharacter] =
    useSelectedCharacter<CharacterSelection | null>(null)
  const clearChat = useClearChat()
  const messages = useStoreMessageOption((state) => state.messages)
  const serverChatId = useStoreMessageOption((state) => state.serverChatId)
  const [userDisplayName, setUserDisplayName] = useStorage(
    "chatUserDisplayName",
    ""
  )
  const previousCharacterId = React.useRef<string | null>(null)
  const initialized = React.useRef(false)
  const lastErrorRef = React.useRef<unknown | null>(null)
  const importInputRef = React.useRef<HTMLInputElement | null>(null)
  const imageOnlyModalRef = React.useRef<ReturnType<typeof modal.confirm> | null>(
    null
  )
  const confirmResolveRef = React.useRef<((confirmed: boolean) => void) | null>(
    null
  )
  const [isImporting, setIsImporting] = React.useState(false)

  const { data, refetch, isFetching, error } = useQuery<CharacterSummary[]>({
    queryKey: ["tldw:listCharacters"],
    queryFn: async () => {
      await tldwClient.initialize()
      const list = await tldwClient.listCharacters()
      return Array.isArray(list) ? list : []
    },
    // Cache characters so we don't refetch on every open.
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  })

  const [menuDensity] = useStorage<"comfortable" | "compact">(
    "menuDensity",
    "comfortable"
  )
  const [searchQuery, setSearchQuery] = React.useState("")
  const selectLabel = t("option:characters.selectCharacter", {
    defaultValue: "Select character"
  }) as string
  const clearLabel = t("option:characters.clearCharacter", {
    defaultValue: "Clear character"
  }) as string
  const emptyTitle = t("settings:manageCharacters.emptyTitle", {
    defaultValue: "No characters yet"
  }) as string
  const emptyDescription = t("settings:manageCharacters.emptyDescription", {
    defaultValue:
      "Create a reusable character with a name, description, and system prompt you can chat with."
  }) as string
  const emptyCreateLabel = t("settings:manageCharacters.emptyPrimaryCta", {
    defaultValue: "Create character"
  }) as string
  const createNewLabel = t("option:characters.createNewCharacter", {
    defaultValue: "Create a New Character+"
  }) as string
  const importLabel = t("option:characters.importCharacter", {
    defaultValue: "Import Character"
  }) as string
  const openPageLabel = t("option:characters.openCharactersPage", {
    defaultValue: "Characters Page"
  }) as string
  const searchPlaceholder = t("option:characters.searchPlaceholder", {
    defaultValue: "Search characters by name"
  }) as string
  const trimmedDisplayName = userDisplayName.trim()
  const hasActiveChat = React.useMemo(() => {
    if (serverChatId) return true
    return messages.some(
      (message) => message.messageType !== "character:greeting"
    )
  }, [messages, serverChatId])
  const openDisplayNameModal = React.useCallback(() => {
    let nextValue = trimmedDisplayName
    modal.confirm({
      title: t("option:characters.displayNameTitle", {
        defaultValue: "Set your name"
      }),
      content: (
        <div className="space-y-2">
          <Input
            autoFocus
            defaultValue={trimmedDisplayName}
            placeholder={t("option:characters.displayNamePlaceholder", {
              defaultValue: "Enter a display name"
            }) as string}
            onChange={(event) => {
              nextValue = event.target.value
            }}
          />
          <div className="text-xs text-text-muted">
            {t("option:characters.displayNameHelp", {
              defaultValue: "Used to replace {{user}} and similar placeholders."
            })}
          </div>
        </div>
      ),
      okText: t("option:characters.displayNameSave", {
        defaultValue: "Save"
      }),
      cancelText: t("common:cancel", { defaultValue: "Cancel" }),
      centered: true,
      onOk: () => {
        setUserDisplayName(nextValue.trim())
      }
    })
  }, [modal, setUserDisplayName, t, trimmedDisplayName])

  const confirmCharacterSwitch = React.useCallback(
    (nextName?: string) =>
      new Promise<boolean>((resolve) => {
        if (confirmResolveRef.current) {
          confirmResolveRef.current(false)
        }
        let settled = false
        const finalize = (value: boolean) => {
          if (settled) return
          settled = true
          if (confirmResolveRef.current === resolve) {
            confirmResolveRef.current = null
          }
          resolve(value)
        }
        confirmResolveRef.current = resolve
        modal.confirm({
          title: t("option:characters.switchConfirmTitle", {
            defaultValue: "Switch character?"
          }),
          content: t("option:characters.switchConfirmBody", {
            defaultValue: nextName
              ? "Switching to {{name}} will clear the current chat. Continue?"
              : "Changing the character will clear the current chat. Continue?",
            name: nextName
          }),
          okText: t("option:characters.switchConfirmOk", {
            defaultValue: "Clear chat & switch"
          }),
          cancelText: t("common:cancel", { defaultValue: "Cancel" }),
          centered: true,
          okButtonProps: { danger: true },
          onOk: () => finalize(true),
          onCancel: () => finalize(false),
          afterClose: () => finalize(false)
        })
      }),
    [modal, t]
  )

  const applySelection = React.useCallback(
    async (next: CharacterSelection | null) => {
      const nextId = next?.id ?? null
      const currentId = selectedCharacter?.id ?? null
      if (nextId === currentId) return

      if (hasActiveChat) {
        const confirmed = await confirmCharacterSwitch(next?.name)
        if (!confirmed) return
      }

      setSelectedCharacter(next)
      if (hasActiveChat) {
        clearChat()
      }

      if (next && !next.greeting) {
        const targetId = next.id
        void tldwClient
          .initialize()
          .catch(() => null)
          .then(() => tldwClient.getCharacter(targetId))
          .then((full) => {
            const hydrated = normalizeCharacter(full || {})
            if (hydrated?.id === targetId && hydrated.greeting) {
              setSelectedCharacter(hydrated)
            }
          })
          .catch(() => {})
      }
    },
    [
      clearChat,
      confirmCharacterSwitch,
      hasActiveChat,
      selectedCharacter?.id,
      setSelectedCharacter
    ]
  )

  const handleImportSuccess = React.useCallback(
    (imported: any) => {
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
      try {
        const normalized = normalizeCharacter(importedCharacter || {})
        void applySelection(normalized)
      } catch {
        // ignore normalization failures; list will refresh
      }
    },
    [applySelection, notification, refetch, t]
  )

  React.useEffect(() => {
    return () => {
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false)
        confirmResolveRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    if (!error || isFetching) {
      lastErrorRef.current = null
      return
    }

    if (lastErrorRef.current === error) {
      return
    }

    lastErrorRef.current = error

    notification.error({
      message: t(
        "option:characters.fetchErrorTitle",
        "Unable to load characters"
      ),
      description: t(
        "option:characters.fetchErrorBody",
        "Check your connection or server health, then try again."
      ),
      placement: "bottomRight",
      duration: 3
    })
  }, [error, isFetching, notification, t])

  React.useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      previousCharacterId.current = selectedCharacter?.id ?? null
      return
    }

    if (
      selectedCharacter?.id &&
      selectedCharacter?.name &&
      previousCharacterId.current !== selectedCharacter.id
    ) {
      notification.success({
        message: t("option:characters.chattingAs", {
          defaultValue: "You're chatting with {{name}}.",
          name: selectedCharacter.name
        })
      })
    }

    previousCharacterId.current = selectedCharacter?.id ?? null
  }, [notification, selectedCharacter?.id, selectedCharacter?.name, t])

  const buildCharactersHash = React.useCallback((create?: boolean) => {
    const params = new URLSearchParams({ from: "header-select" })
    if (create) {
      params.set("create", "true")
    }
    return `#/characters?${params.toString()}`
  }, [])

  const handleOpenCharacters = React.useCallback((options?: { create?: boolean }) => {
    try {
      if (typeof window === "undefined") return

      const hash = buildCharactersHash(options?.create)
      const pathname = window.location.pathname || ""

      // If we're already inside the options UI, just switch routes in-place.
      if (pathname.includes("options.html")) {
        const base = window.location.href.replace(/#.*$/, "")
        window.location.href = `${base}${hash}`
        return
      }

      // Otherwise, try to open the options page in a new tab.
      try {
        const url = browser.runtime.getURL(`/options.html${hash}`)
        if (browser.tabs?.create) {
          browser.tabs.create({ url })
        } else {
          window.open(url, "_blank")
        }
        return
      } catch {
        // fall through to window.open fallback
      }

      window.open(`/options.html${hash}`, "_blank")
    } catch {
      // ignore navigation errors
    }
  }, [buildCharactersHash])

  const handleOpenCreate = React.useCallback(() => {
    handleOpenCharacters({ create: true })
  }, [handleOpenCharacters])

  React.useEffect(() => {
    return () => {
      imageOnlyModalRef.current?.destroy()
      imageOnlyModalRef.current = null
    }
  }, [])

  const handleImportClick = React.useCallback(() => {
    if (isImporting) return
    if (!importInputRef.current) return
    importInputRef.current.value = ""
    importInputRef.current.click()
  }, [isImporting])

  const handleImportFile = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          const clearRef = () => {
            imageOnlyModalRef.current = null
          }
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
            onOk: () => {
              resolve(true)
              clearRef()
            },
            onCancel: () => {
              resolve(false)
              clearRef()
            }
          })
        })

      try {
        setIsImporting(true)
        await tldwClient.initialize().catch(() => null)
        const importCharacter = async (allowImageOnly = false) =>
          await tldwClient.importCharacterFile(file, { allowImageOnly })
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
              const imported = await tldwClient.importCharacterFile(file, {
                allowImageOnly: true
              })
              handleImportSuccess(imported)
            } catch (retryError) {
              const messageText =
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError)
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
    },
    [handleImportSuccess, modal, notification, t]
  )

  const filteredCharacters = React.useMemo(() => {
    const list = Array.isArray(data) ? data : []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => {
      const name = (
        c.name ||
        c.title ||
        c.slug ||
        ""
      ).toString().toLowerCase()
      return name.includes(q)
    })
  }, [data, searchQuery])

  const characterItems = React.useMemo<MenuProps["items"]>(() => {
    return filteredCharacters.reduce<MenuProps["items"]>((items, character, index) => {
      try {
        const normalized = normalizeCharacter(character)
        const displayName =
          normalized.name || character.slug || character.title || ""
        const menuKey =
          character.id ??
          character.slug ??
          character.name ??
          character.title ??
          `character-${index}`

        items.push({
          key: String(menuKey),
          label: (
            <div className="w-56 gap-2 text-sm truncate inline-flex items-center leading-5">
              {normalized.avatar_url ? (
                <img
                  src={normalized.avatar_url}
                  alt={displayName || normalized.id || `Character ${menuKey}`}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <UserCircle2 className="w-4 h-4" />
              )}
              <span className="truncate">
                {displayName || normalized.id || String(menuKey)}
              </span>
            </div>
          ),
          onClick: () => {
            void applySelection(normalized)
          }
        })
      } catch (err) {
        // Skip characters with invalid identifiers but log for debugging.
        console.debug(
          "[CharacterSelect] Skipping character with invalid id/name",
          character,
          err
        )
      }
      return items
    }, [] as MenuProps["items"])
  }, [applySelection, filteredCharacters])

  const clearItem: MenuProps["items"][number] | null =
    selectedCharacter
      ? {
          key: "__clear__",
          label: (
            <button
              type="button"
              className="w-full text-left text-xs font-medium text-text hover:text-text-muted"
            >
              {t(
                "option:characters.clearCharacter",
                "Clear character"
              ) as string}
            </button>
          ),
          onClick: () => {
            void applySelection(null)
          }
        }
      : null

  const refreshItem: MenuProps["items"][number] = {
    key: "__refresh__",
    label: (
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-primary hover:text-primaryStrong"
      >
        {isFetching
          ? t("option:characters.refreshing", "Refreshing characters…")
          : t("option:characters.refresh", "Refresh characters")}
      </button>
    ),
    onClick: () => {
      refetch({ cancelRefetch: true })
    }
  } as const

  const dividerItem = (key: string): MenuProps["items"][number] => ({
    type: "divider",
    key
  })

  const menuItems: MenuProps["items"] = []

  const noneItem: MenuProps["items"][number] = {
    key: "__none__",
    label: (
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-text hover:text-text-muted"
      >
        {t("option:characters.none", "None (no character)") as string}
      </button>
    ),
    onClick: () => {
      void applySelection(null)
    }
  }

  const createItem: MenuProps["items"][number] = {
    key: "__create_character__",
    label: (
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-primary hover:text-primaryStrong"
      >
        {createNewLabel}
      </button>
    ),
    onClick: handleOpenCreate
  }

  const openPageItem: MenuProps["items"][number] = {
    key: "__open_characters_page__",
    label: (
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-primary hover:text-primaryStrong"
      >
        {openPageLabel}
      </button>
    ),
    onClick: () => handleOpenCharacters()
  }

  const importItem: MenuProps["items"][number] = {
    key: "__import_character__",
    label: (
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-primary hover:text-primaryStrong"
      >
        {importLabel}
      </button>
    ),
    onClick: handleImportClick
  }

  const displayNameItem: MenuProps["items"][number] = {
    key: "__user_display_name__",
    label: (
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-text hover:text-text-muted"
      >
        {trimmedDisplayName
          ? t("option:characters.displayNameCurrent", {
              defaultValue: "Your name: {{name}}",
              name: trimmedDisplayName
            })
          : t("option:characters.displayNameAction", {
              defaultValue: "Set your name"
            })}
      </button>
    ),
    onClick: openDisplayNameModal
  }

  menuItems.push(noneItem, displayNameItem, openPageItem, createItem, importItem)

  if (characterItems && characterItems.length > 0) {
    menuItems.push(dividerItem("__divider_items__"), ...characterItems)
  } else if (!data || (Array.isArray(data) && data.length === 0)) {
    menuItems.push(
      dividerItem("__divider_empty__"),
      {
        key: "empty",
        label: (
          <div className="w-56 px-2 py-2 text-xs text-text-muted">
            <div className="font-medium text-text">
              {emptyTitle}
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              {emptyDescription}
            </div>
            <button
              type="button"
              className="mt-2 inline-flex items-center rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-primary hover:border-primary hover:text-primaryStrong">
              {emptyCreateLabel}
            </button>
          </div>
        ),
        onClick: handleOpenCreate
      }
    )
  } else {
    menuItems.push({
      key: "__no_matches__",
      label: (
      <div className="w-56 px-2 py-2 text-xs text-text-muted">
        {t(
          "option:characters.noMatches",
          "No characters match your search yet."
          ) as string}
        </div>
      )
    })
  }

  if (clearItem) {
    menuItems.push(dividerItem("__divider_clear__"), clearItem)
  }

  const actorItem: MenuProps["items"][number] = {
    key: "__actor__",
    label: (
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-text hover:text-text-muted"
      >
        {t(
          "playground:composer.actorTitle",
          "Scene Director (Actor)"
        ) as string}
      </button>
    ),
    onClick: () => {
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tldw:open-actor-settings"))
        }
      } catch {
        // no-op
      }
    }
  }

  menuItems.push(dividerItem("__divider_actor__"), actorItem)
  menuItems.push(dividerItem("__divider_refresh__"), refreshItem)

  const menuContainerRef = React.useRef<HTMLDivElement | null>(null)
  const menuListRef = React.useRef<HTMLUListElement | null>(null)

  const attachMenuRef = React.useCallback(
    (node: HTMLUListElement | null, ref?: React.Ref<HTMLUListElement>) => {
      menuListRef.current = node
      if (!ref) return
      if (typeof ref === "function") {
        ref(node)
      } else if ("current" in ref) {
        ;(ref as React.MutableRefObject<HTMLUListElement | null>).current = node
      }
    },
    []
  )

  const renderMenuWithRef = React.useCallback(
    (menuNode: React.ReactNode) => {
      if (!React.isValidElement(menuNode)) return menuNode
      const menuElement = menuNode as React.ReactElement
      const originalRef = (menuElement as any).ref as React.Ref<HTMLUListElement> | undefined
      return React.cloneElement(menuElement, {
        ref: (node: HTMLUListElement | null) => attachMenuRef(node, originalRef)
      } as any)
    },
    [attachMenuRef]
  )

  const focusFirstMenuItem = React.useCallback(() => {
    const firstItem = menuListRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])'
    )
    firstItem?.focus()
  }, [])

  return (
    <div className="flex items-center gap-2">
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.yaml,.yml,.txt,.md,.png,.webp,.jpg,.jpeg"
        className="hidden"
        onChange={handleImportFile}
      />
      <Dropdown
        onOpenChange={(open) => {
          if (!open) {
            setSearchQuery("")
          }
        }}
        popupRender={(menu) => (
          <div className="w-64" ref={menuContainerRef}>
            <div className="px-2 py-2 border-b border-border">
              <Input
                size="small"
                placeholder={searchPlaceholder}
                value={searchQuery}
                autoFocus
                allowClear
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    focusFirstMenuItem()
                  }
                }}
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto no-scrollbar">
              {renderMenuWithRef(menu)}
            </div>
          </div>
        )}
        menu={{
          items: menuItems,
          activeKey: selectedCharacter?.id,
          className: `character-select-menu no-scrollbar ${
            menuDensity === "compact"
              ? "menu-density-compact"
              : "menu-density-comfortable"
          }`
        }}
        placement="topLeft"
        trigger={["click"]}>
        <Tooltip
          title={
            selectedCharacter?.name
              ? `${selectedCharacter.name} — ${clearLabel}`
              : selectLabel
          }>
          <div className="relative inline-flex">
            <IconButton
              ariaLabel={
                (selectedCharacter?.name
                  ? `${selectedCharacter.name} — ${clearLabel}`
                  : selectLabel) as string
              }
              hasPopup="menu"
              className={`h-11 w-11 sm:h-7 sm:w-7 sm:min-w-0 sm:min-h-0 ${className}`}>
              {selectedCharacter?.avatar_url ? (
                <img
                  src={selectedCharacter.avatar_url}
                  alt={selectedCharacter?.name || "Character avatar"}
                  className={"rounded-full " + iconClassName}
                />
              ) : (
                <UserCircle2 className={iconClassName} />
              )}
            </IconButton>
            {selectedCharacter && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void applySelection(null)
                }}
                className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-text text-[10px] font-semibold text-bg shadow-sm hover:bg-text-muted"
                aria-label={clearLabel}
                title={clearLabel}>
                ×
              </button>
            )}
          </div>
        </Tooltip>
      </Dropdown>

      {showLabel && selectedCharacter?.name && (
        <div className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text shadow-sm sm:inline-flex">
          {selectedCharacter?.avatar_url ? (
            <img
              src={selectedCharacter.avatar_url}
              className="h-5 w-5 rounded-full"
            />
          ) : (
            <UserCircle2 className="h-4 w-4" />
          )}
          <span className="max-w-[180px] truncate">{selectedCharacter.name}</span>
        </div>
      )}
    </div>
  )
}
