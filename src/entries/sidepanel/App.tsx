import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { useEffect, useState } from "react"
import { SidepanelRouting } from "@/routes/chrome-route"
const queryClient = new QueryClient()
import { App as AntdApp, ConfigProvider, Empty, theme } from "antd"
import { StyleProvider } from "@ant-design/cssinjs"
import { useDarkMode } from "~/hooks/useDarkmode"
import "~/i18n"
import { useTranslation } from "react-i18next"
import { PageAssistProvider } from "@/components/Common/PageAssistProvider"
import { FontSizeProvider } from "@/context/FontSizeProvider"
import { QuickChatHelperButton } from "@/components/Common/QuickChatHelper"

function IndexSidepanel() {
  const { mode } = useDarkMode()
  const { t, i18n } = useTranslation()
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr")
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true
  )

  useEffect(() => {
    if (typeof document === "undefined") return
    if (i18n.resolvedLanguage) {
      document.documentElement.lang = i18n.resolvedLanguage
      const dir = i18n.dir(i18n.resolvedLanguage)
      const resolvedDirection: "ltr" | "rtl" = dir === "rtl" ? "rtl" : "ltr"
      document.documentElement.dir = resolvedDirection
      setDirection(resolvedDirection)
    }
  }, [i18n.resolvedLanguage])

  useEffect(() => {
    document.title = t('common:titles.sidepanel', { defaultValue: 'tldw Assistant — Sidebar' })
  }, [t])

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
            imageStyle={{
              height: 60
            }}
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
