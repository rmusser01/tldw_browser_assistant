import logoImage from "~/assets/icon.png"
import { useMessage } from "~/hooks/useMessage"
import { Link } from "react-router-dom"
import { Tooltip, Drawer, notification, Popover, InputNumber, Space, Button } from "antd"
import {
  BoxesIcon,
  CogIcon,
  EraserIcon,
  // EraserIcon,
  HistoryIcon,
  PlusSquare,
  XIcon,
  MessageSquareShareIcon
} from "lucide-react"
import { useTranslation } from "react-i18next"
// import { CurrentChatModelSettings } from "@/components/Common/Settings/CurrentChatModelSettings"
import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { PromptSelect } from "@/components/Common/PromptSelect"
import { Sidebar } from "@/components/Option/Sidebar"
// import { BsIncognito } from "react-icons/bs"
import { isFireFoxPrivateMode } from "@/utils/is-private-mode"
import { Tooltip as AntdTooltip } from 'antd'

type SidepanelHeaderProps = {
  sidebarOpen?: boolean
  setSidebarOpen?: (open: boolean) => void
}

export const SidepanelHeader = ({ 
  sidebarOpen: propSidebarOpen, 
  setSidebarOpen: propSetSidebarOpen 
}: SidepanelHeaderProps = {}) => {
  const [hideCurrentChatModelSettings] = useStorage(
    "hideCurrentChatModelSettings",
    false
  )

  const {
    clearChat,
    isEmbedding,
    messages,
    streaming,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    setSelectedQuickPrompt,
    setMessages,
    setHistory,
    setHistoryId,
    setSelectedModel,
    historyId,
    history,
    useOCR,
    temporaryChat,
    setTemporaryChat
  } = useMessage()
  const { t } = useTranslation(["sidepanel", "common", "option"])
  const [openModelSettings, setOpenModelSettings] = React.useState(false)
  const [localSidebarOpen, setLocalSidebarOpen] = React.useState(false)
  const [webuiBtnSidePanel, setWebuiBtnSidePanel] = useStorage(
    "webuiBtnSidePanel",
    false
  )
  const [ingestTimeoutSec, setIngestTimeoutSec] = React.useState<number>(120)
  const [debugOpen, setDebugOpen] = React.useState<boolean>(false)
  const [debugLogs, setDebugLogs] = React.useState<Array<{ time: number; kind: string; name?: string; data?: string }>>([])

  React.useEffect(() => {
    const onMsg = (msg: any) => {
      if (msg?.type === 'tldw:stream-debug' && msg?.payload) {
        setDebugLogs((prev) => {
          const next = [...prev, msg.payload]
          if (next.length > 200) next.shift()
          return next
        })
      }
    }
    // @ts-ignore
    browser.runtime.onMessage.addListener(onMsg)
    return () => {
      try { /* @ts-ignore */ browser.runtime.onMessage.removeListener(onMsg) } catch {}
    }
  }, [])

  // Use prop state if provided, otherwise use local state
  const sidebarOpen = propSidebarOpen !== undefined ? propSidebarOpen : localSidebarOpen
  const setSidebarOpen = propSetSidebarOpen || setLocalSidebarOpen

  return (
    <div
      data-istemporary-chat={temporaryChat}
      className=" px-3 justify-between bg-white dark:bg-[#171717] border-b border-gray-300 dark:border-gray-700 py-4 items-center absolute top-0 z-10 flex h-14 w-full data-[istemporary-chat='true']:bg-purple-900 data-[istemporary-chat='true']:dark:bg-purple-900">
      <div className="focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 flex items-center dark:text-white">
        <img
          className="h-6 w-auto"
          src={logoImage}
          alt={t("common:pageAssist")}
        />
        <span className="ml-1 text-sm ">{t("common:pageAssist")}</span>
      </div>

      <div className="flex items-center space-x-3">
        {/* Consolidate less-used actions into kebab menu */}
        <Popover
          trigger="click"
          content={
            <Space size="small" direction="vertical">
              <div className="text-xs text-gray-500">{t('sidepanel:header.ingest')}</div>
              <button
                onClick={async () => {
                  await browser.runtime.sendMessage({ type: 'tldw:ingest', mode: 'store', timeoutMs: Math.max(1, Math.round(Number(ingestTimeoutSec)||120))*1000 })
                  const btn = (
                    <Button size="small" type="link" onClick={() => {
                      const url = browser.runtime.getURL("/options.html#/media")
                      browser.tabs.create({ url })
                    }}>View Media</Button>
                  )
                  notification.success({ message: t('sidepanel:notification.ingestSent'), description: t('sidepanel:notification.ingestSentDesc'), btn })
                }}
                className="text-left text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                {t('sidepanel:header.saveCurrent')}
              </button>
              <button
                onClick={async () => {
                  await browser.runtime.sendMessage({ type: 'tldw:ingest', mode: 'process', timeoutMs: Math.max(1, Math.round(Number(ingestTimeoutSec)||120))*1000 })
                  const btn = (
                    <Button size="small" type="link" onClick={() => {
                      const url = browser.runtime.getURL("/options.html#/media")
                      browser.tabs.create({ url })
                    }}>View Media</Button>
                  )
                  notification.success({ message: t('sidepanel:notification.processedLocal'), description: t('sidepanel:notification.processedLocalDesc'), btn })
                }}
                className="text-left text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                {t('sidepanel:header.processLocal')}
              </button>
              <div className="flex items-center gap-2 px-2 pt-1">
                <span className="text-xs text-gray-500">{t('sidepanel:header.timeoutLabel')}</span>
                <InputNumber min={1} size="small" value={ingestTimeoutSec} onChange={(v) => setIngestTimeoutSec(Number(v||120))} />
              </div>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <button
                onClick={async () => {
                  const storage = new (await import('@plasmohq/storage')).Storage({ area: 'local' })
                  const current = (await storage.get<string>('uiMode')) || 'sidePanel'
                  const next = current === 'sidePanel' ? 'webui' : 'sidePanel'
                  await storage.set('uiMode', next)
                  await storage.set('actionIconClick', next)
                  await storage.set('contextMenuClick', 'sidePanel')
                  if (next === 'webui') {
                    const url = browser.runtime.getURL('/options.html')
                    browser.tabs.create({ url })
                  }
                }}
                className="text-left text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                {t('sidepanel:header.toggleSidebar')}
              </button>
              <button
                onClick={() => {
                  const url = browser.runtime.getURL('/options.html#/docs/shortcuts')
                  browser.tabs.create({ url })
                }}
                className="text-left text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                {t('sidepanel:header.shortcuts')}
              </button>
              <button
                onClick={async () => {
                  const next = !debugOpen
                  setDebugOpen(next)
                  try { await browser.runtime.sendMessage({ type: 'tldw:debug', enable: next }) } catch {}
                }}
                className="text-left text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                {debugOpen ? t('sidepanel:header.hideDebug') : t('sidepanel:header.showDebug')}
              </button>
            </Space>
          }
        >
          <button aria-label={t('sidepanel:header.moreOptionsAria')} title={t('sidepanel:header.moreOptionsTitle')} className="flex items-center space-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 text-gray-500 dark:text-gray-400"><path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4z"/></svg>
          </button>
        </Popover>
        {webuiBtnSidePanel ? (
          <Tooltip title={t("tooltip.openwebui")}>
            <button
              onClick={() => {
                const url = browser.runtime.getURL("/options.html")
                browser.tabs.create({ url })
              }}
              aria-label={t('sidepanel:header.openWebuiAria')}
              className="flex items-center space-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700">
              <MessageSquareShareIcon className="size-4 text-gray-500 dark:text-gray-400" />
            </button>
          </Tooltip>
        ) : null}
        {isEmbedding ? (
          <Tooltip title={t("tooltip.embed")}>
            <BoxesIcon className="size-4 text-gray-500 dark:text-gray-400 animate-bounce animate-infinite" />
          </Tooltip>
        ) : null}

        {messages.length > 0 && !streaming && (
          <button
            title={t("option:newChat")}
            onClick={() => {
              clearChat()
            }}
            aria-label={t('sidepanel:header.newChatAria')}
            className="flex items-center space-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700">
            <PlusSquare className="size-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* Private chat toggle moved into chat input controls */}

        {history.length > 0 && (
          <button
            title={t("tooltip.clear")}
            onClick={() => {
              setHistory([])
            }}
            aria-label={t('sidepanel:header.clearHistoryAria')}
            className="flex items-center space-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700">
            <EraserIcon className="size-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
        <Tooltip title={t("tooltip.history")}>
          <button
            onClick={() => {
              setSidebarOpen(true)
            }}
            aria-label={t('sidepanel:header.openHistoryAria')}
            className="flex items-center space-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700">
            <HistoryIcon className="size-4 text-gray-500 dark:text-gray-400" />
          </button>
        </Tooltip>
        <PromptSelect
          selectedSystemPrompt={selectedSystemPrompt}
          setSelectedSystemPrompt={setSelectedSystemPrompt}
          setSelectedQuickPrompt={setSelectedQuickPrompt}
          iconClassName="size-4"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        />
        {/* Conversation settings button moved next to submit in input bar */}
        <Link to="/settings">
          <CogIcon aria-label={t('sidepanel:header.openSettingsAria')} className="size-4 text-gray-500 dark:text-gray-400" />
        </Link>
      </div>
      {/** Settings modal moved to input area; header trigger removed */}

      <Drawer title="Stream Debug" placement="right" onClose={() => setDebugOpen(false)} open={debugOpen} width={480}>
        <div className="text-xs font-mono whitespace-pre-wrap break-all">
          {debugLogs.length === 0 ? (
            <div className="text-gray-500">No stream events yet.</div>
          ) : (
            debugLogs.map((l, idx) => (
              <div key={idx} className="mb-1">
                <span className="text-gray-400 mr-2">{new Date(l.time).toLocaleTimeString()}</span>
                <span className="mr-2">{l.kind === 'event' ? `event: ${l.name}` : 'data:'}</span>
                {l.data && <span>{l.data}</span>}
              </div>
            ))
          )}
        </div>
      </Drawer>

      <Drawer
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between">
              {t("tooltip.history")}
            </div>

            <button onClick={() => setSidebarOpen(false)}>
              <XIcon className="size-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        }
        placement="left"
        closeIcon={null}
        onClose={() => setSidebarOpen(false)}
        open={sidebarOpen}>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          setMessages={setMessages}
          setHistory={setHistory}
          setHistoryId={setHistoryId}
          setSelectedModel={setSelectedModel}
          setSelectedSystemPrompt={setSelectedSystemPrompt}
          clearChat={clearChat}
          historyId={historyId}
          setSystemPrompt={(e) => {}}
          temporaryChat={false}
          history={history}
        />
      </Drawer>
    </div>
  )
}
