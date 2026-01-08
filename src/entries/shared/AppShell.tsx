import React, { useEffect, useRef, useState } from "react"
import { App as AntdApp, ConfigProvider, Empty, theme } from "antd"
import { StyleProvider } from "@ant-design/cssinjs"
import { QueryClientProvider } from "@tanstack/react-query"
import { useDarkMode } from "~/hooks/useDarkmode"
import { PageAssistProvider } from "@/components/Common/PageAssistProvider"
import { FontSizeProvider } from "@/context/FontSizeProvider"
import { createQueryClient } from "@/services/query-client"

type RouterComponent = React.ComponentType<{ children: React.ReactNode }>

type AppShellProps = {
  router: RouterComponent
  direction: "ltr" | "rtl"
  emptyDescription: string
  children: React.ReactNode
  extras?: React.ReactNode
  suspendWhenHidden?: boolean
  includeAntdApp?: boolean
}

const queryClient = createQueryClient()

export const AppShell: React.FC<AppShellProps> = ({
  router: Router,
  direction,
  emptyDescription,
  children,
  extras,
  suspendWhenHidden = false,
  includeAntdApp = true
}) => {
  const { mode } = useDarkMode()
  const portalRootRef = useRef<HTMLDivElement | null>(null)
  const getPopupContainer = React.useCallback(() => {
    if (typeof document === "undefined") return undefined
    return portalRootRef.current ?? document.body
  }, [])
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true
  )

  useEffect(() => {
    if (!suspendWhenHidden || typeof document === "undefined") return
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible")
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [suspendWhenHidden])

  const content = (
    <StyleProvider hashPriority="high">
      <QueryClientProvider client={queryClient}>
        <PageAssistProvider>
          <FontSizeProvider>
            {suspendWhenHidden && !isVisible ? null : children}
            {extras}
          </FontSizeProvider>
        </PageAssistProvider>
      </QueryClientProvider>
    </StyleProvider>
  )

  return (
    <Router>
      <ConfigProvider
        theme={{
          algorithm:
            mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            fontFamily: "Arimo"
          }
        }}
        getPopupContainer={getPopupContainer}
        renderEmpty={() => (
          <Empty
            styles={{ image: { height: 60 } }}
            description={emptyDescription}
          />
        )}
        direction={direction}
      >
        {includeAntdApp ? <AntdApp>{content}</AntdApp> : content}
        <div id="tldw-portal-root" ref={portalRootRef} />
      </ConfigProvider>
    </Router>
  )
}
