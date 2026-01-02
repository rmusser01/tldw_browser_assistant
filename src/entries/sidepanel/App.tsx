import { QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { useEffect, useState } from "react"
import { SidepanelRouting } from "@/routes/chrome-route"
import { App as AntdApp, ConfigProvider, Empty, theme } from "antd"
import { StyleProvider } from "@ant-design/cssinjs"
import { useDarkMode } from "~/hooks/useDarkmode"
import { useSidepanelInit } from "~/hooks/useSidepanelInit"
import "~/i18n"
import { PageAssistProvider } from "@/components/Common/PageAssistProvider"
import { FontSizeProvider } from "@/context/FontSizeProvider"
import { QuickChatHelperButton } from "@/components/Common/QuickChatHelper"
import { KeyboardShortcutsModal } from "@/components/Common/KeyboardShortcutsModal"
import { createQueryClient } from "@/services/query-client"

const queryClient = createQueryClient()

function IndexSidepanel() {
  const { mode } = useDarkMode()
  const { direction, t } = useSidepanelInit({
    titleDefaultValue: "tldw Assistant — Sidebar"
  })
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true
  )

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible")
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return (
    <MemoryRouter>
      <ConfigProvider
        theme={{
          algorithm:
            mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            fontFamily: "Arimo"
          }
        }}
        renderEmpty={() => (
          <Empty
            styles={{ image: { height: 60 } }}
            description={t("common:noData")}
          />
        )}
        direction={direction}>
        <AntdApp>
          <StyleProvider hashPriority="high">
            <QueryClientProvider client={queryClient}>
              <PageAssistProvider>
                <FontSizeProvider>
                  {isVisible ? <SidepanelRouting /> : null}
                  <QuickChatHelperButton />
                  <KeyboardShortcutsModal />
                </FontSizeProvider>
              </PageAssistProvider>
            </QueryClientProvider>
          </StyleProvider>
        </AntdApp>
      </ConfigProvider>
    </MemoryRouter>
  )
}

export default IndexSidepanel
