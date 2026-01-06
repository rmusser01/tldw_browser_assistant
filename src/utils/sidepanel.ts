import { browser } from "wxt/browser"

type ChromeGlobal = typeof globalThis & { chrome?: typeof chrome }

const getChrome = () => (globalThis as ChromeGlobal).chrome

export const isSidepanelSupported = (): boolean => {
  const chromeGlobal = getChrome()
  if (chromeGlobal?.sidePanel?.open) return true
  const sidebar: any = (browser as any)?.sidebarAction
  return Boolean(sidebar?.open || sidebar?.toggle)
}

export const openSidepanel = async (tabId?: number): Promise<void> => {
  try {
    const chromeGlobal = getChrome()
    if (chromeGlobal?.sidePanel?.open) {
      const enableAndOpen = (id?: number) => {
        try {
          if (chromeGlobal.sidePanel.setOptions) {
            try {
              chromeGlobal.sidePanel.setOptions({
                tabId: id,
                path: "sidepanel.html",
                enabled: true
              })
            } catch {
              // ignore setOptions failures; still try to open
            }
          }
          if (id) {
            chromeGlobal.sidePanel.open({ tabId: id })
          } else {
            chromeGlobal.sidePanel.open({} as chrome.sidePanel.OpenOptions)
          }
        } catch {
          // no-op
        }
      }

      if (tabId) {
        enableAndOpen(tabId)
        return
      }

      try {
        chromeGlobal.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
          const activeTabId = tabs?.[0]?.id
          enableAndOpen(activeTabId)
        })
        return
      } catch {
        // ignore tab query failures
      }
    }

    const sidebar: any = (browser as any)?.sidebarAction
    if (sidebar?.open) {
      await sidebar.open()
      return
    }
    if (sidebar?.toggle) {
      await sidebar.toggle()
    }
  } catch {
    // ignore navigation errors
  }
}

export const openSidepanelForActiveTab = async (): Promise<void> =>
  openSidepanel()
