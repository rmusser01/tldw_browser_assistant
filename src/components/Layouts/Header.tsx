import { useStorage } from "@plasmohq/storage/hook"
import {
  BrainCog,
  ChevronLeft,
  ChevronRight,
  CogIcon,
  ComputerIcon,
  GithubIcon,
  PanelLeftIcon,
  ZapIcon
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation, NavLink } from "react-router-dom"
import { SelectedKnowledge } from "../Option/Knowledge/SelectedKnowledge"
import { ModelSelect } from "../Common/ModelSelect"
import { PromptSelect } from "../Common/PromptSelect"
import { useQuery } from "@tanstack/react-query"
import { fetchChatModels } from "@/services/tldw-server"
import { useMessageOption } from "~/hooks/useMessageOption"
import { Avatar, Select, Tooltip } from "antd"
import { getAllPrompts } from "@/db/dexie/helpers"
import { ProviderIcons } from "../Common/ProviderIcon"
import { NewChat } from "./NewChat"
import { MoreOptions } from "./MoreOptions"
import { browser } from "wxt/browser"
type Props = {
  setSidebarOpen: (open: boolean) => void
  setOpenModelSettings: (open: boolean) => void
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
  const {
    data: models,
    isLoading: isModelsLoading,
    refetch
  } = useQuery({
    queryKey: ["fetchModel"],
    queryFn: () => fetchChatModels({ returnEmpty: true }),
    refetchIntervalInBackground: false,
    staleTime: 1000 * 60 * 1
  })

  const { data: prompts, isLoading: isPromptLoading } = useQuery({
    queryKey: ["fetchAllPromptsLayout"],
    queryFn: getAllPrompts
  })

  const { pathname } = useLocation()

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

  return (
    <div
      data-istemporary-chat={temporaryChat}
      className={`absolute top-0 z-10 flex h-14 w-full flex-row items-center justify-center p-3 overflow-x-auto lg:overflow-x-visible bg-gray-50 border-b  dark:bg-[#171717] dark:border-gray-600 data-[istemporary-chat='true']:bg-gray-200 data-[istemporary-chat='true']:dark:bg-black`}>
      <div className="flex gap-2 items-center">
        {pathname !== "/" && (
          <div>
            <NavLink
              to="/"
              className="text-gray-500 items-center dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {isRTL ? (
                <ChevronRight className={`w-8 h-8`} />
              ) : (
                <ChevronLeft className={`w-8 h-8`} />
              )}
            </NavLink>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            className="text-gray-500 dark:text-gray-400"
            onClick={() => setSidebarOpen(true)}>
            <PanelLeftIcon className="w-6 h-6" />
          </button>
          <button
            className="text-gray-500 dark:text-gray-400 text-xs border rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={async () => {
              const storage = new (await import('@plasmohq/storage')).Storage({ area: 'local' })
              await storage.set('uiMode', 'sidePanel')
              await storage.set('actionIconClick', 'sidePanel')
              await storage.set('contextMenuClick', 'sidePanel')
              try {
                // Chromium sidePanel
                // @ts-ignore
                if (chrome?.sidePanel) {
                  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
                  if (tabs?.[0]?.id) await chrome.sidePanel.open({ tabId: tabs[0].id })
                } else if ((browser as any)?.sidebarAction?.open) {
                  await (browser as any).sidebarAction.open()
                }
              } catch {}
            }}
            title="Switch to Sidebar">
            Switch to Sidebar
          </button>
        </div>
        <NewChat clearChat={clearChat} />
        <span className="text-lg font-thin text-zinc-300 dark:text-zinc-600">
          {"/"}
        </span>
        <div className="hidden lg:block">
          <Select
            className="min-w-80  max-w-[460px]"
            placeholder={t("common:selectAModel")}
            // loadingText={t("common:selectAModel")}
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e)
              localStorage.setItem("selectedModel", e)
            }}
            filterOption={(input, option) => {
              //@ts-ignore
              return (
                option?.label?.props["data-title"]
                  ?.toLowerCase()
                  ?.indexOf(input.toLowerCase()) >= 0
              )
            }}
            showSearch
            loading={isModelsLoading}
            options={models?.map((model) => ({
              label: (
                <span
                  key={model.model}
                  data-title={model.name}
                  className="flex flex-row gap-3 items-center ">
                  {model?.avatar ? (
                    <Avatar src={model.avatar} alt={model.name} size="small" />
                  ) : (
                    <ProviderIcons
                      provider={model?.provider}
                      className="w-5 h-5"
                    />
                  )}
                  <span className="line-clamp-2">
                    {model?.nickname || model.model}
                  </span>
                </span>
              ),
              value: model.model
            }))}
            size="large"
            // onRefresh={() => {
            //   refetch()
            // }}
          />
        </div>
        <div className="lg:hidden">
          <ModelSelect />
        </div>
        <span className="text-lg font-thin text-zinc-300 dark:text-zinc-600">
          {"/"}
        </span>
        <div className="hidden lg:block">
          <Select
            size="large"
            loading={isPromptLoading}
            showSearch
            placeholder={t("selectAPrompt")}
            className="w-60"
            allowClear
            onChange={handlePromptChange}
            value={selectedSystemPrompt}
            filterOption={(input, option) =>
              //@ts-ignore
              option.label.key.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            options={prompts?.map((prompt) => ({
              label: (
                <span
                  key={prompt.title}
                  className="flex flex-row gap-3 items-center">
                  {prompt.is_system ? (
                    <ComputerIcon className="w-4 h-4" />
                  ) : (
                    <ZapIcon className="w-4 h-4" />
                  )}
                  {prompt.title}
                </span>
              ),
              value: prompt.id
            }))}
          />
        </div>
        <div className="lg:hidden">
          <PromptSelect
            selectedSystemPrompt={selectedSystemPrompt}
            setSelectedSystemPrompt={setSelectedSystemPrompt}
            setSelectedQuickPrompt={setSelectedQuickPrompt}
          />
        </div>
        <SelectedKnowledge />
      </div>
      <div className="flex flex-1 justify-end px-4">
        <div className="ml-4 flex items-center md:ml-6">
          <div className="flex gap-4 items-center">
            {messages.length > 0 && !streaming && (
              <MoreOptions
                shareModeEnabled={shareModeEnabled}
                historyId={historyId}
                messages={messages}
              />
            )}
            {!hideCurrentChatModelSettings && (
              <Tooltip title={t("common:currentChatModelSettings")}>
                <button
                  onClick={() => setOpenModelSettings(true)}
                  className="!text-gray-500 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  <BrainCog className="w-6 h-6" />
                </button>
              </Tooltip>
            )}
            <Tooltip title={t("githubRepository")}>
              <a
                href="https://github.com/n4ze3m/page-assist"
                target="_blank"
                className="!text-gray-500 hidden lg:block dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <GithubIcon className="w-6 h-6" />
              </a>
            </Tooltip>
            <Tooltip title={t("settings")}>
              <NavLink
                to="/settings"
                className="!text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <CogIcon className="w-6 h-6" />
              </NavLink>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
