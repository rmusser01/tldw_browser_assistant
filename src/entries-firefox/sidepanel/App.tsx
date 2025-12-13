import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { useEffect, useState } from "react"
import { SidepanelRouting } from "@/routes/firefox-route"
const queryClient = new QueryClient()
import { ConfigProvider, Empty, theme } from "antd"
import { StyleProvider } from "@ant-design/cssinjs"
import { useDarkMode } from "~/hooks/useDarkmode"
import "~/i18n"
import { useTranslation } from "react-i18next"
import { PageAssistProvider } from "@/components/Common/PageAssistProvider"
import { FontSizeProvider } from "@/context/FontSizeProvider"

function IndexSidepanel() {
  const { mode } = useDarkMode()
  const { t, i18n } = useTranslation()
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr")

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
    if (typeof document === "undefined") return
    document.title = t('common:titles.sidepanel', { defaultValue: 'tldw Assistant' })
  }, [t])

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
        <StyleProvider hashPriority="high">
          <QueryClientProvider client={queryClient}>
            <PageAssistProvider>
              <FontSizeProvider>
                <SidepanelRouting />
              </FontSizeProvider>
            </PageAssistProvider>
          </QueryClientProvider>
        </StyleProvider>
      </ConfigProvider>
    </MemoryRouter>
  )
}

export default IndexSidepanel
