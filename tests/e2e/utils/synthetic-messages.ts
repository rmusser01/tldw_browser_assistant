import type { Page } from "@playwright/test"

export async function injectSyntheticMessages(
  page: Page,
  count: number
): Promise<{ ok: boolean; reason?: string }> {
  return page.evaluate((cnt) => {
    const store = (window as any).__tldw_useChatStore?.getState?.()
    if (!store?.addMessage) {
      return {
        ok: false,
        reason:
          "Synthetic injection unavailable: window.__tldw_useChatStore.getState().addMessage is not exposed"
      }
    }

    for (let i = 0; i < cnt; i++) {
      const role = i % 2 === 0 ? "user" : "assistant"
      const content =
        role === "user"
          ? `Test message ${i}: ${Math.random().toString(36).substring(7)}`
          : `Response ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
            `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
            `Message number ${i} with some additional content to make it realistic.`
      store.addMessage(role, content)
    }

    return { ok: true }
  }, count)
}

