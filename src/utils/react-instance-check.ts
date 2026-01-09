import React from "react"

type DevtoolsRenderer = {
  currentDispatcherRef?: unknown
  version?: string
  rendererPackageName?: string
}

const getDevtoolsRenderers = (hook: unknown): DevtoolsRenderer[] => {
  if (!hook || typeof hook !== "object") {
    return []
  }

  const renderers = (hook as { renderers?: unknown }).renderers
  if (!renderers) {
    return []
  }

  if (renderers instanceof Map) {
    return Array.from(renderers.values()) as DevtoolsRenderer[]
  }

  if (typeof renderers === "object") {
    return Object.values(renderers as Record<string, DevtoolsRenderer>)
  }

  return []
}

export const checkReactInstance = (label: string) => {
  if (import.meta.env.PROD) {
    return
  }

  const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
  const dispatcher = internals?.ReactCurrentDispatcher
  const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
  const renderers = getDevtoolsRenderers(hook)

  if (!dispatcher) {
    console.warn(`[react-check] ${label} missing ReactCurrentDispatcher`)
    return
  }

  if (renderers.length === 0) {
    console.warn(`[react-check] ${label} no devtools renderer detected`)
    return
  }

  const mismatched = renderers.filter(
    (renderer) =>
      renderer?.currentDispatcherRef &&
      renderer.currentDispatcherRef !== dispatcher
  )

  if (mismatched.length > 0) {
    console.error(`[react-check] ${label} dispatcher mismatch`, {
      reactVersion: React.version,
      rendererVersions: renderers.map((renderer) => renderer?.version),
      rendererPackages: renderers.map(
        (renderer) => renderer?.rendererPackageName
      ),
      rendererCount: renderers.length
    })
    return
  }

  if (renderers.length > 1) {
    console.warn(`[react-check] ${label} multiple renderers detected`, {
      reactVersion: React.version,
      rendererVersions: renderers.map((renderer) => renderer?.version),
      rendererPackages: renderers.map(
        (renderer) => renderer?.rendererPackageName
      ),
      rendererCount: renderers.length
    })
  }
}
