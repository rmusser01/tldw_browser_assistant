import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { CogIcon, Gauge } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation, NavLink, useNavigate } from "react-router-dom"
import { SelectedKnowledge } from "../Option/Knowledge/SelectedKnowledge"
import { ModelSelect } from "../Common/ModelSelect"
import { PromptSelect } from "../Common/PromptSelect"
import PromptSearch from "../Common/PromptSearch"
import { useQuery } from "@tanstack/react-query"
import { useServerOnline } from "@/hooks/useServerOnline"
import { fetchChatModels } from "@/services/tldw-server"
import { useMessageOption } from "~/hooks/useMessageOption"
import { Avatar, Select, Popover, Input, Divider } from "antd"
import QuickIngestModal from "../Common/QuickIngestModal"
import {
  UploadCloud,
  Microscope,
  BookText,
  LayoutGrid,
  StickyNote,
  Layers,
  NotebookPen,
  BookMarked,
  BookOpen,
  ChevronDown
} from "lucide-react"
import { getAllPrompts } from "@/db/dexie/helpers"
import { ProviderIcons } from "../Common/ProviderIcon"
import { NewChat } from "./NewChat"
import { MoreOptions } from "./MoreOptions"
import { browser } from "wxt/browser"
import { CharacterSelect } from "../Common/CharacterSelect"
import { PrimaryToolbar } from "./PrimaryToolbar"

const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ")

type Props = {
  setSidebarOpen: (open: boolean) => void
  setOpenModelSettings: (open: boolean) => void
}

type NavigationItem =
  | {
      type: "link"
      to: string
      icon: React.ComponentType<{ className?: string }>
      label: string
    }
  | {
      type: "component"
      key: string
      node: React.ReactNode
    }

export const Header: React.FC<Props> = ({
  setOpenModelSettings,
  setSidebarOpen
}) => {
  const { t, i18n } = useTranslation(["option", "common"])
  const isRTL = i18n?.dir() === "rtl"

  const [shareModeEnabled] = useStorage("shareMode", false)
  const [hideCurrentChatModelSettings] = useStorage(
    "hideCurrentChatModelSettings",
    false
  )
  const {
    selectedModel,
    setSelectedModel,
    clearChat,
    selectedSystemPrompt,
    setSelectedQuickPrompt,
    setSelectedSystemPrompt,
    messages,
    streaming,
    historyId,
    temporaryChat
  } = useMessageOption()
  const isOnline = useServerOnline()
  const {
    data: models,
    isLoading: isModelsLoading,
    refetch
  } = useQuery({
    queryKey: ["fetchModel"],
    queryFn: () => fetchChatModels({ returnEmpty: true }),
    refetchIntervalInBackground: false,
    staleTime: 1000 * 60 * 1,
    enabled: isOnline
  })

  const { data: prompts, isLoading: isPromptLoading } = useQuery({
    queryKey: ["fetchAllPromptsLayout"],
    queryFn: getAllPrompts
  })

  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false)
  const [chatTitle, setChatTitle] = React.useState("")
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [quickIngestOpen, setQuickIngestOpen] = React.useState(false)

  React.useEffect(() => {
    (async () => {
      try {
        if (historyId && historyId !== 'temp' && !temporaryChat) {
          const { getTitleById } = await import('@/db')
          const title = await getTitleById(historyId)
          setChatTitle(title || '')
        } else {
          setChatTitle('')
        }
      } catch {}
    })()
  }, [historyId, temporaryChat])

  const saveTitle = async (value: string) => {
    try {
      if (historyId && historyId !== 'temp' && !temporaryChat) {
        const { updateHistory } = await import('@/db')
        await updateHistory(historyId, value.trim() || 'Untitled')
      }
    } catch (e) {
      console.error('Failed to update chat title', e)
    }
  }

  const getPromptInfoById = (id: string) => {
    return prompts?.find((prompt) => prompt.id === id)
  }

  const handlePromptChange = (value?: string) => {
    if (!value) {
      setSelectedSystemPrompt(undefined)
      setSelectedQuickPrompt(undefined)
      return
    }
    const prompt = getPromptInfoById(value)
    if (prompt?.is_system) {
      setSelectedSystemPrompt(prompt.id)
    } else {
      setSelectedSystemPrompt(undefined)
      setSelectedQuickPrompt(prompt!.content)
    }
  }

  const navigationGroups = React.useMemo(
    (): Array<{ title: string; items: NavigationItem[] }> => [
      {
        title: t("option:header.groupWorkspace", "Workspace"),
        items: [
          {
            type: "link" as const,
            to: "/review",
            icon: Microscope,
            label: t("option:header.review", "Review")
          },
          {
            type: "link" as const,
            to: "/flashcards",
            icon: Layers,
            label: t("option:header.flashcards", "Flashcards")
          },
          {
            type: "link" as const,
            to: "/notes",
            icon: StickyNote,
            label: t("option:header.notes", "Notes")
          }
        ]
      },
      {
        title: t("option:header.groupKnowledge", "Knowledge"),
        items: [
          {
            type: "component" as const,
            key: "selected-knowledge",
            node: <SelectedKnowledge />
          },
          {
            type: "link" as const,
            to: "/media",
            icon: BookText,
            label: t("option:header.media", "Media")
          },
          {
            type: "link" as const,
            to: "/media-multi",
            icon: LayoutGrid,
            label: t("option:header.libraryView", "Library view")
          }
        ]
      },
      {
        title: t("option:header.groupSettings", "Settings shortcuts"),
        items: [
          {
            type: "link" as const,
            to: "/settings",
            icon: CogIcon,
            label: t("settings")
          },
          {
            type: "link" as const,
            to: "/settings/prompt",
            icon: NotebookPen,
            label: t("settings:managePrompts.title")
          },
          {
            type: "link" as const,
            to: "/settings/world-books",
            icon: BookOpen,
            label: t("settings:manageKnowledge.worldBooks", "World Books")
          },
          {
            type: "link" as const,
            to: "/settings/chat-dictionaries",
            icon: BookMarked,
            label: t("settings:manageKnowledge.chatDictionaries", "Chat dictionaries")
          }
        ]
      }
    ],
    [t]
  )

  const [shortcutsExpanded, setShortcutsExpanded] = React.useState(false)

  return (
    <header
      data-istemporary-chat={temporaryChat}
      className="sticky top-0 z-30 flex w-full flex-col gap-3 border-b bg-gray-50/95 p-3 backdrop-blur dark:border-gray-600 dark:bg-[#171717]/95 data-[istemporary-chat='true']:bg-purple-900 data-[istemporary-chat='true']:dark:bg-purple-900">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PrimaryToolbar
          onToggleSidebar={() => setSidebarOpen(true)}
          showBack={pathname !== "/"}
          isRTL={isRTL}>
          <div className="flex items-center gap-3 min-w-0">
            <NewChat clearChat={clearChat} />
            {!temporaryChat && historyId && historyId !== "temp" && (
              <div className="hidden min-w-[160px] max-w-[280px] lg:block">
                {isEditingTitle ? (
                  <Input
                    size="small"
                    autoFocus
                    value={chatTitle}
                    onChange={(e) => setChatTitle(e.target.value)}
                    onPressEnter={async () => {
                      setIsEditingTitle(false)
                      await saveTitle(chatTitle)
                    }}
                    onBlur={async () => {
                      setIsEditingTitle(false)
                      await saveTitle(chatTitle)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="truncate text-left text-sm text-gray-700 hover:underline dark:text-gray-200"
                    title={chatTitle || "Untitled"}
                  >
                    {chatTitle || t("option:header.untitledChat", "Untitled")}
                  </button>
                )}
              </div>
            )}
          </div>
        </PrimaryToolbar>

        <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("option:header.modelLabel", "Model")}
            </span>
            <div className="hidden lg:block">
              <Select
                className="min-w-[220px] max-w-[320px]"
                placeholder={t("common:selectAModel")}
                value={selectedModel}
                onChange={(value) => {
                  setSelectedModel(value)
                  localStorage.setItem("selectedModel", value)
                }}
                filterOption={(input, option) => {
                  // @ts-ignore
                  const haystack = option?.label?.props?.["data-title"] as string | undefined
                  return haystack?.toLowerCase().includes(input.toLowerCase()) ?? false
                }}
                showSearch
                loading={isModelsLoading}
                options={models?.map((model) => ({
                  label: (
                    <span
                      key={model.model}
                      data-title={model.name}
                      className="flex items-center gap-2">
                      {model?.avatar ? (
                        <Avatar src={model.avatar} alt={model.name} size="small" />
                      ) : (
                        <ProviderIcons provider={model?.provider} className="h-4 w-4" />
                      )}
                      <span className="truncate">
                        {model?.nickname || model.model}
                      </span>
                    </span>
                  ),
                  value: model.model
                }))}
                size="large"
              />
            </div>
            <div className="lg:hidden">
              <ModelSelect />
            </div>
          </div>

          <div className="hidden min-w-[240px] flex-col gap-1 lg:flex">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("option:header.promptLabel", "Prompt")}
            </span>
            <PromptSearch
              onInsertMessage={(content) => {
                setSelectedSystemPrompt(undefined)
                setSelectedQuickPrompt(content)
              }}
              onInsertSystem={(content) => {
                setSelectedSystemPrompt(undefined)
                import("@/store/model").then(({ useStoreChatModelSettings }) => {
                  const { setSystemPrompt } =
                    useStoreChatModelSettings.getState?.() || ({ setSystemPrompt: undefined } as any)
                  setSystemPrompt?.(content)
                })
              }}
            />
          </div>

          <div className="w-full min-w-[180px] lg:hidden">
            <PromptSelect
              selectedSystemPrompt={selectedSystemPrompt}
              setSelectedSystemPrompt={setSelectedSystemPrompt}
              setSelectedQuickPrompt={setSelectedQuickPrompt}
            />
          </div>

          <CharacterSelect className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100" />
        </div>
      </div>

      <Divider className="hidden lg:block" plain />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2 lg:flex-1">
          <button
            type="button"
            onClick={() => setShortcutsExpanded((prev) => !prev)}
            aria-expanded={shortcutsExpanded}
            className="inline-flex items-center self-start rounded-md border border-transparent px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:border-gray-300 hover:bg-white dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f]">
            <ChevronDown
              className={classNames(
                "mr-1 h-4 w-4 transition-transform",
                shortcutsExpanded ? "rotate-180" : ""
              )}
            />
            {shortcutsExpanded
              ? t("option:header.hideShortcuts", "Hide shortcuts")
              : t("option:header.showShortcuts", "Show shortcuts")}
          </button>
          {shortcutsExpanded && (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 lg:flex-1">
                {navigationGroups.map((group) => (
                  <div key={group.title} className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {group.title}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {group.items.map((item) => {
                        if (item.type === "component") {
                          return (
                            <div key={item.key} className="w-full sm:w-auto">
                              {item.node}
                            </div>
                          )
                        }
                        const Icon = item.icon
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                              classNames(
                                "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:w-auto",
                                isActive
                                  ? "border-gray-300 bg-white text-gray-900 dark:border-gray-500 dark:bg-[#1f1f1f] dark:text-white"
                                  : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-white dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f]"
                              )
                            }>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => setOpenModelSettings(true)}
            className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-gray-600 transition hover:border-gray-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f] sm:w-auto"
          >
            <Gauge className="h-4 w-4" aria-hidden="true" />
            <span>{t("option:header.modelSettings", "Model settings")}</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickIngestOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-gray-600 transition hover:border-gray-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f] sm:w-auto"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            <span>{t("option:header.quickIngest", "Quick ingest")}</span>
          </button>

          {messages.length > 0 && !streaming && (
            <div className="flex items-center gap-1">
              <MoreOptions
                shareModeEnabled={shareModeEnabled}
                historyId={historyId}
                messages={messages}
              />
              <span className="sr-only">{t("option:header.moreActions", "More actions")}</span>
            </div>
          )}

          <Popover
            open={moreMenuOpen}
            onOpenChange={setMoreMenuOpen}
            trigger="click"
            placement="bottomRight"
            content={
              <div className="flex flex-col gap-1 min-w-48 text-sm">
                <span className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t("option:header.moreMenu.title", "Advanced tools")}
                </span>
                <button
                  onClick={() => {
                    try {
                      window.open("https://github.com/n4ze3m/page-assist", "_blank", "noopener")
                    } finally {
                      setMoreMenuOpen(false)
                    }
                  }}
                  className="rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t("option:githubRepository")}
                </button>
                <button
                  onClick={async () => {
                    const storage = new (await import("@plasmohq/storage")).Storage({ area: "local" })
                    await storage.set("uiMode", "sidePanel")
                    await storage.set("actionIconClick", "sidePanel")
                    await storage.set("contextMenuClick", "sidePanel")
                    try {
                      // @ts-ignore
                      if (chrome?.sidePanel) {
                        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
                        if (tabs?.[0]?.id) await chrome.sidePanel.open({ tabId: tabs[0].id })
                      } else {
                        await browser.sidebarAction.open()
                      }
                    } catch {}
                    setMoreMenuOpen(false)
                  }}
                  className="rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t("option:header.openSidebar", "Switch to sidebar")}
                </button>
              </div>
            }
          >
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm text-gray-600 transition hover:border-gray-300 hover:bg-white dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f]"
            >
              <span>{t("option:header.more", "More")}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true">
                <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </Popover>
        </div>
      </div>

      <QuickIngestModal open={quickIngestOpen} onClose={() => setQuickIngestOpen(false)} />
    </header>
  )
}
