export type PlatformTarget = "chrome" | "edge" | "firefox"
export type RouterMode = "hash" | "memory"

type PlatformConfig = {
  target: PlatformTarget
  routers: {
    options: RouterMode
    sidepanel: RouterMode
  }
  features: {
    includeAntdApp: boolean
    showQuickChatHelper: boolean
    showKeyboardShortcutsModal: boolean
    suspendSidepanelWhenHidden: boolean
    suspendOptionsWhenHidden: boolean
  }
}

export const ALL_TARGETS: PlatformTarget[] = ["chrome", "edge", "firefox"]

const resolveTarget = (): PlatformTarget => {
  const raw = String(import.meta.env.BROWSER || "chrome").toLowerCase()
  if (raw === "firefox") return "firefox"
  if (raw === "edge") return "edge"
  return "chrome"
}

const target = resolveTarget()

export const isFirefoxTarget = target === "firefox"
export const isChromeTarget = target === "chrome"
export const isEdgeTarget = target === "edge"
export const isChromiumTarget = target === "chrome" || target === "edge"

export const platformConfig: PlatformConfig = {
  target,
  routers: {
    options: isFirefoxTarget ? "memory" : "hash",
    sidepanel: "memory"
  },
  features: {
    includeAntdApp: true,
    showQuickChatHelper: true,
    showKeyboardShortcutsModal: true,
    suspendSidepanelWhenHidden: true,
    suspendOptionsWhenHidden: true
  }
}
