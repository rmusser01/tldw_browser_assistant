import { Suspense } from "react"
import { useDarkMode } from "~/hooks/useDarkmode"
import { OptionRoutingChrome, SidepanelRoutingChrome } from "./chrome"
import { PageAssistLoader } from "@/components/Common/PageAssistLoader"

export const OptionRouting = () => {
  const { mode } = useDarkMode()

  return (
    <div className={`${mode === "dark" ? "dark" : "light"} arimo`}>
      <Suspense
        fallback={
          <PageAssistLoader
            label="Loading tldw Assistant..."
            description="Setting up your workspace"
          />
        }
      >
        <OptionRoutingChrome />
      </Suspense>
    </div>
  )
}

export const SidepanelRouting = () => {
  const { mode } = useDarkMode()

  return (
    <div className={`${mode === "dark" ? "dark" : "light"} arimo`}>
      <Suspense
        fallback={
          <PageAssistLoader
            label="Loading chat..."
            description="Preparing your assistant"
          />
        }
      >
        <SidepanelRoutingChrome />
      </Suspense>
    </div>
  )
}
