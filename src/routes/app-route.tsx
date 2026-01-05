import { Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { useDarkMode } from "~/hooks/useDarkmode"
import { PageAssistLoader } from "@/components/Common/PageAssistLoader"
import { useAutoButtonTitles } from "@/hooks/useAutoButtonTitles"
import {
  platformConfig,
  type PlatformTarget
} from "@/config/platform"
import {
  optionRoutes,
  sidepanelRoutes,
  type RouteDefinition,
  type RouteKind
} from "@/routes/route-registry"

const getRoutesForTarget = (
  routes: RouteDefinition[],
  target: PlatformTarget
) => routes.filter((route) => !route.targets || route.targets.includes(target))

const ROUTE_FALLBACKS: Record<
  RouteKind,
  { label: string; description: string }
> = {
  options: {
    label: "Loading tldw Assistant...",
    description: "Setting up your workspace"
  },
  sidepanel: {
    label: "Loading chat...",
    description: "Preparing your assistant"
  }
}

export const RouteShell = ({ kind }: { kind: RouteKind }) => {
  const { mode } = useDarkMode()
  useAutoButtonTitles()
  const { label, description } = ROUTE_FALLBACKS[kind]
  const routes = kind === "options" ? optionRoutes : sidepanelRoutes
  const visibleRoutes = getRoutesForTarget(routes, platformConfig.target)

  return (
    <div className={`${mode === "dark" ? "dark" : "light"} arimo`}>
      <Suspense fallback={<PageAssistLoader label={label} description={description} />}>
        <Routes>
          {visibleRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Suspense>
    </div>
  )
}
