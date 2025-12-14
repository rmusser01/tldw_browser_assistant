import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { SidepanelRouting } from "@/routes/firefox-route"
const queryClient = new QueryClient()
import { ConfigProvider, Empty, theme } from "antd"
import { StyleProvider } from "@ant-design/cssinjs"
import { useDarkMode } from "~/hooks/useDarkmode"
import { useSidepanelInit } from "~/hooks/useSidepanelInit"
import "~/i18n"
import { PageAssistProvider } from "@/components/Common/PageAssistProvider"
import { FontSizeProvider } from "@/context/FontSizeProvider"

function IndexSidepanel() {
  const { mode } = useDarkMode()
  const { direction, t } = useSidepanelInit({
    titleDefaultValue: "tldw Assistant — Sidebar"
  })

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
